import { useState, useCallback } from 'react'

const LS_KEY = 'rocketdb:favorites'

function load() {
  try { return new Set(JSON.parse(localStorage.getItem(LS_KEY) || '[]')) } catch { return new Set() }
}

function save(set) {
  try { localStorage.setItem(LS_KEY, JSON.stringify([...set])) } catch {}
}

export function useFavorites() {
  const [favs, setFavs] = useState(load)

  const toggle = useCallback(id => {
    setFavs(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      save(next)
      return next
    })
  }, [])

  return { favs, toggle }
}
