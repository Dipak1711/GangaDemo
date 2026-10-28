import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Archive, Building2, Database as DatabaseIcon, Download, KeyRound, RefreshCw, Recycle, RotateCcw, Save, Search, Settings2, ShieldAlert, Trash2, Upload } from 'lucide-react'
import type { Company } from '@/types'
import { useData } from '@/store/DataContext'
import { useAuth } from '@/store/AuthContext'
import { useToast } from '@/store/ToastContext'
import { useAccess } from '@/hooks/useAccess'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Card, CardHeader } from '@/components/ui/Card'
import { ConfirmDialog } from '@/components/ui/Modal'
import { Field, Input, Select } from '@/components/ui/Form'
import { PageHeader, SearchInput } from '@/components/ui/Layout'
import { Table, TableEmptyRow, TableShell, TBody, Td, Th, THead, TR } from '@/components/ui/Table'
import { CrudPage } from '@/components/Crud'
import { NAV_ITEMS, SECTIONS } from '@/config/nav'
import { DOC_META } from '@/lib/docConfig'
import { formatDateTime, formatNumber } from '@/lib/utils'
import { strong } from '@/pages/common'

/* ------------------------------------------------------------------ */
/* Company profile                                                     */
/* ------------------------------------------------------------------ */

const PROFILE_FIELDS: Array<{ key: keyof Company; label: string; required?: boolean; type?: string; full?: boolean; section?: string }> = [
  { key: 'name', label: 'Company name', required: true, section: 'Identity', full: true }, { key: 'brand', label: 'Brand name' }, { key: 'tagline', label: 'Tag line' }, { key: 'owner', label: 'Owner name', required: true },
  { key: 'gstin', label: 'GST number', section: 'Registration' }, { key: 'pan', label: 'PAN number' }, { key: 'msme', label: 'MSME / Udyam certificate' },
  { key: 'email', label: 'Email', type: 'email', section: 'Contact' }, { key: 'mobile', label: 'Mobile', required: true, type: 'tel' }, { key: 'whatsapp', label: 'WhatsApp number', type: 'tel' }, { key: 'website', label: 'Website' },
  { key: 'address1', label: 'Address line 1', section: 'Address', full: true }, { key: 'address2', label: 'Address line 2', full: true }, { key: 'city', label: 'City / village', required: true }, { key: 'taluka', label: 'Taluka' },
  { key: 'district', label: 'District' }, { key: 'state', label: 'State', required: true }, { key: 'country', label: 'Country' }, { key: 'pin', label: 'PIN code' },
  { key: 'facebook', label: 'Facebook', section: 'Social' }, { key: 'instagram', label: 'Instagram' }, { key: 'linkedin', label: 'LinkedIn' }, { key: 'youtube', label: 'YouTube' },
]

