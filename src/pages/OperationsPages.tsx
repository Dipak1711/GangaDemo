import { useMemo, useState } from 'react'
import { AlarmClock, ArrowRight, CalendarCheck, CalendarOff, Check, Contact, Download, HandCoins, Headset, MapPin, Send, Users, Wrench, X, Plus, Trash2, Save } from 'lucide-react'
import type { Attendance, Database } from '@/types'
import { useData } from '@/store/DataContext'
import { useToast } from '@/store/ToastContext'
import { useAccess } from '@/hooks/useAccess'
import { Button } from '@/components/ui/Button'
import { Badge, StatusBadge } from '@/components/ui/Badge'
import { Card, CardHeader } from '@/components/ui/Card'
import { Field, Input, Select } from '@/components/ui/Form'
import { PageHeader, SearchInput } from '@/components/ui/Layout'
import { Modal } from '@/components/ui/Modal'
import { SegmentedTabs } from '@/components/ui/SegmentedTabs'
import { StatCard } from '@/components/ui/StatCard'
import { Table, TableEmptyRow, TableShell, TBody, Td, Th, THead, TR } from '@/components/ui/Table'
import { CategoryBarChart } from '@/components/charts/Charts'
import { CrudPage, opts, type Row } from '@/components/Crud'
import { byId, nameOf, pendingAlerts } from '@/lib/calc'
import { addDaysISO, daysBetween, downloadCSV, formatCurrency, formatDate, formatMoney, round2, todayISO, uid } from '@/lib/utils'
import { ActiveBadge, money, strong, sub } from '@/pages/common'

/* ------------------------------------------------------------------ */
/* CRM                                                                 */
/* ------------------------------------------------------------------ */

const COMPLAINT_FLOW: Record<string, string> = { Open: 'In Progress', 'In Progress': 'Resolved', Resolved: 'Closed' }

export function ComplaintsPage() {
  const { mutate } = useData()
  const toast = useToast()
  const { canEdit } = useAccess()
  const advance = (id: string, no: string, to: string) => {
    mutate((d) => { const c = d.complaints.find((x) => x.id === id); if (c) c.status = to as typeof c.status }, { action: 'Updated', entity: 'complaints', detail: `${no} → ${to}` })
    toast.success(`${no} moved to ${to}.`)
  }
  const tone = (s: string) => (s === 'Open' ? 'danger' : s === 'In Progress' ? 'warning' : s === 'Resolved' ? 'info' : 'success') as 'danger' | 'warning' | 'info' | 'success'
  return (
    <CrudPage
      collection="complaints" entity="Complaint" title="CRM / Complaints" icon={<Headset className="h-5 w-5" />} eyebrow="CRM / AMC" description="Customer complaints linked to AMC contracts and quotations, tracked from open to closed." labelOf={(r) => r.no}
      blank={(db) => ({ id: uid('cp'), no: `CMP-${String(db.complaints.length + 1).padStart(3, '0')}`, partyId: '', amcId: '', quotationId: '', subject: '', description: '', priority: 'Medium', status: 'Open', createdAt: new Date().toISOString() })}
      columns={[
        { key: 'no', label: 'No', render: (r) => <span className="font-mono text-[13px] font-semibold">{r.no}</span> },
        { key: 'subject', label: 'Subject', render: (r, db) => <>{strong(r.subject)}{sub(nameOf(db.parties, r.partyId))}</>, text: (r) => r.subject },
        { key: 'priority', label: 'Priority', render: (r) => <Badge tone={r.priority === 'High' ? 'danger' : r.priority === 'Medium' ? 'warning' : 'neutral'}>{r.priority}</Badge>, text: (r) => r.priority, hideBelow: 'md' },
        { key: 'createdAt', label: 'Raised', render: (r) => formatDate(r.createdAt), text: (r) => r.createdAt, hideBelow: 'lg' },
        { key: 'status', label: 'Status', render: (r) => <Badge tone={tone(r.status)} dot>{r.status}</Badge>, text: (r) => r.status },
      ]}
      fields={[
        { key: 'no', label: 'Complaint no', required: true }, { key: 'partyId', label: 'Customer', type: 'select', required: true, options: (db) => opts(db.parties.filter((p) => p.type === 'Customer')) },
        { key: 'priority', label: 'Priority', type: 'select', required: true, options: ['Low', 'Medium', 'High'].map((p) => ({ value: p, label: p })) },
        { key: 'amcId', label: 'AMC contract', type: 'select', options: (db, d) => db.amcs.filter((a) => !d.partyId || a.partyId === d.partyId).map((a) => ({ value: a.id, label: a.contractNo })) },
        { key: 'quotationId', label: 'Sales quotation', type: 'select', options: (db, d) => db.docs.filter((x) => x.kind === 'salesQuotation' && (!d.partyId || x.partyId === d.partyId)).map((x) => ({ value: x.id, label: x.no })) },
        { key: 'status', label: 'Status', type: 'select', required: true, options: ['Open', 'In Progress', 'Resolved', 'Closed'].map((p) => ({ value: p, label: p })) },
        { key: 'subject', label: 'Subject', required: true, full: true }, { key: 'description', label: 'Description', type: 'textarea', required: true },
      ]}
      validate={(d, db) => (db.complaints.some((c) => c.id !== d.id && c.no.toLowerCase() === String(d.no).toLowerCase()) ? { no: 'This complaint number is already used.' } : {})}
      stats={(rows) => [
        { label: 'Open', value: 0, numericValue: rows.filter((r) => r.status === 'Open').length, icon: <Headset className="h-5 w-5" />, tone: 'rose' },
        { label: 'In progress', value: 0, numericValue: rows.filter((r) => r.status === 'In Progress').length, icon: <Wrench className="h-5 w-5" />, tone: 'amber' },
        { label: 'Resolved / closed', value: 0, numericValue: rows.filter((r) => r.status === 'Resolved' || r.status === 'Closed').length, icon: <Check className="h-5 w-5" />, tone: 'emerald' },
        { label: 'High priority open', value: 0, numericValue: rows.filter((r) => r.priority === 'High' && r.status !== 'Closed' && r.status !== 'Resolved').length, icon: <AlarmClock className="h-5 w-5" />, tone: 'violet' },
      ]}
      filters={[{ key: 'status', label: 'Status', options: ['Open', 'In Progress', 'Resolved', 'Closed'].map((s) => ({ value: s, label: s })), test: (r, v) => r.status === v }, { key: 'priority', label: 'Priority', options: ['High', 'Medium', 'Low'].map((s) => ({ value: s, label: s })), test: (r, v) => r.priority === v }]}
      rowActions={(r) => canEdit && COMPLAINT_FLOW[r.status] ? <Button size="sm" variant="secondary" iconRight={<ArrowRight className="h-3.5 w-3.5" />} onClick={() => advance(r.id, r.no, COMPLAINT_FLOW[r.status])}>{COMPLAINT_FLOW[r.status]}</Button> : null}
      modalSize="lg"
    />
  )
}

