import { useState, useEffect, useCallback } from 'react'

const LL2_BASE  = 'https://lldev.thespacedevs.com/2.2.0' // dev server — higher rate limits, same data
const CACHE_TTL = 10 * 60 * 1000  // 10 min → 12 req/hr (limit: 15/hr on dev server)
const LS_PREFIX = 'rocketdb:ll2:v2:'  // bump version to clear stale cache

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
async function fetchWithCache(url, force = false) {
  const stored = lsGet(url)

  // Fresh cache hit — no network needed (unless forced)
  if (!force && stored && Date.now() - stored.ts < CACHE_TTL) {
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

/** Clear all LL2 cache entries so the next fetch is guaranteed fresh. */
function clearCache() {
  try {
    Object.keys(localStorage)
      .filter(k => k.startsWith(LS_PREFIX))
      .forEach(k => localStorage.removeItem(k))
  } catch { /* ignore */ }
}

// Statuses that mean a launch is truly over
const FINAL_STATUSES = new Set([3, 4, 7]) // Success, Failure, Partial Failure

// Statuses that mean "scrubbed / awaiting new window" — keep in Upcoming
const SCRUB_STATUSES = new Set([2, 5, 8]) // TBD, Hold, TBC

// Tiny grace so a launch doesn't vanish the instant it hits T-0
const NET_GRACE_MS = 2 * 60 * 1000 // 2 min

// ── Hook ──────────────────────────────────────────────────────────────────
export function useLaunches() {
  const [upcoming,    setUpcoming]    = useState([])
  const [previous,    setPrevious]    = useState([])
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState(null)
  const [lastUpdated, setLastUpdated] = useState(null)

  const fetchAll = useCallback(async (force = false) => {
    setLoading(true)
    setError(null)
    try {
      const [upRes, prevRes] = await Promise.all([
        fetchWithCache(`${LL2_BASE}/launch/upcoming/?format=json&limit=50&mode=detailed`, force),
        fetchWithCache(`${LL2_BASE}/launch/previous/?format=json&limit=30&ordering=-net&mode=detailed`, force),
      ])

      const upcomingResults = upRes.results || []
      const previousResults = prevRes.results || []
      const now = Date.now()

      // ── Classify /upcoming/ results ──────────────────────────────────────
      // A launch belongs in Upcoming only if its NET is in the future
      // OR it is scrubbed/on-hold (waiting for a new window).
      // Anything else past NET (GO, In Flight, etc.) has launched — move it out.
      const isStillUpcoming = l => {
        if (!l.net) return true                              // no NET → keep
        const pastNet = new Date(l.net).getTime() < now - NET_GRACE_MS
        if (!pastNet) return true                            // future → keep
        return SCRUB_STATUSES.has(l.status?.id)             // scrubbed → keep
      }
      const genuinelyUpcoming = upcomingResults.filter(isStillUpcoming)
      const launchedFromUpcoming = upcomingResults.filter(l => !isStillUpcoming(l))

      // ── Classify /previous/ results ───────────────────────────────────────
      const scrubbed = previousResults.filter(l => !FINAL_STATUSES.has(l.status?.id))
      const finished = previousResults.filter(l =>  FINAL_STATUSES.has(l.status?.id))

      // ── Build Upcoming: genuinely upcoming + scrubbed (no dupes) ──────────
      const upcomingIds = new Set(genuinelyUpcoming.map(l => l.id))
      const toAdd = scrubbed.filter(l => !upcomingIds.has(l.id))
      const merged = [...genuinelyUpcoming, ...toAdd]
        .sort((a, b) => new Date(a.net) - new Date(b.net))

      // ── Build Previous: confirmed + "result pending" (no dupes) ───────────
      const prevIds = new Set(finished.map(l => l.id))
      const pendingResult = launchedFromUpcoming.filter(l => !prevIds.has(l.id))
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

  const forceRefetch = useCallback(() => {
    clearCache()
    return fetchAll(true)
  }, [fetchAll])

  return { upcoming, previous, loading, error, lastUpdated, refetch: forceRefetch }
}
