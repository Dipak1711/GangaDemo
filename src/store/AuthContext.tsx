import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Access, Role, User } from '@/types'
import { useData } from '@/store/DataContext'
import { readSession, writeSession } from '@/lib/storage'
import { uid } from '@/lib/utils'

interface AuthValue {
  user: User | null
  role: Role | null
  login: (username: string, password: string) => { ok: boolean; error?: string }
  logout: () => void
  accessFor: (group: string) => Access
}

const AuthContext = createContext<AuthValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const { db, mutate, setActor } = useData()
  const [userId, setUserId] = useState<string | null>(() => readSession())

  const user = useMemo(() => db.users.find((u) => u.id === userId && u.status === 'Active') ?? null, [db.users, userId])
  const role = useMemo(() => db.roles.find((r) => r.id === user?.roleId) ?? null, [db.roles, user])

  useEffect(() => {
    setActor(user?.name ?? 'System')
  }, [user, setActor])

  const login = useCallback<AuthValue['login']>(
    (username, password) => {
      const found = db.users.find((u) => u.username.toLowerCase() === username.trim().toLowerCase())
      if (!found || found.password !== password) return { ok: false, error: 'Invalid username or password.' }
      if (found.status !== 'Active') return { ok: false, error: 'This account is disabled. Contact an administrator.' }
      writeSession(found.id)
      setUserId(found.id)
      setActor(found.name)
      mutate(
        (draft) => {
          draft.activity.unshift({ id: uid('act'), at: new Date().toISOString(), user: found.name, action: 'Login', entity: 'session', detail: `${found.username} signed in` })
        },
      )
      return { ok: true }
    },
    [db.users, mutate, setActor],
  )

  const logout = useCallback(() => {
    if (user) {
      mutate((draft) => {
        draft.activity.unshift({ id: uid('act'), at: new Date().toISOString(), user: user.name, action: 'Logout', entity: 'session', detail: `${user.username} signed out` })
      })
    }
    writeSession(null)
    setUserId(null)
  }, [mutate, user])

  const accessFor = useCallback((group: string): Access => role?.access[group] ?? 'none', [role])

  const value = useMemo(() => ({ user, role, login, logout, accessFor }), [user, role, login, logout, accessFor])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside an AuthProvider')
  return ctx
}
