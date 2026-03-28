import { useState, useEffect } from 'react'

const CACHE = {}
const TTL   = 60 * 60 * 1000   // 1 hour

export function useSunriseSunset(lat, lng, launchTime) {
  const [data, setData] = useState(null)

  useEffect(() => {
    if (lat == null || lng == null || isNaN(lat) || isNaN(lng)) {
      setData(null)
      return
    }

    // Use the launch date (or today) for the query
    const dateStr = launchTime
      ? new Date(launchTime).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10)

    const key = `${lat.toFixed(2)},${lng.toFixed(2)},${dateStr}`

    if (CACHE[key] && Date.now() - CACHE[key].ts < TTL) {
      setData(CACHE[key].data)
      return
    }

    fetch(
      `https://api.sunrise-sunset.org/json?lat=${lat}&lng=${lng}&date=${dateStr}&formatted=0`
    )
      .then(r => { if (!r.ok) throw new Error(); return r.json() })
      .then(json => {
        if (json.status !== 'OK') return
        const r = json.results
        const sunrise    = new Date(r.sunrise)
        const sunset     = new Date(r.sunset)
        const civilDawn  = new Date(r.civil_twilight_begin)
        const civilDusk  = new Date(r.civil_twilight_end)

        let phase = 'unknown'
        if (launchTime) {
          const t = new Date(launchTime)
          if      (t >= sunrise  && t < sunset)    phase = 'day'
          else if (t >= civilDawn && t < sunrise)  phase = 'dawn'
          else if (t >= sunset   && t <= civilDusk) phase = 'dusk'
          else                                      phase = 'night'
        }

        const PHASE_LABEL = {
          day:   { icon: '☀️',  label: 'Day Launch',   color: '#ffd740' },
          dawn:  { icon: '🌅',  label: 'Dawn Launch',  color: '#ff9940' },
          dusk:  { icon: '🌆',  label: 'Dusk Launch',  color: '#ff7070' },
          night: { icon: '🌙',  label: 'Night Launch', color: '#bb86fc' },
        }

        const result = {
          sunrise, sunset, civilDawn, civilDusk,
          phase,
          ...(PHASE_LABEL[phase] || {}),
        }
        CACHE[key] = { data: result, ts: Date.now() }
        setData(result)
      })
      .catch(() => {})   // silent fail — non-critical data
  }, [lat, lng, launchTime])

  return data
}
