import { useState, useEffect, useCallback } from 'react'

const LL2_BASE  = 'https://lldev.thespacedevs.com/2.2.0' // dev server — higher rate limits, same data
const CACHE_TTL = 15 * 60 * 1000  // 15 min → 8 req/hr (limit: 15/hr)
const LS_PREFIX = 'rocketdb:ll2:'  // localStorage key prefix

// ── Persistent cache (survives page refresh) ──────────────────────────────
function lsGet(url) {
  try {
    const raw = localStorage.getItem(LS_PREFIX + url)
    if (!raw) return null
    return JSON.parse(raw) // { data, ts }
  } catch { return null }
}

function lsSet(url, data) {
  try {
    localStorage.setItem(LS_PREFIX + url, JSON.stringify({ data, ts: Date.now() }))
  } catch { /* storage full — silent fail */ }
}

// ── Fetch with localStorage-backed TTL cache ──────────────────────────────
async function fetchWithCache(url) {
  const stored = lsGet(url)

  // Fresh cache hit — no network needed
  if (stored && Date.now() - stored.ts < CACHE_TTL) {
    return stored.data
  }

  let res
  try {
    res = await fetch(url)
  } catch (e) {
    // Network failure — serve stale cache if available
    if (stored) return stored.data
    throw new Error('Network error — check connection')
  }

  if (res.status === 429) {
    // Rate limited — always serve whatever we have stored (even expired)
    if (stored) return stored.data
    throw new Error('API rate limit reached — please wait a few minutes and refresh')
  }

  if (!res.ok) throw new Error(`API error ${res.status}`)

  const data = await res.json()
  lsSet(url, data)
  return data
}

// Statuses that mean a launch is truly over
const FINAL_STATUSES = new Set([3, 4, 7]) // Success, Failure, Partial Failure

// How long after NET before a still-"GO" launch is treated as "launched, result pending"
const INFLIGHT_GRACE_MS = 30 * 60 * 1000 // 30 min

// ── Hook ──────────────────────────────────────────────────────────────────
export function useLaunches() {
  const [upcoming,    setUpcoming]    = useState([])
  const [previous,    setPrevious]    = useState([])
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState(null)
  const [lastUpdated, setLastUpdated] = useState(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [upRes, prevRes] = await Promise.all([
        fetchWithCache(`${LL2_BASE}/launch/upcoming/?format=json&limit=20&mode=detailed`),
        fetchWithCache(`${LL2_BASE}/launch/previous/?format=json&limit=20&ordering=-net&mode=detailed`),
      ])

      const upcomingResults = upRes.results || []
      const previousResults = prevRes.results || []
      const now = Date.now()

      // ── Classify /upcoming/ results ──────────────────────────────────────
      // Some entries are "GO" (status 1) but their NET is well in the past —
      // the rocket has launched but LL2 hasn't confirmed the result yet.
      // Move those to the Previous tab so Upcoming stays clean.
      const pastNetGo = upcomingResults.filter(l =>
        l.status?.id === 1 &&
        l.net &&
        new Date(l.net).getTime() < now - INFLIGHT_GRACE_MS
      )
      const genuinelyUpcoming = upcomingResults.filter(l =>
        !(l.status?.id === 1 &&
          l.net &&
          new Date(l.net).getTime() < now - INFLIGHT_GRACE_MS)
      )

      // ── Classify /previous/ results ───────────────────────────────────────
      // Scrubbed = past NET but no final outcome → keep in Upcoming
      // Finished = confirmed Success / Failure / Partial
      const scrubbed = previousResults.filter(l => !FINAL_STATUSES.has(l.status?.id))
      const finished = previousResults.filter(l =>  FINAL_STATUSES.has(l.status?.id))

      // ── Build Upcoming: genuinely upcoming + scrubbed (no dupes) ──────────
      const upcomingIds = new Set(genuinelyUpcoming.map(l => l.id))
      const toAdd = scrubbed.filter(l => !upcomingIds.has(l.id))
      const merged = [...genuinelyUpcoming, ...toAdd]
        .sort((a, b) => new Date(a.net) - new Date(b.net))

      // ── Build Previous: confirmed + "launched, result pending" ─────────────
      const prevIds = new Set(finished.map(l => l.id))
      const pendingResult = pastNetGo.filter(l => !prevIds.has(l.id))
      const allPrevious = [...finished, ...pendingResult]
        .sort((a, b) => new Date(b.net) - new Date(a.net))

      setUpcoming(merged)
      setPrevious(allPrevious)
      setLastUpdated(new Date())
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAll()
    const interval = setInterval(fetchAll, CACHE_TTL)
    return () => clearInterval(interval)
  }, [fetchAll])

  return { upcoming, previous, loading, error, lastUpdated, refetch: fetchAll }
}
