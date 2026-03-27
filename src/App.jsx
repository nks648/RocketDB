import React, { useState } from 'react'
import Header from './components/Header'
import WorldMap from './components/WorldMap'
import LaunchSidebar from './components/LaunchSidebar'
import LaunchDetail from './components/LaunchDetail'
import MobileLaunchBanner from './components/MobileLaunchBanner'
import StatsPanel from './components/StatsPanel'
import VideoModal from './components/VideoModal'
import { useLaunches } from './hooks/useLaunches'

export default function App() {
  const { upcoming, previous, loading, error, lastUpdated, refetch } = useLaunches()
  const [selectedLaunch, setSelectedLaunch] = useState(null)
  const [videoState, setVideoState] = useState(null)
  const [activeTab, setActiveTab] = useState('upcoming')
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false)

  function handlePlayVideo(url, title) {
    setVideoState({ url, title })
  }

  function handleSelectLaunch(launch) {
    setSelectedLaunch(launch)
    // Close sheet so map is fully visible after selecting
    setMobileSheetOpen(false)
  }

  return (
    <div className="app">
      <Header
        lastUpdated={lastUpdated}
        loading={loading}
        onRefetch={refetch}
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
          />
        )}
      </div>

      {/* Mobile floating selected launch banner (above bottom sheet) */}
      {selectedLaunch && (
        <MobileLaunchBanner
          launch={selectedLaunch}
          onClose={() => setSelectedLaunch(null)}
          onPlayVideo={handlePlayVideo}
        />
      )}

      {/* Sheet backdrop dimmer */}
      {mobileSheetOpen && (
        <div
          className="sheet-backdrop"
          onClick={() => setMobileSheetOpen(false)}
        />
      )}

      <StatsPanel upcoming={upcoming} previous={previous} />

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
