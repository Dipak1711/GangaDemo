import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeftRight, BellRing, Boxes, Download, History, Layers, PieChart as PieIcon, Plus, Repeat, ShoppingCart, SlidersHorizontal, Trash2 } from 'lucide-react'
import type { Database, Item, ItemClass, StockMove } from '@/types'
import { useData } from '@/store/DataContext'
import { useToast } from '@/store/ToastContext'
import { useAccess } from '@/hooks/useAccess'
import { Button } from '@/components/ui/Button'
import { Badge, StatusBadge } from '@/components/ui/Badge'
import { Card, CardHeader } from '@/components/ui/Card'
import { Checkbox, Field, Input, Select, Textarea } from '@/components/ui/Form'
import { PageHeader, ProgressBar, SearchInput } from '@/components/ui/Layout'
import { Modal } from '@/components/ui/Modal'
import { SegmentedTabs } from '@/components/ui/SegmentedTabs'
import { StatCard } from '@/components/ui/StatCard'
import { Table, TableEmptyRow, TableShell, TBody, Td, Th, THead, TR } from '@/components/ui/Table'
import { CategoryBarChart, DonutChart } from '@/components/charts/Charts'
import { CrudPage, opts } from '@/components/Crud'
import { blankDoc, defaultSeriesId, lineFromItem, takeDocNo, termsFor } from '@/lib/docs'
import { byId, lowStockItems, nameOf, stockMap, stockStatus, stockValue, warehouseStock, type StockStatus } from '@/lib/calc'
import { DOC_META } from '@/lib/docConfig'
import { downloadCSV, formatCurrency, formatDate, formatNumber, todayISO, uid } from '@/lib/utils'
import { money, strong, sub } from '@/pages/common'

const CLASSES: Array<'all' | ItemClass> = ['all', 'Tractor', 'Finished Good', 'Redymat Part', 'Raw Material']
const statusTone = (s: StockStatus) => s

interface HistoryRow {
  date: string
  source: string
  ref: string
  party: string
  qty: number
}

/** Every event that changed an item's stock, oldest first, with a running balance. */
function itemHistory(db: Database, itemId: string): Array<HistoryRow & { balance: number }> {
  const item = byId(db.items, itemId)
  const rows: HistoryRow[] = []
  for (const doc of db.docs) {
    if (doc.status === 'Cancelled') continue
    const line = doc.lines.filter((l) => l.itemId === itemId)
    if (line.length === 0) continue
    const party = nameOf(db.parties, doc.partyId, '')
    const label = DOC_META[doc.kind].label
    if (doc.kind === 'goodsReceipt' && ['Received', 'Inspected', 'Accepted'].includes(doc.status)) rows.push({ date: doc.date, source: label, ref: doc.no, party, qty: line.reduce((s, l) => s + l.accepted, 0) })
    if (doc.kind === 'purchaseInvoice' && db.docs.find((d) => d.id === doc.refId)?.kind !== 'goodsReceipt') rows.push({ date: doc.date, source: label, ref: doc.no, party, qty: line.reduce((s, l) => s + l.qty, 0) })
    if (doc.kind === 'purchaseReturn' || doc.kind === 'salesInvoice') rows.push({ date: doc.date, source: label, ref: doc.no, party, qty: -line.reduce((s, l) => s + l.qty, 0) })
    if (doc.kind === 'salesReturn') {
      const good = line.filter((l) => l.condition === 'Good').reduce((s, l) => s + l.qty, 0)
      if (good) rows.push({ date: doc.date, source: label, ref: doc.no, party, qty: good })
    }
  }
  for (const m of db.stockMoves.filter((x) => x.itemId === itemId)) rows.push({ date: m.date, source: m.type, ref: byId(db.warehouses, m.warehouseId)?.name ?? '', party: m.note, qty: m.qty })
  for (const wo of db.workOrders) {
    const bom = byId(db.boms, wo.bomId)
    for (const e of wo.entries) {
      if (!e.qty) continue
      if (wo.productId === itemId) rows.push({ date: e.date, source: 'Production output', ref: wo.no, party: e.note, qty: e.qty })
      const comp = bom?.components.find((c) => c.itemId === itemId)
      if (comp) rows.push({ date: e.date, source: 'Production consumed', ref: wo.no, party: e.note, qty: -comp.qty * e.qty })
    }
  }
  rows.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
  let balance = item?.openingStock ?? 0
  const out = [{ date: '', source: 'Opening stock', ref: '', party: '', qty: item?.openingStock ?? 0, balance }]
  for (const r of rows) {
    balance += r.qty
    out.push({ ...r, balance })
  }
  return out
}

