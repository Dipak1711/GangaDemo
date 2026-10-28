import { useMemo, useState } from 'react'
import { Factory, FilePlus2, ListChecks, Play, Plus, Scissors, Trash2, Briefcase, Wrench, FileSpreadsheet, AlertTriangle, Download } from 'lucide-react'
import type { Database, WorkOrder } from '@/types'
import { useData } from '@/store/DataContext'
import { useToast } from '@/store/ToastContext'
import { useAccess } from '@/hooks/useAccess'
import { Button } from '@/components/ui/Button'
import { Badge, StatusBadge } from '@/components/ui/Badge'
import { Card, CardHeader } from '@/components/ui/Card'
import { Field, Input, Select, Textarea } from '@/components/ui/Form'
import { PageHeader, ProgressBar } from '@/components/ui/Layout'
import { Modal } from '@/components/ui/Modal'
import { StatCard } from '@/components/ui/StatCard'
import { Table, TableEmptyRow, TableShell, TBody, Td, Th, THead, TR } from '@/components/ui/Table'
import { CategoryBarChart } from '@/components/charts/Charts'
import { CrudPage, opts, type Row } from '@/components/Crud'
import { byId, nameOf, stockMap } from '@/lib/calc'
import { downloadCSV, formatDate, formatCurrency, todayISO, uid } from '@/lib/utils'
import { money, strong, sub } from '@/pages/common'

/* ------------------------------------------------------------------ */
/* Final design                                                        */
/* ------------------------------------------------------------------ */

export function DesignsPage() {
  return (
    <CrudPage
      collection="designs" entity="Design" title="Final Design" icon={<Scissors className="h-5 w-5" />} eyebrow="Production"
      description="Approved drawings, specifications and revisions for each manufactured product."
      blank={(db) => ({ id: uid('dg'), code: `FD-${String(db.designs.length + 1).padStart(3, '0')}`, name: '', productId: '', revision: 'A', status: 'Draft', fileName: '', notes: '', date: todayISO() })}
      columns={[
        { key: 'code', label: 'Code', render: (r) => <span className="font-mono text-xs font-semibold">{r.code}</span> },
        { key: 'name', label: 'Design', render: (r, db) => <>{strong(r.name)}{sub(nameOf(db.items, r.productId, 'No product linked'))}</>, text: (r) => r.name },
        { key: 'revision', label: 'Rev', align: 'center' },
        { key: 'status', label: 'Status', render: (r) => <Badge tone={r.status === 'Approved' ? 'success' : r.status === 'Draft' ? 'warning' : 'neutral'} dot>{r.status}</Badge>, text: (r) => r.status },
        { key: 'fileName', label: 'File', hideBelow: 'md', render: (r) => r.fileName || '—' },
        { key: 'date', label: 'Date', render: (r) => formatDate(r.date), text: (r) => r.date, hideBelow: 'lg' },
      ]}
      fields={[
        { key: 'code', label: 'Design code', required: true }, { key: 'name', label: 'Design title', required: true },
        { key: 'productId', label: 'Product', type: 'select', options: (db) => opts(db.items.filter((i) => i.itemClass === 'Finished Good' || i.itemClass === 'Tractor')) },
        { key: 'revision', label: 'Revision' }, { key: 'status', label: 'Status', type: 'select', required: true, options: ['Draft', 'Approved', 'Obsolete'].map((s) => ({ value: s, label: s })) },
        { key: 'date', label: 'Date', type: 'date', required: true },
        { key: 'fileName', label: 'File name', hint: 'Reference to the drawing file (PDF / DWG)' }, { key: 'notes', label: 'Notes', type: 'textarea' },
      ]}
      modalSize="md"
    />
  )
}

/* ------------------------------------------------------------------ */
/* BOM                                                                 */
/* ------------------------------------------------------------------ */

