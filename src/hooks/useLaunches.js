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
      setUpcoming(upRes.results || [])
      setPrevious(prevRes.results || [])
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
