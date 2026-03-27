import React from 'react'
import LaunchCard from './LaunchCard'

export default function LaunchSidebar({
  upcoming, previous, loading,
  activeTab, setActiveTab,
  selectedLaunch, onSelectLaunch, onPlayVideo,
}) {
  const launches = activeTab === 'upcoming' ? upcoming : previous

  return (
    <aside className="sidebar">
      <div className="sidebar-tabs">
        <button
          className={`sidebar-tab${activeTab === 'upcoming' ? ' active' : ''}`}
          onClick={() => setActiveTab('upcoming')}
        >
          Upcoming
          {upcoming.length > 0 && (
            <span className="sidebar-count">{upcoming.length}</span>
          )}
        </button>
        <button
          className={`sidebar-tab${activeTab === 'previous' ? ' active' : ''}`}
          onClick={() => setActiveTab('previous')}
        >
          Previous
          {previous.length > 0 && (
            <span className="sidebar-count">{previous.length}</span>
          )}
        </button>
      </div>

      {loading && (
        <div className="sidebar-loading">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="skeleton" />
          ))}
        </div>
      )}

      {!loading && launches.length === 0 && (
        <div className="sidebar-empty">
          <span style={{ fontSize: 32 }}>🛰️</span>
          <span>No launches found</span>
        </div>
      )}

      {!loading && launches.length > 0 && (
        <div className="sidebar-list">
          {launches.map(launch => (
            <LaunchCard
              key={launch.id}
              launch={launch}
              selected={selectedLaunch?.id === launch.id}
              onSelect={onSelectLaunch}
              onPlayVideo={onPlayVideo}
            />
          ))}
        </div>
      )}
    </aside>
  )
}
