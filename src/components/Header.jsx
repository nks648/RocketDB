import React from 'react'

export default function Header({ lastUpdated, loading, onRefetch }) {
  const timeStr = lastUpdated
    ? lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '—'

  return (
    <header className="header">
      <div className="header-logo">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 2C8 2 4 8 4 14c0 3 2 5 4 6l4 1 4-1c2-1 4-3 4-6 0-6-4-12-8-12z"/>
          <path d="M8 20l-2 2M16 20l2 2M9 14a3 3 0 0 0 6 0"/>
        </svg>
        RocketDB
      </div>

      {!loading && (
        <div className="header-live">
          <span className="pulse-dot" />
          Live
        </div>
      )}

      {loading && (
        <div className="header-live" style={{ color: 'var(--text-muted)' }}>
          <span style={{ display:'inline-block', width:8, height:8, borderRadius:'50%', background:'var(--text-muted)', flexShrink:0 }} />
          Fetching…
        </div>
      )}

      <div className="header-status">
        LL2 API · Updated {timeStr}
      </div>

      <div className="header-right">
        <button
          className="btn-icon"
          onClick={onRefetch}
          title="Refresh launch data"
          disabled={loading}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M1 4v6h6M23 20v-6h-6"/>
            <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/>
          </svg>
          Refresh
        </button>

        <a
          href="https://thespacedevs.com/llapi"
          target="_blank"
          rel="noreferrer"
          className="btn-icon"
          style={{ textDecoration:'none' }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/>
          </svg>
          Launch Library 2
        </a>
      </div>
    </header>
  )
}
