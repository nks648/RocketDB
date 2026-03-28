import { useState, useEffect } from 'react'

const ISS_URL  = 'https://api.wheretheiss.at/v1/satellites/25544'
const POLL_MS  = 10_000   // update every 10 s

export function useISS(enabled) {
  const [position, setPosition] = useState(null)
  const [error,    setError]    = useState(null)

  useEffect(() => {
    if (!enabled) { setPosition(null); setError(null); return }

    let cancelled = false

    async function poll() {
      try {
        const res = await fetch(ISS_URL)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const d = await res.json()
        if (cancelled) return
        setPosition({
          lat:        d.latitude,
          lng:        d.longitude,
          altKm:      d.altitude,
          speedKmh:   d.velocity,
          visibility: d.visibility,   // 'daylight' | 'eclipsed'
        })
        setError(null)
      } catch (e) {
        if (!cancelled) setError(e.message)
      }
    }

    poll()
    const id = setInterval(poll, POLL_MS)
    return () => { cancelled = true; clearInterval(id) }
  }, [enabled])

  return { position, error }
}
