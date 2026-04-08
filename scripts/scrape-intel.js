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

const UA = 'RocketDB-Intel/1.0 (nks648.github.io/RocketDB; educational, low-frequency)'

// ─────────────────────────────────────────────────────────────────────────────
// HTTP helper
// ─────────────────────────────────────────────────────────────────────────────
async function get(url, json = false) {
  const r = await fetch(url, {
    headers: {
      'User-Agent': UA,
      'Accept': json ? 'application/json' : 'text/html,application/xhtml+xml,*/*',
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
  january:0, february:1, march:2, april:3, may:4, june:5,
  july:6, august:7, september:8, october:9, november:10, december:11,
  jan:0, feb:1, mar:2, apr:3, jun:5, jul:6, aug:7, sep:8, oct:9, nov:10, dec:11,
}

const TZ_OFFSET = {
  UTC:0, GMT:0, Z:0,
  EDT:-4, EST:-5, CDT:-5, CST:-6,
  MDT:-6, MST:-7, PDT:-7, PST:-8,
  CEST:2, CET:1, BST:1, IST:5.5,
}

/** "April 9" → Date (UTC midnight) — handles year roll-over */
function parseDateStr(str) {
  const m = str.match(/([A-Za-z]+)\s+(\d{1,2})/)
  if (!m) return null
  const month = MONTHS[m[1].toLowerCase()]
  if (month === undefined) return null
  const day = parseInt(m[2], 10)
  const now = new Date()
  // If parsed month is ≥2 months in the past → must be next year
  const year = (month < now.getUTCMonth() - 1) ? YEAR + 1 : YEAR
  return new Date(Date.UTC(year, month, day))
}

/** Extract best UTC ISO from a SFN-style time string + a base date */
function resolveUTC(baseDate, timeStr) {
  if (!baseDate || !timeStr) return null
  const ts = timeStr.replace(/\u00a0/g, ' ')

  // Prefer explicit UTC/GMT in parentheses: "(2000 UTC)" or "(2000 GMT)"
  const utcParen = ts.match(/\(\s*(\d{4})\s*(GMT|UTC)\s*\)/)
  if (utcParen) {
    const h = parseInt(utcParen[1].slice(0, 2), 10)
    const mn = parseInt(utcParen[1].slice(2), 10)
    const d = new Date(baseDate)
    d.setUTCHours(h, mn, 0, 0)
    return d.toISOString()
  }

  // Try local time "8:00 p.m. EDT" or "8 p.m. EDT"
  const local = ts.match(/(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)\s+([A-Z]{2,5})/i)
  if (local) {
    let h  = parseInt(local[1], 10)
    const mn = parseInt(local[2] || '0', 10)
    const ap = local[3].replace(/\./g, '').toLowerCase()
    const tz = local[4].toUpperCase()
    if (ap === 'pm' && h !== 12) h += 12
    if (ap === 'am' && h === 12) h = 0
    const offset = TZ_OFFSET[tz] ?? 0
    const utcH = h - offset
    const d = new Date(baseDate)
    // Adjust day if UTC hour overflows
    d.setUTCDate(d.getUTCDate() + Math.floor(utcH / 24))
    d.setUTCHours(((utcH % 24) + 24) % 24, mn, 0, 0)
    return d.toISOString()
  }

  // Time as "HHMM UTC" standalone
  const bare = ts.match(/(\d{4})\s*(UTC|GMT)/)
  if (bare) {
    const h = parseInt(bare[1].slice(0, 2), 10)
    const mn = parseInt(bare[1].slice(2), 10)
    const d = new Date(baseDate)
    d.setUTCHours(h, mn, 0, 0)
    return d.toISOString()
  }

  // Just return midnight UTC for the date
  return baseDate.toISOString()
}

// ─────────────────────────────────────────────────────────────────────────────
// Source 1 — SpaceFlightNow launch schedule
// ─────────────────────────────────────────────────────────────────────────────
async function scrapeSpaceFlightNow() {
  const html = await get('https://spaceflightnow.com/launch-schedule/')
  const root = parseHTML(html)
  const launches = []

  // SFN page structure:
  //   <div class="datename">…date text…</div>
  //   <div class="missionname"><h5>Rocket / Mission</h5></div>
  //   <div class="missiondata">…time, site, vehicle…</div>
  // Blocks repeat for each launch.

  const dateBlocks = root.querySelectorAll('.datename, [class*="datename"]')
  console.log(`  SFN: found ${dateBlocks.length} date blocks`)

  for (const dateBlock of dateBlocks) {
    const rawDate = dateBlock.text.trim().replace(/\s+/g, ' ')
    if (!rawDate || /no launch|tbd/i.test(rawDate)) continue
    const baseDate = parseDateStr(rawDate)
    if (!baseDate) continue

    // Walk forward to find the next .missionname and .missiondata siblings
    let node = dateBlock.nextElementSibling
    let missionName = ''
    let timeStr     = ''
    let site        = ''
    let vehicle     = ''
    let safetyLimit = 0

    while (node && safetyLimit++ < 8) {
      const cls = (node.classNames || '').toString()

      if (cls.includes('datename')) break           // next launch block

      if (cls.includes('missionname') || cls.includes('mission-name')) {
        missionName = (node.querySelector('a') || node).text.trim()
      }

      if (cls.includes('missiondata') || cls.includes('mission-data') || cls.includes('missionDetails')) {
        const txt = node.text.replace(/\s+/g, ' ')
        const timeM = txt.match(/[Ll]aunch\s+time[:\s]+([^|,\n]{5,40})/i)
          || txt.match(/[Ww]indow[:\s]+([^|,\n]{5,40})/i)
          || txt.match(/[Ll]iftoff[:\s]+([^|,\n]{5,40})/i)
        const siteM  = txt.match(/[Ll]aunch\s+site[:\s]+([^\n|]{5,80})/i)
          || txt.match(/[Ss]ite[:\s]+([^\n|]{5,80})/i)
        const vehM   = txt.match(/[Vv]ehicle[:\s]+([^\n|]{3,50})/i)
          || txt.match(/[Rr]ocket[:\s]+([^\n|]{3,50})/i)
        timeStr = timeM?.[1]?.trim() || ''
        site    = siteM?.[1]?.trim() || ''
        vehicle = vehM?.[1]?.trim()  || ''
      }

      node = node.nextElementSibling
    }

    if (!missionName) continue

    // "Spectrum / Onward and Upward" → rocket=Spectrum, mission=Onward and Upward
    const slash = missionName.indexOf('/')
    let rocket  = (slash > -1 ? missionName.slice(0, slash) : missionName).trim()
    let mission = (slash > -1 ? missionName.slice(slash + 1) : missionName).trim()
    if (vehicle && !rocket) rocket = vehicle

    const net = resolveUTC(baseDate, timeStr)

    launches.push({
      rocket,
      mission,
      provider: '',
      site,
      net,
      window: timeStr || rawDate,
      source: 'SpaceFlightNow',
      sourceUrl: 'https://spaceflightnow.com/launch-schedule/',
      confidence: timeStr && net ? 'high' : 'low',
    })
  }

  return launches
}

// ─────────────────────────────────────────────────────────────────────────────
// Source 2 — Wikipedia "List of orbital launches of YEAR"
// ─────────────────────────────────────────────────────────────────────────────
async function scrapeWikipedia() {
  const url =
    `https://en.wikipedia.org/w/api.php` +
    `?action=parse&page=List_of_orbital_launches_of_${YEAR}` +
    `&prop=wikitext&formatversion=2&format=json`

  const data = await get(url, true)
  const wikitext = data?.parse?.wikitext
  if (!wikitext) throw new Error('No wikitext returned')

  const launches = []

  // Rows look like:
  // | {{dts|2025|4|9}} || Spectrum || Onward and Upward || Andøya || ISAR || ...
  // or
  // | {{date|2025|April|9|...}} || ...
  const rowRe = /\|\s*\{\{(?:dts|date)\|(\d{4})\|(\w+)\|(\d{1,2})[^}]*\}\}\s*\|\|([^\n]+)/g
  let m
  while ((m = rowRe.exec(wikitext)) !== null) {
    const [, yr, mon, day, rest] = m
    const monthNum = MONTHS[mon.toLowerCase()] ?? (parseInt(mon, 10) - 1)
    if (monthNum === undefined || isNaN(monthNum)) continue

    const cells = rest.split('||').map(c =>
      c.replace(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g, '$1')
       .replace(/\{\{[^}]+\}\}/g, '')
       .replace(/[*'<>]/g, '')
       .trim()
    )

    const rocket   = cells[0] || ''
    const mission  = cells[1] || ''
    const site     = cells[2] || ''
    const provider = cells[3] || ''

    if (!rocket || rocket.length < 2) continue

    const net = new Date(Date.UTC(parseInt(yr, 10), monthNum, parseInt(day, 10))).toISOString()

    launches.push({
      rocket:  rocket.slice(0, 60),
      mission: mission.slice(0, 80),
      provider: provider.slice(0, 60),
      site:    site.slice(0, 80),
      net,
      window:  '',
      source:  'Wikipedia',
      sourceUrl: `https://en.wikipedia.org/wiki/List_of_orbital_launches_of_${YEAR}`,
      confidence: 'low',   // Wikipedia dates are often approximate
    })
  }

  return launches
}

// ─────────────────────────────────────────────────────────────────────────────
// Source 3 — NASASpaceFlight (NSF) launch schedule JSON
// They expose a machine-readable endpoint used by their own site
// ─────────────────────────────────────────────────────────────────────────────
async function scrapeNSF() {
  // NSF doesn't have a public API; skip gracefully
  return []
}

// ─────────────────────────────────────────────────────────────────────────────
// De-duplicate: keep highest-confidence entry per rocket+mission pair
// ─────────────────────────────────────────────────────────────────────────────
function dedup(launches) {
  const map = new Map()
  for (const l of launches) {
    const key = `${l.rocket.toLowerCase()}|${l.mission.toLowerCase()}`
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
    { name: 'NSF',            fn: scrapeNSF },
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

  // Sort by net date ascending
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
