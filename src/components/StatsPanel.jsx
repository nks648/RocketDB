import React, { useMemo } from 'react'

export default function StatsPanel({ upcoming, previous }) {
  const stats = useMemo(() => {
    const successes = previous.filter(l => l.status?.id === 3).length
    const failures = previous.filter(l => l.status?.id === 4 || l.status?.id === 6).length
    const successRate = previous.length > 0
      ? Math.round((successes / previous.length) * 100)
      : null

    // Count by agency from all launches
    const agencyCounts = {}
    const allLaunches = [...upcoming, ...previous]
    for (const l of allLaunches) {
      const agency = l.launch_service_provider?.abbrev
        || l.launch_service_provider?.name?.split(' ')[0]
        || 'Other'
      agencyCounts[agency] = (agencyCounts[agency] || 0) + 1
    }
    const topAgencies = Object.entries(agencyCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)

    // Next launch
    const next = upcoming.find(l => l.net)
    const nextIn = next?.net
      ? Math.max(0, new Date(next.net).getTime() - Date.now())
      : null
    const nextInHours = nextIn !== null ? (nextIn / 3600000).toFixed(1) : null

    // Scrub / hold count (upcoming that are past NET)
    const scrubbed = upcoming.filter(l => {
      const pastNet = l.net && new Date(l.net).getTime() < Date.now()
      return pastNet && [2, 5, 8].includes(l.status?.id)
    }).length

    // Orbit class breakdown from upcoming
    const orbitCounts = {}
    for (const l of upcoming) {
      const o = l.mission?.orbit?.abbrev || l.mission?.orbit?.name || null
      if (o) orbitCounts[o] = (orbitCounts[o] || 0) + 1
    }
    const topOrbits = Object.entries(orbitCounts).sort((a, b) => b[1] - a[1]).slice(0, 3)

    return { successes, failures, successRate, topAgencies, next, nextInHours, scrubbed, topOrbits }
  }, [upcoming, previous])

  return (
    <div className="stats-panel">
      <div className="stat-item">
        <div>
          <div className="stat-value">{upcoming.length}</div>
          <div className="stat-label">Upcoming</div>
        </div>
      </div>

      <div className="stat-item">
        <div>
          <div className="stat-value">{previous.length}</div>
          <div className="stat-label">Recent</div>
        </div>
      </div>

      {stats.successRate !== null && (
        <div className="stat-item green">
          <div>
            <div className="stat-value">{stats.successRate}%</div>
            <div className="stat-label">Success Rate</div>
          </div>
        </div>
      )}

      {stats.failures > 0 && (
        <div className="stat-item red">
          <div>
            <div className="stat-value">{stats.failures}</div>
            <div className="stat-label">Failures</div>
          </div>
        </div>
      )}

      {stats.scrubbed > 0 && (
        <div className="stat-item" style={{ '--sv': 'var(--yellow)' }}>
          <div>
            <div className="stat-value" style={{ color:'var(--yellow)' }}>{stats.scrubbed}</div>
            <div className="stat-label">Scrubbed</div>
          </div>
        </div>
      )}

      {stats.nextInHours !== null && (
        <div className="stat-item orange">
          <div>
            <div className="stat-value">
              {parseFloat(stats.nextInHours) < 1
                ? `${Math.round(parseFloat(stats.nextInHours) * 60)}m`
                : `${stats.nextInHours}h`}
            </div>
            <div className="stat-label">Next Launch</div>
          </div>
        </div>
      )}

      {stats.topOrbits.length > 0 && (
        <div className="stats-agencies">
          <span style={{ fontSize:10, color:'var(--text-muted)', letterSpacing:1, textTransform:'uppercase', whiteSpace:'nowrap' }}>
            Orbits:
          </span>
          {stats.topOrbits.map(([name, count]) => (
            <span key={name} className="agency-pill">
              {name} <span style={{ color:'var(--purple)', marginLeft:3 }}>{count}</span>
            </span>
          ))}
        </div>
      )}

      {stats.topAgencies.length > 0 && (
        <div className="stats-agencies" style={{ borderLeft:'1px solid var(--border)', paddingLeft:20 }}>
          <span style={{ fontSize:10, color:'var(--text-muted)', letterSpacing:1, textTransform:'uppercase', whiteSpace:'nowrap' }}>
            Agencies:
          </span>
          {stats.topAgencies.map(([name, count]) => (
            <span key={name} className="agency-pill">
              {name} <span style={{ color:'var(--accent)', marginLeft:3 }}>{count}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
