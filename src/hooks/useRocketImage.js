import { useState, useEffect } from 'react'

const cache = new Map()

function wikiTitleFromUrl(url) {
  if (!url) return null
  const m = url.match(/\/wiki\/([^#?]+)/)
  return m ? decodeURIComponent(m[1]) : null
}

// Wikipedia action API — more reliable than REST summary for images
async function wikiActionImage(title) {
  const url =
    `https://en.wikipedia.org/w/api.php?action=query&prop=pageimages` +
    `&pithumbsize=500&format=json&origin=*&titles=${encodeURIComponent(title)}`
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const d = await res.json()
    const pages = d.query?.pages
    if (!pages) return null
    const page = Object.values(pages)[0]
    return page?.thumbnail?.source || null
  } catch { return null }
}

// Wikipedia search — find an article by keyword then get its image
async function wikiSearchImage(query) {
  const url =
    `https://en.wikipedia.org/w/api.php?action=query&generator=search` +
    `&gsrsearch=${encodeURIComponent(query)}&gsrnamespace=0&gsrlimit=3` +
    `&prop=pageimages&pithumbsize=500&format=json&origin=*`
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const d = await res.json()
    const pages = d.query?.pages
    if (!pages) return null
    // Take the first result that has a thumbnail
    for (const page of Object.values(pages)) {
      if (page.thumbnail?.source) return page.thumbnail.source
    }
    return null
  } catch { return null }
}

async function resolveImage(launch) {
  // 1. LL2 fields (try both common naming conventions)
  const ll2 =
    launch?.image ||
    launch?.rocket?.configuration?.image_url ||
    launch?.rocket?.configuration?.image ||
    null
  if (ll2) return ll2

  const rocketName  = launch?.rocket?.configuration?.full_name || launch?.rocket?.configuration?.name
  const agencyName  = launch?.launch_service_provider?.name
  const wikiUrl     = launch?.rocket?.configuration?.wiki_url

  // 2. Wikipedia — direct article via wiki_url (action API is more reliable than REST)
  if (wikiUrl) {
    const title = wikiTitleFromUrl(wikiUrl)
    if (title) {
      const img = await wikiActionImage(title)
      if (img) return img
    }
  }

  // 3. Wikipedia — search by rocket name
  if (rocketName) {
    const query = agencyName ? `${rocketName} ${agencyName} rocket` : `${rocketName} rocket launch vehicle`
    const img = await wikiSearchImage(query)
    if (img) return img
  }

  // 4. Agency image / logo
  return (
    launch?.launch_service_provider?.image_url ||
    launch?.launch_service_provider?.logo_url ||
    null
  )
}

/**
 * Returns the best available image for a launch, trying in order:
 *   LL2 launch photo → LL2 rocket config photo → Wikipedia (direct + search) → agency logo
 */
export function useRocketImage(launch) {
  const cacheKey = launch?.id

  const [img, setImg] = useState(() => {
    if (!cacheKey) return null
    return cache.has(cacheKey) ? cache.get(cacheKey) : null
  })

  useEffect(() => {
    if (!launch) return
    if (cache.has(launch.id)) {
      setImg(cache.get(launch.id))
      return
    }

    let cancelled = false
    resolveImage(launch).then(result => {
      if (cancelled) return
      cache.set(launch.id, result)
      setImg(result)
    })
    return () => { cancelled = true }
  }, [launch?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  return img
}
