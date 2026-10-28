import { useLocation } from 'react-router-dom'
import { navItemFor } from '@/config/nav'
import { useAuth } from '@/store/AuthContext'

/** Access level for the screen currently on display. */
export function useAccess() {
  const { pathname } = useLocation()
  const { accessFor } = useAuth()
  const item = navItemFor(pathname)
  const level = item ? accessFor(item.access) : 'edit'
  return { level, canView: level !== 'none', canEdit: level === 'edit' }
}
