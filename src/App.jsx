import React, { useState, useEffect, useCallback } from 'react'
import Header from './components/Header'
import WorldMap from './components/WorldMap'
import LaunchSidebar from './components/LaunchSidebar'
import LaunchDetail from './components/LaunchDetail'
import MobileLaunchBanner from './components/MobileLaunchBanner'
import StatsPanel from './components/StatsPanel'
import VideoModal from './components/VideoModal'
import CinematicMode from './components/CinematicMode'
import { useLaunches } from './hooks/useLaunches'
import { useFavorites } from './hooks/useFavorites'
import { useRLLLaunches, matchRLL } from './hooks/useRLLLaunches'
import { useUserDateOverrides } from './hooks/useUserDateOverrides'

function useOnlineStatus() {
  const [online, setOnline] = useState(() => navigator.onLine)
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])
  return online
}

export default function App() {
  const { upcoming, previous, loading, error, lastUpdated, refetch } = useLaunches()
  const { favs, toggle: toggleFavorite } = useFavorites()
  const rllLaunches = useRLLLaunches()
  const { overrides, set: setOverride, clear: clearOverride } = useUserDateOverrides()
  const [selectedLaunch, setSelectedLaunch] = useState(null)
  const [videoState, setVideoState]         = useState(null)
  const [activeTab, setActiveTab]           = useState('upcoming')
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false)
  const [cinematicLaunch, setCinematicLaunch] = useState(null)
  const [theme, setTheme] = useState(() => localStorage.getItem('rocketdb:theme') || 'dark')
  const [initialSelectDone, setInitialSelectDone] = useState(false)
  const online = useOnlineStatus()

  // Apply theme to document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('rocketdb:theme', theme)
  }, [theme])

  // Auto-select on first data load — prefer URL ?id=, else first upcoming
  useEffect(() => {
    if (initialSelectDone || loading) return
    if (upcoming.length === 0 && previous.length === 0) return
    const params = new URLSearchParams(window.location.search)
    const urlId = params.get('id')
    const all = [...upcoming, ...previous]
    const fromUrl = urlId ? all.find(l => l.id === urlId) : null
    setSelectedLaunch(fromUrl || upcoming[0] || null)
    setInitialSelectDone(true)
  }, [loading, upcoming, previous, initialSelectDone])

  // Sync URL ?id= when selected launch changes
  useEffect(() => {
    if (!initialSelectDone) return
    const url = new URL(window.location.href)
    if (selectedLaunch) {
      url.searchParams.set('id', selectedLaunch.id)
    } else {
      url.searchParams.delete('id')
    }
    window.history.replaceState({}, '', url.toString())
  }, [selectedLaunch, initialSelectDone])

  // Live tab-title countdown for selected or next upcoming launch
  useEffect(() => {
    const target = selectedLaunch || upcoming[0]
    if (!target?.net) { document.title = 'RocketDB'; return }
    function tick() {
      const name = target.rocket?.configuration?.name || 'Launch'
      const ms = new Date(target.net).getTime() - Date.now()
      if (ms <= 0) {
        const nonFinal = [2, 5, 8]
        const sid = target.status?.id
        document.title = nonFinal.includes(sid) ? `NET TBC — ${name} — RocketDB` : '🚀 Liftoff! — RocketDB'
        return
      }
      const d = Math.floor(ms / 86400000)
      const h = Math.floor((ms % 86400000) / 3600000)
      const m = Math.floor((ms % 3600000) / 60000)
      const s = Math.floor((ms % 60000) / 1000)
      const hms = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
      document.title = d > 0
        ? `T-${d}d ${hms} — ${name} — RocketDB`
        : `T-${hms} — ${name} — RocketDB`
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => { clearInterval(id); document.title = 'RocketDB' }
  }, [selectedLaunch, upcoming])

  // ── Keyboard shortcuts ───────────────────────────────────────────────────────
  const handleSelectLaunch = useCallback((launch) => {
    setSelectedLaunch(launch)
    setMobileSheetOpen(false)
  }, [])

  useEffect(() => {
    function onKey(e) {
      const tag = e.target.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (e.metaKey || e.ctrlKey || e.altKey) return

      switch (e.key) {
        case 'Escape':
          if (cinematicLaunch) { setCinematicLaunch(null); return }
          if (selectedLaunch)  { setSelectedLaunch(null); return }
          break

        case 'n': case 'N': {
          // Next launch in active tab
          const list = activeTab === 'upcoming' ? upcoming : previous
          if (!list.length) return
          const idx = list.findIndex(l => l.id === selectedLaunch?.id)
          handleSelectLaunch(list[Math.min(idx + 1, list.length - 1)])
          setActiveTab(activeTab)
          break
        }
        case 'p': case 'P': {
          // Previous launch in active tab
          const list = activeTab === 'upcoming' ? upcoming : previous
          if (!list.length) return
          const idx = list.findIndex(l => l.id === selectedLaunch?.id)
          handleSelectLaunch(list[Math.max(idx - 1, 0)])
          break
        }
        case 'f': case 'F':
          if (selectedLaunch) setCinematicLaunch(selectedLaunch)
          break

        case 'r': case 'R':
          if (!loading) refetch()
          break

        default:
          break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [upcoming, previous, selectedLaunch, cinematicLaunch, activeTab, loading, refetch, handleSelectLaunch])

  function handlePlayVideo(url, title) {
    setVideoState({ url, title })
  }

  return (
    <div className="app">
      <Header
        lastUpdated={lastUpdated}
        loading={loading}
        onRefetch={refetch}
        theme={theme}
        onToggleTheme={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
        online={online}
      />

      {/* Desktop sidebar */}
      <LaunchSidebar
        upcoming={upcoming}
        previous={previous}
        loading={loading}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        selectedLaunch={selectedLaunch}
        onSelectLaunch={handleSelectLaunch}
        onPlayVideo={handlePlayVideo}
        isOpen={mobileSheetOpen}
        onToggleSheet={() => setMobileSheetOpen(v => !v)}
        favs={favs}
        onToggleFavorite={toggleFavorite}
      />

      {/* Map area */}
      <div className="map-area">
        <WorldMap
          launches={[...upcoming, ...previous]}
          selectedLaunch={selectedLaunch}
          onSelectLaunch={handleSelectLaunch}
          onPlayVideo={handlePlayVideo}
        />

        {/* Desktop selected launch detail */}
        {selectedLaunch && (
          <LaunchDetail
            launch={selectedLaunch}
            onClose={() => setSelectedLaunch(null)}
            onPlayVideo={handlePlayVideo}
            onCinematic={() => setCinematicLaunch(selectedLaunch)}
            rllMatch={matchRLL(selectedLaunch, rllLaunches)}
            override={overrides[selectedLaunch.id] || null}
            onSetOverride={setOverride}
            onClearOverride={clearOverride}
          />
        )}
      </div>

      {/* Mobile floating selected launch banner */}
      {selectedLaunch && (
        <MobileLaunchBanner
          launch={selectedLaunch}
          onClose={() => setSelectedLaunch(null)}
          onPlayVideo={handlePlayVideo}
          onCinematic={() => setCinematicLaunch(selectedLaunch)}
          rllMatch={matchRLL(selectedLaunch, rllLaunches)}
          override={overrides[selectedLaunch.id] || null}
          onSetOverride={setOverride}
          onClearOverride={clearOverride}
        />
      )}

      {/* Sheet backdrop dimmer */}
      {mobileSheetOpen && (
        <div className="sheet-backdrop" onClick={() => setMobileSheetOpen(false)} />
      )}

      <StatsPanel upcoming={upcoming} previous={previous} />

      {/* Cinematic T-0 mode */}
      {cinematicLaunch && (
        <CinematicMode
          launch={cinematicLaunch}
          onClose={() => setCinematicLaunch(null)}
          onPlayVideo={handlePlayVideo}
        />
      )}

      {videoState && (
        <VideoModal
          url={videoState.url}
          title={videoState.title}
          onClose={() => setVideoState(null)}
        />
      )}

      {error && (
        <div className="error-banner">
          ⚠ {error} — cached data shown
        </div>
      )}
    </div>
  )
}
