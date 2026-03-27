import React, { useEffect } from 'react'

export default function VideoModal({ url, title, onClose }) {
  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      className="modal-backdrop"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="modal-inner">
        <div className="modal-header">
          <span className="modal-title">
            <span style={{ color:'var(--red)', marginRight:6 }}>●</span>
            {title || 'Live Stream'}
          </span>
          <button className="btn-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-video">
          <iframe
            src={url}
            title={title || 'Launch stream'}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      </div>
    </div>
  )
}
