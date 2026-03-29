import React, { useState } from 'react'
import SpaceWeatherBadge from './SpaceWeatherBadge'

export default function Header({ lastUpdated, loading, onRefetch, theme, onToggleTheme, online }) {
  const [showShortcuts, setShowShortcuts] = useState(false)

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

      {/* Online / offline / loading indicator */}
      {!online ? (
        <div className="header-live" style={{ color: 'var(--orange)' }}>
          <span style={{ display:'inline-block', width:8, height:8, borderRadius:'50%', background:'var(--orange)', flexShrink:0 }} />
          Offline
        </div>
      ) : !loading ? (
        <div className="header-live">
          <span className="pulse-dot" />
          Live
        </div>
      ) : (
        <div className="header-live" style={{ color: 'var(--text-muted)' }}>
          <span style={{ display:'inline-block', width:8, height:8, borderRadius:'50%', background:'var(--text-muted)', flexShrink:0 }} />
          Fetching…
        </div>
      )}

      <div className="header-status">
        LL2 API · Updated {timeStr}
      </div>

      <SpaceWeatherBadge />

      <div className="header-right">
        {/* Keyboard shortcuts hint */}
        <div className="shortcut-hint-wrap">
          <button
            className="btn-icon"
            onClick={() => setShowShortcuts(v => !v)}
            title="Keyboard shortcuts"
            aria-label="Keyboard shortcuts"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <rect x="2" y="4" width="20" height="16" rx="2"/>
              <path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M8 12h.01M12 12h.01M16 12h.01M7 16h10"/>
            </svg>
            <span className="btn-label">Keys</span>
          </button>
          {showShortcuts && (
            <>
              <div className="shortcut-backdrop" onClick={() => setShowShortcuts(false)} />
              <div className="shortcut-panel">
                <div className="shortcut-row"><kbd>N</kbd> Next launch</div>
                <div className="shortcut-row"><kbd>P</kbd> Prev launch</div>
                <div className="shortcut-row"><kbd>F</kbd> Cinematic mode</div>
                <div className="shortcut-row"><kbd>R</kbd> Refresh data</div>
                <div className="shortcut-row"><kbd>Esc</kbd> Close panel</div>
              </div>
            </>
          )}
        </div>

        {/* Theme toggle */}
        <button
          className="btn-icon"
          onClick={onToggleTheme}
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark' ? (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="12" cy="12" r="5"/>
              <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
            </svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
            </svg>
          )}
          <span className="btn-label">{theme === 'dark' ? 'Light' : 'Dark'}</span>
        </button>

        <button
          className="btn-icon"
          onClick={onRefetch}
          title="Refresh launch data (R)"
          disabled={loading}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M1 4v6h6M23 20v-6h-6"/>
            <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/>
          </svg>
          <span className="btn-label">Refresh</span>
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
          <span className="btn-label">LL2 API</span>
        </a>
      </div>
    </header>
  )
}
