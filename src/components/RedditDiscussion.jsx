import React from 'react'
import { useRedditThread } from '../hooks/useRedditThread'

const RedditIcon = () => (
  <svg width="11" height="11" viewBox="0 0 20 20" fill="currentColor"
    style={{ color:'#ff4500', verticalAlign:'middle', marginRight:4 }}>
    <circle cx="10" cy="10" r="10"/>
    <path fill="white" d="M16.7 10a1.5 1.5 0 0 0-2.6-1 7.4 7.4 0 0 0-3.9-1.2l.7-3.1 2.1.5a1 1 0 1 0 .1-.5l-2.4-.5a.2.2 0 0 0-.3.2l-.7 3.4a7.4 7.4 0 0 0-3.9 1.2 1.5 1.5 0 1 0-1.6 2.4 3 3 0 0 0 0 .5c0 2.5 2.9 4.5 6.5 4.5s6.5-2 6.5-4.5a3 3 0 0 0 0-.5 1.5 1.5 0 0 0 .5-1.4zm-10.2 1a1 1 0 1 1 2 0 1 1 0 0 1-2 0zm5.6 2.7a3.4 3.4 0 0 1-4.2 0 .3.3 0 0 1 .4-.4 2.8 2.8 0 0 0 3.4 0 .3.3 0 0 1 .4.4zm-.2-1.7a1 1 0 1 1 0-2 1 1 0 0 1 0 2z"/>
  </svg>
)

export default function RedditDiscussion({ launch }) {
  const { posts, loading } = useRedditThread(launch)
  if (loading) return <div className="reddit-loading">Loading discussion…</div>
  if (!posts.length) return null
  return (
    <div className="reddit-section">
      <div className="reddit-title">
        <RedditIcon />
        Discussion
      </div>
      <div className="reddit-posts">
        {posts.map(p => (
          <a key={p.id} href={p.url} target="_blank" rel="noopener noreferrer" className="reddit-post">
            <span className="reddit-post-sub">r/{p.sub}</span>
            <span className="reddit-post-title">{p.title}</span>
            <span className="reddit-post-meta">▲{p.score} · {p.comments} comments</span>
          </a>
        ))}
      </div>
    </div>
  )
}
