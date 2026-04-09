#!/usr/bin/env node
/**
 * Launch Intelligence Scraper
 * Sources: SpaceFlightNow · Wikipedia · SpaceX API
 * Writes: public/launch-intel.json
 *
 * Run:       node scripts/scrape-intel.js
 * Scheduled: .github/workflows/scrape-intel.yml  (every 6 h)
 */

import { writeFileSync } from 'node:fs'
import { fileURLToPath }  from 'node:url'
import { dirname, join }  from 'node:path'
import { parse as parseHTML } from 'node-html-parser'

const __dir = dirname(fileURLToPath(import.meta.url))
const OUT   = join(__dir, '../public/launch-intel.json')
const YEAR  = new Date().getUTCFullYear()

// Mimic a real browser request
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Cache-Control': 'no-cache',
}

async function get(url, json = false) {
  const r = await fetch(url, {
    headers: json ? { 'Accept': 'application/json', 'User-Agent': HEADERS['User-Agent'] } : HEADERS,
    signal: AbortSignal.timeout(25_000),
    redirect: 'follow',
  })
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  return json ? r.json() : r.text()
}

// ─── Date helpers ─────────────────────────────────────────────────────────────
const MONTHS = {
  january:0,  february:1, march:2,    april:3,
  may:4,      june:5,     july:6,     august:7,
  september:8,october:9,  november:10,december:11,
  jan:0, feb:1, mar:2, apr:3, jun:5, jul:6,
  aug:7, sep:8, oct:9, nov:10, dec:11,
}
const TZ = { UTC:0,GMT:0,Z:0, EDT:-4,EST:-5,CDT:-5,CST:-6,MDT:-6,MST:-7,PDT:-7,PST:-8,CEST:2,CET:1,BST:1 }

function parseDateStr(str) {
  if (!str) return null
  const s = str.replace(/,?\s*\d{4}/, '').trim()
  const fwd = s.match(/([A-Za-z]+)\s+(\d{1,2})/)
  const rev = !fwd && s.match(/(\d{1,2})\s+([A-Za-z]+)/)
  const [, rawMon, rawDay] = fwd ? fwd : rev ? [rev[0], rev[2], rev[1]] : []
  if (!rawMon) return null
  const month = MONTHS[rawMon.toLowerCase()]
  if (month === undefined) return null
  const day = parseInt(rawDay, 10)
  const now = new Date()
  const year = month < now.getUTCMonth() - 2 ? YEAR + 1 : YEAR
  return new Date(Date.UTC(year, month, day))
}

function resolveUTC(base, timeStr = '') {
  if (!base) return null
  const ts = timeStr.replace(/\u00a0/g, ' ')
  // (2000 GMT) or (2000 UTC)
  let m = ts.match(/\(\s*(\d{4})\s*(?:GMT|UTC)\s*\)/)
  if (m) { const d = new Date(base); d.setUTCHours(+m[1].slice(0,2), +m[1].slice(2), 0, 0); return d.toISOString() }
  // 8:00 p.m. EDT
  m = ts.match(/(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)\s+([A-Z]{2,5})/i)
  if (m) {
    let h = +m[1]; const mn = +(m[2]||0); const ap = m[3].replace(/\./g,'').toLowerCase(); const tz = m[4].toUpperCase()
    if (ap==='pm' && h!==12) h+=12; if (ap==='am' && h===12) h=0
    const utcH = h - (TZ[tz]??0)
    const d = new Date(base)
    d.setUTCDate(d.getUTCDate() + Math.floor(utcH/24))
    d.setUTCHours(((utcH%24)+24)%24, mn, 0, 0)
    return d.toISOString()
  }
  // 2000 UTC standalone
  m = ts.match(/(\d{4})\s*(?:UTC|GMT)/)
  if (m) { const d = new Date(base); d.setUTCHours(+m[1].slice(0,2), +m[1].slice(2), 0, 0); return d.toISOString() }
  return base.toISOString()
}

