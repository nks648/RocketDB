import { useState, useEffect, useRef } from 'react'

const POLL_MS = 60_000 // OpenSky anonymous: max ~400 req/day; 60s is safe

/**
 * Fetch airborne aircraft from OpenSky Network within ~280 km of a launch pad.
 * No API key needed. Falls back silently on CORS / rate-limit errors.
 */
export function useAircraft(enabled, padLat, padLng) {
  const [aircraft, setAircraft] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState(null)
  const timer = useRef(null)

  useEffect(() => {
    if (!enabled || padLat == null || padLng == null) {
      setAircraft([])
      setError(null)
      return
    }

    const deg = 2.5 // ~280 km radius
    const params = new URLSearchParams({
      lamin: (padLat - deg).toFixed(3),
      lomin: (padLng - deg).toFixed(3),
      lamax: (padLat + deg).toFixed(3),
      lomax: (padLng + deg).toFixed(3),
    })
    const url = `https://opensky-network.org/api/states/all?${params}`

    async function poll() {
      setLoading(true)
      try {
        const res = await fetch(url)
        if (!res.ok) throw new Error(`OpenSky ${res.status}`)
        const data = await res.json()

        const planes = (data.states || [])
          .filter(s => s[5] != null && s[6] != null && !s[8]) // airborne + has position
          .map(s => ({
            icao:     s[0],
            callsign: (s[1] || '').trim() || s[0].toUpperCase(),
            lng:      s[5],
            lat:      s[6],
            altFt:    s[7] != null ? Math.round(s[7] * 3.281) : null,
            speedKts: s[9] != null ? Math.round(s[9] * 1.944) : null,
            heading:  s[10] != null ? Math.round(s[10]) : 0,
            country:  s[2],
          }))

        setAircraft(planes)
        setError(null)
      } catch (e) {
        setError(e.message)
        // Keep last known positions on error
      } finally {
        setLoading(false)
      }
    }

    poll()
    timer.current = setInterval(poll, POLL_MS)
    return () => clearInterval(timer.current)
  }, [enabled, padLat, padLng])

  return { aircraft, loading, error }
}
