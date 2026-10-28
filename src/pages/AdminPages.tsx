import { useMemo, useState } from 'react'
import { Activity, Building, Check, Download, KeyRound, Lock, Plus, Save, Trash2, UserCog } from 'lucide-react'
import type { Access, Role } from '@/types'
import { useData } from '@/store/DataContext'
import { useAuth } from '@/store/AuthContext'
import { useToast } from '@/store/ToastContext'
import { useAccess } from '@/hooks/useAccess'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Card, CardHeader } from '@/components/ui/Card'
import { ConfirmDialog } from '@/components/ui/Modal'
import { Field, Input, Select, Textarea } from '@/components/ui/Form'
import { PageHeader, SearchInput } from '@/components/ui/Layout'
import { Table, TableEmptyRow, TableShell, TBody, Td, Th, THead, TR } from '@/components/ui/Table'
import { CrudPage, opts } from '@/components/Crud'
import { ACCESS_GROUPS } from '@/lib/seed'
import { inUse } from '@/lib/refs'
import { cn, downloadCSV, formatDateTime, uid } from '@/lib/utils'
import { ActiveBadge, strong, sub } from '@/pages/common'

export function OrganizationsPage() {
  return (
    <CrudPage
      collection="organizations" entity="Company profile" title="Company Profiles" icon={<Building className="h-5 w-5" />} eyebrow="Admin / Security" description="Organisations that can be switched between from the top bar."
      blank={() => ({ id: uid('org'), name: '', gstin: '', city: '', state: 'Gujarat', status: 'Active' })}
      columns={[
        { key: 'name', label: 'Company', render: (r) => strong(r.name) }, { key: 'gstin', label: 'GSTIN', hideBelow: 'md', render: (r) => <span className="font-mono text-xs">{r.gstin || '—'}</span>, text: (r) => r.gstin },
        { key: 'city', label: 'Location', render: (r) => `${r.city}${r.state ? `, ${r.state}` : ''}`, text: (r) => r.city },
        { key: 'users', label: 'Users', align: 'right', render: (r, db) => db.users.filter((u) => u.orgId === r.id).length },
        { key: 'status', label: 'Status', render: (r) => <ActiveBadge status={r.status} />, text: (r) => r.status },
      ]}
      fields={[
        { key: 'name', label: 'Company name', required: true, full: true }, { key: 'gstin', label: 'GSTIN' }, { key: 'city', label: 'City', required: true }, { key: 'state', label: 'State' },
        { key: 'status', label: 'Status', type: 'select', required: true, options: [{ value: 'Active', label: 'Active' }, { value: 'Inactive', label: 'Inactive' }] },
      ]}
      validate={(d) => (d.gstin && !/^[0-9A-Z]{15}$/i.test(String(d.gstin).trim()) ? { gstin: 'GSTIN must be 15 letters/digits.' } : {})}
      modalSize="md"
    />
  )
}

export function UsersPage() {
  const { user } = useAuth()
  return (
    <CrudPage
      collection="users" entity="User" title="User Assignments" icon={<UserCog className="h-5 w-5" />} eyebrow="Admin / Security" description="Who can sign in, which company they work in, and the role that decides what they can see and change."
      blank={(db) => ({ id: uid('u'), username: '', password: '', name: '', roleId: db.roles[1]?.id ?? '', email: '', status: 'Active', orgId: db.organizations[0]?.id ?? '' })}
      columns={[
        { key: 'name', label: 'User', render: (r) => <>{strong(r.name)}{sub(r.email)}</>, text: (r) => r.name },
        { key: 'username', label: 'Username', render: (r) => <span className="font-mono text-xs font-semibold">{r.username}</span> },
        { key: 'roleId', label: 'Role', render: (r, db) => <Badge tone="purple">{db.roles.find((x) => x.id === r.roleId)?.name ?? '—'}</Badge>, text: (r, db) => db.roles.find((x) => x.id === r.roleId)?.name ?? '' },
        { key: 'orgId', label: 'Company', hideBelow: 'md', render: (r, db) => db.organizations.find((o) => o.id === r.orgId)?.name ?? '—', text: (r, db) => db.organizations.find((o) => o.id === r.orgId)?.name ?? '' },
        { key: 'status', label: 'Status', render: (r) => <ActiveBadge status={r.status} />, text: (r) => r.status },
      ]}
      fields={[
        { key: 'name', label: 'Full name', required: true }, { key: 'username', label: 'Username', required: true }, { key: 'password', label: 'Password', type: 'password', required: true, hint: 'At least 6 characters' },
        { key: 'email', label: 'Email', type: 'email' }, { key: 'roleId', label: 'Role', type: 'select', required: true, options: (db) => opts(db.roles) },
        { key: 'orgId', label: 'Company', type: 'select', required: true, options: (db) => opts(db.organizations) },
        { key: 'status', label: 'Status', type: 'select', required: true, options: [{ value: 'Active', label: 'Active' }, { value: 'Disabled', label: 'Disabled' }] },
      ]}
      validate={(d, db) => {
        const e: Record<string, string> = {}
        if (db.users.some((u) => u.id !== d.id && u.username.toLowerCase() === String(d.username).trim().toLowerCase())) e.username = 'This username is taken.'
        if (String(d.password).length < 6) e.password = 'Password must be at least 6 characters.'
        if (d.id === user?.id && d.status !== 'Active') e.status = 'You cannot disable your own account.'
        return e
      }}
      canDelete={(r, db) => (r.id === user?.id ? 'You cannot delete the account you are signed in with.' : db.users.filter((u) => u.roleId === r.roleId && u.status === 'Active').length <= 1 && db.roles.find((x) => x.id === r.roleId)?.name === 'Administrator' ? 'At least one active administrator must remain.' : null)}
      modalSize="md"
    />
  )
}