// ─── SpaceFlightNow ───────────────────────────────────────────────────────────
async function scrapeSpaceFlightNow() {
  const html = await get('https://spaceflightnow.com/launch-schedule/')

  // Debug: show first 600 chars so we can spot bot-blocks or structure
  console.log('  SFN HTML preview:', html.slice(0, 600).replace(/\s+/g, ' '))

  const root = parseHTML(html)

  // Collect all class names to understand the page structure
  const classSet = new Set()
  root.querySelectorAll('[class]').forEach(el =>
    String(el.getAttribute?.('class')||'').split(/\s+/).filter(Boolean).forEach(c => classSet.add(c))
  )
  console.log('  SFN class names:', [...classSet].slice(0, 60).join(', '))

  const launches = []

  // ── Try multiple selector strategies ──────────────────────────────────────

  // Strategy 1: WordPress-style h5/strong date paragraphs (most common SFN structure)
  // Pattern: <p><strong>April 9</strong> · <strong>time</strong> | Mission / Rocket</p>
  const strongDates = root.querySelectorAll('p strong, td strong, h5 strong, p b')
  console.log(`  SFN strat1 (strong date tags): ${strongDates.length} candidates`)
  for (const el of strongDates) {
    const txt = el.text.trim()
    const base = parseDateStr(txt)
    if (!base) continue
    // Look in parent paragraph for time + rocket info
    const parent = el.parentNode
    const full = parent?.text?.replace(/\s+/g, ' ').trim() || ''
    // Extract anything after the date: "8 p.m. EDT | Spectrum / Mission"
    const afterDate = full.replace(txt, '').replace(/^\s*[·|,\s]+/, '')
    const slash = afterDate.indexOf('/')
    const rocket  = slash > -1 ? afterDate.slice(0, slash).replace(/[^A-Za-z0-9 \-]/g,'').trim() : afterDate.slice(0,40).trim()
    const mission = slash > -1 ? afterDate.slice(slash+1).split(/[|\n]/)[0].trim() : ''
    if (!rocket || rocket.length < 3) continue
    launches.push({ rocket, mission, provider:'', site:'',
      net: resolveUTC(base, afterDate),
      window: afterDate.slice(0,60),
      source:'SpaceFlightNow', sourceUrl:'https://spaceflightnow.com/launch-schedule/', confidence:'low' })
  }

  // Strategy 2: .datename CSS class (SFN theme variant)
  if (launches.length === 0) {
    const dateBlocks = root.querySelectorAll('.datename, .launchdate, [class*="date-name"], [class*="launch-date"]')
    console.log(`  SFN strat2 (.datename): ${dateBlocks.length} blocks`)
    for (const block of dateBlocks) {
      const base = parseDateStr(block.text.trim())
      if (!base) continue
      let node = block.nextElementSibling, missionText = '', timeStr = '', limit = 8
      while (node && limit-- > 0) {
        const cls = String(node.classNames||'')
        if (/datename|launchdate/.test(cls)) break
        if (/mission/.test(cls)) missionText = (node.querySelector('a')||node).text.trim()
        if (/data|detail/.test(cls)) {
          const t = node.text.replace(/\s+/g,' ')
          const tM = t.match(/(?:time|window|liftoff)[:\s]+([^\n|,]{5,40})/i)
          if (tM) timeStr = tM[1].trim()
        }
        node = node.nextElementSibling
      }
      if (!missionText) continue
      const slash = missionText.indexOf('/')
      const rocket  = (slash>-1 ? missionText.slice(0,slash) : missionText).trim()
      const mission = (slash>-1 ? missionText.slice(slash+1) : missionText).trim()
      launches.push({ rocket, mission, provider:'', site:'',
        net: resolveUTC(base, timeStr), window: timeStr||block.text.trim(),
        source:'SpaceFlightNow', sourceUrl:'https://spaceflightnow.com/launch-schedule/', confidence: timeStr?'high':'low' })
    }
  }

  // Strategy 3: table rows with date + rocket
  if (launches.length === 0) {
    const rows = root.querySelectorAll('tr')
    console.log(`  SFN strat3 (table rows): ${rows.length} rows`)
    for (const row of rows) {
      const cells = row.querySelectorAll('td')
      if (cells.length < 2) continue
      const base = parseDateStr(cells[0].text.trim())
      if (!base) continue
      const rocket = cells[1].text.replace(/\s+/g,' ').trim().slice(0,60)
      const mission = cells[2]?.text?.replace(/\s+/g,' ').trim().slice(0,80) || rocket
      if (!rocket || rocket.length < 3) continue
      launches.push({ rocket, mission, provider:'', site:'',
        net: base.toISOString(), window:'',
        source:'SpaceFlightNow', sourceUrl:'https://spaceflightnow.com/launch-schedule/', confidence:'low' })
    }
  }

  console.log(`  SFN total: ${launches.length}`)
  return launches
}