export function AmcPage() {
  const { db, mutate } = useData()
  const toast = useToast()
  const { canEdit } = useAccess()
  const [target, setTarget] = useState<string | null>(null)
  const [date, setDate] = useState(todayISO())
  const [notes, setNotes] = useState('')
  const amc = db.amcs.find((a) => a.id === target)

  const addService = () => {
    if (!amc) return
    if (!notes.trim()) return toast.error('Describe the service that was carried out.')
    mutate((d) => { d.amcs.find((a) => a.id === amc.id)?.services.push({ id: uid('sv'), date, notes: notes.trim() }) }, { action: 'Updated', entity: 'amcs', detail: `${amc.contractNo}: service recorded` })
    setNotes('')
    toast.success('Service recorded.')
  }
  const removeService = (id: string) => mutate((d) => { const a = d.amcs.find((x) => x.id === amc?.id); if (a) a.services = a.services.filter((s) => s.id !== id) })

  return (
    <>
      <CrudPage
        collection="amcs" entity="AMC contract" title="AMC / Services" icon={<CalendarCheck className="h-5 w-5" />} eyebrow="CRM / AMC" description="Annual maintenance contracts and the services carried out under each." labelOf={(r) => r.contractNo}
        blank={(d) => ({ id: uid('amc'), contractNo: `AMC/AGRI/${String(d.amcs.length + 1).padStart(4, '0')}`, partyId: '', start: todayISO(), end: addDaysISO(todayISO(), 365), amount: 0, status: 'Active', remarks: '', services: [] })}
        columns={[
          { key: 'contractNo', label: 'Contract', render: (r, d) => <><span className="font-mono text-[13px] font-semibold text-navy-900">{r.contractNo}</span>{sub(nameOf(d.parties, r.partyId))}</>, text: (r) => r.contractNo },
          { key: 'period', label: 'Period', render: (r) => `${formatDate(r.start)} → ${formatDate(r.end)}`, text: (r) => `${r.start} ${r.end}`, hideBelow: 'md' },
          { key: 'amount', label: 'Amount', align: 'right', render: (r) => money(r.amount), text: (r) => r.amount },
          { key: 'services', label: 'Services', align: 'right', render: (r) => r.services.length, text: (r) => r.services.length },
          { key: 'status', label: 'Status', render: (r) => { const left = daysBetween(todayISO(), r.end); const expired = r.status === 'Active' && left < 0; return expired ? <Badge tone="danger" dot>Expired</Badge> : r.status === 'Active' && left <= 30 ? <Badge tone="warning" dot>Ends in {left}d</Badge> : <Badge tone={r.status === 'Active' ? 'success' : 'neutral'} dot>{r.status}</Badge> }, text: (r) => r.status },
        ]}
        fields={[
          { key: 'contractNo', label: 'Contract no', required: true }, { key: 'partyId', label: 'Customer', type: 'select', required: true, options: (db2) => opts(db2.parties.filter((p) => p.type === 'Customer')) },
          { key: 'amount', label: 'Contract amount (₹)', type: 'number', min: 0 }, { key: 'start', label: 'Start', type: 'date', required: true }, { key: 'end', label: 'End', type: 'date', required: true },
          { key: 'status', label: 'Status', type: 'select', required: true, options: ['Active', 'Expired', 'Cancelled'].map((s) => ({ value: s, label: s })) }, { key: 'remarks', label: 'Remarks', type: 'textarea' },
        ]}
        validate={(d, db2) => {
          const e: Record<string, string> = {}
          if (d.end <= d.start) e.end = 'End date must be after the start date.'
          if (db2.amcs.some((a) => a.id !== d.id && a.contractNo.toLowerCase() === String(d.contractNo).toLowerCase())) e.contractNo = 'This contract number is already used.'
          return e
        }}
        stats={(rows) => [
          { label: 'Active contracts', value: 0, numericValue: rows.filter((r) => r.status === 'Active' && r.end >= todayISO()).length, icon: <CalendarCheck className="h-5 w-5" />, tone: 'emerald' },
          { label: 'Expiring in 30 days', value: 0, numericValue: rows.filter((r) => r.status === 'Active' && daysBetween(todayISO(), r.end) >= 0 && daysBetween(todayISO(), r.end) <= 30).length, icon: <AlarmClock className="h-5 w-5" />, tone: 'amber' },
          { label: 'Expired', value: 0, numericValue: rows.filter((r) => r.end < todayISO() || r.status === 'Expired').length, icon: <X className="h-5 w-5" />, tone: 'rose' },
          { label: 'Contract value', value: '', numericValue: rows.reduce((s, r) => s + r.amount, 0), format: (v) => formatCurrency(v, true), icon: <HandCoins className="h-5 w-5" />, tone: 'sapphire' },
        ]}
        rowActions={(r) => <Button size="sm" variant="ghost" icon={<Wrench className="h-4 w-4" />} onClick={() => setTarget(r.id)}>Services</Button>}
        modalSize="md"
      />
      <Modal open={Boolean(amc)} onClose={() => setTarget(null)} size="md" title="Service history" subtitle={amc ? `${amc.contractNo} · ${nameOf(db.parties, amc.partyId)}` : ''}>
        {canEdit ? (
          <div className="mb-4 grid gap-3 sm:grid-cols-[170px_1fr_auto] sm:items-end">
            <Field label="Service date"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
            <Field label="Work carried out"><Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Oil and filter change" /></Field>
            <Button icon={<Plus className="h-4 w-4" />} onClick={addService}>Add</Button>
          </div>
        ) : null}
        {amc && amc.services.length ? (
          <ul className="divide-y divide-silver-200 rounded-xl ring-1 ring-silver-200">
            {[...amc.services].sort((a, b) => (a.date < b.date ? 1 : -1)).map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm"><span><strong className="text-navy-900">{formatDate(s.date)}</strong> · {s.notes}</span>{canEdit ? <button type="button" aria-label="Remove service" className="rounded-md p-1.5 text-rose-600 hover:bg-rose-50" onClick={() => removeService(s.id)}><Trash2 className="h-4 w-4" /></button> : null}</li>
            ))}
          </ul>
        ) : <p className="rounded-xl bg-silver-50 px-3 py-5 text-center text-sm text-silver-600 ring-1 ring-silver-200">No services recorded yet.</p>}
      </Modal>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* HR                                                                  */