/* ------------------------------------------------------------------ */
/* Roles                                                               */
/* ------------------------------------------------------------------ */

const LEVELS: Array<{ value: Access; label: string }> = [{ value: 'none', label: 'No access' }, { value: 'view', label: 'View only' }, { value: 'edit', label: 'View & edit' }]

export function RolesPage() {
  const { db, mutate } = useData()
  const toast = useToast()
  const { canEdit } = useAccess()
  const [selectedId, setSelectedId] = useState(db.roles[0]?.id ?? '')
  const role = db.roles.find((r) => r.id === selectedId) ?? db.roles[0]
  const [draft, setDraft] = useState<Role | null>(null)
  const [deleting, setDeleting] = useState(false)
  const working = draft && draft.id === role?.id ? draft : role
  const dirty = Boolean(draft && draft.id === role?.id)
  const locked = role?.name === 'Administrator'

  const update = (patch: Partial<Role>) => role && setDraft({ ...(working as Role), ...patch })
  const setAccess = (group: string, level: Access) => role && setDraft({ ...(working as Role), access: { ...(working as Role).access, [group]: level } })
  const save = () => {
    if (!draft) return
    if (!draft.name.trim()) return toast.error('A role needs a name.')
    if (db.roles.some((r) => r.id !== draft.id && r.name.toLowerCase() === draft.name.trim().toLowerCase())) return toast.error('A role with this name already exists.')
    mutate((d) => { const i = d.roles.findIndex((r) => r.id === draft.id); if (i >= 0) d.roles[i] = { ...draft, name: draft.name.trim() } }, { action: 'Updated', entity: 'roles', detail: draft.name })
    setDraft(null)
    toast.success('Role permissions saved.')
  }
  const addRole = () => {
    const id = uid('role')
    mutate((d) => { d.roles.push({ id, name: `New role ${d.roles.length + 1}`, description: '', access: Object.fromEntries(ACCESS_GROUPS.map((g) => [g.id, g.id === 'dashboard' ? 'view' : 'none'])) as Record<string, Access> }) }, { action: 'Created', entity: 'roles', detail: 'New role' })
    setSelectedId(id)
    setDraft(null)
  }
  const removeRole = () => {
    if (!role) return
    const reason = inUse(db, 'roles', role.id)
    if (reason) { setDeleting(false); return toast.error(`Cannot delete this role. ${reason}`) }
    mutate((d) => { d.roles = d.roles.filter((r) => r.id !== role.id) }, { action: 'Deleted', entity: 'roles', detail: role.name })
    setDeleting(false)
    setSelectedId(db.roles.find((r) => r.id !== role.id)?.id ?? '')
    toast.success('Role deleted.')
  }

  const counts = useMemo(() => Object.fromEntries(db.roles.map((r) => [r.id, db.users.filter((u) => u.roleId === r.id).length])), [db])

  return (
    <>
      <PageHeader title="Roles & Permissions" eyebrow="Admin / Security" icon={<KeyRound className="h-5 w-5" />} description="Decide, per module, whether a role has no access, can only view, or can view and change records. Menus and buttons follow these settings."
        actions={canEdit ? <Button icon={<Plus className="h-4 w-4" />} onClick={addRole}>New role</Button> : undefined} />
      <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
        <Card padded={false}>
          <ul className="divide-y divide-silver-200">
            {db.roles.map((r) => (
              <li key={r.id}>
                <button type="button" onClick={() => { setSelectedId(r.id); setDraft(null) }} aria-current={r.id === role?.id} className={cn('flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-silver-50', r.id === role?.id && 'bg-sapphire-50 shadow-[inset_3px_0_0_0_#ed7333]')}>
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-violet-100 text-violet-700"><KeyRound className="h-4 w-4" /></span>
                  <span className="min-w-0 flex-1"><span className="block truncate text-[13.5px] font-semibold text-navy-900">{r.name}</span><span className="block truncate text-xs text-silver-600">{counts[r.id]} user{counts[r.id] === 1 ? '' : 's'}</span></span>
                </button>
              </li>
            ))}
          </ul>
        </Card>
        {working ? (
          <Card>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Role name" required><Input value={working.name} disabled={!canEdit || locked} onChange={(e) => update({ name: e.target.value })} /></Field>
              <Field label="Description"><Input value={working.description} disabled={!canEdit} onChange={(e) => update({ description: e.target.value })} /></Field>
            </div>
            {locked ? <p className="mt-3 flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900 ring-1 ring-amber-200"><Lock className="h-3.5 w-3.5" /> The Administrator role always has full access and cannot be restricted.</p> : null}
            <div className="mt-4 overflow-x-auto rounded-xl ring-1 ring-silver-200">
              <table className="w-full min-w-[560px] text-sm">
                <thead className="bg-silver-50 text-left text-[11px] font-bold tracking-[0.06em] text-silver-600 uppercase"><tr><th className="px-4 py-3">Module</th>{LEVELS.map((l) => <th key={l.value} className="px-4 py-3 text-center">{l.label}</th>)}</tr></thead>
                <tbody className="divide-y divide-silver-200">
                  {ACCESS_GROUPS.map((g) => (
                    <tr key={g.id}>
                      <td className="px-4 py-2.5 font-medium text-navy-900">{g.label}</td>
                      {LEVELS.map((l) => (
                        <td key={l.value} className="px-4 py-2.5 text-center">
                          <input type="radio" name={`${role?.id}-${g.id}`} aria-label={`${g.label}: ${l.label}`} checked={(working.access[g.id] ?? 'none') === l.value} disabled={!canEdit || locked} onChange={() => setAccess(g.id, l.value)} className="h-4 w-4 accent-[#df6527]" />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {canEdit ? (
              <div className="mt-4 flex flex-wrap justify-between gap-2">
                <Button variant="danger" size="sm" icon={<Trash2 className="h-4 w-4" />} onClick={() => setDeleting(true)} disabled={locked}>Delete role</Button>
                <div className="flex gap-2"><Button variant="outline" disabled={!dirty} onClick={() => setDraft(null)}>Discard</Button><Button icon={<Save className="h-4 w-4" />} disabled={!dirty || locked} onClick={save}>Save permissions</Button></div>
              </div>
            ) : null}
          </Card>
        ) : null}
      </div>
      <ConfirmDialog open={deleting} title="Delete role?" message={<>Users assigned to <strong className="text-navy-900">{role?.name}</strong> must be reassigned first.</>} confirmLabel="Delete role" onConfirm={removeRole} onCancel={() => setDeleting(false)} />
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Activity log                                                        */
/* ------------------------------------------------------------------ */

export function ActivityPage() {
  const { db } = useData()
  const [query, setQuery] = useState('')
  const [user, setUser] = useState('')
  const [action, setAction] = useState('')
  const [page, setPage] = useState(1)
  const size = 15
  const users = [...new Set(db.activity.map((a) => a.user))]
  const rows = db.activity.filter((a) => (!user || a.user === user) && (!action || a.action === action) && (!query || `${a.entity} ${a.detail} ${a.user}`.toLowerCase().includes(query.toLowerCase())))
  const pages = Math.max(1, Math.ceil(rows.length / size))
  const p = Math.min(page, pages)
  const tone = (a: string) => (a === 'Created' ? 'success' : a === 'Deleted' ? 'danger' : a === 'Updated' ? 'info' : a === 'Restored' ? 'purple' : 'neutral') as 'success' | 'danger' | 'info' | 'purple' | 'neutral'
  return (
    <>
      <PageHeader title="Activity Log" eyebrow="Admin / Security" icon={<Activity className="h-5 w-5" />} description="An audit trail of who created, changed, deleted or restored records and when they signed in."
        actions={<Button variant="outline" icon={<Download className="h-4 w-4" />} onClick={() => downloadCSV('activity-log.csv', ['When', 'User', 'Action', 'Entity', 'Detail'], rows.map((a) => [a.at, a.user, a.action, a.entity, a.detail]))}>Export</Button>} />
      <div className="flex flex-wrap items-center gap-2.5">
        <SearchInput value={query} onChange={(v) => { setQuery(v); setPage(1) }} placeholder="Search activity…" className="w-full sm:w-72" />
        <Select aria-label="User" value={user} onChange={(e) => { setUser(e.target.value); setPage(1) }} className="h-10 w-auto! min-w-40"><option value="">User: all</option>{users.map((u) => <option key={u}>{u}</option>)}</Select>
        <Select aria-label="Action" value={action} onChange={(e) => { setAction(e.target.value); setPage(1) }} className="h-10 w-auto! min-w-40"><option value="">Action: all</option>{['Created', 'Updated', 'Deleted', 'Restored', 'Login', 'Logout', 'System'].map((a) => <option key={a}>{a}</option>)}</Select>
        <span className="tnum ml-auto text-xs font-medium text-silver-600">{rows.length} entries</span>
      </div>
      <TableShell>
        <Table className="min-w-[760px]">
          <THead><tr><Th>When</Th><Th>User</Th><Th>Action</Th><Th>Entity</Th><Th>Detail</Th></tr></THead>
          <TBody>{rows.length === 0 ? <TableEmptyRow colSpan={5}>No activity matches</TableEmptyRow> : rows.slice((p - 1) * size, p * size).map((a) => (
            <TR key={a.id}><Td className="whitespace-nowrap">{formatDateTime(a.at)}</Td><Td>{strong(a.user)}</Td><Td><Badge tone={tone(a.action)} dot>{a.action}</Badge></Td><Td className="font-mono text-xs">{a.entity}</Td><Td className="text-silver-700">{a.detail}</Td></TR>
          ))}</TBody>
        </Table>
        <div className="flex items-center justify-between border-t border-silver-200 bg-silver-50/60 px-4 py-2.5 text-xs text-silver-600">
          <span className="tnum">Page {p} of {pages}</span>
          <div className="flex gap-1"><Button size="sm" variant="outline" disabled={p <= 1} onClick={() => setPage(p - 1)}>Previous</Button><Button size="sm" variant="outline" disabled={p >= pages} onClick={() => setPage(p + 1)}>Next</Button></div>
        </div>
      </TableShell>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Switch profile                                                      */
/* ------------------------------------------------------------------ */

export function SwitchProfilePage() {
  const { db, mutate } = useData()
  const { user } = useAuth()
  const toast = useToast()
  const switchTo = (orgId: string, name: string) => {
    if (!user) return
    mutate((d) => { const u = d.users.find((x) => x.id === user.id); if (u) u.orgId = orgId }, { action: 'Updated', entity: 'users', detail: `${user.username} switched to ${name}` })
    toast.success(`Now working in ${name}.`)
  }
  return (
    <>
      <PageHeader title="Switch Profile" eyebrow="Admin / Security" icon={<Lock className="h-5 w-5" />} description="Choose which company you are working in. The company name shows in the top bar and on your activity." />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {db.organizations.map((o) => {
          const active = user?.orgId === o.id
          return (
            <Card key={o.id} variant={active ? 'raised' : 'default'} className={cn(active && 'ring-2 ring-sapphire-500')}>
              <div className="flex items-start gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-sapphire-50 text-sapphire-700 ring-1 ring-sapphire-200"><Building className="h-5 w-5" /></span>
                <div className="min-w-0 flex-1"><h3 className="text-[15px] font-bold text-navy-900">{o.name}</h3><p className="mt-0.5 text-xs text-silver-600">{o.city}, {o.state}</p><p className="mt-1 font-mono text-xs text-silver-600">{o.gstin || 'No GSTIN'}</p></div>
                {active ? <Badge tone="success" dot>Active</Badge> : null}
              </div>
              <div className="mt-4 flex justify-between">
                <ActiveBadge status={o.status} />
                <Button size="sm" variant={active ? 'outline' : 'primary'} disabled={active || o.status !== 'Active'} icon={active ? <Check className="h-4 w-4" /> : undefined} onClick={() => switchTo(o.id, o.name)}>{active ? 'Current' : 'Switch to this'}</Button>
              </div>
            </Card>
          )
        })}
      </div>
      <p className="text-xs text-silver-600">In this demo all companies share the same sample data; switching changes the active profile only.</p>
    </>
  )
}
