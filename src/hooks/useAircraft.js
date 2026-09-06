import { useState, useEffect, useRef } from 'react'

const POLL_MS = 60_000 // adsb.lol is generous but no need to poll faster than this

/**
 * Fetch airborne aircraft from adsb.lol within ~280 km of a launch pad.
 * No API key needed. Falls back silently on CORS / rate-limit errors.
 *
 * OpenSky Network retired anonymous REST access (now requires an OAuth2
 * client / account), so this hook uses adsb.lol's free, key-less,
 * CORS-enabled point-radius endpoint instead.
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

    const radiusNm = 150 // ~280 km, under adsb.lol's 250 nm cap
    const url = `https://api.adsb.lol/v2/point/${padLat.toFixed(4)}/${padLng.toFixed(4)}/${radiusNm}`

    async function poll() {
      setLoading(true)
      try {
        const res = await fetch(url)
        if (!res.ok) throw new Error(`adsb.lol ${res.status}`)
        const data = await res.json()

        const planes = (data.ac || [])
          .filter(a => a.lat != null && a.lon != null && a.alt_baro !== 'ground')
          .map(a => ({
            icao:     a.hex,
            callsign: (a.flight || '').trim() || a.hex.toUpperCase(),
            lng:      a.lon,
            lat:      a.lat,
            altFt:    typeof a.alt_baro === 'number' ? Math.round(a.alt_baro) : null,
            speedKts: a.gs != null ? Math.round(a.gs) : null,
            heading:  a.track != null ? Math.round(a.track) : 0,
            country:  a.r || a.t || '',
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
