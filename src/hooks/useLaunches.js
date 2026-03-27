import { useState, useEffect, useCallback } from 'react'

const LL2_BASE = 'https://ll.thespacedevs.com/2.2.0'
const CACHE_TTL = 15 * 60 * 1000 // 15 min — LL2 free tier: 15 req/hr, 2 req/cycle = 8/hr

const cache = {}

async function fetchWithCache(url) {
  const now = Date.now()
  if (cache[url] && now - cache[url].ts < CACHE_TTL) {
    return cache[url].data
  }
  const res = await fetch(url)
  if (res.status === 429) {
    // Rate limited — return stale cache if we have it, else throw
    if (cache[url]) return cache[url].data
    throw new Error('HTTP 429 — rate limited. Data refreshes every 15 min.')
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = await res.json()
  cache[url] = { data, ts: now }
  return data
}

export function useLaunches() {
  const [upcoming, setUpcoming] = useState([])
  const [previous, setPrevious] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [lastUpdated, setLastUpdated] = useState(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [upRes, prevRes] = await Promise.all([
        fetchWithCache(
          `${LL2_BASE}/launch/upcoming/?format=json&limit=20&mode=detailed`
        ),
        fetchWithCache(
          `${LL2_BASE}/launch/previous/?format=json&limit=20&ordering=-net&mode=detailed`
        ),
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