/* ------------------------------------------------------------------ */

export function EmployeesPage() {
  return (
    <CrudPage
      collection="employees" entity="Employee" title="Employees" icon={<Users className="h-5 w-5" />} eyebrow="HR / Payroll" description="Employee master with branch, department, designation and monthly salary."
      blank={(db) => ({ id: uid('em'), code: `E${String(db.employees.length + 1).padStart(3, '0')}`, name: '', branchId: db.branches[0]?.id ?? '', departmentId: '', designationId: '', phone: '', email: '', joinDate: todayISO(), salary: 0, status: 'Active' })}
      columns={[
        { key: 'code', label: 'Code', render: (r) => <span className="font-mono text-xs font-semibold">{r.code}</span> },
        { key: 'name', label: 'Employee', render: (r, db) => <>{strong(r.name)}{sub(`${nameOf(db.designations, r.designationId, '—')} · ${nameOf(db.departments, r.departmentId, '—')}`)}</>, text: (r) => r.name },
        { key: 'phone', label: 'Phone', hideBelow: 'md' }, { key: 'joinDate', label: 'Joined', render: (r) => formatDate(r.joinDate), text: (r) => r.joinDate, hideBelow: 'lg' },
        { key: 'salary', label: 'Salary / month', align: 'right', render: (r) => money(r.salary), text: (r) => r.salary },
        { key: 'status', label: 'Status', render: (r) => <ActiveBadge status={r.status} />, text: (r) => r.status },
      ]}
      fields={[
        { key: 'code', label: 'Employee code', required: true }, { key: 'name', label: 'Full name', required: true },
        { key: 'branchId', label: 'Branch', type: 'select', required: true, options: (db) => opts(db.branches) },
        { key: 'departmentId', label: 'Department', type: 'select', required: true, options: (db, d) => opts(db.departments.filter((x) => x.branchId === d.branchId)) },
        { key: 'designationId', label: 'Designation', type: 'select', options: (db, d) => opts(db.designations.filter((x) => x.departmentId === d.departmentId)).map((o) => ({ ...o, label: `${o.label}` })) },
        { key: 'phone', label: 'Phone', type: 'tel' }, { key: 'email', label: 'Email', type: 'email' }, { key: 'joinDate', label: 'Joining date', type: 'date', required: true },
        { key: 'salary', label: 'Monthly salary (₹)', type: 'number', required: true, min: 0 }, { key: 'status', label: 'Status', type: 'select', required: true, options: [{ value: 'Active', label: 'Active' }, { value: 'Inactive', label: 'Inactive' }] },
      ]}
      filters={[{ key: 'dept', label: 'Department', options: (db) => opts(db.departments), test: (r, v) => r.departmentId === v }, { key: 'st', label: 'Status', options: [{ value: 'Active', label: 'Active' }, { value: 'Inactive', label: 'Inactive' }], test: (r, v) => r.status === v }]}
      stats={(rows) => [
        { label: 'Employees', value: 0, numericValue: rows.length, icon: <Users className="h-5 w-5" />, tone: 'sapphire' },
        { label: 'Active', value: 0, numericValue: rows.filter((r) => r.status === 'Active').length, icon: <Check className="h-5 w-5" />, tone: 'emerald' },
        { label: 'Monthly payroll', value: '', numericValue: rows.filter((r) => r.status === 'Active').reduce((s, r) => s + r.salary, 0), format: (v) => formatCurrency(v, true), icon: <HandCoins className="h-5 w-5" />, tone: 'violet' },
        { label: 'Departments', value: 0, numericValue: new Set(rows.map((r) => r.departmentId)).size, icon: <Users className="h-5 w-5" />, tone: 'cyan' },
      ]}
      validate={(d, db) => (db.employees.some((e) => e.id !== d.id && e.code.toLowerCase() === String(d.code).toLowerCase()) ? { code: 'This employee code is already used.' } : {})}
      modalSize="lg"
    />
  )
}