// ─── Wikipedia ────────────────────────────────────────────────────────────────
async function scrapeWikipedia() {
  // Try current year, fall back to next year if article doesn't exist
  for (const yr of [YEAR, YEAR-1]) {
    const url = `https://en.wikipedia.org/w/api.php?action=parse&page=List_of_orbital_launches_of_${yr}&prop=text&formatversion=2&format=json&disableeditsection=1`
    let data
    try { data = await get(url, true) } catch { continue }
    const articleHtml = data?.parse?.text
    if (!articleHtml) { console.log(`  Wikipedia ${yr}: no article text`); continue }

    console.log(`  Wikipedia ${yr} HTML preview:`, articleHtml.slice(0, 300).replace(/\s+/g,' '))

    const root = parseHTML(articleHtml)
    const launches = []

    // Find all wikitables
    const tables = root.querySelectorAll('table.wikitable, table.sortable, table[class*="wikitable"]')
    console.log(`  Wikipedia ${yr}: ${tables.length} tables`)

    for (const table of tables) {
      const rows = table.querySelectorAll('tr')
      if (rows.length < 3) continue

      // Detect columns from header row
      const thRow = rows.find(r => r.querySelectorAll('th').length > 2)
      if (!thRow) continue
      const headers = thRow.querySelectorAll('th').map(th => th.text.trim().toLowerCase())
      console.log(`  Wikipedia table headers: ${headers.slice(0,8).join(' | ')}`)

      const col = (patterns) => headers.findIndex(h => patterns.some(p => h.includes(p)))
      const dateCol    = col(['date','day','launch date'])
      const rocketCol  = col(['rocket','vehicle','launch vehicle','carrier rocket'])
      const payloadCol = col(['payload','mission','spacecraft','satellite'])
      const siteCol    = col(['site','pad','location','launch site'])
      const opCol      = col(['operator','provider','agency','customer'])

      if (dateCol === -1 && rocketCol === -1) {
        console.log(`  Wikipedia: skipping table — no date/rocket columns in: ${headers.join('|')}`)
        continue
      }

      for (let i = 1; i < rows.length; i++) {
        const cells = rows[i].querySelectorAll('td, th')
        if (cells.length < 2) continue
        const gc = (idx) => idx >= 0 && idx < cells.length
          ? cells[idx].text.replace(/\[[\d\s*†‡]+\]/g,'').replace(/\s+/g,' ').trim()
          : ''

        const rawDate  = gc(dateCol  >= 0 ? dateCol  : 0)
        const rocket   = gc(rocketCol >= 0 ? rocketCol : 1).slice(0,60)
        const mission  = gc(payloadCol >= 0 ? payloadCol : Math.min(2, cells.length-1)).slice(0,80)
        const site     = gc(siteCol  >= 0 ? siteCol  : -1).slice(0,80)
        const provider = gc(opCol    >= 0 ? opCol    : -1).slice(0,60)

        const base = parseDateStr(rawDate)
        if (!base || !rocket || rocket.length < 2) continue
        // Skip launches more than 3 days in the past
        if (base.getTime() < Date.now() - 3*86400000) continue

        launches.push({ rocket, mission: mission||rocket, provider, site,
          net: base.toISOString(), window:'',
          source:`Wikipedia (${yr})`,
          sourceUrl:`https://en.wikipedia.org/wiki/List_of_orbital_launches_of_${yr}`,
          confidence:'low' })
      }
    }

    if (launches.length > 0) {
      console.log(`  Wikipedia ${yr}: ${launches.length} launches`)
      return launches
    }
    console.log(`  Wikipedia ${yr}: 0 launches parsed`)
  }
  return []
}

// ─── SpaceX API (bonus — reliable JSON, no scraping needed) ──────────────────
async function scrapeSpaceX() {
  const data = await get('https://api.spacexdata.com/v4/launches/upcoming', true)
  if (!Array.isArray(data)) throw new Error('Unexpected response format')
  return data
    .filter(l => l.date_utc && l.name)
    .map(l => ({
      rocket:  'Falcon 9',        // SpaceX only launches Falcon 9 / Heavy in upcoming
      mission: l.name,
      provider:'SpaceX',
      site:    l.launchpad || '',
      net:     l.date_utc,
      window:  l.date_precision || '',
      source:  'SpaceX API',
      sourceUrl:'https://api.spacexdata.com/v4/launches/upcoming',
      confidence: l.date_precision === 'hour' ? 'high' : 'low',
    }))
}

// ─── De-duplicate ─────────────────────────────────────────────────────────────
function dedup(launches) {
  const map = new Map()
  for (const l of launches) {
    const key = `${l.rocket.toLowerCase()}|${(l.mission||'').toLowerCase().slice(0,30)}`
    const ex = map.get(key)
    if (!ex || l.confidence === 'high') map.set(key, l)
  }
  return [...map.values()]
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const sources = [
    { name:'SpaceFlightNow', fn: scrapeSpaceFlightNow },
    { name:'Wikipedia',      fn: scrapeWikipedia },
    { name:'SpaceX API',     fn: scrapeSpaceX },
  ]

  const all = []
  for (const { name, fn } of sources) {
    try {
      const results = await fn()
      console.log(`✓ ${name}: ${results.length} launches`)
      all.push(...results)
    } catch (err) {
      console.warn(`✗ ${name}: ${err.message}`)
    }
  }

  const combined = dedup(all.filter(l => l.rocket?.length > 1))
  combined.sort((a,b) => (a.net||'').localeCompare(b.net||''))

  writeFileSync(OUT, JSON.stringify({
    updated:  new Date().toISOString(),
    sources:  sources.map(s => s.name),
    launches: combined,
  }, null, 2))

  console.log(`\nTotal: ${combined.length} launches written to ${OUT}`)
}

main().catch(err => { console.error('Fatal:', err); process.exit(1) })
