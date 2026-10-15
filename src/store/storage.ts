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

/** Moves a value saved under a renamed key, unless the new key already has one. */
export function migrateKey(from: string, to: string) {
  try {
    const s = safeStorage()
    const old = s?.getItem(from)
    if (!s || old == null) return
    if (s.getItem(to) == null) s.setItem(to, old)
    s.removeItem(from)
  } catch {
    // Keep working with whatever is readable.
  }
}