function BomForm({ draft, set, errors, db }: { draft: Row; set: (k: string, v: unknown) => void; errors: Record<string, string>; db: Database }) {
  const comps = (draft.components ?? []) as Array<{ itemId: string; qty: number }>
  const cost = comps.reduce((s, c) => s + (byId(db.items, c.itemId)?.purchaseRate ?? 0) * c.qty, 0)
  const product = byId(db.items, draft.productId)
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Finished product" required error={errors.productId} className="sm:col-span-2">
          <Select value={draft.productId} onChange={(e) => set('productId', e.target.value)} invalid={Boolean(errors.productId)}>
            <option value="">Select product…</option>
            {db.items.filter((i) => i.itemClass === 'Finished Good' || i.itemClass === 'Tractor').map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
          </Select>
        </Field>
        <Field label="Version"><Input value={draft.version} onChange={(e) => set('version', e.target.value)} /></Field>
      </div>
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-[13px] font-bold tracking-wide text-silver-700 uppercase">Components</h3>
          <Button size="sm" variant="outline" icon={<Plus className="h-4 w-4" />} onClick={() => set('components', [...comps, { itemId: '', qty: 1 }])}>Add component</Button>
        </div>
        {comps.length === 0 ? <p className="rounded-xl bg-silver-50 px-3 py-4 text-sm text-silver-600 ring-1 ring-silver-200">No components yet.</p> : (
          <ul className="divide-y divide-silver-200 rounded-xl ring-1 ring-silver-200">
            {comps.map((c, i) => (
              <li key={i} className="flex flex-wrap items-center gap-2 px-3 py-2">
                <Select aria-label="Component" value={c.itemId} onChange={(e) => set('components', comps.map((x, j) => (j === i ? { ...x, itemId: e.target.value } : x)))} className="h-9 min-w-52 flex-1 text-sm">
                  <option value="">Select component…</option>
                  {db.items.filter((it) => it.id !== draft.productId).map((it) => <option key={it.id} value={it.id}>{it.name}</option>)}
                </Select>
                <Input aria-label="Quantity" type="number" min={0} step="any" value={c.qty} onChange={(e) => set('components', comps.map((x, j) => (j === i ? { ...x, qty: Number(e.target.value) } : x)))} className="h-9 w-28! text-right text-sm" />
                <span className="w-12 text-xs text-silver-600">{db.units.find((u) => u.id === byId(db.items, c.itemId)?.baseUnitId)?.alias}</span>
                <button type="button" aria-label="Remove component" onClick={() => set('components', comps.filter((_, j) => j !== i))} className="rounded-md p-1.5 text-rose-600 hover:bg-rose-50"><Trash2 className="h-4 w-4" /></button>
              </li>
            ))}
          </ul>
        )}
        {errors.components ? <p className="field-error mt-2 text-xs font-medium text-rose-700">{errors.components}</p> : null}
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-silver-50 p-3 ring-1 ring-silver-200"><p className="text-[11px] font-bold tracking-wide text-silver-600 uppercase">Material cost / unit</p><p className="tnum mt-0.5 text-lg font-extrabold text-navy-900">{money(cost)}</p></div>
        <div className="rounded-xl bg-silver-50 p-3 ring-1 ring-silver-200"><p className="text-[11px] font-bold tracking-wide text-silver-600 uppercase">Selling rate</p><p className="tnum mt-0.5 text-lg font-extrabold text-navy-900">{product ? money(product.sellingRate) : '—'}</p></div>
        <div className="rounded-xl bg-emerald-50 p-3 ring-1 ring-emerald-200"><p className="text-[11px] font-bold tracking-wide text-emerald-700 uppercase">Gross margin</p><p className="tnum mt-0.5 text-lg font-extrabold text-emerald-800">{product && product.sellingRate ? money(product.sellingRate - cost) : '—'}</p></div>
      </div>
      <Field label="Notes"><Textarea value={draft.notes} onChange={(e) => set('notes', e.target.value)} /></Field>
    </div>
  )
}

