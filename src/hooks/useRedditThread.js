import { useState, useEffect } from 'react'

const CACHE = {}
const TTL = 10 * 60 * 1000 // 10 min

// Only allow verified reddit.com permalink URLs
function safeRedditUrl(permalink) {
  if (!permalink || typeof permalink !== 'string') return null
  // permalink from Reddit API always starts with /r/ — prepend https://www.reddit.com
  const full = permalink.startsWith('/') ? `https://www.reddit.com${permalink}` : permalink
  try {
    const u = new URL(full)
    const ok = u.protocol === 'https:' &&
      (u.hostname === 'www.reddit.com' || u.hostname === 'reddit.com') &&
      u.pathname.startsWith('/r/')
    return ok ? full : null
  } catch { return null }
}

async function searchReddit(sub, query) {
  const q = encodeURIComponent(query)
  const url = `https://www.reddit.com/r/${sub}/search.json?q=${q}&sort=new&limit=5&t=month&restrict_sr=1`
  if (CACHE[url] && Date.now() - CACHE[url].ts < TTL) return CACHE[url].data

  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`Reddit ${res.status}`)
  const data = await res.json()
  const posts = (data?.data?.children || []).flatMap(c => {
    const postUrl = safeRedditUrl(c.data.permalink)
    if (!postUrl) return []   // drop posts with unsafe URLs
    return [{
      id: c.data.id,
      title: String(c.data.title || '').slice(0, 200),   // cap length
      url: postUrl,
      score: c.data.score,
      comments: c.data.num_comments,
      flair: c.data.link_flair_text || null,
      created: new Date(c.data.created_utc * 1000),
      sub: c.data.subreddit,
    }]
  })
  CACHE[url] = { data: posts, ts: Date.now() }
  return posts
}

// Build a short search query from a launch name like "Falcon 9 | Starlink 6-80"
function buildQuery(launch) {
  if (!launch) return null
  const name = launch.name || ''
  // Prefer mission name after " | "
  const parts = name.split(' | ')
  const mission = parts[1] || parts[0]
  // Trim to 3 words max for better results
  return mission.split(' ').slice(0, 4).join(' ')
}

export function useRedditThread(launch) {
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const query = buildQuery(launch)

  useEffect(() => {
    if (!query) { setPosts([]); return }

    let cancelled = false
    setLoading(true)
    setError(null)

    Promise.allSettled([
      searchReddit('spacex', query),
      searchReddit('rocketlaunch', query),
    ]).then(results => {
      if (cancelled) return
      const all = []
      for (const r of results) {
        if (r.status === 'fulfilled') all.push(...r.value)
      }
      // Deduplicate by id, sort by created desc
      const seen = new Set()
      const unique = all.filter(p => {
        if (seen.has(p.id)) return false
        seen.add(p.id)
        return true
      }).sort((a, b) => b.created - a.created).slice(0, 6)

      setPosts(unique)
      if (all.length === 0 && results.every(r => r.status === 'rejected')) {
        setError('Reddit unavailable')
      }
    }).finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [query])

  return { posts, loading, error }
}
