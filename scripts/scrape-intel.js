#!/usr/bin/env node
/**
 * Launch Intelligence Scraper
 * Pulls launch dates from SpaceFlightNow and Wikipedia,
 * normalises them, and writes public/launch-intel.json.
 *
 * Run manually:  node scripts/scrape-intel.js
 * Scheduled:     .github/workflows/scrape-intel.yml  (every 6 hours)
 */

import { writeFileSync } from 'node:fs'
import { fileURLToPath }  from 'node:url'
import { dirname, join }  from 'node:path'
import { parse as parseHTML } from 'node-html-parser'

const __dir = dirname(fileURLToPath(import.meta.url))
const OUT   = join(__dir, '../public/launch-intel.json')
const YEAR  = new Date().getUTCFullYear()

const UA = 'Mozilla/5.0 (compatible; RocketDB-Intel/1.0; +https://nks648.github.io/RocketDB)'

// ─────────────────────────────────────────────────────────────────────────────
// HTTP helpers
// ─────────────────────────────────────────────────────────────────────────────
async function get(url, json = false) {
  const r = await fetch(url, {
    headers: {
      'User-Agent': UA,
      'Accept': json ? 'application/json' : 'text/html,application/xhtml+xml,*/*',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    signal: AbortSignal.timeout(25_000),
  })
  if (!r.ok) throw new Error(`HTTP ${r.status} — ${url}`)
  return json ? r.json() : r.text()
}

// ─────────────────────────────────────────────────────────────────────────────
// Date / time helpers
// ─────────────────────────────────────────────────────────────────────────────
const MONTHS = {
  january:0,  february:1, march:2,    april:3,
  may:4,      june:5,     july:6,     august:7,
  september:8,october:9,  november:10,december:11,
  jan:0, feb:1, mar:2, apr:3, jun:5, jul:6,
  aug:7, sep:8, oct:9, nov:10, dec:11,
}

const TZ_OFFSET = {
  UTC:0, GMT:0, Z:0,
  EDT:-4, EST:-5, CDT:-5, CST:-6,
  MDT:-6, MST:-7, PDT:-7, PST:-8,
  CEST:2, CET:1, BST:1,
}

/** "April 9" or "9 April" or "April 9, 2025" → Date UTC midnight */
function parseDateStr(str) {
  if (!str) return null
  const s = str.trim().replace(/,?\s*\d{4}/, '') // strip year
  // "April 9" or "Apr 9"
  let m = s.match(/([A-Za-z]+)\s+(\d{1,2})/)
  if (!m) {
    // "9 April"
    m = s.match(/(\d{1,2})\s+([A-Za-z]+)/)
    if (m) m = [m[0], m[2], m[1]] // reorder to [full, month, day]
  }
  if (!m) return null
  const month = MONTHS[m[1].toLowerCase()]
  if (month === undefined) return null
  const day = parseInt(m[2], 10)
  const now = new Date()
  const year = (month < now.getUTCMonth() - 2) ? YEAR + 1 : YEAR
  return new Date(Date.UTC(year, month, day))
}

/** Extract UTC ISO from a time string + a base Date */
function resolveUTC(baseDate, timeStr) {
  if (!baseDate) return null
  if (!timeStr) return baseDate.toISOString()
  const ts = timeStr.replace(/\u00a0/g, ' ')

  // Prefer "(2000 UTC)" or "(2000 GMT)" in parentheses
  const utcParen = ts.match(/\(\s*(\d{4})\s*(GMT|UTC)\s*\)/)
  if (utcParen) {
    const h = parseInt(utcParen[1].slice(0, 2), 10)
    const mn = parseInt(utcParen[1].slice(2), 10)
    const d = new Date(baseDate); d.setUTCHours(h, mn, 0, 0)
    return d.toISOString()
  }

  // "8:00 p.m. EDT" or "8 p.m. EDT"
  const local = ts.match(/(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)\s+([A-Z]{2,5})/i)
  if (local) {
    let h = parseInt(local[1], 10)
    const mn = parseInt(local[2] || '0', 10)
    const ap = local[3].replace(/\./g, '').toLowerCase()
    const tz = local[4].toUpperCase()
    if (ap === 'pm' && h !== 12) h += 12
    if (ap === 'am' && h === 12) h = 0
    const offset = TZ_OFFSET[tz] ?? 0
    const utcH = h - offset
    const d = new Date(baseDate)
    d.setUTCDate(d.getUTCDate() + Math.floor(utcH / 24))
    d.setUTCHours(((utcH % 24) + 24) % 24, mn, 0, 0)
    return d.toISOString()
  }

  // "2000 UTC" standalone
  const bare = ts.match(/(\d{4})\s*(UTC|GMT)/)
  if (bare) {
    const h = parseInt(bare[1].slice(0, 2), 10)
    const mn = parseInt(bare[1].slice(2), 10)
    const d = new Date(baseDate); d.setUTCHours(h, mn, 0, 0)
    return d.toISOString()
  }

  return baseDate.toISOString()
}

// ─────────────────────────────────────────────────────────────────────────────
// Source 1 — SpaceFlightNow launch schedule
// ─────────────────────────────────────────────────────────────────────────────
async function scrapeSpaceFlightNow() {
  const html = await get('https://spaceflightnow.com/launch-schedule/')
  const root = parseHTML(html)

  // ── Debug: log top-level class names so we can see the actual structure ──
  const allClasses = new Set()
  root.querySelectorAll('[class]').forEach(el => {
    String(el.classNames || el.getAttribute?.('class') || '').split(/\s+/).forEach(c => { if (c) allClasses.add(c) })
  })
  console.log('  SFN classes found:', [...allClasses].slice(0, 40).join(', '))

  const launches = []

  // ── Strategy A: look for .datename blocks (original approach) ──
  const dateBlocks = root.querySelectorAll('.datename')
  console.log(`  SFN strategy A (.datename): ${dateBlocks.length} blocks`)

  if (dateBlocks.length > 0) {
    for (const dateBlock of dateBlocks) {
      const rawDate = dateBlock.text.trim().replace(/\s+/g, ' ')
      const baseDate = parseDateStr(rawDate)
      if (!baseDate) continue

      let node = dateBlock.nextElementSibling
      let missionName = '', timeStr = '', site = ''
      let limit = 8
      while (node && limit-- > 0) {
        const cls = String(node.classNames || '')
        if (cls.includes('datename')) break
        if (cls.includes('missionname') || cls.includes('mission')) {
          missionName = (node.querySelector('a') || node).text.trim()
        }
        if (cls.includes('missiondata') || cls.includes('data')) {
          const txt = node.text.replace(/\s+/g, ' ')
          const tM = txt.match(/(?:time|window|liftoff)[:\s]+([^\n|,]{5,40})/i)
          const sM = txt.match(/(?:site|pad)[:\s]+([^\n|]{5,80})/i)
          if (tM) timeStr = tM[1].trim()
          if (sM) site    = sM[1].trim()
        }
        node = node.nextElementSibling
      }
      if (!missionName) continue
      const slash = missionName.indexOf('/')
      const rocket  = (slash > -1 ? missionName.slice(0, slash) : missionName).trim()
      const mission = (slash > -1 ? missionName.slice(slash + 1) : missionName).trim()
      launches.push({
        rocket, mission, provider:'', site,
        net: resolveUTC(baseDate, timeStr),
        window: timeStr || rawDate,
        source: 'SpaceFlightNow',
        sourceUrl: 'https://spaceflightnow.com/launch-schedule/',
        confidence: timeStr ? 'high' : 'low',
      })
    }
    if (launches.length > 0) return launches
  }

  // ── Strategy B: look for <h5> tags containing month names ──
  console.log('  SFN strategy B (h5 date scan)...')
  const h5s = root.querySelectorAll('h5, h4, h3')
  const monthRe = /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2}/i
  for (const h of h5s) {
    const txt = h.text.trim()
    if (!monthRe.test(txt)) continue
    const baseDate = parseDateStr(txt)
    if (!baseDate) continue

    // Look at next siblings for mission info
    let sib = h.nextElementSibling
    let missionText = '', limit = 6
    while (sib && limit-- > 0) {
      const sibTxt = sib.text.trim()
      if (monthRe.test(sibTxt)) break
      if (sibTxt.length > 3 && sibTxt.length < 120) {
        missionText = sibTxt; break
      }
      sib = sib.nextElementSibling
    }
    if (!missionText) continue
    const slash = missionText.indexOf('/')
    const rocket  = (slash > -1 ? missionText.slice(0, slash) : missionText).trim()
    const mission = (slash > -1 ? missionText.slice(slash + 1) : missionText).trim()
    launches.push({
      rocket, mission, provider:'', site:'',
      net: baseDate.toISOString(), window: txt,
      source: 'SpaceFlightNow',
      sourceUrl: 'https://spaceflightnow.com/launch-schedule/',
      confidence: 'low',
    })
  }
  console.log(`  SFN strategy B: ${launches.length} launches`)

  // ── Strategy C: plain text scan ──
  if (launches.length === 0) {
    console.log('  SFN strategy C (text scan)...')
    const bodyText = root.querySelector('article, .entry-content, main, body')?.text || root.text
    // Find blocks: "Month Day" then next line with rocket name
    const blockRe = /\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{1,2})\b([^]*?)(?=\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2}\b|$)/gi
    let bm
    while ((bm = blockRe.exec(bodyText)) !== null && launches.length < 50) {
      const dateStr = `${bm[1]} ${bm[2]}`
      const baseDate = parseDateStr(dateStr)
      if (!baseDate) continue
      const block = bm[3].trim().slice(0, 300)
      // Try to extract rocket name — look for known patterns
      const vehM = block.match(/(?:vehicle|rocket)[:\s]+([A-Za-z0-9 \-]+)/i)
        || block.match(/^([A-Z][A-Za-z0-9 \-]{2,30})\s*[\/|]/)
      if (!vehM) continue
      const rocket = vehM[1].trim()
      const timeM = block.match(/\d{4}\s*(?:UTC|GMT)/i) || block.match(/\d{1,2}(?::\d{2})?\s*[ap]\.?m\.?\s+[A-Z]{2,4}/i)
      const timeStr = timeM?.[0] || ''
      launches.push({
        rocket, mission: rocket, provider:'', site:'',
        net: resolveUTC(baseDate, timeStr),
        window: timeStr || dateStr,
        source: 'SpaceFlightNow',
        sourceUrl: 'https://spaceflightnow.com/launch-schedule/',
        confidence: 'low',
      })
    }
    console.log(`  SFN strategy C: ${launches.length} launches`)
  }

  return launches
}

