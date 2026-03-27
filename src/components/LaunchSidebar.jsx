import React, { useState, useMemo } from 'react'
import LaunchCard from './LaunchCard'
import CountdownTimer from './CountdownTimer'

export default function LaunchSidebar({
  upcoming, previous, loading,
  activeTab, setActiveTab,
  selectedLaunch, onSelectLaunch, onPlayVideo,
  isOpen, onToggleSheet,
}) {
  const [filter, setFilter] = useState('')
  const allLaunches = activeTab === 'upcoming' ? upcoming : previous
  const launches = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return allLaunches
    return allLaunches.filter(l =>
      l.name?.toLowerCase().includes(q) ||
      l.rocket?.configuration?.name?.toLowerCase().includes(q) ||
      l.launch_service_provider?.abbrev?.toLowerCase().includes(q) ||
      l.launch_service_provider?.name?.toLowerCase().includes(q) ||
      l.pad?.location?.name?.toLowerCase().includes(q)
    )
  }, [allLaunches, filter])
  const nextLaunch = upcoming.find(l => l.net)

  return (
    <aside className={`sidebar${isOpen ? ' sheet-open' : ''}`}>

      {/* ── Mobile pull handle ── */}
      <div className="sheet-handle" onClick={onToggleSheet} role="button" aria-label="Toggle launch list">
        <div className="handle-pip" />
        <div className="handle-row">
          <div className="handle-info">
            <span className="handle-rocket">🚀</span>
            <div className="handle-text">
              <span className="handle-title">Launch Monitor</span>
              {nextLaunch && !isOpen && (
                <span className="handle-next">
                  Next: {nextLaunch.name.split(' | ')[1] || nextLaunch.name.split(' | ')[0]}
                  {' — '}
                  <CountdownTimer netTime={nextLaunch.net} status={nextLaunch.status} />
                </span>
              )}
              {isOpen && (
                <span className="handle-next">
                  {upcoming.length} upcoming · {previous.length} past
                </span>
              )}
            </div>
          </div>
          <svg
            className={`handle-chevron${isOpen ? ' open' : ''}`}
            width="18" height="18" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
          >
            <polyline points="18 15 12 9 6 15" />
          </svg>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="sidebar-tabs">
        <button
          className={`sidebar-tab${activeTab === 'upcoming' ? ' active' : ''}`}
          onClick={() => setActiveTab('upcoming')}
        >
          Upcoming
          {upcoming.length > 0 && <span className="sidebar-count">{upcoming.length}</span>}
        </button>
        <button
          className={`sidebar-tab${activeTab === 'previous' ? ' active' : ''}`}
          onClick={() => setActiveTab('previous')}
        >
          Previous
          {previous.length > 0 && <span className="sidebar-count">{previous.length}</span>}
        </button>
      </div>

      {/* ── Search filter ── */}
      <div className="sidebar-search">
        <input
          type="search"
          className="sidebar-search-input"
          placeholder="Filter by rocket, agency, site…"
          value={filter}
          onChange={e => setFilter(e.target.value)}
          aria-label="Filter launches"
        />
        {filter && (
          <button className="sidebar-search-clear" onClick={() => setFilter('')} aria-label="Clear filter">✕</button>
        )}
      </div>

      {/* ── Launch list ── */}
      {loading && (
        <div className="sidebar-loading">
          {[...Array(5)].map((_, i) => <div key={i} className="skeleton" />)}
        </div>
      )}

      {!loading && launches.length === 0 && (
        <div className="sidebar-empty">
          <span style={{ fontSize: 32 }}>{filter ? '🔍' : '🛰️'}</span>
          <span>{filter ? `No matches for "${filter}"` : 'No launches found'}</span>
          {filter && (
            <button className="btn-icon" style={{ fontSize:11 }} onClick={() => setFilter('')}>
              Clear filter
            </button>
          )}
        </div>
      )}

      {!loading && launches.length > 0 && (
        <div className="sidebar-list">
          {launches.map(launch => (
            <LaunchCard
              key={launch.id}
              launch={launch}
              selected={selectedLaunch?.id === launch.id}
              onSelect={l => { onSelectLaunch(l); }}
              onPlayVideo={onPlayVideo}
            />
          ))}
        </div>
      )}
    </aside>
  )
}