export function AttendancePage() {
  const { db, mutate } = useData()
  const toast = useToast()
  const { canEdit } = useAccess()
  const [date, setDate] = useState(todayISO())
  const staff = useMemo(() => db.employees.filter((e) => e.status === 'Active'), [db.employees])
  const initial = useMemo(() => {
    const map: Record<string, { status: Attendance['status']; inTime: string; outTime: string }> = {}
    staff.forEach((e) => {
      const rec = db.attendance.find((a) => a.date === date && a.employeeId === e.id)
      map[e.id] = rec ? { status: rec.status, inTime: rec.inTime, outTime: rec.outTime } : { status: 'Present', inTime: '', outTime: '' }
    })
    return map
  }, [db.attendance, staff, date])
  const [edits, setEdits] = useState<{ date: string; map: typeof initial } | null>(null)
  const current = edits && edits.date === date ? edits.map : initial
  const dirty = Boolean(edits && edits.date === date)
  const saved = db.attendance.filter((a) => a.date === date).length
  const set = (id: string, patch: Partial<(typeof initial)[string]>) => setEdits({ date, map: { ...current, [id]: { ...current[id], ...patch } } })
  const count = (s: Attendance['status']) => Object.values(current).filter((v) => v.status === s).length
  const isSunday = new Date(`${date}T00:00:00`).getDay() === 0

  const save = () => {
    mutate((d) => {
      d.attendance = d.attendance.filter((a) => a.date !== date)
      staff.forEach((e) => d.attendance.push({ id: uid('at'), date, employeeId: e.id, ...current[e.id], inTime: current[e.id].status === 'Absent' || current[e.id].status === 'Leave' ? '' : current[e.id].inTime, outTime: current[e.id].status === 'Absent' || current[e.id].status === 'Leave' ? '' : current[e.id].outTime }))
    }, { action: 'Updated', entity: 'attendance', detail: `Attendance for ${date}` })
    setEdits(null)
    toast.success(`Attendance saved for ${formatDate(date)}.`)
  }
  const markAll = (status: Attendance['status']) => setEdits({ date, map: Object.fromEntries(staff.map((e) => [e.id, { ...current[e.id], status, inTime: status === 'Present' ? current[e.id].inTime || '09:30' : '', outTime: status === 'Present' ? current[e.id].outTime || '18:00' : '' }])) })

  return (
    <>
      <PageHeader title="Attendance" eyebrow="HR / Payroll" icon={<CalendarCheck className="h-5 w-5" />} description="Mark daily attendance for active employees. Payroll reads from these records."
        actions={canEdit ? <><Button variant="outline" onClick={() => markAll('Present')}>Mark all present</Button><Button icon={<Save className="h-4 w-4" />} onClick={save} disabled={!dirty && saved > 0}>Save attendance</Button></> : undefined} />
      <div className="flex flex-wrap items-end gap-3 rounded-2xl bg-surface p-4 shadow-lift">
        <Field label="Date"><Input type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} className="w-48" /></Field>
        <div className="flex gap-1.5 pb-0.5"><Button size="sm" variant="outline" onClick={() => setDate(todayISO())}>Today</Button><Button size="sm" variant="outline" onClick={() => setDate(addDaysISO(date, -1))}>Previous day</Button></div>
        {isSunday ? <Badge tone="info" className="mb-2.5">Sunday — weekly off</Badge> : null}
        <span className="ml-auto pb-2.5 text-xs text-silver-600">{saved ? `${saved} saved for this date` : 'Not yet saved for this date'}</span>
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Present" value={0} numericValue={count('Present')} icon={<Check className="h-5 w-5" />} tone="emerald" />
        <StatCard label="Absent" value={0} numericValue={count('Absent')} icon={<X className="h-5 w-5" />} tone="rose" />
        <StatCard label="Half day" value={0} numericValue={count('Half Day')} icon={<AlarmClock className="h-5 w-5" />} tone="amber" />
        <StatCard label="On leave" value={0} numericValue={count('Leave')} icon={<CalendarOff className="h-5 w-5" />} tone="violet" />
      </div>
      <TableShell>
        <Table className="min-w-[700px]">
          <THead><tr><Th>Employee</Th><Th>Status</Th><Th>In</Th><Th>Out</Th></tr></THead>
          <TBody>{staff.length === 0 ? <TableEmptyRow colSpan={4}>No active employees</TableEmptyRow> : staff.map((e) => {
            const v = current[e.id]
            const off = v.status === 'Absent' || v.status === 'Leave'
            return (
              <TR key={e.id}>
                <Td>{strong(e.name)}{sub(`${e.code} · ${nameOf(db.designations, e.designationId, '')}`)}</Td>
                <Td><Select aria-label={`Status of ${e.name}`} value={v.status} disabled={!canEdit} onChange={(ev) => set(e.id, { status: ev.target.value as Attendance['status'] })} className="h-9 w-40! text-sm">{['Present', 'Absent', 'Half Day', 'Leave'].map((s) => <option key={s}>{s}</option>)}</Select></Td>
                <Td><Input aria-label={`In time of ${e.name}`} type="time" value={v.inTime} disabled={off || !canEdit} onChange={(ev) => set(e.id, { inTime: ev.target.value })} className="h-9 w-36! text-sm" /></Td>
                <Td><Input aria-label={`Out time of ${e.name}`} type="time" value={v.outTime} disabled={off || !canEdit} onChange={(ev) => set(e.id, { outTime: ev.target.value })} className="h-9 w-36! text-sm" /></Td>
              </TR>
            )
          })}</TBody>
        </Table>
      </TableShell>
    </>
  )
}

