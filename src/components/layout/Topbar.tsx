import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Bell, ChevronDown, Command, LogOut, Menu, Moon, PanelLeftClose, PanelLeftOpen, Search, Sun, Building } from 'lucide-react'
import { useData } from '@/store/DataContext'
import { useAuth } from '@/store/AuthContext'
import { useClickOutside, useTheme } from '@/hooks'
import { DOC_META } from '@/lib/docConfig'
import { docTotal, nameOf, pendingAlerts } from '@/lib/calc'
import { cn, formatCurrency, formatDate, todayISO } from '@/lib/utils'

interface SearchResult {
  id: string
  label: string
  sub: string
  to: string
  group: string
}

export function Topbar({ onMenuClick, onToggleCollapse, mini }: { onMenuClick: () => void; onToggleCollapse: () => void; mini: boolean }) {
  const { db } = useData()
  const { user, role, logout, accessFor } = useAuth()
  const { theme, toggle: toggleTheme } = useTheme()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [bellOpen, setBellOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const searchInputRef = useRef<HTMLInputElement | null>(null)

  const searchRef = useClickOutside<HTMLDivElement>(() => setSearchOpen(false))
  const bellRef = useClickOutside<HTMLDivElement>(() => setBellOpen(false))
  const menuRef = useClickOutside<HTMLDivElement>(() => setMenuOpen(false))

  const alerts = useMemo(() => pendingAlerts(db), [db])
  const urgent = alerts.filter((a) => a.severity === 'high').length
  const org = db.organizations.find((o) => o.id === user?.orgId) ?? db.organizations[0]

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        searchInputRef.current?.focus()
        setSearchOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const index = useMemo<SearchResult[]>(() => {
    const out: SearchResult[] = []
    if (accessFor('masters') !== 'none') {
      db.parties.forEach((p) =>
        out.push({ id: p.id, label: p.name, sub: `${p.code} · ${p.city}`, to: p.type === 'Customer' ? '/masters/customers' : p.type === 'Vendor' ? '/masters/vendors' : '/logistics/dealers', group: p.type }),
      )
      db.items.forEach((i) => out.push({ id: i.id, label: i.name, sub: `${i.code} · ${formatCurrency(i.sellingRate || i.purchaseRate)}`, to: '/masters/items', group: 'Item' }))
    }
    db.docs.forEach((d) => {
      const meta = DOC_META[d.kind]
      if (accessFor(meta.side) === 'none') return
      out.push({ id: d.id, label: d.no, sub: `${meta.label} · ${nameOf(db.parties, d.partyId)} · ${formatCurrency(docTotal(d, db), true)}`, to: meta.route, group: meta.label })
    })
    return out
  }, [db, accessFor])

  const results = useMemo(() => {
    const term = query.trim().toLowerCase()
    if (!term) return []
    return index.filter((e) => `${e.label} ${e.sub} ${e.group}`.toLowerCase().includes(term)).slice(0, 8)
  }, [index, query])

  useEffect(() => setActiveIndex(0), [query])

  const openResult = (r: SearchResult) => {
    navigate(r.to, { state: { openId: r.id } })
    setQuery('')
    setSearchOpen(false)
  }

  const onSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setSearchOpen(true)
      setActiveIndex((c) => Math.min(c + 1, Math.max(results.length - 1, 0)))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((c) => Math.max(c - 1, 0))
    } else if (event.key === 'Enter' && results[activeIndex]) {
      event.preventDefault()
      openResult(results[activeIndex])
    } else if (event.key === 'Escape') {
      setSearchOpen(false)
      event.currentTarget.blur()
    }
  }

  const initials = (user?.name ?? 'G').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()

  return (
    <header className="no-print sticky top-0 z-20 flex h-[68px] items-center gap-3 border-b border-silver-200 bg-surface/85 px-4 backdrop-blur-xl lg:px-9">
      <button
        type="button"
        onClick={onMenuClick}
        className="hit pressable grid h-10 w-10 shrink-0 place-items-center rounded-full border border-silver-200 bg-surface text-navy-700 shadow-flat transition-colors hover:bg-silver-50 lg:hidden"
        aria-label="Open navigation"
      >
        <Menu className="h-5 w-5" />
      </button>
      <button
        type="button"
        onClick={onToggleCollapse}
        className="hit pressable hidden h-10 w-10 shrink-0 place-items-center rounded-full border border-silver-200 bg-surface text-navy-700 shadow-flat transition-colors hover:bg-silver-50 lg:grid"
        aria-label={mini ? 'Expand sidebar' : 'Collapse sidebar'}
        title={mini ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {mini ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
      </button>

      <div ref={searchRef} className="relative w-full max-w-md">
        <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-silver-500" aria-hidden="true" />
        <input
          ref={searchInputRef}
          value={query}
          role="combobox"
          aria-expanded={searchOpen && Boolean(query.trim())}
          aria-controls="topbar-search-results"
          aria-autocomplete="list"
          aria-label="Search parties, items and documents"
          onChange={(e) => {
            setQuery(e.target.value)
            setSearchOpen(true)
          }}
          onFocus={() => setSearchOpen(true)}
          onKeyDown={onSearchKeyDown}
          placeholder="Search customers, items, invoices…"
          className="h-11 w-full rounded-[14px] border border-silver-200 bg-silver-50 pr-16 pl-10 text-[16px] text-navy-900 transition-[border-color,box-shadow,background-color] duration-150 placeholder:text-silver-600 hover:border-silver-300 focus:border-blue-500 focus:bg-surface focus:ring-2 focus:ring-blue-100 focus:outline-none sm:text-sm"
        />
        <kbd className="pointer-events-none absolute top-1/2 right-2.5 hidden -translate-y-1/2 items-center gap-0.5 rounded-md border border-silver-200 bg-surface px-1.5 py-0.5 text-[10px] font-semibold text-silver-600 sm:flex">
          <Command className="h-2.5 w-2.5" />K
        </kbd>

        {searchOpen && query.trim() ? (
          <div id="topbar-search-results" role="listbox" className="animate-pop-in absolute inset-x-0 top-12 z-30 origin-top overflow-hidden rounded-xl bg-surface shadow-panel">
            {results.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-silver-600">No matching records found.</p>
            ) : (
              <ul className="max-h-80 divide-y divide-silver-200 overflow-y-auto">
                {results.map((r, i) => (
                  <li key={`${r.group}-${r.id}`} role="option" aria-selected={i === activeIndex}>
                    <button
                      type="button"
                      onMouseEnter={() => setActiveIndex(i)}
                      onClick={() => openResult(r)}
                      className={cn('flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors', i === activeIndex ? 'bg-blue-50' : 'hover:bg-silver-50')}
                    >
                      <span className="rounded-md bg-silver-100 px-1.5 py-0.5 text-[10px] font-bold tracking-wide whitespace-nowrap text-silver-600 uppercase">{r.group}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-medium text-navy-900">{r.label}</span>
                        <span className="block truncate text-xs text-silver-600">{r.sub}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
      </div>

      <div className="ml-auto flex items-center gap-2 sm:gap-3">
        {org ? (
          <Link
            to="/admin/switch"
            className="hidden items-center gap-2 rounded-full border border-silver-200 bg-surface px-3 py-2 text-[12px] font-semibold text-navy-700 shadow-flat transition-colors hover:bg-silver-50 xl:flex"
            title="Switch company profile"
          >
            <Building className="h-4 w-4 text-sapphire-600" />
            <span className="max-w-[170px] truncate">{org.name}</span>
          </Link>
        ) : null}

        <button
          type="button"
          onClick={toggleTheme}
          className="hit pressable grid h-10 w-10 place-items-center rounded-full border border-silver-200 bg-surface text-navy-700 shadow-flat transition-colors hover:bg-silver-50"
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </button>

        <div ref={bellRef} className="relative">
          <button
            type="button"
            onClick={() => setBellOpen((v) => !v)}
            aria-expanded={bellOpen}
            aria-label={`Pending alerts: ${alerts.length}`}
            className={cn(
              'hit pressable relative grid h-10 w-10 place-items-center rounded-full border border-silver-200 bg-surface text-navy-700 shadow-flat transition-colors hover:bg-silver-50',
              urgent > 0 && !bellOpen && 'animate-pulse-ring',
            )}
          >
            <Bell className="h-5 w-5" />
            {alerts.length > 0 ? (
              <span className="tnum absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-linear-to-b from-rose-500 to-rose-600 px-1 text-[10px] font-bold text-white ring-2 ring-surface">
                {alerts.length > 9 ? '9+' : alerts.length}
              </span>
            ) : null}
          </button>
          {bellOpen ? (
            <div className="animate-pop-in absolute right-0 top-12 z-30 w-[min(380px,calc(100vw-2rem))] origin-top-right overflow-hidden rounded-xl bg-surface shadow-panel">
              <div className="flex items-center justify-between border-b border-silver-100 bg-silver-50/70 px-4 py-3">
                <p className="text-[13px] font-bold text-navy-900">Pending alerts</p>
                <span className="text-xs text-silver-600">{formatDate(todayISO())}</span>
              </div>
              {alerts.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-silver-600">Nothing pending. All caught up.</p>
              ) : (
                <ul className="max-h-80 divide-y divide-silver-200 overflow-y-auto">
                  {alerts.slice(0, 7).map((a) => (
                    <li key={a.id}>
                      <Link to={a.to} onClick={() => setBellOpen(false)} className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-silver-50">
                        <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', a.severity === 'high' ? 'bg-rose-500' : a.severity === 'medium' ? 'bg-amber-500' : 'bg-blue-500')} aria-hidden="true" />
                        <span className="min-w-0">
                          <span className="block truncate text-[13px] font-medium text-navy-900">{a.label}</span>
                          <span className="block truncate text-xs text-silver-600">{a.kind} · {a.detail}</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              <Link to="/logistics/alerts" onClick={() => setBellOpen(false)} className="block border-t border-silver-100 px-4 py-2.5 text-center text-xs font-bold text-blue-700 transition-colors hover:bg-silver-50">
                Open alert centre ({alerts.length})
              </Link>
            </div>
          ) : null}
        </div>

        <div ref={menuRef} className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-expanded={menuOpen}
            className="pressable flex items-center gap-2.5 rounded-full border border-silver-200 bg-surface py-1 pr-3 pl-1 shadow-flat transition-colors hover:bg-silver-50"
          >
            <span className="grid h-8 w-8 place-items-center rounded-full bg-linear-to-br from-[#ed7333] to-[#d6581e] text-[10.5px] font-bold text-white shadow-[inset_0_1px_0_0_rgba(255,255,255,0.25)] ring-2 ring-gold-300/70">{initials}</span>
            <span className="hidden text-left leading-tight sm:block">
              <span className="block text-[11.5px] font-bold text-navy-900">{user?.name}</span>
              <span className="block text-[10px] text-silver-600">{role?.name}</span>
            </span>
            <ChevronDown className="hidden h-3.5 w-3.5 text-silver-500 sm:block" />
          </button>
          {menuOpen ? (
            <div className="animate-pop-in absolute right-0 top-12 z-30 w-60 origin-top-right overflow-hidden rounded-xl bg-surface shadow-panel">
              <div className="border-b border-silver-100 bg-silver-50/70 px-4 py-3">
                <p className="truncate text-[13px] font-bold text-navy-900">{user?.name}</p>
                <p className="truncate text-xs text-silver-600">{user?.email}</p>
              </div>
              <Link to="/company/profile" onClick={() => setMenuOpen(false)} className="block px-4 py-2.5 text-[13px] font-medium text-navy-800 hover:bg-silver-50">Company profile</Link>
              <Link to="/admin/switch" onClick={() => setMenuOpen(false)} className="block px-4 py-2.5 text-[13px] font-medium text-navy-800 hover:bg-silver-50">Switch profile</Link>
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false)
                  logout()
                }}
                className="flex w-full items-center gap-2 border-t border-silver-100 px-4 py-2.5 text-left text-[13px] font-semibold text-rose-700 hover:bg-rose-50"
              >
                <LogOut className="h-4 w-4" /> Sign out
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  )
}
