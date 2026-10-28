import { Suspense, useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Lock } from 'lucide-react'
import { Sidebar } from '@/components/layout/Sidebar'
import { Topbar } from '@/components/layout/Topbar'
import { EmptyState } from '@/components/ui/Layout'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { useAccess } from '@/hooks/useAccess'

function PageFallback() {
  return (
    <div className="flex flex-col gap-5" aria-busy="true">
      <div className="skeleton h-12 w-72" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="skeleton h-32 rounded-2xl" />
        ))}
      </div>
      <div className="skeleton h-80 rounded-2xl" />
    </div>
  )
}

export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [mini, setMini] = useState(() => {
    try {
      return localStorage.getItem('ganga.sidebar') === 'mini'
    } catch {
      return false
    }
  })
  const location = useLocation()
  const { canView } = useAccess()

  useEffect(() => {
    setSidebarOpen(false)
    window.scrollTo({ top: 0 })
  }, [location.pathname])

  const toggleMini = () => {
    setMini((current) => {
      const next = !current
      try {
        localStorage.setItem('ganga.sidebar', next ? 'mini' : 'full')
      } catch {
        /* preference just isn't remembered */
      }
      return next
    })
  }

  return (
    <div className="app-canvas no-print relative flex min-h-screen">
      <Sidebar open={sidebarOpen} mini={mini} onClose={() => setSidebarOpen(false)} />
      <div className="relative flex min-w-0 flex-1 flex-col">
        <Topbar onMenuClick={() => setSidebarOpen(true)} onToggleCollapse={toggleMini} mini={mini} />
        <main className="flex-1 px-4 py-6 lg:px-9 lg:py-8">
          <div key={location.pathname} className="page-enter mx-auto flex w-full max-w-[1640px] flex-col gap-5">
            {canView ? (
              <ErrorBoundary resetKey={location.pathname}>
                <Suspense fallback={<PageFallback />}>
                  <Outlet />
                </Suspense>
              </ErrorBoundary>
            ) : (
              <EmptyState
                icon={<Lock className="h-5 w-5" />}
                title="You do not have access to this module"
                description="Ask an administrator to grant your role access under Admin → Roles & Permissions."
              />
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
