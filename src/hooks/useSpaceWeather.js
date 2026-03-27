import { useState, useEffect } from 'react'

const SWPC = 'https://services.swpc.noaa.gov/json'
const CACHE = {}
const TTL = 5 * 60 * 1000 // 5 min

async function cachedFetch(url) {
  if (CACHE[url] && Date.now() - CACHE[url].ts < TTL) return CACHE[url].data
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = await res.json()
  CACHE[url] = { data, ts: Date.now() }
  return data
}

function kpLevel(kp) {
  if (kp >= 8) return { label: 'Severe', color: '#ff1744', short: 'G4-G5' }
  if (kp >= 6) return { label: 'Strong', color: '#ff6d00', short: 'G2-G3' }
  if (kp >= 5) return { label: 'Minor Storm', color: '#ffd740', short: 'G1' }
  if (kp >= 4) return { label: 'Active', color: '#ffe082', short: 'Active' }
  if (kp >= 2) return { label: 'Quiet', color: '#00e676', short: 'Quiet' }
  return { label: 'Very Quiet', color: '#00c8f0', short: 'Calm' }
}

export function useSpaceWeather() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    Promise.all([
      cachedFetch(`${SWPC}/planetary_k_index_1m.json`),
      cachedFetch(`${SWPC}/alerts.json`),
    ])
      .then(([kpArr, alerts]) => {
        if (cancelled) return

        // Latest Kp: last entry in the array
        const latestKp = kpArr?.length
          ? kpArr[kpArr.length - 1]?.kp_index ?? null
          : null

        // Past 24h Kp for sparkline
        const recent = (kpArr || []).slice(-24 * 60) // last 24h of 1-min data
        const hourly = []
        for (let i = recent.length - 1; i >= 0; i -= 60) {
          hourly.unshift(recent[i]?.kp_index ?? 0)
          if (hourly.length >= 24) break
        }

        // Filter active space weather alerts (not older than 24h)
        const activeAlerts = (alerts || []).filter(a => {
          const issued = new Date(a.issue_datetime || a.issued || 0)
          return Date.now() - issued.getTime() < 24 * 3600 * 1000
            && !a.message?.toLowerCase().includes('cancel')
        }).slice(0, 3)

        const level = latestKp != null ? kpLevel(latestKp) : null

        setData({ kp: latestKp, level, hourly, alerts: activeAlerts })
        setError(null)
      })
      .catch(e => { if (!cancelled) setError(e.message) })
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [])

  return { data, loading, error }
}
