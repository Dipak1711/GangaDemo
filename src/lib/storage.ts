import type { Database } from '@/types'
import { createSeedDatabase, DB_VERSION } from '@/lib/seed'

export const STORAGE_KEY = 'ganga_erp_db'
export const SESSION_KEY = 'ganga_erp_session'

function storage(): Storage | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null
    return window.localStorage
  } catch {
    return null
  }
}

export function saveDatabase(db: Database): void {
  const store = storage()
  if (!store) return
  try {
    store.setItem(STORAGE_KEY, JSON.stringify(db))
  } catch (error) {
    console.error('[ganga] Failed to persist data', error)
  }
}

/** Fill any collection missing from an older / partial payload with seed defaults. */
function mergeWithDefaults(parsed: Partial<Database>): Database {
  const seed = createSeedDatabase()
  const merged = { ...seed } as Record<string, unknown>
  for (const key of Object.keys(seed) as Array<keyof Database>) {
    const value = parsed[key]
    if (value === undefined || value === null) continue
    if (Array.isArray(seed[key])) {
      if (Array.isArray(value)) merged[key] = value
    } else if (typeof seed[key] === 'object') {
      merged[key] = { ...(seed[key] as object), ...(value as object) }
    } else {
      merged[key] = value
    }
  }
  const out = merged as unknown as Database
  out.version = DB_VERSION
  return out
}

export function loadDatabase(): Database {
  const store = storage()
  if (!store) return createSeedDatabase()
  let raw: string | null = null
  try {
    raw = store.getItem(STORAGE_KEY)
  } catch {
    raw = null
  }
  if (!raw) {
    const seed = createSeedDatabase()
    saveDatabase(seed)
    return seed
  }
  try {
    const parsed = JSON.parse(raw) as Partial<Database>
    if (!parsed || typeof parsed !== 'object') throw new Error('Invalid payload')
    if (parsed.version !== DB_VERSION) {
      const seed = createSeedDatabase()
      saveDatabase(seed)
      return seed
    }
    return mergeWithDefaults(parsed)
  } catch (error) {
    console.warn('[ganga] Corrupt stored data detected, recreating defaults.', error)
    const seed = createSeedDatabase()
    saveDatabase(seed)
    return seed
  }
}

export function resetDatabase(): Database {
  const seed = createSeedDatabase()
  saveDatabase(seed)
  return seed
}

/** A database with configuration masters kept but every transaction removed. */
export function eraseTransactions(db: Database): Database {
  return {
    ...db,
    docs: [], stockMoves: [], serials: [], vouchers: [], expenses: [], workOrders: [], complaints: [], amcs: [],
    attendance: [], leaves: [], alertLogs: [], trash: [],
    series: db.series.map((s) => ({ ...s, next: 1 })),
    items: db.items.map((i) => ({ ...i, openingStock: 0 })),
  }
}

export function cloneDatabase(db: Database): Database {
  if (typeof structuredClone === 'function') return structuredClone(db)
  return JSON.parse(JSON.stringify(db)) as Database
}

export function readSession(): string | null {
  try {
    return storage()?.getItem(SESSION_KEY) ?? null
  } catch {
    return null
  }
}
export function writeSession(userId: string | null): void {
  try {
    const store = storage()
    if (!store) return
    if (userId) store.setItem(SESSION_KEY, userId)
    else store.removeItem(SESSION_KEY)
  } catch {
    /* session just won't persist */
  }
}
