import { useState, useEffect } from 'react'

// Shared in-memory cache — avoids re-fetching within a session
const cache = new Map()

function wikiTitle(url) {
  if (!url) return null
  const m = url.match(/\/wiki\/([^#?]+)/)
  return m ? decodeURIComponent(m[1].replace(/_/g, ' ')) : null
}

async function fetchWiki(wikiUrl) {
  const title = wikiTitle(wikiUrl)
  if (!title) return null

  const key = `wiki:${title}`
  if (cache.has(key)) return cache.get(key)

  try {
    const res = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`
    )
    if (!res.ok) { cache.set(key, null); return null }
    const d = await res.json()
    const img = d.thumbnail?.source || d.originalimage?.source || null
    cache.set(key, img)
    return img
  } catch {
    cache.set(key, null)
    return null
  }
}

/**
 * Returns the best available image URL for a launch, loading async fallbacks
 * as needed. Priority:
 *   1. launch.image                         (LL2 launch-specific photo)
 *   2. rocket.configuration.image_url       (LL2 rocket type photo)
 *   3. Wikipedia thumbnail                  (via rocket.configuration.wiki_url)
 *   4. launch_service_provider.image_url    (agency photo)
 *   5. launch_service_provider.logo_url     (agency logo — last resort)
 */
export function useRocketImage(launch) {
  const syncImg =
    launch?.image ||
    launch?.rocket?.configuration?.image_url ||
    null

  const wikiUrl = launch?.rocket?.configuration?.wiki_url

  // Check wiki cache synchronously so there's no flicker on re-renders
  const cachedWiki = wikiUrl
    ? (cache.has(`wiki:${wikiTitle(wikiUrl)}`) ? cache.get(`wiki:${wikiTitle(wikiUrl)}`) : undefined)
    : null

  const [wikiImg, setWikiImg] = useState(cachedWiki ?? null)

  useEffect(() => {
    if (syncImg) return            // already have an image — no fetch needed
    if (cachedWiki !== undefined) return  // already checked Wikipedia

    let cancelled = false
    fetchWiki(wikiUrl).then(img => {
      if (!cancelled) setWikiImg(img)
    })
    return () => { cancelled = true }
  }, [syncImg, wikiUrl, cachedWiki])

  return (
    syncImg ||
    wikiImg ||
    launch?.launch_service_provider?.image_url ||
    launch?.launch_service_provider?.logo_url ||
    null
  )
}
