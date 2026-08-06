'use client'

import { useEffect, useState } from 'react'

/**
 * useState persisted to localStorage.
 *
 * Reads lazily after mount (SSR has no localStorage, and reading during render
 * would make hydration mismatch), then writes on every change. Storage errors
 * (private mode, quota) degrade to plain state.
 */
export function useLocalStorage<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key)
      // Deliberate one-time post-mount setState: reading localStorage in the
      // useState initializer would make server and client HTML disagree.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw !== null) setValue(JSON.parse(raw) as T)
    } catch {
      // fall through with the initial value
    }
    setLoaded(true)
  }, [key])

  useEffect(() => {
    if (!loaded) return
    try {
      window.localStorage.setItem(key, JSON.stringify(value))
    } catch {
      // storage full or unavailable — state still works for this session
    }
  }, [key, value, loaded])

  return [value, setValue] as const
}
