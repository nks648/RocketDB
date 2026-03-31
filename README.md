# 🚀 RocketDB

A real-time rocket launch tracker built with React. Live launch data, an interactive world map, pad weather, orbital parameters, cinematic countdown mode, and more — all in one responsive web app.

**Live site:** [nks648.github.io/RocketDB](https://nks648.github.io/RocketDB/)

---

## Features

### Launch Data
- **Upcoming & Previous launches** — fetches up to 50 upcoming and 30 recent launches from the [Launch Library 2 API](https://thespacedevs.com/llapi)
- **Live countdown timers** — ticking T-minus countdowns for every upcoming launch
- **Status badges** — Go, TBC, TBD, Hold, In Flight, Success, Failure, Partial Failure, Pending Result
- **Search & filter** — filter by rocket name, agency, or launch site; agency dropdown; favorites-only view
- **Favorites** — star any launch; persisted to localStorage across sessions
- **Deep linking** — URL `?id=<launch_id>` links directly to a specific launch

### Launch Detail Panel
- Mission description, launch window, hold/failure reasons
- **Booster / Reuse** — serial number, flight number, reuse and landing outcome
- **Orbital Parameters** — estimated altitude, inclination, period, and velocity for the target orbit
- **Pad Weather** — live conditions (temp, wind, cloud cover, visibility) with a GO / MARGINAL / NO-GO assessment and 6-hour forecast, powered by [Open-Meteo](https://open-meteo.com/)
- **Reddit discussion** — links to the r/spacex / r/RocketLaunch thread for the mission
- **Share** — Web Share API with clipboard fallback
- **Calendar export** — downloads a `.ics` file to add the launch to any calendar app
- **Notify Me** — browser push notifications at T-1 hour, T-30 min, T-5 min, and T-0

### World Map
- Interactive [Leaflet](https://leafletjs.com/) map with launch site markers
- Rocket popups with live countdown on hover
- **ISS tracker** — real-time ISS position with purple ground track
- **Ascent arc** — estimated ground track from pad to target orbit
- **NOTAM zones** — FAA airspace restriction overlays near active pads
- **Space weather overlay** — Kp-index geomagnetic storm indicator
- Toggleable map layers: ISS track, ascent arc, NOTAM zones

### Cinematic Mode
Full-screen immersive T-0 experience — press **F** or click **Cinema** in the detail panel:
- Blurred launch image backdrop
- Giant live countdown
- Mission name, site, and status
- Direct stream / Watch Live buttons
- Press **Esc** to exit

### Responsive Design
| Breakpoint | Layout |
|---|---|
| > 1100 px (desktop) | Sidebar + map + stats bar |
| 901 – 1100 px (tablet landscape) | Narrower sidebar (260 px) |
| 769 – 900 px (tablet portrait / iPad) | Compact sidebar (230 px), stats hidden |
| ≤ 768 px (mobile) | Full-screen map, bottom-sheet launch list, floating launch banner |

Works on iPhone, Android, iPad, and all major desktop browsers in both portrait and landscape.

### Other
- **Light / Dark theme** — toggled from the header, persisted to localStorage
- **Space weather badge** — live Kp index with storm alerts from [NOAA SWPC](https://www.swpc.noaa.gov/)
- **Keyboard shortcuts** — `N` next, `P` previous, `F` cinematic, `R` refresh, `Esc` close
- **Offline support** — service worker caches the app shell; stale launch data served when offline
- **PWA** — installable on mobile and desktop via `manifest.json`
- **Rocket images** — multi-source fallback: LL2 launch photo → LL2 rocket config photo → Wikipedia thumbnail → agency logo

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | [React 18](https://react.dev/) |
| Build tool | [Vite 5](https://vitejs.dev/) |
| Map | [Leaflet](https://leafletjs.com/) + [React-Leaflet](https://react-leaflet.js.org/) |
| Fonts | Space Grotesk, Space Mono (Google Fonts) |
| Hosting | GitHub Pages |
| Launch data | [Launch Library 2](https://thespacedevs.com/llapi) (dev server) |
| Weather | [Open-Meteo](https://open-meteo.com/) |
| Space weather | [NOAA SWPC](https://www.swpc.noaa.gov/) |
| ISS position | [Open Notify](http://open-notify.org/) |
| Images | LL2 API + [Wikipedia REST API](https://www.mediawiki.org/wiki/API:REST_API) |

No backend. Everything runs in the browser.

---

## Getting Started

### Prerequisites
- Node.js 18+
- npm 9+

### Install & run locally

```bash
git clone https://github.com/nks648/RocketDB.git
cd RocketDB
npm install
npm run dev
```

Open [http://localhost:5173/RocketDB/](http://localhost:5173/RocketDB/)

### Build for production

```bash
npm run build
```

Output goes to `dist/`. The `base: '/RocketDB/'` path in `vite.config.js` is set for GitHub Pages deployment.

### Deploy to GitHub Pages

```bash
npm run build
# then push dist/ or use the gh-pages package
```

---

## Project Structure

```
src/
├── components/
│   ├── CinematicMode.jsx     # Full-screen T-0 countdown overlay
│   ├── CountdownTimer.jsx    # Reusable live countdown
│   ├── Header.jsx            # Top bar: logo, status, theme, shortcuts
│   ├── LaunchCard.jsx        # Sidebar list item
│   ├── LaunchDetail.jsx      # Bottom detail panel (desktop)
│   ├── LaunchSidebar.jsx     # Upcoming / Previous list + filters
│   ├── MobileLaunchBanner.jsx# Floating detail card (mobile)
│   ├── OrbitalParams.jsx     # Altitude, inclination, period, velocity
│   ├── RedditDiscussion.jsx  # r/spacex / r/RocketLaunch thread link
│   ├── SpaceWeatherBadge.jsx # Kp index badge with storm alerts
│   ├── StatsPanel.jsx        # Bottom stats bar (desktop)
│   ├── VideoModal.jsx        # Embedded YouTube / stream player
│   ├── WeatherWidget.jsx     # Pad weather with GO/NO-GO assessment
│   └── WorldMap.jsx          # Leaflet map with all overlays
├── hooks/
│   ├── useFavorites.js       # localStorage-backed favorites Set
│   ├── useISS.js             # Real-time ISS position polling
│   ├── useLaunches.js        # LL2 API fetch + classification logic
│   ├── useRocketImage.js     # Multi-source image fallback hook
│   ├── useSpaceWeather.js    # NOAA SWPC Kp index
│   ├── useSunriseSunset.js   # Day/night at launch pad
│   ├── useRedditThread.js    # Reddit thread search
│   └── useWeather.js         # Open-Meteo pad weather
├── utils/
│   ├── orbital.js            # Altitude, inclination, period, velocity estimates
│   └── shareExport.js        # Web Share API + .ics calendar export
├── data/
│   └── launchZones.js        # Status map, NOTAM zone definitions
├── App.jsx                   # Root: state, routing, keyboard shortcuts
└── index.css                 # All styles (CSS variables, responsive breakpoints)
public/
├── manifest.json             # PWA manifest
└── sw.js                     # Service worker (cache-first shell)
```

---

## API Rate Limits

The app uses the **LL2 development server** (`lldev.thespacedevs.com`) which allows 15 requests/hour. Launch data is cached in `localStorage` for 15 minutes, so normal usage makes at most 8 requests/hour (well within the limit).

---

## License

MIT
