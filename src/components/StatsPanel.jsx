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

    // Monthly launch rate — last 6 months
    const months = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date()
      d.setDate(1)
      d.setMonth(d.getMonth() - i)
      months.push({
        label: d.toLocaleString('default', { month: 'short' }),
        year: d.getFullYear(),
        month: d.getMonth(),
        count: 0,
        success: 0,
      })
    }
    for (const l of previous) {
      if (!l.net) continue
      const d = new Date(l.net)
      const entry = months.find(m => m.year === d.getFullYear() && m.month === d.getMonth())
      if (entry) {
        entry.count++
        if (l.status?.id === 3) entry.success++
      }
    }

    return { successes, failures, successRate, topAgencies, next, nextInHours, scrubbed, topOrbits, months }
  }, [upcoming, previous])

  const maxCount = Math.max(...stats.months.map(m => m.count), 1)

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

      {/* Monthly launch rate chart — last 6 months */}
      {stats.months.some(m => m.count > 0) && (
        <div className="stats-chart" title="Launches per month (last 6 months)">
          {stats.months.map((m, i) => (
            <div key={i} className="chart-col">
              <div className="chart-bar-wrap">
                <div
                  className="chart-bar"
                  style={{ height: `${Math.max((m.count / maxCount) * 100, m.count > 0 ? 8 : 0)}%` }}
                  title={`${m.label}: ${m.count} launches (${m.success} success)`}
                />
              </div>
              <div className="chart-label">{m.label}</div>
              {m.count > 0 && <div className="chart-count">{m.count}</div>}
            </div>
          ))}
          <div className="chart-title">Launches / month</div>
        </div>
      )}
    </div>
  )
}