export function ProfilePage() {
  const { db, mutate } = useData()
  const { user } = useAuth()
  const toast = useToast()
  const { canEdit } = useAccess()
  const [form, setForm] = useState<Company>(db.company)
  const [errors, setErrors] = useState<Partial<Record<keyof Company, string>>>({})
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' })
  const [pwError, setPwError] = useState('')
  const dirty = JSON.stringify(form) !== JSON.stringify(db.company)

  const set = (key: keyof Company, value: string) => {
    setForm((f) => ({ ...f, [key]: value }))
    setErrors((e) => ({ ...e, [key]: undefined }))
  }
  const save = () => {
    const found: Partial<Record<keyof Company, string>> = {}
    PROFILE_FIELDS.forEach((f) => { if (f.required && !String(form[f.key]).trim()) found[f.key] = `${f.label} is required.` })
    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email)) found.email = 'Enter a valid email address.'
    if (form.gstin && !/^[0-9A-Z]{15}$/i.test(form.gstin.trim())) found.gstin = 'GSTIN must be 15 letters/digits.'
    if (form.pan && !/^[A-Z]{5}[0-9]{4}[A-Z]$/i.test(form.pan.trim())) found.pan = 'PAN looks like ABCDE1234F.'
    if (form.pin && !/^\d{6}$/.test(form.pin.trim())) found.pin = 'PIN code is 6 digits.'
    if (Object.keys(found).length) { setErrors(found); return toast.error('Please fix the highlighted fields.') }
    mutate((d) => { d.company = { ...form } }, { action: 'Updated', entity: 'company', detail: 'Company profile saved' })
    toast.success('Company profile saved.')
  }
  const changePassword = () => {
    if (!user) return
    if (pw.current !== user.password) return setPwError('Current password is incorrect.')
    if (pw.next.length < 6) return setPwError('New password must be at least 6 characters.')
    if (pw.next !== pw.confirm) return setPwError('The new passwords do not match.')
    mutate((d) => { const u = d.users.find((x) => x.id === user.id); if (u) u.password = pw.next }, { action: 'Updated', entity: 'users', detail: `${user.username} changed password` })
    setPw({ current: '', next: '', confirm: '' })
    setPwError('')
    toast.success('Password changed.')
  }

  return (
    <>
      <PageHeader title="My Profile" eyebrow="Company Profile" icon={<Building2 className="h-5 w-5" />} description="Your company's identity. These details print on every invoice, quotation and report."
        actions={canEdit ? <><Button variant="outline" disabled={!dirty} onClick={() => { setForm(db.company); setErrors({}) }}>Discard</Button><Button icon={<Save className="h-4 w-4" />} disabled={!dirty} onClick={save}>Save changes</Button></> : undefined} />
      <Card>
        <fieldset disabled={!canEdit} className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
          {PROFILE_FIELDS.map((f) => (
            <div key={f.key} className={f.full ? 'sm:col-span-2 lg:col-span-2' : ''}>
              {f.section ? <h3 className="mb-3 mt-1 border-b border-silver-200 pb-1.5 text-[11.5px] font-bold tracking-[0.12em] text-silver-600 uppercase sm:col-span-2 lg:col-span-4">{f.section}</h3> : null}
              <Field label={f.label} required={f.required} error={errors[f.key]}>
                <Input type={f.type ?? 'text'} value={String(form[f.key] ?? '')} onChange={(e) => set(f.key, e.target.value)} invalid={Boolean(errors[f.key])} />
              </Field>
            </div>
          ))}
        </fieldset>
      </Card>
      <Card>
        <CardHeader title="Change password" subtitle={`Signed in as ${user?.username}`} icon={<KeyRound className="h-4 w-4" />} accent="gold" />
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <Field label="Current password"><Input type="password" value={pw.current} onChange={(e) => { setPw({ ...pw, current: e.target.value }); setPwError('') }} autoComplete="current-password" /></Field>
          <Field label="New password" hint="At least 6 characters"><Input type="password" value={pw.next} onChange={(e) => { setPw({ ...pw, next: e.target.value }); setPwError('') }} autoComplete="new-password" /></Field>
          <Field label="Confirm new password" error={pwError}><Input type="password" value={pw.confirm} onChange={(e) => { setPw({ ...pw, confirm: e.target.value }); setPwError('') }} autoComplete="new-password" invalid={Boolean(pwError)} /></Field>
        </div>
        <div className="mt-4 flex justify-end"><Button variant="outline" onClick={changePassword} disabled={!pw.current || !pw.next}>Update password</Button></div>
      </Card>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* ERP configuration                                                   */
/* ------------------------------------------------------------------ */

export function ConfigPage() {
  const { db, mutate } = useData()
  const toast = useToast()
  const { canEdit } = useAccess()
  const [fy, setFy] = useState(db.company.financialYearStart)
  const saveFy = () => {
    if (!fy) return toast.error('Choose the financial year start date.')
    mutate((d) => { d.company.financialYearStart = fy }, { action: 'Updated', entity: 'config', detail: `Financial year starts ${fy}` })
    toast.success('Financial year updated. Reports now start from this date.')
  }
  return (
    <>
      <PageHeader title="ERP Configuration" eyebrow="Settings" icon={<Settings2 className="h-5 w-5" />} description="Financial year and the number series used by every document." />
      <Card>
        <CardHeader title="Financial year" subtitle="Reports and opening balances start from this date." accent="sapphire" />
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <Field label="Financial year starts"><Input type="date" value={fy} onChange={(e) => setFy(e.target.value)} disabled={!canEdit} className="w-52" /></Field>
          <Field label="Currency"><Input value="INR — Indian Rupee (₹)" readOnly className="w-56" /></Field>
          {canEdit ? <Button icon={<Save className="h-4 w-4" />} onClick={saveFy} disabled={fy === db.company.financialYearStart}>Save</Button> : null}
        </div>
      </Card>
      <CrudPage
        collection="series" entity="Series" title="Document numbering" description="Prefix, next number and padding for each document series. Changing the next number only affects documents created from now on."
        labelOf={(r) => `${r.prefix}`}
        blank={(d) => ({ id: `sr_${Date.now().toString(36)}`, kind: 'salesInvoice', prefix: '', next: 1, pad: 3, _n: d.series.length })}
        columns={[
          { key: 'kind', label: 'Document', render: (r) => strong(DOC_META[r.kind as keyof typeof DOC_META]?.label ?? r.kind), text: (r) => r.kind },
          { key: 'prefix', label: 'Prefix', render: (r) => <span className="font-mono text-xs font-semibold">{r.prefix}</span> },
          { key: 'next', label: 'Next number', align: 'right' },
          { key: 'preview', label: 'Next document no', render: (r) => <Badge tone="info">{`${r.prefix}${String(r.next).padStart(r.pad, '0')}`}</Badge>, text: (r) => `${r.prefix}${String(r.next).padStart(r.pad, '0')}` },
        ]}
        fields={[
          { key: 'kind', label: 'Document type', type: 'select', required: true, options: Object.values(DOC_META).map((m) => ({ value: m.kind, label: m.label })), disabled: (_d, isNew) => !isNew },
          { key: 'prefix', label: 'Prefix', required: true, hint: 'e.g. INV-26-' }, { key: 'next', label: 'Next number', type: 'number', required: true, min: 1 }, { key: 'pad', label: 'Digits', type: 'number', required: true, min: 1 },
        ]}
        validate={(d, db2) => (db2.series.some((s) => s.id !== d.id && s.kind === d.kind && s.prefix.toLowerCase() === String(d.prefix).toLowerCase()) ? { prefix: 'This prefix is already used for that document.' } : {})}
        prepare={(d) => { const { _n: _unused, ...rest } = d; return rest as typeof d }}
        modalSize="md" pageSize={25}
      />
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Data & backup                                                       */
/* ------------------------------------------------------------------ */

export function DataPage() {
  const { db, exportJSON, importJSON, reset, eraseData } = useData()
  const toast = useToast()
  const { canEdit } = useAccess()
  const fileRef = useRef<HTMLInputElement>(null)
  const [confirm, setConfirm] = useState<'reset' | 'erase' | null>(null)
  const [typed, setTyped] = useState('')

  const counts = useMemo(() => [
    ['Parties', db.parties.length], ['Items', db.items.length], ['Documents', db.docs.length], ['Vouchers & expenses', db.vouchers.length + db.expenses.length],
    ['Work orders', db.workOrders.length], ['Employees', db.employees.length], ['Complaints & AMC', db.complaints.length + db.amcs.length], ['Activity entries', db.activity.length],
  ] as Array<[string, number]>, [db])
  const size = useMemo(() => `${(new Blob([JSON.stringify(db)]).size / 1024).toFixed(0)} KB`, [db])

  const onImport = async (file?: File) => {
    if (!file) return
    const result = await importJSON(file)
    if (result.ok) toast.success('Backup restored.')
    else toast.error(result.error ?? 'Import failed.')
    if (fileRef.current) fileRef.current.value = ''
  }
  const doConfirm = () => {
    if (confirm === 'reset') { reset(); toast.success('Demo data restored to the original sample set.') }
    if (confirm === 'erase') { eraseData(); toast.success('All transactions erased. Masters were kept.') }
    setConfirm(null)
    setTyped('')
  }

  return (
    <>
      <PageHeader title="Backup & Data" eyebrow="Settings" icon={<DatabaseIcon className="h-5 w-5" />} description="Everything lives in this browser's localStorage. Export a backup, restore one, or start again." />
      <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
        <Card>
          <CardHeader title="What is stored" subtitle={`About ${size} in localStorage`} accent="sapphire" />
          <dl className="mt-4 grid gap-3 sm:grid-cols-2">
            {counts.map(([label, n]) => <div key={label} className="flex items-center justify-between rounded-xl bg-silver-50 px-3.5 py-3 ring-1 ring-silver-200"><dt className="text-sm text-silver-700">{label}</dt><dd className="tnum text-lg font-extrabold text-navy-900">{formatNumber(n)}</dd></div>)}
          </dl>
        </Card>
        <Card>
          <CardHeader title="Backup" accent="emerald" />
          <div className="mt-4 flex flex-col gap-3">
            <Button variant="outline" icon={<Download className="h-4 w-4" />} onClick={exportJSON}>Export backup (.json)</Button>
            {canEdit ? (
              <>
                <input ref={fileRef} type="file" accept="application/json" className="sr-only" id="restore-file" onChange={(e) => void onImport(e.target.files?.[0])} />
                <Button variant="outline" icon={<Upload className="h-4 w-4" />} onClick={() => fileRef.current?.click()}>Restore from backup</Button>
              </>
            ) : null}
          </div>
        </Card>
      </div>
      {canEdit ? (
        <Card className="ring-1 ring-rose-200">
          <CardHeader title="Danger zone" subtitle="These actions replace what is stored in this browser." icon={<ShieldAlert className="h-4 w-4" />} accent="rose" />
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="rounded-xl bg-silver-50 p-4 ring-1 ring-silver-200">
              <h3 className="text-sm font-bold text-navy-900">Reset demo data</h3>
              <p className="mt-1 text-xs leading-relaxed text-silver-700">Throws away every change and reloads the original sample business.</p>
              <Button className="mt-3" variant="outline" icon={<RefreshCw className="h-4 w-4" />} onClick={() => setConfirm('reset')}>Reset to sample data</Button>
            </div>
            <div className="rounded-xl bg-rose-50 p-4 ring-1 ring-rose-200">
              <h3 className="text-sm font-bold text-rose-900">Erase ERP data</h3>
              <p className="mt-1 text-xs leading-relaxed text-rose-800">Deletes all documents, vouchers, expenses, production, HR and CRM records and zeroes opening stock. Masters (items, parties, taxes) are kept.</p>
              <Button className="mt-3" variant="danger" icon={<Trash2 className="h-4 w-4" />} onClick={() => setConfirm('erase')}>Erase all transactions</Button>
            </div>
          </div>
        </Card>
      ) : null}
      <ConfirmDialog
        open={confirm !== null}
        title={confirm === 'erase' ? 'Erase all transactions?' : 'Reset to sample data?'}
        message={confirm === 'erase' ? (
          <div className="flex flex-col gap-3"><p>This cannot be undone. Export a backup first if you might need the data.</p><Field label="Type ERASE to confirm"><Input value={typed} onChange={(e) => setTyped(e.target.value)} autoFocus /></Field></div>
        ) : 'Every change you made will be lost and the original demo data restored.'}
        confirmLabel={confirm === 'erase' ? 'Erase everything' : 'Reset'}
        onConfirm={() => (confirm === 'erase' && typed !== 'ERASE' ? toast.error('Type ERASE exactly to continue.') : doConfirm())}
        onCancel={() => { setConfirm(null); setTyped('') }}
      />
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Recycle bin                                                         */
/* ------------------------------------------------------------------ */

export function RecyclePage() {
  const { db, restore, purge } = useData()
  const toast = useToast()
  const { canEdit } = useAccess()
  const [confirmAll, setConfirmAll] = useState(false)
  const [query, setQuery] = useState('')
  const rows = db.trash.filter((t) => !query || `${t.label} ${t.collection} ${t.deletedBy}`.toLowerCase().includes(query.toLowerCase()))
  const onRestore = (id: string, label: string) => {
    const ok = restore(id)
    if (ok) toast.success(`“${label}” restored.`)
    else toast.error('Could not restore this record.')
  }
  return (
    <>
      <PageHeader title="Recycling" eyebrow="Settings" icon={<Recycle className="h-5 w-5" />} description="Deleted records wait here. Restore one to put it back exactly as it was, or remove it for good."
        actions={canEdit && db.trash.length ? <Button variant="danger" icon={<Trash2 className="h-4 w-4" />} onClick={() => setConfirmAll(true)}>Empty recycle bin</Button> : undefined} />
      <SearchInput value={query} onChange={setQuery} placeholder="Search deleted records…" className="w-full sm:w-80" />
      <TableShell>
        <Table className="min-w-[720px]">
          <THead><tr><Th>Record</Th><Th>Type</Th><Th>Deleted</Th><Th>By</Th><Th align="right">Actions</Th></tr></THead>
          <TBody>{rows.length === 0 ? <TableEmptyRow colSpan={5}>The recycle bin is empty</TableEmptyRow> : rows.map((t) => (
            <TR key={t.id}><Td>{strong(t.label)}</Td><Td><Badge tone="silver">{t.collection}</Badge></Td><Td className="whitespace-nowrap">{formatDateTime(t.deletedAt)}</Td><Td>{t.deletedBy}</Td>
              <Td align="right">{canEdit ? <div className="flex justify-end gap-1"><Button size="sm" variant="secondary" icon={<RotateCcw className="h-4 w-4" />} onClick={() => onRestore(t.id, t.label)}>Restore</Button><Button size="icon" variant="ghost" aria-label={`Delete ${t.label} permanently`} title="Delete permanently" className="text-rose-600 hover:bg-rose-50" onClick={() => { purge(t.id); toast.success('Removed permanently.') }} icon={<Trash2 className="h-4 w-4" />} /></div> : null}</Td></TR>
          ))}</TBody>
        </Table>
      </TableShell>
      <ConfirmDialog open={confirmAll} title="Empty recycle bin?" message={`${db.trash.length} record(s) will be removed permanently.`} confirmLabel="Empty bin" onConfirm={() => { db.trash.forEach((t) => purge(t.id)); setConfirmAll(false); toast.success('Recycle bin emptied.') }} onCancel={() => setConfirmAll(false)} />
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Sitemap                                                             */
/* ------------------------------------------------------------------ */

export function SitemapPage() {
  const { accessFor } = useAuth()
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()
  const total = NAV_ITEMS.filter((i) => accessFor(i.access) !== 'none').length
  return (
    <>
      <PageHeader title="Sitemap" eyebrow="Settings" icon={<Archive className="h-5 w-5" />} description={`Every screen you can open — ${total} in total. Search to jump straight to one.`} />
      <div className="relative w-full sm:w-96"><SearchInput value={query} onChange={setQuery} placeholder="Find a screen…" /></div>
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {SECTIONS.map((s) => {
          const items = NAV_ITEMS.filter((i) => i.section === s.id && accessFor(i.access) !== 'none' && (!q || `${i.label} ${i.description}`.toLowerCase().includes(q)))
          if (!items.length) return null
          const Icon = s.icon
          return (
            <Card key={s.id}>
              <div className="mb-3 flex items-center gap-2.5"><span className={`grid h-9 w-9 place-items-center rounded-xl ${s.tone}`}><Icon className="h-4.5 w-4.5" /></span><h3 className="text-[15px] font-bold text-navy-900">{s.title}</h3><Badge className="ml-auto">{items.length}</Badge></div>
              <ul className="flex flex-col">
                {items.map((i) => (
                  <li key={i.to}><Link to={i.to} className="group flex items-start gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-silver-50"><Search className="mt-1 h-3.5 w-3.5 shrink-0 text-silver-400 group-hover:text-sapphire-600" /><span className="min-w-0"><span className="block text-[13.5px] font-semibold text-navy-900">{i.label}</span><span className="block truncate text-xs text-silver-600">{i.description}</span></span></Link></li>
                ))}
              </ul>
            </Card>
          )
        })}
      </div>
    </>
  )
}

