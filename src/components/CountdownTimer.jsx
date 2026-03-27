import React, { useState, useEffect } from 'react'

function formatDuration(ms) {
  if (ms <= 0) return 'T+00:00:00'
  const totalSec = Math.floor(ms / 1000)
  const d = Math.floor(totalSec / 86400)
  const h = Math.floor((totalSec % 86400) / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (d > 0) {
    return `T-${d}d ${String(h).padStart(2,'0')}h ${String(m).padStart(2,'0')}m`
  }
  return `T-${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
}

// What to show when NET has passed but launch is not confirmed complete
const PAST_LABELS = {
  2: 'NET TBD',
  5: 'On Hold',
  6: 'In Flight',
  8: 'NET TBC',
}

export default function CountdownTimer({ netTime, status, large = false }) {
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  if (!netTime) {
    const label = status?.id ? (PAST_LABELS[status.id] || 'TBD') : 'TBD'
    return <span className="countdown past">{label}</span>
  }

  const target = new Date(netTime).getTime()
  const diff = target - now

  if (diff < 0) {
    // If status indicates it's not truly over, show appropriate label
    const label = status?.id && PAST_LABELS[status.id]
      ? PAST_LABELS[status.id]
      : 'Launched'
    return <span className={large ? 'countdown-large past' : 'countdown past'}>{label}</span>
  }

  const cls = large ? 'countdown-large' : diff < 3600000 ? 'countdown imminent' : 'countdown'
  return <span className={cls}>{formatDuration(diff)}</span>
}