// ─────────────────────────────────────────────────────────────────────────────
// Source 2 — Wikipedia orbital launches list (HTML table parsing)
// ─────────────────────────────────────────────────────────────────────────────
async function scrapeWikipedia() {
  // Use the HTML version of the article — far more reliable than raw wikitext
  const url =
    `https://en.wikipedia.org/w/api.php` +
    `?action=parse&page=List_of_orbital_launches_of_${YEAR}` +
    `&prop=text&formatversion=2&format=json&disableeditsection=1`

  const data = await get(url, true)
  const articleHtml = data?.parse?.text
  if (!articleHtml) throw new Error('No article HTML returned')

  const root = parseHTML(articleHtml)
  const launches = []

  // Wikipedia orbital launch tables have structure:
  // <table class="wikitable">
  //   <tr> <th>Date</th> <th>Rocket</th> <th>Payload</th> ... </tr>
  //   <tr> <td>9 April</td> <td>Spectrum</td> <td>Onward and Upward</td> ... </tr>
  // </table>
  const tables = root.querySelectorAll('table.wikitable, table.sortable')
  console.log(`  Wikipedia: ${tables.length} wikitables found`)

  for (const table of tables) {
    const rows = table.querySelectorAll('tr')
    if (rows.length < 2) continue

    // Detect column positions from header row
    const headerRow = rows[0]
    const headers = headerRow.querySelectorAll('th').map(th => th.text.trim().toLowerCase())
    console.log(`  Wikipedia table headers: ${headers.slice(0,8).join(' | ')}`)

    // Flexible column detection
    const dateCol    = headers.findIndex(h => /date|day/.test(h))
    const rocketCol  = headers.findIndex(h => /rocket|vehicle|launch vehicle|carrier/.test(h))
    const payloadCol = headers.findIndex(h => /payload|mission|spacecraft/.test(h))
    const siteCol    = headers.findIndex(h => /site|pad|location/.test(h))
    const opCol      = headers.findIndex(h => /operator|provider|agency/.test(h))

    if (dateCol === -1 && rocketCol === -1) continue // not a launch table

    for (let i = 1; i < rows.length; i++) {
      const cells = rows[i].querySelectorAll('td')
      if (cells.length < 2) continue

      const getCell = idx => idx >= 0 && idx < cells.length
        ? cells[idx].text.replace(/\[[\d\s]+\]/g, '').replace(/\s+/g, ' ').trim()
        : ''

      const rawDate   = getCell(dateCol   >= 0 ? dateCol   : 0)
      const rocket    = getCell(rocketCol >= 0 ? rocketCol : 1).slice(0, 60)
      const payload   = getCell(payloadCol >= 0 ? payloadCol : 2).slice(0, 80)
      const site      = getCell(siteCol   >= 0 ? siteCol   : -1).slice(0, 80)
      const provider  = getCell(opCol     >= 0 ? opCol     : -1).slice(0, 60)

      const baseDate = parseDateStr(rawDate)
      if (!baseDate || !rocket || rocket.length < 2) continue

      // Skip past launches (more than 3 days ago)
      if (baseDate.getTime() < Date.now() - 3 * 86400000) continue

      launches.push({
        rocket, mission: payload || rocket, provider, site,
        net: baseDate.toISOString(), window: '',
        source: 'Wikipedia',
        sourceUrl: `https://en.wikipedia.org/wiki/List_of_orbital_launches_of_${YEAR}`,
        confidence: 'low',
      })
    }
  }

  return launches
}

// ─────────────────────────────────────────────────────────────────────────────
// De-duplicate: keep highest-confidence entry per rocket+mission pair
// ─────────────────────────────────────────────────────────────────────────────
function dedup(launches) {
  const map = new Map()
  for (const l of launches) {
    const key = `${l.rocket.toLowerCase()}|${l.mission.toLowerCase().slice(0, 30)}`
    const existing = map.get(key)
    if (!existing || l.confidence === 'high') map.set(key, l)
  }
  return [...map.values()]
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  const sources = [
    { name: 'SpaceFlightNow', fn: scrapeSpaceFlightNow },
    { name: 'Wikipedia',      fn: scrapeWikipedia },
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

  const valid    = all.filter(l => l.rocket && l.rocket.length > 1)
  const combined = dedup(valid)
  combined.sort((a, b) => (a.net || '').localeCompare(b.net || ''))

  const output = {
    updated:  new Date().toISOString(),
    sources:  sources.map(s => s.name),
    launches: combined,
  }

  writeFileSync(OUT, JSON.stringify(output, null, 2))
  console.log(`\nWrote ${combined.length} launches → ${OUT}`)
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})
