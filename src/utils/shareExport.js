// Share a launch via Web Share API (mobile) or clipboard (desktop)
export async function shareLaunch(launch) {
  const id  = launch.id
  const url = `${window.location.origin}${window.location.pathname.replace(/\/$/, '')}?id=${id}`
  const text = `🚀 ${launch.name} — NET ${launch.net ? new Date(launch.net).toLocaleString() : 'TBD'}`

  if (navigator.share) {
    try {
      await navigator.share({ title: launch.name, text, url })
      return 'shared'
    } catch (e) {
      if (e.name === 'AbortError') return 'cancelled'
      // Fall through to clipboard
    }
  }

  try {
    await navigator.clipboard.writeText(url)
    return 'copied'
  } catch {
    // Final fallback
    const el = document.createElement('textarea')
    el.value = url
    document.body.appendChild(el)
    el.select()
    document.execCommand('copy')
    document.body.removeChild(el)
    return 'copied'
  }
}

// Download an .ics calendar event for a launch
export function downloadICS(launch) {
  if (!launch.net) return

  function icsDate(d) {
    return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
  }

  const net  = new Date(launch.net)
  const end  = new Date(net.getTime() + 2 * 60 * 60 * 1000) // 2 hr window
  const now  = new Date()
  const uid  = `rocketdb-${launch.id}@rocketdb`
  const url  = `https://nks648.github.io/RocketDB/?id=${launch.id}`
  const site = [launch.pad?.name, launch.pad?.location?.name].filter(Boolean).join(', ')
  const desc = [
    launch.mission?.description || '',
    `Vehicle: ${launch.rocket?.configuration?.full_name || launch.rocket?.configuration?.name || ''}`,
    `Status: ${launch.status?.name || 'TBD'}`,
    ``,
    url,
  ].join('\\n').replace(/,/g, '\\,')

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//RocketDB//Launch Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${icsDate(now)}`,
    `DTSTART:${icsDate(net)}`,
    `DTEND:${icsDate(end)}`,
    `SUMMARY:🚀 ${launch.name}`,
    `DESCRIPTION:${desc}`,
    `LOCATION:${site}`,
    `URL:${url}`,
    'STATUS:TENTATIVE',
    'END:VEVENT',
    'END:VCALENDAR',
  ]

  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' })
  const a    = document.createElement('a')
  a.href     = URL.createObjectURL(blob)
  a.download = `${launch.name.replace(/[^a-z0-9]/gi, '-').slice(0, 60)}.ics`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(a.href)
}
