// localStorage can be missing or throw (private mode, sandboxed iframes, quota); callers then keep state in memory.
export function safeStorage(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export function readJson(key: string): unknown {
  try {
    const raw = safeStorage()?.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function writeJson(key: string, value: unknown) {
  try {
    safeStorage()?.setItem(key, JSON.stringify(value))
  } catch {
    // Keep working in memory.
  }
}
