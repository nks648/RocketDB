import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import 'leaflet/dist/leaflet.css'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

// Register service worker for PWA support (offline + notification click handler)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/RocketDB/sw.js').catch(() => {
      // SW registration failure is non-fatal — app works fine without it
    })
  })
}