/* ------------------------------------------------------------------ */
/* Stock availability                                                  */
/* ------------------------------------------------------------------ */

export function StockPage() {
  const { db, mutate } = useData()
  const toast = useToast()
  const { canEdit } = useAccess()
  const [cls, setCls] = useState<'all' | ItemClass>('all')
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [historyItem, setHistoryItem] = useState<Item | null>(null)
  const [adjustItem, setAdjustItem] = useState<Item | null>(null)
  const [dir, setDir] = useState<'in' | 'out'>('in')
  const [qty, setQty] = useState(1)
  const [note, setNote] = useState('')

  const stock = useMemo(() => stockMap(db), [db])
  const wh = useMemo(() => warehouseStock(db), [db])
  const all = db.items.filter((i) => i.status === 'Active')
  const rows = useMemo(() => {
    const term = query.trim().toLowerCase()
    return all.filter((i) => {
      const q = stock.get(i.id) ?? 0
      if (cls !== 'all' && i.itemClass !== cls) return false
      if (category && i.categoryId !== category) return false
      if (statusFilter && stockStatus(i, q) !== statusFilter) return false
      return !term || `${i.name} ${i.code} ${nameOf(db.categories, i.categoryId, '')}`.toLowerCase().includes(term)
    })
  }, [all, cls, category, statusFilter, query, stock, db.categories])

  const value = stockValue(db, stock)
  const low = all.filter((i) => stockStatus(i, stock.get(i.id) ?? 0) === 'Low stock').length
  const out = all.filter((i) => stockStatus(i, stock.get(i.id) ?? 0) === 'Out of stock').length

  const applyAdjust = () => {
    if (!adjustItem) return
    const current = stock.get(adjustItem.id) ?? 0
    const delta = dir === 'in' ? qty : -qty
    if (!(qty > 0)) return toast.error('Enter a quantity greater than zero.')
    if (current + delta < 0) return toast.error(`Cannot remove ${qty}: only ${current} in stock.`)
    mutate(
      (d) => {
        d.stockMoves.push({ id: uid('mv'), itemId: adjustItem.id, date: todayISO(), qty: delta, type: 'Adjustment', warehouseId: d.warehouses[0]?.id ?? '', note: note || (dir === 'in' ? 'Stock added' : 'Stock removed'), ref: '' })
      },
      { action: 'Created', entity: 'stock', detail: `${dir === 'in' ? '+' : '−'}${qty} ${adjustItem.name}` },
    )
    toast.success(`Stock adjusted: ${adjustItem.name} is now ${current + delta}.`)
    setAdjustItem(null)
    setQty(1)
    setNote('')
  }

  const history = historyItem ? itemHistory(db, historyItem.id) : []
  const whBreakdown = historyItem ? [...(wh.get(historyItem.id) ?? new Map<string, number>()).entries()].filter(([, v]) => v !== 0) : []

  return (
    <>
      <PageHeader
        title="Stock Availability" eyebrow="Inventory" icon={<Boxes className="h-5 w-5" />}
        description="Live stock of tractors, finished goods, Redymat (ready-made) parts and raw material — derived from receipts, sales, returns, adjustments and production."
        actions={<Button variant="outline" icon={<Download className="h-4 w-4" />} onClick={() => downloadCSV(`stock-${todayISO()}.csv`, ['Code', 'Item', 'Class', 'Category', 'Stock', 'Min', 'Max', 'Value', 'Status'], rows.map((i) => { const q = stock.get(i.id) ?? 0; return [i.code, i.name, i.itemClass, nameOf(db.categories, i.categoryId, ''), q, i.minStock, i.maxStock, q * i.purchaseRate, stockStatus(i, q)] }))}>Export</Button>}
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Active items" value={all.length} numericValue={all.length} icon={<Boxes className="h-5 w-5" />} tone="sapphire" />
        <StatCard label="Stock value" value="" numericValue={value} format={(v) => formatCurrency(v, true)} icon={<Layers className="h-5 w-5" />} tone="emerald" hint="At purchase rate" />
        <StatCard label="Low stock" value={low} numericValue={low} icon={<BellRing className="h-5 w-5" />} tone="amber" hint="At or below minimum" />
        <StatCard label="Out of stock" value={out} numericValue={out} icon={<BellRing className="h-5 w-5" />} tone="rose" />
      </div>

      <div className="overflow-x-auto pb-1">
        <SegmentedTabs value={cls} onChange={setCls} items={CLASSES.map((c) => ({ value: c, label: c === 'all' ? 'All stock' : c, count: c === 'all' ? all.length : all.filter((i) => i.itemClass === c).length }))} />
      </div>
      <div className="flex flex-wrap items-center gap-2.5">
        <SearchInput value={query} onChange={setQuery} placeholder="Search item or code…" className="w-full sm:w-72" />
        <Select aria-label="Category" value={category} onChange={(e) => setCategory(e.target.value)} className="h-10 w-auto! min-w-44">
          <option value="">Category: all</option>
          {db.categories.filter((c) => c.kind === 'Category').map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
        <Select aria-label="Stock status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-10 w-auto! min-w-40">
          <option value="">Status: all</option>
          {['In stock', 'Low stock', 'Out of stock', 'Overstock'].map((s) => <option key={s}>{s}</option>)}
        </Select>
        <span className="tnum ml-auto text-xs font-medium text-silver-600">{rows.length} items</span>
      </div>

      <TableShell>
        <Table className="min-w-[900px]">
          <THead>
            <tr><Th>Item</Th><Th className="hidden md:table-cell">Class</Th><Th align="right">Current</Th><Th className="hidden lg:table-cell">Level</Th><Th align="right" className="hidden lg:table-cell">Min / Max</Th><Th align="right">Value</Th><Th>Status</Th><Th align="right">Actions</Th></tr>
          </THead>
          <TBody>
            {rows.length === 0 ? <TableEmptyRow colSpan={8}>No stock matches these filters</TableEmptyRow> : rows.map((i) => {
              const q = stock.get(i.id) ?? 0
              const st = stockStatus(i, q)
              const pct = i.maxStock ? (q / i.maxStock) * 100 : q > 0 ? 100 : 0
              return (
                <TR key={i.id}>
                  <Td>{strong(i.name)}{sub(`${i.code} · ${nameOf(db.categories, i.categoryId)}`)}</Td>
                  <Td className="hidden md:table-cell"><Badge tone="silver">{i.itemClass}</Badge></Td>
                  <Td align="right" className="font-bold text-navy-900">{formatNumber(q)} <span className="text-xs font-medium text-silver-600">{db.units.find((u) => u.id === i.baseUnitId)?.alias}</span></Td>
                  <Td className="hidden w-36 lg:table-cell"><ProgressBar value={pct} tone={st === 'In stock' ? 'emerald' : st === 'Overstock' ? 'blue' : st === 'Low stock' ? 'amber' : 'rose'} /></Td>
                  <Td align="right" className="hidden text-silver-700 lg:table-cell">{i.minStock} / {i.maxStock || '—'}</Td>
                  <Td align="right">{money(Math.max(0, q) * i.purchaseRate)}</Td>
                  <Td><StatusBadge status={statusTone(st)} /></Td>
                  <Td align="right">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" icon={<History className="h-4 w-4" />} onClick={() => setHistoryItem(i)}>History</Button>
                      {canEdit ? <Button size="sm" variant="secondary" icon={<SlidersHorizontal className="h-4 w-4" />} onClick={() => setAdjustItem(i)}>Adjust</Button> : null}
                    </div>
                  </Td>
                </TR>
              )
            })}
          </TBody>
        </Table>
      </TableShell>

      <Modal open={Boolean(historyItem)} onClose={() => setHistoryItem(null)} size="lg" title={`Stock history — ${historyItem?.name ?? ''}`} subtitle={`${historyItem?.code} · current stock ${historyItem ? formatNumber(stock.get(historyItem.id) ?? 0) : ''}`}>
        {whBreakdown.length > 1 ? (
          <div className="mb-4 flex flex-wrap gap-2">
            {whBreakdown.map(([id, v]) => <Badge key={id} tone="info">{nameOf(db.warehouses, id)}: {v}</Badge>)}
          </div>
        ) : null}
        <div className="overflow-x-auto rounded-xl ring-1 ring-silver-200">
          <table className="w-full min-w-[560px] border-collapse text-sm">
            <thead className="bg-silver-50 text-left text-[11px] font-bold tracking-[0.06em] text-silver-600 uppercase"><tr><th className="px-3 py-2">Date</th><th className="px-3 py-2">Source</th><th className="px-3 py-2">Reference</th><th className="px-3 py-2 text-right">In / Out</th><th className="px-3 py-2 text-right">Balance</th></tr></thead>
            <tbody className="divide-y divide-silver-200">
              {history.map((h, i) => (
                <tr key={i}>
                  <td className="px-3 py-2 whitespace-nowrap">{h.date ? formatDate(h.date) : '—'}</td>
                  <td className="px-3 py-2">{h.source}</td>
                  <td className="px-3 py-2 text-silver-700">{h.ref}{h.party ? <span className="block text-xs text-silver-500">{h.party}</span> : null}</td>
                  <td className={`tnum px-3 py-2 text-right font-semibold ${h.qty < 0 ? 'text-rose-700' : 'text-emerald-700'}`}>{h.qty > 0 ? '+' : ''}{h.qty}</td>
                  <td className="tnum px-3 py-2 text-right font-bold text-navy-900">{h.balance}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Modal>

      <Modal open={Boolean(adjustItem)} onClose={() => setAdjustItem(null)} size="sm" title="Adjust stock" subtitle={adjustItem ? `${adjustItem.name} · currently ${stock.get(adjustItem.id) ?? 0}` : ''}
        footer={<><Button variant="outline" onClick={() => setAdjustItem(null)}>Cancel</Button><Button onClick={applyAdjust}>Apply adjustment</Button></>}>
        <div className="flex flex-col gap-4">
          <SegmentedTabs value={dir} onChange={setDir} items={[{ value: 'in', label: 'Stock in (+)' }, { value: 'out', label: 'Stock out (−)' }]} />
          <Field label="Quantity" required><Input type="number" min={0} value={qty} onChange={(e) => setQty(Number(e.target.value))} /></Field>
          <Field label="Reason / note"><Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Physical count correction" /></Field>
        </div>
      </Modal>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Movements                                                           */
/* ------------------------------------------------------------------ */

export function MovementsPage() {
  return (
    <CrudPage
      collection="stockMoves" entity="Adjustment" title="Stock In / Out" icon={<ArrowLeftRight className="h-5 w-5" />} eyebrow="Inventory"
      description="Manual stock corrections. Positive quantities add stock, negative quantities remove it. Documents and production adjust stock automatically."
      scope={(r) => r.type === 'Adjustment'}
      blank={(db) => ({ id: uid('mv'), itemId: '', date: todayISO(), qty: 1, type: 'Adjustment', warehouseId: db.warehouses[0]?.id ?? '', note: '', ref: '' })}
      columns={[
        { key: 'date', label: 'Date', render: (r) => formatDate(r.date), text: (r) => r.date },
        { key: 'itemId', label: 'Item', render: (r, db) => strong(nameOf(db.items, r.itemId)), text: (r, db) => nameOf(db.items, r.itemId) },
        { key: 'qty', label: 'Quantity', align: 'right', render: (r) => <span className={r.qty < 0 ? 'font-bold text-rose-700' : 'font-bold text-emerald-700'}>{r.qty > 0 ? '+' : ''}{r.qty}</span>, text: (r) => r.qty },
        { key: 'dir', label: 'Direction', render: (r) => <Badge tone={r.qty < 0 ? 'danger' : 'success'}>{r.qty < 0 ? 'Stock out' : 'Stock in'}</Badge>, text: (r) => (r.qty < 0 ? 'Out' : 'In') },
        { key: 'note', label: 'Note', hideBelow: 'md' },
      ]}
      fields={[
        { key: 'itemId', label: 'Item', type: 'select', required: true, options: (db) => opts(db.items) }, { key: 'date', label: 'Date', type: 'date', required: true },
        { key: 'qty', label: 'Quantity (+ in / − out)', type: 'number', required: true, hint: 'Use a negative number to remove stock' },
        { key: 'note', label: 'Reason / note', type: 'textarea' },
      ]}
      validate={(d, db, isNew) => {
        if (!d.qty) return { qty: 'Quantity cannot be zero.' }
        const current = stockMap(db).get(d.itemId) ?? 0
        const previous = isNew ? 0 : (db.stockMoves.find((m) => m.id === d.id)?.qty ?? 0)
        if (current - previous + d.qty < 0) return { qty: `Only ${current - previous} in stock — cannot remove ${Math.abs(d.qty)}.` }
        return {}
      }}
      modalSize="md"
    />
  )
}

/* ------------------------------------------------------------------ */
/* Transfers                                                           */
/* ------------------------------------------------------------------ */

export function TransferPage() {
  const { db, mutate } = useData()
  const toast = useToast()
  const { canEdit } = useAccess()
  const wh = useMemo(() => warehouseStock(db), [db])
  const [form, setForm] = useState({ itemId: '', from: db.warehouses[0]?.id ?? '', to: db.warehouses[1]?.id ?? '', qty: 1, date: todayISO(), note: '' })
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }))
  const available = form.itemId ? (wh.get(form.itemId)?.get(form.from) ?? 0) : 0

  const transfers = useMemo(() => {
    const outs = db.stockMoves.filter((m) => m.type === 'Transfer Out')
    return outs.map((o) => ({ out: o, into: db.stockMoves.find((m) => m.type === 'Transfer In' && m.itemId === o.itemId && m.date === o.date && (m.ref === o.ref && o.ref ? true : -m.qty === o.qty)) })).sort((a, b) => (a.out.date < b.out.date ? 1 : -1))
  }, [db.stockMoves])

  const submit = () => {
    if (!form.itemId) return toast.error('Choose an item to transfer.')
    if (form.from === form.to) return toast.error('Source and destination must be different.')
    if (!(form.qty > 0)) return toast.error('Enter a quantity greater than zero.')
    if (form.qty > available) return toast.error(`Only ${available} available in ${nameOf(db.warehouses, form.from)}.`)
    const ref = uid('tr')
    mutate(
      (d) => {
        d.stockMoves.push(
          { id: uid('mv'), itemId: form.itemId, date: form.date, qty: -form.qty, type: 'Transfer Out', warehouseId: form.from, note: form.note || `To ${nameOf(d.warehouses, form.to)}`, ref },
          { id: uid('mv'), itemId: form.itemId, date: form.date, qty: form.qty, type: 'Transfer In', warehouseId: form.to, note: form.note || `From ${nameOf(d.warehouses, form.from)}`, ref },
        )
      },
      { action: 'Created', entity: 'stock', detail: `Transfer ${form.qty} × ${nameOf(db.items, form.itemId)}` },
    )
    toast.success('Stock transferred.')
    setForm((f) => ({ ...f, qty: 1, note: '' }))
  }

  const undo = (ref: string) => {
    mutate((d) => {
      d.stockMoves = d.stockMoves.filter((m) => m.ref !== ref)
    }, { action: 'Deleted', entity: 'stock', detail: 'Stock transfer reversed' })
    toast.success('Transfer reversed.')
  }

  return (
    <>
      <PageHeader title="Stock Transfer" eyebrow="Inventory" icon={<Repeat className="h-5 w-5" />} description="Move stock between warehouses. Total stock is unchanged; only the location changes." />
      {canEdit ? (
        <Card>
          <CardHeader title="New transfer" accent="sapphire" />
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Item" required className="lg:col-span-2">
              <Select value={form.itemId} onChange={(e) => set('itemId', e.target.value)}><option value="">Select item…</option>{db.items.filter((i) => i.status === 'Active').map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}</Select>
            </Field>
            <Field label="From warehouse" required><Select value={form.from} onChange={(e) => set('from', e.target.value)}>{db.warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</Select></Field>
            <Field label="To warehouse" required><Select value={form.to} onChange={(e) => set('to', e.target.value)}>{db.warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</Select></Field>
            <Field label="Quantity" required hint={form.itemId ? `${available} available in source` : undefined}><Input type="number" min={0} value={form.qty} onChange={(e) => set('qty', Number(e.target.value))} /></Field>
            <Field label="Date" required><Input type="date" value={form.date} onChange={(e) => set('date', e.target.value)} /></Field>
            <Field label="Note" className="lg:col-span-2"><Input value={form.note} onChange={(e) => set('note', e.target.value)} placeholder="Optional" /></Field>
          </div>
          <div className="mt-4 flex justify-end"><Button icon={<Repeat className="h-4 w-4" />} onClick={submit}>Transfer stock</Button></div>
        </Card>
      ) : null}

      <TableShell>
        <Table>
          <THead><tr><Th>Date</Th><Th>Item</Th><Th>From</Th><Th>To</Th><Th align="right">Qty</Th><Th>Note</Th>{canEdit ? <Th align="right">Actions</Th> : null}</tr></THead>
          <TBody>
            {transfers.length === 0 ? <TableEmptyRow colSpan={7}>No transfers recorded</TableEmptyRow> : transfers.map(({ out, into }) => (
              <TR key={out.id}>
                <Td>{formatDate(out.date)}</Td><Td>{strong(nameOf(db.items, out.itemId))}</Td>
                <Td>{nameOf(db.warehouses, out.warehouseId)}</Td><Td>{into ? nameOf(db.warehouses, into.warehouseId) : '—'}</Td>
                <Td align="right" className="font-bold">{Math.abs(out.qty)}</Td><Td className="text-silver-600">{out.note}</Td>
                {canEdit ? <Td align="right">{out.ref ? <Button size="icon" variant="ghost" aria-label="Reverse transfer" title="Reverse transfer" className="text-rose-600 hover:bg-rose-50" onClick={() => undo(out.ref)} icon={<Trash2 className="h-4 w-4" />} /> : null}</Td> : null}
              </TR>
            ))}
          </TBody>
        </Table>
      </TableShell>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Low stock                                                           */
/* ------------------------------------------------------------------ */

export function LowStockPage() {
  const { db, mutate } = useData()
  const toast = useToast()
  const navigate = useNavigate()
  const { canEdit } = useAccess()
  const [picked, setPicked] = useState<Record<string, boolean>>({})
  const [vendorId, setVendorId] = useState('')
  const [open, setOpen] = useState(false)

  const rows = useMemo(() => lowStockItems(db).map(({ item, qty }) => ({ item, qty, suggest: Math.max(1, (item.maxStock || item.minStock * 3) - qty) })).sort((a, b) => a.qty - b.qty), [db])
  const chosen = rows.filter((r) => picked[r.item.id])

  const createPO = () => {
    if (!vendorId) return toast.error('Choose a vendor for the purchase order.')
    const created = mutate(
      (d) => {
        const doc = blankDoc('purchaseOrder', defaultSeriesId(d, 'purchaseOrder'))
        doc.no = takeDocNo(d, doc.seriesId)
        doc.partyId = vendorId
        doc.terms = termsFor(d, 'purchaseOrder')
        doc.notes = 'Auto-created from the Low Stock Alert list'
        doc.lines = chosen.map((r) => lineFromItem(r.item, 'purchaseOrder', r.suggest))
        d.docs.push(doc)
        return doc
      },
      { action: 'Created', entity: 'docs', detail: 'Purchase Order from low-stock list' },
    )
    toast.success(`Purchase order ${created.no} created with ${chosen.length} item(s).`)
    navigate(DOC_META.purchaseOrder.route, { state: { openId: created.id } })
  }

  return (
    <>
      <PageHeader title="Low Stock Alert" eyebrow="Inventory" icon={<BellRing className="h-5 w-5" />} description="Active items at or below their minimum level, with a suggested reorder quantity to reach the maximum."
        actions={canEdit ? <Button icon={<ShoppingCart className="h-4 w-4" />} disabled={chosen.length === 0} onClick={() => setOpen(true)}>Create purchase order ({chosen.length})</Button> : undefined} />
      <TableShell>
        <Table className="min-w-[760px]">
          <THead><tr><Th className="w-10"><Checkbox label="" aria-label="Select all" checked={rows.length > 0 && chosen.length === rows.length} onChange={(e) => setPicked(e.target.checked ? Object.fromEntries(rows.map((r) => [r.item.id, true])) : {})} /></Th><Th>Item</Th><Th align="right">In stock</Th><Th align="right">Minimum</Th><Th align="right">Suggested order</Th><Th>Status</Th></tr></THead>
          <TBody>
            {rows.length === 0 ? <TableEmptyRow colSpan={6}>Nothing is below its minimum level</TableEmptyRow> : rows.map(({ item, qty, suggest }) => (
              <TR key={item.id}>
                <Td><Checkbox label="" aria-label={`Select ${item.name}`} checked={Boolean(picked[item.id])} onChange={(e) => setPicked((p) => ({ ...p, [item.id]: e.target.checked }))} /></Td>
                <Td>{strong(item.name)}{sub(`${item.code} · ${item.itemClass}`)}</Td>
                <Td align="right" className="font-bold">{qty}</Td><Td align="right">{item.minStock}</Td><Td align="right">{suggest}</Td>
                <Td><StatusBadge status={stockStatus(item, qty)} /></Td>
              </TR>
            ))}
          </TBody>
        </Table>
      </TableShell>
      <Modal open={open} onClose={() => setOpen(false)} size="sm" title="Create purchase order" subtitle={`${chosen.length} item(s) selected`}
        footer={<><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={createPO} icon={<Plus className="h-4 w-4" />}>Create order</Button></>}>
        <Field label="Vendor" required><Select value={vendorId} onChange={(e) => setVendorId(e.target.value)}><option value="">Select vendor…</option>{db.parties.filter((p) => p.type === 'Vendor').map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</Select></Field>
        <ul className="mt-4 divide-y divide-silver-200 rounded-xl ring-1 ring-silver-200">{chosen.map((r) => <li key={r.item.id} className="flex justify-between px-3 py-2 text-sm"><span>{r.item.name}</span><span className="tnum font-bold">{r.suggest}</span></li>)}</ul>
      </Modal>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Inventory report                                                    */
/* ------------------------------------------------------------------ */

export function InventoryReportPage() {
  const { db } = useData()
  const stock = useMemo(() => stockMap(db), [db])
  const rows = useMemo(() => db.items.map((i) => ({ item: i, qty: stock.get(i.id) ?? 0, value: Math.max(0, stock.get(i.id) ?? 0) * i.purchaseRate })), [db, stock])
  const byClass = useMemo(() => Object.entries(rows.reduce<Record<string, number>>((a, r) => ({ ...a, [r.item.itemClass]: (a[r.item.itemClass] ?? 0) + r.value }), {})).map(([name, value]) => ({ name, value: Math.round(value) })), [rows])
  const byCategory = useMemo(() => Object.entries(rows.reduce<Record<string, number>>((a, r) => { const n = nameOf(db.categories, r.item.categoryId, 'Other'); return { ...a, [n]: (a[n] ?? 0) + r.value } }, {})).map(([name, value]) => ({ name, value: Math.round(value) })).sort((a, b) => b.value - a.value).slice(0, 8), [rows, db.categories])
  const top = [...rows].sort((a, b) => b.value - a.value).slice(0, 10)
  const total = rows.reduce((s, r) => s + r.value, 0)
  const health = (['In stock', 'Low stock', 'Out of stock', 'Overstock'] as StockStatus[]).map((s) => ({ name: s, value: rows.filter((r) => stockStatus(r.item, r.qty) === s).length }))
  return (
    <>
      <PageHeader title="Inventory Report" eyebrow="Inventory" icon={<PieIcon className="h-5 w-5" />} description="Stock valuation at purchase rate, by class and category, with stock health."
        actions={<Button variant="outline" icon={<Download className="h-4 w-4" />} onClick={() => downloadCSV(`inventory-valuation-${todayISO()}.csv`, ['Code', 'Item', 'Class', 'Stock', 'Rate', 'Value'], rows.map((r) => [r.item.code, r.item.name, r.item.itemClass, r.qty, r.item.purchaseRate, r.value]))}>Export valuation</Button>} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total valuation" value="" numericValue={total} format={(v) => formatCurrency(v, true)} icon={<Layers className="h-5 w-5" />} tone="emerald" />
        <StatCard label="Items tracked" value={rows.length} numericValue={rows.length} icon={<Boxes className="h-5 w-5" />} tone="sapphire" />
        <StatCard label="Units in stock" value={0} numericValue={rows.reduce((s, r) => s + Math.max(0, r.qty), 0)} icon={<Boxes className="h-5 w-5" />} tone="violet" />
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        <Card><CardHeader title="Value by class" accent="sapphire" /><DonutChart data={byClass} currency centerLabel="Total" /></Card>
        <Card><CardHeader title="Value by category" accent="gold" /><CategoryBarChart data={byCategory} currency horizontal height={260} color="#0f766e" /></Card>
        <Card><CardHeader title="Stock health" subtitle="Items by status" accent="emerald" /><DonutChart data={health} colors={['#059669', '#f59e0b', '#dc2626', '#0ea5e9']} centerLabel="Items" /></Card>
      </div>
      <TableShell>
        <Table>
          <THead><tr><Th>Top items by value</Th><Th>Class</Th><Th align="right">Stock</Th><Th align="right">Rate</Th><Th align="right">Value</Th></tr></THead>
          <TBody>{top.map((r) => <TR key={r.item.id}><Td>{strong(r.item.name)}</Td><Td><Badge tone="silver">{r.item.itemClass}</Badge></Td><Td align="right">{r.qty}</Td><Td align="right">{money(r.item.purchaseRate)}</Td><Td align="right" className="font-bold">{money(r.value)}</Td></TR>)}</TBody>
        </Table>
      </TableShell>
    </>
  )
}