export function BomPage() {
  return (
    <CrudPage
      collection="boms" entity="BOM" title="Bill of Material (BOM)" icon={<ListChecks className="h-5 w-5" />} eyebrow="Production"
      description="The raw materials and parts that go into one unit of a finished product."
      blank={() => ({ id: uid('bom'), productId: '', version: 'v1.0', components: [], notes: '' })}
      columns={[
        { key: 'productId', label: 'Finished product', render: (r, db) => <>{strong(nameOf(db.items, r.productId))}{sub(`Version ${r.version}`)}</>, text: (r, db) => nameOf(db.items, r.productId) },
        { key: 'components', label: 'Components', align: 'right', render: (r) => r.components.length, text: (r) => r.components.length },
        { key: 'cost', label: 'Material cost / unit', align: 'right', render: (r, db) => money(r.components.reduce((s: number, c: { itemId: string; qty: number }) => s + (byId(db.items, c.itemId)?.purchaseRate ?? 0) * c.qty, 0)), text: (r, db) => r.components.reduce((s: number, c: { itemId: string; qty: number }) => s + (byId(db.items, c.itemId)?.purchaseRate ?? 0) * c.qty, 0) },
        { key: 'notes', label: 'Notes', hideBelow: 'md' },
      ]}
      fields={[]}
      renderForm={(d, set, e, db) => <BomForm draft={d} set={set} errors={e} db={db} />}
      validate={(d) => {
        const e: Record<string, string> = {}
        if (!d.productId) e.productId = 'Choose the finished product.'
        const comps = d.components as Array<{ itemId: string; qty: number }>
        if (comps.length === 0) e.components = 'Add at least one component.'
        else if (comps.some((c) => !c.itemId || !(c.qty > 0))) e.components = 'Every component needs an item and a quantity above zero.'
        else if (new Set(comps.map((c) => c.itemId)).size !== comps.length) e.components = 'A component is listed twice.'
        return e
      }}
      modalSize="lg"
    />
  )
}

/* ------------------------------------------------------------------ */
/* Work orders                                                         */
/* ------------------------------------------------------------------ */

function LogModal({ order, onClose }: { order: WorkOrder | null; onClose: () => void }) {
  const { db, mutate } = useData()
  const toast = useToast()
  const [qty, setQty] = useState(1)
  const [note, setNote] = useState('')
  const bom = order ? byId(db.boms, order.bomId) : undefined
  const stock = useMemo(() => stockMap(db), [db])
  const remaining = order ? Math.max(0, order.qty - order.produced) : 0
  const needs = (bom?.components ?? []).map((c) => ({ ...c, need: c.qty * qty, have: stock.get(c.itemId) ?? 0 }))
  const short = needs.filter((n) => n.need > n.have)

  const submit = () => {
    if (!order) return
    if (!(qty > 0)) return toast.error('Enter a quantity greater than zero.')
    if (qty > remaining) return toast.error(`Only ${remaining} unit(s) remain on this work order.`)
    if (short.length) return toast.error(`Not enough ${nameOf(db.items, short[0].itemId)} in stock (need ${short[0].need}, have ${short[0].have}).`)
    mutate(
      (d) => {
        const wo = d.workOrders.find((w) => w.id === order.id)
        if (!wo) return
        wo.entries.push({ id: uid('pe'), date: todayISO(), qty, note })
        wo.produced = wo.entries.reduce((s, e) => s + e.qty, 0)
        wo.status = wo.produced >= wo.qty ? 'Completed' : 'In Progress'
      },
      { action: 'Updated', entity: 'workOrders', detail: `${order.no}: produced ${qty} × ${nameOf(db.items, order.productId)}` },
    )
    toast.success(`${qty} unit(s) logged. Components consumed and finished goods added to stock.`)
    setQty(1)
    setNote('')
    onClose()
  }

  return (
    <Modal open={Boolean(order)} onClose={onClose} size="md" title="Log production" subtitle={order ? `${order.no} · ${nameOf(db.items, order.productId)} · ${remaining} remaining` : ''}
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={submit} disabled={short.length > 0} icon={<FilePlus2 className="h-4 w-4" />}>Log production</Button></>}>
      <div className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Quantity produced" required hint={`Up to ${remaining}`}><Input type="number" min={0} value={qty} onChange={(e) => setQty(Number(e.target.value))} /></Field>
          <Field label="Note"><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Batch / shift" /></Field>
        </div>
        <div>
          <h3 className="mb-2 text-[13px] font-bold tracking-wide text-silver-700 uppercase">Material that will be consumed</h3>
          {needs.length === 0 ? <p className="text-sm text-silver-600">This work order has no BOM, so no components are consumed.</p> : (
            <ul className="divide-y divide-silver-200 rounded-xl ring-1 ring-silver-200">
              {needs.map((n) => (
                <li key={n.itemId} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                  <span>{nameOf(db.items, n.itemId)}</span>
                  <span className={`tnum font-semibold ${n.need > n.have ? 'text-rose-700' : 'text-navy-900'}`}>{n.need} <span className="font-normal text-silver-600">of {n.have} in stock</span></span>
                </li>
              ))}
            </ul>
          )}
          {short.length > 0 ? <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-rose-700"><AlertTriangle className="h-3.5 w-3.5" /> Insufficient stock for {short.map((s) => nameOf(db.items, s.itemId)).join(', ')}.</p> : null}
        </div>
      </div>
    </Modal>
  )
}