export function LeavePage() {
  const { mutate } = useData()
  const toast = useToast()
  const { canEdit } = useAccess()
  const decide = (id: string, status: 'Approved' | 'Rejected') => {
    mutate((d) => { const l = d.leaves.find((x) => x.id === id); if (l) l.status = status }, { action: 'Updated', entity: 'leaves', detail: `Leave ${status.toLowerCase()}` })
    toast.success(`Leave ${status.toLowerCase()}.`)
  }
  return (
    <CrudPage
      collection="leaves" entity="Leave request" title="Leave Tracker" icon={<CalendarOff className="h-5 w-5" />} eyebrow="HR / Payroll" description="Leave requests with approval. Approved paid leave counts towards payroll." labelOf={(r, db) => `${nameOf(db.employees, r.employeeId)} ${r.from}`}
      blank={() => ({ id: uid('lv'), employeeId: '', from: todayISO(), to: todayISO(), type: 'Casual', status: 'Pending', reason: '' })}
      columns={[
        { key: 'employeeId', label: 'Employee', render: (r, db) => strong(nameOf(db.employees, r.employeeId)), text: (r, db) => nameOf(db.employees, r.employeeId) },
        { key: 'period', label: 'Period', render: (r) => `${formatDate(r.from)} → ${formatDate(r.to)}`, text: (r) => `${r.from} ${r.to}` },
        { key: 'days', label: 'Days', align: 'right', render: (r) => daysBetween(r.from, r.to) + 1, text: (r) => daysBetween(r.from, r.to) + 1 },
        { key: 'type', label: 'Type', render: (r) => <Badge tone="info">{r.type}</Badge>, text: (r) => r.type },
        { key: 'reason', label: 'Reason', hideBelow: 'lg' },
        { key: 'status', label: 'Status', render: (r) => <Badge tone={r.status === 'Approved' ? 'success' : r.status === 'Rejected' ? 'danger' : 'warning'} dot>{r.status}</Badge>, text: (r) => r.status },
      ]}
      fields={[
        { key: 'employeeId', label: 'Employee', type: 'select', required: true, options: (db) => opts(db.employees.filter((e) => e.status === 'Active')) },
        { key: 'type', label: 'Leave type', type: 'select', required: true, options: ['Casual', 'Sick', 'Earned', 'Unpaid'].map((t) => ({ value: t, label: t })) },
        { key: 'from', label: 'From', type: 'date', required: true }, { key: 'to', label: 'To', type: 'date', required: true },
        { key: 'status', label: 'Status', type: 'select', required: true, options: ['Pending', 'Approved', 'Rejected'].map((t) => ({ value: t, label: t })) }, { key: 'reason', label: 'Reason', type: 'textarea' },
      ]}
      validate={(d, db) => {
        const e: Record<string, string> = {}
        if (d.to < d.from) e.to = 'End date cannot be before the start date.'
        else if (db.leaves.some((l) => l.id !== d.id && l.employeeId === d.employeeId && l.status !== 'Rejected' && d.from <= l.to && d.to >= l.from)) e.from = 'This overlaps another leave for the same employee.'
        return e
      }}
      filters={[{ key: 'st', label: 'Status', options: ['Pending', 'Approved', 'Rejected'].map((s) => ({ value: s, label: s })), test: (r, v) => r.status === v }]}
      rowActions={(r) => canEdit && r.status === 'Pending' ? (
        <>
          <Button size="icon" variant="ghost" aria-label="Approve leave" title="Approve" className="text-emerald-600 hover:bg-emerald-50" onClick={() => decide(r.id, 'Approved')} icon={<Check className="h-4 w-4" />} />
          <Button size="icon" variant="ghost" aria-label="Reject leave" title="Reject" className="text-rose-600 hover:bg-rose-50" onClick={() => decide(r.id, 'Rejected')} icon={<X className="h-4 w-4" />} />
        </>
      ) : null}
      modalSize="md"
    />
  )
}

