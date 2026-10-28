import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { ActivityEntry, CollectionKey, Database } from '@/types'
import { cloneDatabase, loadDatabase, resetDatabase, saveDatabase, eraseTransactions } from '@/lib/storage'
import { uid } from '@/lib/utils'

type Row = { id: string }
export interface Audit {
  action: ActivityEntry['action']
  entity: string
  detail: string
}

interface DataContextValue {
  db: Database
  /** Apply a change to a cloned draft, persist it, and optionally write an audit entry. */
  mutate: <T>(recipe: (draft: Database) => T, audit?: Audit) => T
  upsert: <K extends CollectionKey>(collection: K, record: Database[K][number], label: string) => void
  remove: <K extends CollectionKey>(collection: K, id: string, label: string, entity: string) => void
  restore: (trashId: string) => boolean
  purge: (trashId: string) => void
  setActor: (name: string) => void
  reset: () => void
  eraseData: () => void
  exportJSON: () => void
  importJSON: (file: File) => Promise<{ ok: boolean; error?: string }>
}

const DataContext = createContext<DataContextValue | null>(null)

export function DataProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<Database>(() => loadDatabase())
  const dbRef = useRef(db)
  const actorRef = useRef('System')

  const apply = useCallback((next: Database) => {
    dbRef.current = next
    setDb(next)
  }, [])

  useEffect(() => {
    saveDatabase(db)
  }, [db])

  const pushAudit = (draft: Database, audit: Audit) => {
    draft.activity.unshift({ id: uid('act'), at: new Date().toISOString(), user: actorRef.current, ...audit })
    if (draft.activity.length > 400) draft.activity.length = 400
  }

  const mutate = useCallback(
    <T,>(recipe: (draft: Database) => T, audit?: Audit): T => {
      const draft = cloneDatabase(dbRef.current)
      const result = recipe(draft)
      if (audit) pushAudit(draft, audit)
      apply(draft)
      return result
    },
    [apply],
  )

  const upsert = useCallback<DataContextValue['upsert']>(
    (collection, record, label) => {
      mutate(
        (draft) => {
          const list = draft[collection] as unknown as Row[]
          const index = list.findIndex((r) => r.id === (record as Row).id)
          const created = index < 0
          if (created) list.push(record as Row)
          else list[index] = record as Row
          return created
        },
        { action: dbRef.current[collection].some((r) => (r as Row).id === (record as Row).id) ? 'Updated' : 'Created', entity: String(collection), detail: label },
      )
    },
    [mutate],
  )

  const remove = useCallback<DataContextValue['remove']>(
    (collection, id, label, entity) => {
      mutate(
        (draft) => {
          const list = draft[collection] as unknown as Row[]
          const index = list.findIndex((r) => r.id === id)
          if (index < 0) return
          const [record] = list.splice(index, 1)
          draft.trash.unshift({
            id: uid('trash'), collection: String(collection), label, deletedAt: new Date().toISOString(),
            deletedBy: actorRef.current, record: record as unknown as Record<string, unknown>,
          })
        },
        { action: 'Deleted', entity, detail: label },
      )
    },
    [mutate],
  )

  const restore = useCallback(
    (trashId: string) =>
      mutate(
        (draft) => {
          const entry = draft.trash.find((t) => t.id === trashId)
          if (!entry) return false
          const list = (draft as unknown as Record<string, unknown>)[entry.collection]
          if (!Array.isArray(list)) return false
          list.push(entry.record)
          draft.trash = draft.trash.filter((t) => t.id !== trashId)
          return true
        },
        { action: 'Restored', entity: 'recycle bin', detail: dbRef.current.trash.find((t) => t.id === trashId)?.label ?? '' },
      ),
    [mutate],
  )

  const purge = useCallback(
    (trashId: string) => {
      mutate((draft) => {
        draft.trash = draft.trash.filter((t) => t.id !== trashId)
      })
    },
    [mutate],
  )

  const setActor = useCallback((name: string) => {
    actorRef.current = name
  }, [])

  const reset = useCallback(() => apply(resetDatabase()), [apply])

  const eraseData = useCallback(() => {
    const next = eraseTransactions(dbRef.current)
    next.activity = [{ id: uid('act'), at: new Date().toISOString(), user: actorRef.current, action: 'System', entity: 'erp', detail: 'All transactions erased' }]
    apply(next)
  }, [apply])

  const exportJSON = useCallback(() => {
    const blob = new Blob([JSON.stringify(dbRef.current, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `ganga-erp-backup-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }, [])

  const importJSON = useCallback(
    async (file: File) => {
      try {
        const parsed = JSON.parse(await file.text()) as Database
        if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.parties) || !Array.isArray(parsed.docs)) {
          return { ok: false, error: 'That file does not look like a Ganga ERP backup.' }
        }
        apply(parsed)
        return { ok: true }
      } catch {
        return { ok: false, error: 'Could not read that file. Please choose a valid JSON backup.' }
      }
    },
    [apply],
  )

  const value = useMemo<DataContextValue>(
    () => ({ db, mutate, upsert, remove, restore, purge, setActor, reset, eraseData, exportJSON, importJSON }),
    [db, mutate, upsert, remove, restore, purge, setActor, reset, eraseData, exportJSON, importJSON],
  )
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData(): DataContextValue {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData must be used inside a DataProvider')
  return ctx
}