export function WorkOrdersPage({ type }: { type: WorkOrder['type'] }) {
  const { mutate } = useData()
  const toast = useToast()
  const { canEdit } = useAccess()
  const [logOrder, setLogOrder] = useState<WorkOrder | null>(null)
  const meta = {
    Custom: { title: 'Custom Production', eyebrow: 'Production', icon: <Wrench className="h-5 w-5" />, desc: 'Made-to-order work orders for a specific customer.' },
    Regular: { title: 'Regular Production', eyebrow: 'Production', icon: <Factory className="h-5 w-5" />, desc: 'Stock-building work orders for standard products.' },
    'Job Work': { title: 'Work Order / Job Work', eyebrow: 'Production', icon: <Briefcase className="h-5 w-5" />, desc: 'Work outsourced to a vendor on a job-work basis.' },
  }[type]
  const scope = useMemo(() => (r: Row) => r.type === type, [type])
  const start = (id: string, no: string) => {
    mutate((d) => { const wo = d.workOrders.find((w) => w.id === id); if (wo) wo.status = 'In Progress' }, { action: 'Updated', entity: 'workOrders', detail: `${no} started` })
    toast.success(`${no} is now in progress.`)
  }
  return (
    <>
      <CrudPage
        collection="workOrders" entity="Work order" title={meta.title} icon={meta.icon} eyebrow={meta.eyebrow} description={meta.desc} scope={scope} labelOf={(r) => r.no}
        blank={(db) => ({ id: uid('wo'), no: `WO-${String(db.workOrders.length + 1).padStart(3, '0')}`, type, productId: '', bomId: '', qty: 1, produced: 0, customerId: '', vendorId: '', startDate: todayISO(), dueDate: todayISO(), status: 'Planned', notes: '', entries: [] })}
        columns={[
          { key: 'no', label: 'Work order', render: (r, db) => <><span className="font-mono text-[13px] font-semibold text-navy-900">{r.no}</span>{sub(nameOf(db.items, r.productId))}</>, text: (r) => r.no },
          { key: 'progress', label: 'Progress', render: (r) => <div className="w-36"><ProgressBar value={r.qty ? (r.produced / r.qty) * 100 : 0} tone={r.status === 'Completed' ? 'emerald' : 'blue'} /><span className="tnum mt-1 block text-xs text-silver-600">{r.produced} / {r.qty} units</span></div>, text: (r) => `${r.produced}/${r.qty}` },
          { key: 'party', label: type === 'Job Work' ? 'Vendor' : 'Customer', render: (r, db) => (type === 'Job Work' ? nameOf(db.parties, r.vendorId) : nameOf(db.parties, r.customerId, 'Stock')), text: (r, db) => nameOf(db.parties, type === 'Job Work' ? r.vendorId : r.customerId), hideBelow: 'md' },
          { key: 'dueDate', label: 'Due', render: (r) => formatDate(r.dueDate), text: (r) => r.dueDate, hideBelow: 'lg' },
          { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status === 'Planned' ? 'Pending' : r.status} />, text: (r) => r.status },
        ]}
        fields={[
          { key: 'no', label: 'Work order no', required: true }, { key: 'productId', label: 'Product', type: 'select', required: true, options: (db) => opts(db.items.filter((i) => i.itemClass === 'Finished Good' || i.itemClass === 'Tractor')) },
          { key: 'bomId', label: 'Bill of material', type: 'select', required: true, options: (db, d) => db.boms.filter((b) => !d.productId || b.productId === d.productId).map((b) => ({ value: b.id, label: `${nameOf(db.items, b.productId)} · ${b.version}` })) },
          { key: 'qty', label: 'Quantity to produce', type: 'number', required: true, min: 1 },
          { key: 'customerId', label: 'Customer', type: 'select', options: (db) => opts(db.parties.filter((p) => p.type === 'Customer')), visible: () => type === 'Custom' },
          { key: 'vendorId', label: 'Job-work vendor', type: 'select', required: true, options: (db) => opts(db.parties.filter((p) => p.type === 'Vendor')), visible: () => type === 'Job Work' },
          { key: 'startDate', label: 'Start date', type: 'date', required: true }, { key: 'dueDate', label: 'Due date', type: 'date', required: true },
          { key: 'status', label: 'Status', type: 'select', required: true, options: ['Planned', 'In Progress', 'Completed', 'Cancelled'].map((s) => ({ value: s, label: s })) },
          { key: 'notes', label: 'Notes', type: 'textarea' },
        ]}
        validate={(d, db) => {
          const e: Record<string, string> = {}
          if (d.dueDate < d.startDate) e.dueDate = 'Due date cannot be before the start date.'
          if (d.qty < d.produced) e.qty = `Already produced ${d.produced}; quantity cannot be lower.`
          if (db.workOrders.some((w) => w.id !== d.id && w.no.toLowerCase() === String(d.no).toLowerCase())) e.no = 'This work order number is already used.'
          return e
        }}
        canDelete={(r) => (r.entries.length > 0 ? 'Production has already been logged against it.' : null)}
        rowActions={(r) => canEdit && r.status !== 'Completed' && r.status !== 'Cancelled' ? (
          <>
            {r.status === 'Planned' ? <Button size="sm" variant="ghost" icon={<Play className="h-4 w-4" />} onClick={() => start(r.id, r.no)}>Start</Button> : null}
            <Button size="sm" variant="secondary" icon={<FilePlus2 className="h-4 w-4" />} onClick={() => setLogOrder(r as unknown as WorkOrder)}>Log output</Button>
          </>
        ) : null}
        modalSize="lg"
      />
      <LogModal order={logOrder} onClose={() => setLogOrder(null)} />
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Production entry & report                                           */
/* ------------------------------------------------------------------ */

export function ProductionEntryPage() {
  const { db } = useData()
  const { canEdit } = useAccess()
  const [orderId, setOrderId] = useState('')
  const [target, setTarget] = useState<WorkOrder | null>(null)
  const entries = useMemo(() => db.workOrders.flatMap((w) => w.entries.map((e) => ({ ...e, wo: w }))).sort((a, b) => (a.date < b.date ? 1 : -1)), [db.workOrders])
  const open = db.workOrders.filter((w) => w.status === 'Planned' || w.status === 'In Progress')
  return (
    <>
      <PageHeader title="Production Entry" eyebrow="Production" icon={<FilePlus2 className="h-5 w-5" />} description="Log what was produced against an open work order. Components are consumed and finished goods added to stock automatically."
        actions={canEdit ? (
          <div className="flex items-center gap-2">
            <Select aria-label="Work order" value={orderId} onChange={(e) => setOrderId(e.target.value)} className="h-10 w-auto! min-w-56"><option value="">Choose open work order…</option>{open.map((w) => <option key={w.id} value={w.id}>{w.no} · {nameOf(db.items, w.productId)}</option>)}</Select>
            <Button icon={<Plus className="h-4 w-4" />} disabled={!orderId} onClick={() => setTarget(db.workOrders.find((w) => w.id === orderId) ?? null)}>Log output</Button>
          </div>
        ) : undefined} />
      <TableShell>
        <Table>
          <THead><tr><Th>Date</Th><Th>Work order</Th><Th>Product</Th><Th align="right">Quantity</Th><Th>Note</Th></tr></THead>
          <TBody>
            {entries.length === 0 ? <TableEmptyRow colSpan={5}>No production has been logged yet</TableEmptyRow> : entries.map((e) => (
              <TR key={e.id}><Td>{formatDate(e.date)}</Td><Td><span className="font-mono text-[13px] font-semibold">{e.wo.no}</span></Td><Td>{strong(nameOf(db.items, e.wo.productId))}</Td><Td align="right" className="font-bold">{e.qty}</Td><Td className="text-silver-600">{e.note}</Td></TR>
            ))}
          </TBody>
        </Table>
      </TableShell>
      <LogModal order={target} onClose={() => { setTarget(null); setOrderId('') }} />
    </>
  )
}

export function ProductionReportPage() {
  const { db } = useData()
  const byProduct = useMemo(() => {
    const map = new Map<string, { planned: number; produced: number; orders: number }>()
    db.workOrders.filter((w) => w.status !== 'Cancelled').forEach((w) => {
      const cur = map.get(w.productId) ?? { planned: 0, produced: 0, orders: 0 }
      map.set(w.productId, { planned: cur.planned + w.qty, produced: cur.produced + w.produced, orders: cur.orders + 1 })
    })
    return [...map.entries()].map(([id, v]) => ({ id, name: nameOf(db.items, id), ...v }))
  }, [db])
  const consumption = useMemo(() => {
    const map = new Map<string, number>()
    db.workOrders.forEach((w) => {
      const bom = byId(db.boms, w.bomId)
      w.entries.forEach((e) => bom?.components.forEach((c) => map.set(c.itemId, (map.get(c.itemId) ?? 0) + c.qty * e.qty)))
    })
    return [...map.entries()].map(([id, qty]) => ({ id, name: nameOf(db.items, id), qty, cost: qty * (byId(db.items, id)?.purchaseRate ?? 0) })).sort((a, b) => b.cost - a.cost)
  }, [db])
  const counts = ['Planned', 'In Progress', 'Completed', 'Cancelled'].map((s) => ({ name: s, value: db.workOrders.filter((w) => w.status === s).length }))
  const totalCost = consumption.reduce((s, c) => s + c.cost, 0)
  return (
    <>
      <PageHeader title="Production Report" eyebrow="Production" icon={<FileSpreadsheet className="h-5 w-5" />} description="Output against plan and the material consumed to achieve it."
        actions={<Button variant="outline" icon={<Download className="h-4 w-4" />} onClick={() => downloadCSV(`production-${todayISO()}.csv`, ['Product', 'Work orders', 'Planned', 'Produced'], byProduct.map((p) => [p.name, p.orders, p.planned, p.produced]))}>Export</Button>} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Work orders" value={db.workOrders.length} numericValue={db.workOrders.length} icon={<Factory className="h-5 w-5" />} tone="sapphire" />
        <StatCard label="Units produced" value={0} numericValue={db.workOrders.reduce((s, w) => s + w.produced, 0)} icon={<ListChecks className="h-5 w-5" />} tone="emerald" />
        <StatCard label="In progress" value={0} numericValue={db.workOrders.filter((w) => w.status === 'In Progress').length} icon={<Play className="h-5 w-5" />} tone="amber" />
        <StatCard label="Material consumed" value="" numericValue={totalCost} format={(v) => formatCurrency(v, true)} icon={<Wrench className="h-5 w-5" />} tone="violet" />
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <Card><CardHeader title="Work orders by status" accent="sapphire" /><CategoryBarChart data={counts} height={230} /></Card>
        <Card><CardHeader title="Planned vs produced" subtitle="Units per product" accent="emerald" /><CategoryBarChart data={byProduct.map((p) => ({ name: p.name.split(' ').slice(0, 2).join(' '), value: p.produced }))} height={230} color="#059669" /></Card>
      </div>
      <TableShell>
        <Table>
          <THead><tr><Th>Product</Th><Th align="right">Work orders</Th><Th align="right">Planned</Th><Th align="right">Produced</Th><Th>Completion</Th></tr></THead>
          <TBody>{byProduct.length === 0 ? <TableEmptyRow colSpan={5}>No work orders yet</TableEmptyRow> : byProduct.map((p) => (
            <TR key={p.id}><Td>{strong(p.name)}</Td><Td align="right">{p.orders}</Td><Td align="right">{p.planned}</Td><Td align="right" className="font-bold">{p.produced}</Td><Td className="w-48"><ProgressBar value={p.planned ? (p.produced / p.planned) * 100 : 0} tone="emerald" /></Td></TR>
          ))}</TBody>
        </Table>
      </TableShell>
      <TableShell>
        <Table>
          <THead><tr><Th>Material consumed</Th><Th align="right">Quantity</Th><Th align="right">Cost</Th></tr></THead>
          <TBody>{consumption.length === 0 ? <TableEmptyRow colSpan={3}>No material consumed yet</TableEmptyRow> : consumption.map((c) => <TR key={c.id}><Td>{strong(c.name)}</Td><Td align="right">{c.qty}</Td><Td align="right" className="font-bold">{money(c.cost)}</Td></TR>)}</TBody>
        </Table>
      </TableShell>
    </>
  )
}