export function PayrollPage() {
  const { db } = useData()
  const [month, setMonth] = useState(todayISO().slice(0, 7))
  const rows = useMemo(() => {
    const [y, m] = month.split('-').map(Number)
    const total = new Date(y, m, 0).getDate()
    const days = Array.from({ length: total }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`)
    const working = days.filter((d) => new Date(`${d}T00:00:00`).getDay() !== 0).length
    return db.employees.filter((e) => e.status === 'Active').map((e) => {
      const recs = db.attendance.filter((a) => a.employeeId === e.id && a.date.startsWith(month))
      const present = recs.filter((a) => a.status === 'Present').length + recs.filter((a) => a.status === 'Half Day').length * 0.5
      const paidLeave = db.leaves.filter((l) => l.employeeId === e.id && l.status === 'Approved' && l.type !== 'Unpaid').reduce((s, l) => {
        let n = 0
        for (let d = l.from; d <= l.to; d = addDaysISO(d, 1)) if (d.startsWith(month) && new Date(`${d}T00:00:00`).getDay() !== 0) n++
        return s + n
      }, 0)
      const recorded = recs.length > 0
      const payable = recorded ? Math.min(working, present + paidLeave) : working
      const perDay = e.salary / working
      return { e, working, recorded, present, paidLeave, payable, perDay, net: round2(perDay * payable), deduction: round2(e.salary - perDay * payable) }
    })
  }, [db, month])
  const net = rows.reduce((s, r) => s + r.net, 0)
  return (
    <>
      <PageHeader title="Payroll" eyebrow="HR / Payroll" icon={<HandCoins className="h-5 w-5" />} description="Monthly salary sheet worked out from attendance and approved paid leave. Salary is divided over working days (Sundays off)."
        actions={<Button variant="outline" icon={<Download className="h-4 w-4" />} onClick={() => downloadCSV(`payroll-${month}.csv`, ['Employee', 'Salary', 'Working days', 'Present', 'Paid leave', 'Payable days', 'Deduction', 'Net pay'], rows.map((r) => [r.e.name, r.e.salary, r.working, r.present, r.paidLeave, r.payable, r.deduction, r.net]))}>Export</Button>} />
      <div className="flex flex-wrap items-end gap-3 rounded-2xl bg-surface p-4 shadow-lift"><Field label="Month"><Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-48" /></Field></div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Employees paid" value={0} numericValue={rows.length} icon={<Users className="h-5 w-5" />} tone="sapphire" />
        <StatCard label="Gross salary" value="" numericValue={rows.reduce((s, r) => s + r.e.salary, 0)} format={(v) => formatCurrency(v, true)} icon={<HandCoins className="h-5 w-5" />} tone="violet" />
        <StatCard label="Net payable" value="" numericValue={net} format={(v) => formatCurrency(v, true)} icon={<HandCoins className="h-5 w-5" />} tone="emerald" />
      </div>
      <TableShell>
        <Table className="min-w-[900px]">
          <THead><tr><Th>Employee</Th><Th align="right">Salary</Th><Th align="right">Working days</Th><Th align="right">Present</Th><Th align="right">Paid leave</Th><Th align="right">Payable days</Th><Th align="right">Deduction</Th><Th align="right">Net pay</Th></tr></THead>
          <TBody>{rows.map((r) => (
            <TR key={r.e.id}><Td>{strong(r.e.name)}{sub(r.recorded ? r.e.code : `${r.e.code} · no attendance recorded — full pay assumed`)}</Td><Td align="right">{formatMoney(r.e.salary)}</Td><Td align="right">{r.working}</Td><Td align="right">{r.present}</Td><Td align="right">{r.paidLeave}</Td><Td align="right">{r.payable}</Td><Td align="right" className={r.deduction > 0 ? 'text-rose-700' : ''}>{formatMoney(r.deduction)}</Td><Td align="right" className="font-bold text-navy-900">{formatMoney(r.net)}</Td></TR>
          ))}</TBody>
        </Table>
      </TableShell>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Contacts & map                                                      */
/* ------------------------------------------------------------------ */

export function ContactsPage() {
  const { db } = useData()
  const [query, setQuery] = useState('')
  const [type, setType] = useState('all')
  const all = useMemo(() => [
    ...db.parties.map((p) => ({ id: p.id, name: p.name, type: p.type as string, person: p.contactPerson, phone: p.phone, email: p.email, city: p.city })),
    ...db.employees.map((e) => ({ id: e.id, name: e.name, type: 'Employee', person: nameOf(db.designations, e.designationId, ''), phone: e.phone, email: e.email, city: nameOf(db.branches, e.branchId, '') })),
    ...db.transporters.map((t) => ({ id: t.id, name: t.name, type: t.kind, person: '', phone: t.contact, email: t.email, city: t.address })),
  ], [db])
  const rows = all.filter((c) => (type === 'all' || c.type === type) && (!query || `${c.name} ${c.person} ${c.phone} ${c.email} ${c.city}`.toLowerCase().includes(query.toLowerCase())))
  const types = ['all', 'Customer', 'Vendor', 'Dealer', 'Employee', 'Transport', 'Courier']
  return (
    <>
      <PageHeader title="Customer Contact List" eyebrow="Dealer & Dispatch" icon={<Contact className="h-5 w-5" />} description="One directory of every customer, vendor, dealer, employee and carrier — tap a number to call."
        actions={<Button variant="outline" icon={<Download className="h-4 w-4" />} onClick={() => downloadCSV('contacts.csv', ['Name', 'Type', 'Contact person', 'Phone', 'Email', 'City'], rows.map((c) => [c.name, c.type, c.person, c.phone, c.email, c.city]))}>Export</Button>} />
      <div className="overflow-x-auto pb-1"><SegmentedTabs value={type} onChange={setType} items={types.map((t) => ({ value: t, label: t === 'all' ? 'Everyone' : t, count: t === 'all' ? all.length : all.filter((c) => c.type === t).length }))} /></div>
      <SearchInput value={query} onChange={setQuery} placeholder="Search name, phone, email, city…" className="w-full sm:w-96" />
      <TableShell>
        <Table className="min-w-[780px]">
          <THead><tr><Th>Name</Th><Th>Type</Th><Th>Contact</Th><Th>Phone</Th><Th>Email</Th><Th>Location</Th></tr></THead>
          <TBody>{rows.length === 0 ? <TableEmptyRow colSpan={6}>No contacts match</TableEmptyRow> : rows.map((c) => (
            <TR key={`${c.type}-${c.id}`}><Td>{strong(c.name)}</Td><Td><Badge tone={c.type === 'Customer' ? 'success' : c.type === 'Vendor' ? 'warning' : c.type === 'Dealer' ? 'purple' : 'info'}>{c.type}</Badge></Td><Td>{c.person || '—'}</Td>
              <Td>{c.phone ? <a className="text-sapphire-700 hover:underline" href={`tel:${c.phone}`}>{c.phone}</a> : '—'}</Td><Td>{c.email ? <a className="text-sapphire-700 hover:underline" href={`mailto:${c.email}`}>{c.email}</a> : '—'}</Td><Td className="text-silver-700">{c.city || '—'}</Td></TR>
          ))}</TBody>
        </Table>
      </TableShell>
    </>
  )
}

export function MapPage() {
  const { db } = useData()
  const [type, setType] = useState('all')
  const parties = db.parties.filter((p) => type === 'all' || p.type === type)
  const groups = useMemo(() => {
    const m = new Map<string, typeof parties>()
    parties.forEach((p) => { const key = `${p.city || 'Unknown'}, ${p.state}`; m.set(key, [...(m.get(key) ?? []), p]) })
    return [...m.entries()].sort((a, b) => b[1].length - a[1].length)
  }, [parties])
  const chart = groups.slice(0, 8).map(([name, list]) => ({ name: name.split(',')[0], value: list.length }))
  return (
    <>
      <PageHeader title="Map Location" eyebrow="Dealer & Dispatch" icon={<MapPin className="h-5 w-5" />} description="Customers, vendors and dealers grouped by city and state. Open any address in Google Maps." />
      <div className="overflow-x-auto"><SegmentedTabs value={type} onChange={setType} items={['all', 'Customer', 'Vendor', 'Dealer'].map((t) => ({ value: t, label: t === 'all' ? 'All parties' : `${t}s`, count: t === 'all' ? db.parties.length : db.parties.filter((p) => p.type === t).length }))} /></div>
      <div className="grid gap-5 lg:grid-cols-[1fr_1.4fr]">
        <Card><CardHeader title="Parties by city" accent="sapphire" /><CategoryBarChart data={chart} horizontal height={300} /></Card>
        <Card padded={false}>
          <div className="p-5 pb-2"><CardHeader title="Locations" subtitle={`${groups.length} cities · ${parties.length} parties`} accent="emerald" /></div>
          <ul className="max-h-[340px] divide-y divide-silver-200 overflow-y-auto">
            {groups.map(([place, list]) => (
              <li key={place} className="flex items-center gap-3 px-5 py-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-sapphire-50 text-sapphire-700 ring-1 ring-sapphire-200"><MapPin className="h-4 w-4" /></span>
                <span className="min-w-0 flex-1"><span className="block text-[13.5px] font-semibold text-navy-900">{place}</span><span className="block truncate text-xs text-silver-600">{list.map((p) => p.name).join(' · ')}</span></span>
                <Badge tone="info">{list.length}</Badge>
                <a className="text-xs font-bold text-sapphire-700 hover:underline" target="_blank" rel="noreferrer" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}`}>Open map</a>
              </li>
            ))}
          </ul>
        </Card>
      </div>
      <TableShell>
        <Table className="min-w-[760px]">
          <THead><tr><Th>Party</Th><Th>Type</Th><Th>Address</Th><Th>District</Th><Th align="right">Map</Th></tr></THead>
          <TBody>{parties.map((p) => (
            <TR key={p.id}><Td>{strong(p.name)}</Td><Td><Badge tone="silver">{p.type}</Badge></Td><Td className="text-silver-700">{p.address}, {p.city}</Td><Td>{p.district}</Td>
              <Td align="right"><a className="text-xs font-bold text-sapphire-700 hover:underline" target="_blank" rel="noreferrer" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${p.address}, ${p.city}, ${p.state}`)}`}>View on map</a></Td></TR>
          ))}</TBody>
        </Table>
      </TableShell>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Communications alert system                                         */
