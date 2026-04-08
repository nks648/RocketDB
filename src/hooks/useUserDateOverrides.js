import { useState, useCallback } from 'react'

const STORAGE_KEY = 'rocketdb:date-overrides:v1'

function load() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') } catch { return {} }
}

function save(data) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)) } catch { /* full */ }
}

/**
 * Per-launch user date overrides, stored in localStorage.
 * Each override: { net: ISO string, note: string }
 */
export function useUserDateOverrides() {
  const [overrides, setOverrides] = useState(load)

  const set = useCallback((launchId, net, note = '') => {
    setOverrides(prev => {
      const next = { ...prev, [launchId]: { net, note, savedAt: new Date().toISOString() } }
      save(next)
      return next
    })
  }, [])

  const clear = useCallback((launchId) => {
    setOverrides(prev => {
      const next = { ...prev }
      delete next[launchId]
      save(next)
      return next
    })
  }, [])

  return { overrides, set, clear }
}
