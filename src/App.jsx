import React, { useState } from 'react'
import Header from './components/Header'
import WorldMap from './components/WorldMap'
import LaunchSidebar from './components/LaunchSidebar'
import LaunchDetail from './components/LaunchDetail'
import StatsPanel from './components/StatsPanel'
import VideoModal from './components/VideoModal'
import { useLaunches } from './hooks/useLaunches'

export default function App() {
  const { upcoming, previous, loading, error, lastUpdated, refetch } = useLaunches()
  const [selectedLaunch, setSelectedLaunch] = useState(null)
  const [videoState, setVideoState] = useState(null) // { url, title }
  const [activeTab, setActiveTab] = useState('upcoming')

  function handlePlayVideo(url, title) {
    setVideoState({ url, title })
  }

  function handleSelectLaunch(launch) {
    setSelectedLaunch(launch)
  }

  return (
    <div className="app">
      <Header
        lastUpdated={lastUpdated}
        loading={loading}
        onRefetch={refetch}
      />

      <LaunchSidebar
        upcoming={upcoming}
        previous={previous}
        loading={loading}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        selectedLaunch={selectedLaunch}
        onSelectLaunch={handleSelectLaunch}
        onPlayVideo={handlePlayVideo}
      />

      <div className="map-area">
        <WorldMap
          launches={[...upcoming, ...previous]}
          selectedLaunch={selectedLaunch}
          onSelectLaunch={handleSelectLaunch}
          onPlayVideo={handlePlayVideo}
        />

        {selectedLaunch && (
          <LaunchDetail
            launch={selectedLaunch}
            onClose={() => setSelectedLaunch(null)}
            onPlayVideo={handlePlayVideo}
          />
        )}
      </div>

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
          ⚠ API error: {error} — showing cached data
        </div>
      )}
    </div>
  )
}