/* ------------------------------------------------------------------ */

export function AlertsPage() {
  const { db, mutate } = useData()
  const toast = useToast()
  const { canEdit } = useAccess()
  const [tab, setTab] = useState<'queue' | 'rules' | 'log'>('queue')
  const alerts = useMemo(() => pendingAlerts(db), [db])
  const ruleFor = (kind: string) => db.alertRules.find((r) => r.trigger === kind && r.enabled)
  const recipient = (partyId?: string, database: Database = db) => { const p = byId(database.parties, partyId); return p?.phone || 'store@gangaagro.example' }

  const send = (ids: string[]) => {
    const picked = alerts.filter((a) => ids.includes(a.id))
    let sent = 0
    mutate((d) => {
      picked.forEach((a) => {
        const rule = d.alertRules.find((r) => r.trigger === a.kind && r.enabled)
        if (!rule) return
        d.alertLogs.unshift({ id: uid('al'), at: new Date().toISOString(), rule: rule.name, channel: rule.channel, to: recipient(a.partyId, d), message: `${a.label} — ${a.detail}` })
        sent++
      })
      if (d.alertLogs.length > 200) d.alertLogs.length = 200
    }, { action: 'System', entity: 'alerts', detail: `${picked.length} alert(s) queued` })
    if (sent) toast.success(`${sent} message${sent === 1 ? '' : 's'} sent (simulated) and logged.`)
    else toast.error('No enabled rule covers the selected alerts. Enable one under Rules.')
  }

  return (
    <>
      <PageHeader title="Communications Alert System" eyebrow="Dealer & Dispatch" icon={<AlarmClock className="h-5 w-5" />} description="Business events that need a message — overdue invoices, low stock, expiring quotes and AMCs. Messages are simulated in this demo and recorded in the log."
        actions={canEdit && tab === 'queue' ? <Button icon={<Send className="h-4 w-4" />} onClick={() => send(alerts.filter((a) => ruleFor(a.kind)).map((a) => a.id))} disabled={!alerts.some((a) => ruleFor(a.kind))}>Send all matching</Button> : undefined} />
      <SegmentedTabs value={tab} onChange={setTab} items={[{ value: 'queue', label: 'Alert queue', count: alerts.length }, { value: 'rules', label: 'Rules', count: db.alertRules.length }, { value: 'log', label: 'Sent log', count: db.alertLogs.length }]} />
      <div className="tab-swap flex flex-col gap-4" key={tab}>
        {tab === 'queue' ? (
          <TableShell>
            <Table className="min-w-[760px]">
              <THead><tr><Th>Severity</Th><Th>Alert</Th><Th>Detail</Th><Th>Channel</Th><Th align="right">Action</Th></tr></THead>
              <TBody>{alerts.length === 0 ? <TableEmptyRow colSpan={5}>Nothing needs a message right now</TableEmptyRow> : alerts.map((a) => {
                const rule = ruleFor(a.kind)
                return (
                  <TR key={a.id}>
                    <Td><StatusBadge status={a.severity === 'high' ? 'Overdue' : a.severity === 'medium' ? 'Pending' : 'Open'} /></Td>
                    <Td>{strong(a.label)}{sub(a.kind)}</Td><Td className="text-silver-700">{a.detail}</Td>
                    <Td>{rule ? <Badge tone="info">{rule.channel}</Badge> : <span className="text-xs text-silver-500">No rule</span>}</Td>
                    <Td align="right">{canEdit ? <Button size="sm" variant="secondary" icon={<Send className="h-3.5 w-3.5" />} disabled={!rule} onClick={() => send([a.id])}>Send</Button> : null}</Td>
                  </TR>
                )
              })}</TBody>
            </Table>
          </TableShell>
        ) : null}
        {tab === 'rules' ? (
          <CrudPage
            embedded collection="alertRules" entity="Alert rule" title="Alert rules" description="A rule decides which channel carries a given kind of alert."
            blank={() => ({ id: uid('ar'), name: '', trigger: 'Low stock', channel: 'Email', enabled: true, threshold: 0 })}
            columns={[
              { key: 'name', label: 'Rule', render: (r) => strong(r.name) }, { key: 'trigger', label: 'Trigger', render: (r) => <Badge tone="info">{r.trigger}</Badge>, text: (r) => r.trigger },
              { key: 'channel', label: 'Channel' }, { key: 'threshold', label: 'Threshold (days)', align: 'right', hideBelow: 'md' },
              { key: 'enabled', label: 'State', render: (r) => <Badge tone={r.enabled ? 'success' : 'neutral'} dot>{r.enabled ? 'Enabled' : 'Disabled'}</Badge>, text: (r) => (r.enabled ? 'Enabled' : 'Disabled') },
            ]}
            fields={[
              { key: 'name', label: 'Rule name', required: true }, { key: 'trigger', label: 'Trigger', type: 'select', required: true, options: ['Low stock', 'Overdue invoice', 'Quotation expiring', 'AMC expiring', 'Payment received'].map((t) => ({ value: t, label: t })) },
              { key: 'channel', label: 'Channel', type: 'select', required: true, options: ['Email', 'SMS', 'WhatsApp'].map((t) => ({ value: t, label: t })) }, { key: 'threshold', label: 'Threshold (days)', type: 'number', min: 0 },
              { key: 'enabled', label: 'Enabled', type: 'checkbox', hint: 'Rule is active' },
            ]}
            modalSize="md"
          />
        ) : null}
        {tab === 'log' ? (
          <TableShell>
            <Table className="min-w-[720px]">
              <THead><tr><Th>Sent at</Th><Th>Rule</Th><Th>Channel</Th><Th>To</Th><Th>Message</Th></tr></THead>
              <TBody>{db.alertLogs.length === 0 ? <TableEmptyRow colSpan={5}>No messages sent yet</TableEmptyRow> : db.alertLogs.map((l) => (
                <TR key={l.id}><Td className="whitespace-nowrap">{formatDate(l.at)}</Td><Td>{l.rule}</Td><Td><Badge tone="info">{l.channel}</Badge></Td><Td>{l.to}</Td><Td className="max-w-[360px] text-silver-700">{l.message}</Td></TR>
              ))}</TBody>
            </Table>
          </TableShell>
        ) : null}
      </div>
    </>
  )
}

