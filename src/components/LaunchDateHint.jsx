import React, { useState } from 'react'

/**
 * Shows supplementary date intelligence for TBC / TBD launches:
 *   - RocketLaunch.Live window (if API has a date LL2 doesn't)
 *   - User-pinned custom date/time
 */
export default function LaunchDateHint({ launch, rllMatch, override, onSetOverride, onClearOverride }) {
  const [editing, setEditing] = useState(false)
  const [inputVal, setInputVal] = useState('')
  const [inputNote, setInputNote] = useState('')

  // TBD (2), Hold (5), TBC (8) — also treat "Go" (1) launches as eligible
  // so users can always pin a community-sourced date for any future launch
  const isTBC = [1, 2, 5, 8].includes(launch?.status?.id)
  const isPast = [3, 4, 6, 7].includes(launch?.status?.id)
  const hasNoConfirmedNet = !launch?.net || isTBC

  // Format RLL window
  const rllDate = rllMatch?.win_open
    ? new Date(rllMatch.win_open).toLocaleString([], { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit', timeZoneName:'short' })
    : rllMatch?.date_str || null

  const rllClose = rllMatch?.win_close
    ? new Date(rllMatch.win_close).toLocaleString([], { hour:'2-digit', minute:'2-digit' })
    : null

  function handleSave() {
    if (!inputVal) return
    const iso = new Date(inputVal).toISOString()
    if (isNaN(new Date(inputVal))) return
    onSetOverride(iso, inputNote)
    setEditing(false)
    setInputVal('')
    setInputNote('')
  }

  function startEdit() {
    // Pre-fill with existing override or RLL date
    const prefill = override?.net || rllMatch?.win_open || ''
    setInputVal(prefill ? new Date(prefill).toISOString().slice(0, 16) : '')
    setInputNote(override?.note || '')
    setEditing(true)
  }

  if (isPast) return null
  if (!rllDate && !override && !isTBC) return null

  return (
    <div className="date-hint-wrap">

      {/* RLL supplementary date */}
      {rllDate && !override && (
        <div className="date-hint rll">
          <span className="date-hint-icon">📡</span>
          <div className="date-hint-body">
            <span className="date-hint-source">RocketLaunch.Live</span>
            <span className="date-hint-value">
              {rllDate}{rllClose ? ` – ${rllClose}` : ''}
            </span>
            <span className="date-hint-note">Unconfirmed — not in LL2 API yet</span>
          </div>
        </div>
      )}

      {/* User override */}
      {override && (
        <div className="date-hint user">
          <span className="date-hint-icon">📌</span>
          <div className="date-hint-body">
            <span className="date-hint-source">Your date</span>
            <span className="date-hint-value">
              {new Date(override.net).toLocaleString([], { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit', timeZoneName:'short' })}
            </span>
            {override.note && <span className="date-hint-note">{override.note}</span>}
          </div>
          <button className="date-hint-clear" onClick={onClearOverride} title="Remove override">✕</button>
        </div>
      )}

      {/* Edit form */}
      {editing ? (
        <div className="date-hint-form">
          <input
            type="datetime-local"
            className="date-hint-input"
            value={inputVal}
            onChange={e => setInputVal(e.target.value)}
          />
          <input
            type="text"
            className="date-hint-input"
            placeholder="Source / note (optional)"
            value={inputNote}
            onChange={e => setInputNote(e.target.value)}
            maxLength={80}
          />
          <div style={{ display:'flex', gap:6 }}>
            <button className="btn-primary" style={{ fontSize:11, padding:'4px 10px' }} onClick={handleSave}>Save</button>
            <button className="btn-icon"    style={{ fontSize:11, padding:'4px 10px' }} onClick={() => setEditing(false)}>Cancel</button>
          </div>
        </div>
      ) : (
        <button className="date-hint-pin" onClick={startEdit}>
          📌 {override ? 'Edit date' : 'Pin a date'}
        </button>
      )}
    </div>
  )
}
