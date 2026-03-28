import React, { useState, useMemo, useRef } from 'react'
import LaunchCard from './LaunchCard'
import CountdownTimer from './CountdownTimer'

export default function LaunchSidebar({
  upcoming, previous, loading,
  activeTab, setActiveTab,
  selectedLaunch, onSelectLaunch, onPlayVideo,
  isOpen, onToggleSheet,
  favs, onToggleFavorite,
}) {
  const [filter, setFilter] = useState('')
  const [agencyFilter, setAgencyFilter] = useState('')
  const [showFavs, setShowFavs] = useState(false)
  const listRef = useRef(null)

  const allLaunches = activeTab === 'upcoming' ? upcoming : previous

  // All unique agencies for the dropdown
  const agencies = useMemo(() => {
    const s = new Set()
    allLaunches.forEach(l => {
      const a = l.launch_service_provider?.abbrev || l.launch_service_provider?.name
      if (a) s.add(a)
    })
    return [...s].sort()
  }, [allLaunches])

  const launches = useMemo(() => {
    let list = allLaunches
    const q = filter.trim().toLowerCase()
    if (q) {
      list = list.filter(l =>
        l.name?.toLowerCase().includes(q) ||
        l.rocket?.configuration?.name?.toLowerCase().includes(q) ||
        l.launch_service_provider?.abbrev?.toLowerCase().includes(q) ||
        l.launch_service_provider?.name?.toLowerCase().includes(q) ||
        l.pad?.location?.name?.toLowerCase().includes(q)
      )
    }
    if (agencyFilter) {
      list = list.filter(l =>
        l.launch_service_provider?.abbrev === agencyFilter ||
        l.launch_service_provider?.name === agencyFilter
      )
    }
    if (showFavs) {
      list = list.filter(l => favs.has(l.id))
    }
    return list
  }, [allLaunches, filter, agencyFilter, showFavs, favs])

  const nextLaunch = upcoming.find(l => l.net)
  const isFiltered = filter || agencyFilter || showFavs

  // Arrow-key navigation between cards
  function handleListKeyDown(e) {
    const cards = listRef.current?.querySelectorAll('[data-launch-card]')
    if (!cards?.length) return
    const idx = [...cards].findIndex(el => el === document.activeElement)
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      cards[Math.min(idx + 1, cards.length - 1)]?.focus()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      cards[Math.max(idx - 1, 0)]?.focus()
    }
  }

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
          {upcoming.length > 0 && (
            <span className="sidebar-count">
              {isFiltered && activeTab === 'upcoming' ? launches.length : upcoming.length}
            </span>
          )}
        </button>
        <button
          className={`sidebar-tab${activeTab === 'previous' ? ' active' : ''}`}
          onClick={() => setActiveTab('previous')}
        >
          Previous
          {previous.length > 0 && (
            <span className="sidebar-count">
              {isFiltered && activeTab === 'previous' ? launches.length : previous.length}
            </span>
          )}
        </button>
      </div>

      {/* ── Search + filters ── */}
      <div className="sidebar-filters">
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

        <div className="sidebar-filter-row">
          {/* Agency dropdown */}
          <select
            className="sidebar-agency-select"
            value={agencyFilter}
            onChange={e => setAgencyFilter(e.target.value)}
            aria-label="Filter by agency"
          >
            <option value="">All agencies</option>
            {agencies.map(a => <option key={a} value={a}>{a}</option>)}
          </select>

          {/* Favorites chip */}
          <button
            className={`sidebar-fav-btn${showFavs ? ' active' : ''}`}
            onClick={() => setShowFavs(v => !v)}
            title="Show favorites only"
          >
            {showFavs ? '★' : '☆'} Favs
            {favs.size > 0 && <span className="sidebar-count" style={{ marginLeft: 3 }}>{favs.size}</span>}
          </button>
        </div>
      </div>

      {/* ── Launch list ── */}
      {loading && (
        <div className="sidebar-loading">
          {[...Array(5)].map((_, i) => <div key={i} className="skeleton" />)}
        </div>
      )}

      {!loading && launches.length === 0 && (
        <div className="sidebar-empty">
          <span style={{ fontSize: 32 }}>{isFiltered ? '🔍' : '🛰️'}</span>
          <span>{showFavs ? 'No favorites yet' : isFiltered ? 'No matches' : 'No launches found'}</span>
          {isFiltered && (
            <button className="btn-icon" style={{ fontSize:11 }} onClick={() => { setFilter(''); setAgencyFilter(''); setShowFavs(false) }}>
              Clear filters
            </button>
          )}
        </div>
      )}

      {!loading && launches.length > 0 && (
        <div className="sidebar-list" ref={listRef} onKeyDown={handleListKeyDown}>
          {launches.map(launch => (
            <LaunchCard
              key={launch.id}
              launch={launch}
              selected={selectedLaunch?.id === launch.id}
              onSelect={l => onSelectLaunch(l)}
              onPlayVideo={onPlayVideo}
              isFavorite={favs.has(launch.id)}
              onToggleFavorite={onToggleFavorite}
            />
          ))}
        </div>
      )}
    </aside>
  )
}
