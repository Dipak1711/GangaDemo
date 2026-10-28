import { useMemo, useState } from 'react'
import { AlertTriangle, Plus, Trash2, Wand2, X } from 'lucide-react'
import type { Database, Doc, DocKind, DocLine } from '@/types'
import { useData } from '@/store/DataContext'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select, Textarea } from '@/components/ui/Form'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { DOC_META } from '@/lib/docConfig'
import { blankLine, deriveDoc, lineFromItem, peekDocNo, seriesFor, sundryFrom } from '@/lib/docs'
import { byId, calcDoc, calcLine, docsOf, docTotal, invoiceStates, isLive, lineQty, nameOf, soldSerials, stockMap, taxRate } from '@/lib/calc'
import { addDaysISO, cn, formatDate, formatMoney, round2, uid } from '@/lib/utils'

export const PAYMENT_TERMS: Record<string, number> = { 'Due on Receipt': 0, 'Net 15': 15, 'Net 30': 30, 'Net 45': 45, 'Net 60': 60 }

const SOURCES: Partial<Record<DocKind, DocKind[]>> = {
  salesOrder: ['salesQuotation'],
  salesPacking: ['salesOrder'],
  salesInvoice: ['salesOrder', 'salesPacking'],
  deliveryNote: ['salesInvoice'],
  gatePass: ['salesInvoice', 'deliveryNote'],
  salesReturn: ['salesInvoice'],
  purchaseOrder: ['purchaseQuotation'],
  goodsReceipt: ['purchaseOrder'],
  purchaseInvoice: ['purchaseOrder', 'goodsReceipt'],
  purchaseReturn: ['purchaseInvoice'],
  purchaseDelivery: ['purchaseOrder'],
  purchasePacking: ['purchaseOrder'],
}

/* ------------------------------------------------------------------ */
/* Validation                                                          */
/* ------------------------------------------------------------------ */

export function validateDoc(doc: Doc, db: Database): Record<string, string> {
  const meta = DOC_META[doc.kind]
  const e: Record<string, string> = {}
  if (!doc.partyId) e.partyId = `Select a ${meta.partyType.toLowerCase()}.`
  if (!doc.date) e.date = 'Date is required.'
  if (!doc.seriesId) e.seriesId = 'Choose a series.'
  const extra = meta.extraDate
  if (extra && doc[extra.key] && doc.date && doc[extra.key] < doc.date) e[extra.key] = `${extra.label} cannot be before the document date.`

  if (meta.lineMode === 'payment') {
    if (!(doc.amount > 0)) e.amount = 'Enter an amount greater than zero.'
    const allocated = doc.allocations.reduce((s, a) => s + a.amount, 0)
    if (allocated > doc.amount + 0.01) e.allocations = 'Allocated amount cannot exceed the payment amount.'
    const states = invoiceStates(db, doc.kind === 'receipt' ? 'salesInvoice' : 'purchaseInvoice')
    const orig = db.docs.find((d) => d.id === doc.id)
    for (const a of doc.allocations) {
      const st = states.find((s) => s.doc.id === a.docId)
      const own = orig?.allocations.find((x) => x.docId === a.docId)?.amount ?? 0
      if (st && a.amount > st.balance + own + 0.01) e.allocations = `Allocation to ${st.doc.no} exceeds its outstanding balance.`
    }
    if (doc.tdsPct < 0 || doc.tdsPct > 30) e.tdsPct = 'TDS must be between 0 and 30%.'
    return e
  }

  const lines = doc.lines.filter((l) => l.itemId)
  if (lines.length === 0) e.lines = 'Add at least one item.'
  const messages: string[] = []
  const orig = db.docs.find((d) => d.id === doc.id)
  const stock = stockMap(db)
  const used = soldSerials(db, doc.id)
  for (const l of lines) {
    const item = byId(db.items, l.itemId)
    const label = item?.name ?? 'Item'
    if (meta.lineMode === 'receipt') {
      if (l.received < 0 || l.accepted < 0) messages.push(`${label}: quantities cannot be negative.`)
      if (l.accepted > l.received) messages.push(`${label}: accepted quantity exceeds received quantity.`)
    } else if (meta.lineMode === 'delivery') {
      if (l.delivered <= 0) messages.push(`${label}: enter a delivered quantity.`)
      if (l.delivered > l.qty) messages.push(`${label}: delivered quantity exceeds ordered quantity.`)
    } else if (!(l.qty > 0)) messages.push(`${label}: quantity must be greater than zero.`)
    if (meta.moneyDoc && l.rate < 0) messages.push(`${label}: rate cannot be negative.`)
    if (l.discountPct < 0 || l.discountPct > 100) messages.push(`${label}: discount must be between 0 and 100%.`)
    if (doc.kind === 'salesInvoice' && item) {
      const prior = orig && isLive(orig) ? orig.lines.filter((x) => x.itemId === l.itemId).reduce((s, x) => s + x.qty, 0) : 0
      const available = (stock.get(item.id) ?? 0) + prior
      const wanted = lines.filter((x) => x.itemId === l.itemId).reduce((s, x) => s + x.qty, 0)
      if (wanted > available + 0.0001) messages.push(`${label}: only ${available} in stock, ${wanted} requested.`)
      if (item.serialRequired) {
        if (l.serials.length !== l.qty) messages.push(`${label}: select exactly ${l.qty} serial number(s) (${l.serials.length} chosen).`)
        if (l.serials.some((s) => used.has(s))) messages.push(`${label}: a chosen serial number is already sold.`)
      }
    }
  }
  if (messages.length) e.lines = messages.join('\n')
  return e
}

/* ------------------------------------------------------------------ */
/* Small controls                                                      */
/* ------------------------------------------------------------------ */

function NumCell({ value, onChange, min = 0, step = 'any', className, 'aria-label': label }: { value: number; onChange: (n: number) => void; min?: number; step?: string; className?: string; 'aria-label'?: string }) {
  return (
    <input
      type="number"
      inputMode="decimal"
      aria-label={label}
      min={min}
      step={step}
      value={Number.isFinite(value) ? value : ''}
      onFocus={(e) => e.target.select()}
      onChange={(e) => onChange(e.target.value === '' ? 0 : Number(e.target.value))}
      className={cn('tnum h-9 w-full min-w-[72px] rounded-lg border border-silver-300 bg-surface px-2 text-right text-[16px] text-navy-900 hover:border-silver-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none disabled:bg-silver-50 sm:text-sm', className)}
    />
  )
}

function SerialPicker({ open, onClose, line, docId, onSave }: { open: boolean; onClose: () => void; line: DocLine | null; docId: string; onSave: (serials: string[]) => void }) {
  const { db } = useData()
  const [picked, setPicked] = useState<string[]>([])
  const [seen, setSeen] = useState('')
  if (open && line && seen !== line.id) {
    setSeen(line.id)
    setPicked(line.serials)
  }
  if (!open && seen) setSeen('')
  const available = useMemo(() => {
    if (!line) return []
    const sold = soldSerials(db, docId)
    return db.serials.filter((s) => s.itemId === line.itemId && !sold.has(s.serial))
  }, [db, line, docId])
  const need = line?.qty ?? 0
  const toggle = (serial: string) => setPicked((p) => (p.includes(serial) ? p.filter((x) => x !== serial) : [...p, serial]))
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title="Select serial numbers"
      subtitle={line ? `${nameOf(db.items, line.itemId)} · ${need} required` : ''}
      footer={
        <>
          <Button variant="outline" onClick={() => setPicked(available.slice(0, need).map((s) => s.serial))}>Pick first {need}</Button>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => { onSave(picked); onClose() }} disabled={picked.length !== need}>Apply ({picked.length}/{need})</Button>
        </>
      }
    >
      {available.length === 0 ? (
        <p className="text-sm text-silver-600">No unsold serial numbers exist for this item. Generate some under Master Setup → Serial Numbers.</p>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {available.map((s) => {
            const on = picked.includes(s.serial)
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => toggle(s.serial)}
                aria-pressed={on}
                className={cn('pressable rounded-lg border px-3 py-2 text-left font-mono text-xs font-semibold', on ? 'border-sapphire-500 bg-sapphire-50 text-sapphire-800' : 'border-silver-300 bg-surface text-navy-800 hover:bg-silver-50')}
              >
                {s.serial}
              </button>
            )
          })}
        </div>
      )}
    </Modal>
  )
}

/* ------------------------------------------------------------------ */
/* Editor                                                              */
/* ------------------------------------------------------------------ */

export function DocEditor({ draft, setDraft, errors, isNew, readOnly }: { draft: Doc; setDraft: (fn: (d: Doc) => Doc) => void; errors: Record<string, string>; isNew: boolean; readOnly: boolean }) {
  const { db } = useData()
  const meta = DOC_META[draft.kind]
  const patch = (p: Partial<Doc>) => setDraft((d) => ({ ...d, ...p }))
  const [serialLine, setSerialLine] = useState<string | null>(null)

  const parties = db.parties.filter((p) => p.type === meta.partyType && (p.status === 'Active' || p.id === draft.partyId))
  const itemChoices = db.items.filter((i) => i.status === 'Active' && (meta.side === 'purchase' || i.itemClass !== 'Raw Material'))
  const stock = useMemo(() => stockMap(db), [db])
  const orig = db.docs.find((d) => d.id === draft.id)
  const totals = calcDoc(draft, db.taxes)
  const seriesOptions = seriesFor(db, draft.kind)
  const displayNo = isNew ? peekDocNo(db, draft.seriesId) : draft.no
  const sources = SOURCES[draft.kind] ?? []
  const sourceDocs = db.docs.filter((d) => sources.includes(d.kind) && isLive(d) && (!draft.partyId || d.partyId === draft.partyId))

  const choosePartyAndGst = (partyId: string) => {
    const party = byId(db.parties, partyId)
    const inter = party && party.state && party.state !== db.company.state
    patch({ partyId, gstType: inter ? 'Inter' : 'Intra', deliveryAddress: draft.deliveryAddress || (party ? `${party.address}, ${party.city}` : ''), allocations: [] })
  }

  const loadFrom = (id: string) => {
    const src = db.docs.find((d) => d.id === id)
    if (!src) return
    const d = deriveDoc(db, src, draft.kind)
    patch({ lines: d.lines, sundries: d.sundries, partyId: d.partyId, refId: d.refId, refNo: d.refNo, gstType: d.gstType, deliveryAddress: d.deliveryAddress, dealerCode: d.dealerCode, empCode: d.empCode, transporterId: d.transporterId || draft.transporterId })
  }

  const updateLine = (id: string, p: Partial<DocLine>) => setDraft((d) => ({ ...d, lines: d.lines.map((l) => (l.id === id ? { ...l, ...p } : l)) }))
  const chooseItem = (lineId: string, itemId: string) => {
    const item = byId(db.items, itemId)
    if (!item) return updateLine(lineId, { itemId: '' })
    const fresh = lineFromItem(item, draft.kind, 1)
    setDraft((d) => ({ ...d, lines: d.lines.map((l) => (l.id === lineId ? { ...fresh, id: l.id, qty: l.qty || 1, received: meta.lineMode === 'receipt' ? l.received || l.qty || 1 : 0, accepted: meta.lineMode === 'receipt' ? l.accepted || l.qty || 1 : 0, delivered: meta.lineMode === 'delivery' ? l.delivered || l.qty || 1 : 0 } : l)) }))
  }
  const addLine = () => setDraft((d) => ({ ...d, lines: [...d.lines, blankLine()] }))
  const removeLine = (id: string) => setDraft((d) => ({ ...d, lines: d.lines.length > 1 ? d.lines.filter((l) => l.id !== id) : d.lines }))

  const mode = meta.lineMode
  const isSalesReturn = draft.kind === 'salesReturn'
  const lineError = errors.lines?.split('\n') ?? []

  /* ---------------- payment editor ---------------- */
  if (mode === 'payment') {
    return (
      <fieldset disabled={readOnly} className="min-w-0 border-0 p-0">
        <PaymentEditor draft={draft} patch={patch} errors={errors} isNew={isNew} seriesOptions={seriesOptions} displayNo={displayNo} parties={parties} choosePartyAndGst={choosePartyAndGst} />
      </fieldset>
    )
  }

  const columns: string[] =
    mode === 'priced' ? ['Item', 'Qty', 'Rate (₹)', 'Disc %', 'GST', 'Amount']
      : mode === 'receipt' ? ['Item', 'Ordered', 'Received', 'Accepted', 'Rejected', 'Rate (₹)', 'Amount']
        : mode === 'delivery' ? ['Item', 'Ordered', 'Delivered', 'Pending']
          : mode === 'return' ? ['Item', 'Qty', 'Rate (₹)', isSalesReturn ? 'Condition' : 'Reason', 'Amount']
            : ['Item', 'Qty', 'Unit', 'Remarks']

  return (
    <fieldset disabled={readOnly} className="min-w-0 border-0 p-0">
      <div className="flex flex-col gap-5">
        {Object.keys(errors).length > 0 ? (
          <div role="alert" className="flex gap-3 rounded-xl bg-rose-50 p-3.5 text-sm text-rose-900 ring-1 ring-rose-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-semibold">This document needs attention before it can be saved.</p>
              <ul className="mt-1 list-disc pl-4 text-[13px]">
                {Object.entries(errors).flatMap(([key, msg]) => msg.split('\n').map((m, i) => <li key={`${key}${i}`}>{m}</li>))}
              </ul>
            </div>
          </div>
        ) : null}

        <section className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Series" required error={errors.seriesId}>
            <Select value={draft.seriesId} onChange={(e) => patch({ seriesId: e.target.value })} disabled={!isNew}>
              {seriesOptions.map((s) => <option key={s.id} value={s.id}>{s.prefix}</option>)}
            </Select>
          </Field>
          <Field label={`${meta.label} no`} hint={isNew ? 'Assigned on save' : undefined}>
            <Input value={displayNo} readOnly className="font-mono" />
          </Field>
          <Field label={meta.dateLabel} required error={errors.date}>
            <Input type="date" value={draft.date} onChange={(e) => patch({ date: e.target.value, ...(meta.extraDate?.key === 'dueDate' ? { dueDate: addDaysISO(e.target.value, PAYMENT_TERMS[draft.paymentTerms] ?? 30) } : {}) })} invalid={Boolean(errors.date)} />
          </Field>
          {meta.extraDate ? (
            <Field label={meta.extraDate.label} required error={errors[meta.extraDate.key]}>
              <Input type="date" value={draft[meta.extraDate.key]} onChange={(e) => patch({ [meta.extraDate!.key]: e.target.value } as Partial<Doc>)} invalid={Boolean(errors[meta.extraDate.key])} />
            </Field>
          ) : <div className="hidden lg:block" />}

          <Field label={meta.partyType} required error={errors.partyId} className="lg:col-span-2">
            <Select value={draft.partyId} onChange={(e) => choosePartyAndGst(e.target.value)} invalid={Boolean(errors.partyId)}>
              <option value="">Select {meta.partyType.toLowerCase()}…</option>
              {parties.map((p) => <option key={p.id} value={p.id}>{p.name} — {p.city}</option>)}
            </Select>
          </Field>
          {sources.length > 0 ? (
            <Field label={`Load from ${sources.map((s) => DOC_META[s].label).join(' / ')}`} hint="Copies items, charges and party" className="lg:col-span-2">
              <Select value="" onChange={(e) => loadFrom(e.target.value)}>
                <option value="">— Optional —</option>
                {sourceDocs.map((d) => <option key={d.id} value={d.id}>{DOC_META[d.kind].label} {d.no} · {nameOf(db.parties, d.partyId)}{DOC_META[d.kind].moneyDoc ? ` · ${formatMoney(docTotal(d, db))}` : ''}</option>)}
              </Select>
            </Field>
          ) : null}

          {meta.fields.includes('gstType') ? (
            <Field label="Tax type" hint="Auto-set from party state">
              <Select value={draft.gstType} onChange={(e) => patch({ gstType: e.target.value as Doc['gstType'] })}>
                <option value="Intra">Intra-state (CGST + SGST)</option>
                <option value="Inter">Inter-state (IGST)</option>
              </Select>
            </Field>
          ) : null}
          {meta.fields.includes('paymentTerms') ? (
            <Field label="Payment terms">
              <Select value={draft.paymentTerms} onChange={(e) => patch({ paymentTerms: e.target.value, dueDate: addDaysISO(draft.date, PAYMENT_TERMS[e.target.value] ?? 30) })}>
                {Object.keys(PAYMENT_TERMS).map((t) => <option key={t}>{t}</option>)}
              </Select>
            </Field>
          ) : null}
          {meta.fields.includes('reference') ? <Field label="Reference"><Input value={draft.reference} onChange={(e) => patch({ reference: e.target.value })} placeholder="PO / customer ref" /></Field> : null}
          {meta.fields.includes('dealer') ? <Field label="Dealer code / name"><Input value={draft.dealerCode} onChange={(e) => patch({ dealerCode: e.target.value })} placeholder="D001" /></Field> : null}
          {meta.fields.includes('dealer') ? <Field label="Employee code / name"><Input value={draft.empCode} onChange={(e) => patch({ empCode: e.target.value })} placeholder="E001" /></Field> : null}
          {meta.fields.includes('transporter') ? (
            <Field label="Transporter">
              <Select value={draft.transporterId} onChange={(e) => patch({ transporterId: e.target.value })}>
                <option value="">— None —</option>
                {db.transporters.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.kind})</option>)}
              </Select>
            </Field>
          ) : null}
          {meta.fields.includes('vehicle') ? <Field label="Vehicle no"><Input value={draft.vehicleNo} onChange={(e) => patch({ vehicleNo: e.target.value.toUpperCase() })} placeholder="GJ03 AB 1234" /></Field> : null}
          {meta.fields.includes('tracking') ? <Field label="Tracking no"><Input value={draft.trackingNo} onChange={(e) => patch({ trackingNo: e.target.value })} /></Field> : null}
          {meta.fields.includes('receiver') ? <Field label="Receiver name"><Input value={draft.receiverName} onChange={(e) => patch({ receiverName: e.target.value })} /></Field> : null}
          {meta.fields.includes('receiver') ? <Field label="Receiver mobile"><Input type="tel" value={draft.receiverMobile} onChange={(e) => patch({ receiverMobile: e.target.value })} /></Field> : null}
          {meta.fields.includes('gateType') ? (
            <Field label="Type">
              <Select value={draft.gateType} onChange={(e) => patch({ gateType: e.target.value })}>
                {['Material Out', 'Material In', 'Return', 'Sample', 'Repair'].map((t) => <option key={t}>{t}</option>)}
              </Select>
            </Field>
          ) : null}
          {meta.fields.includes('purpose') ? <Field label="Purpose"><Input value={draft.purpose} onChange={(e) => patch({ purpose: e.target.value })} /></Field> : null}
          {meta.fields.includes('personCarrying') ? <Field label="Person carrying goods"><Input value={draft.personCarrying} onChange={(e) => patch({ personCarrying: e.target.value })} /></Field> : null}
          {meta.fields.includes('returnType') ? (
            <Field label="Return type">
              <Select value={draft.returnType} onChange={(e) => patch({ returnType: e.target.value })}>
                {(isSalesReturn ? ['Sales Return', 'Warranty Return', 'Damage Return', 'Exchange'] : ['Purchase Return', 'Warranty Return', 'Damage Return', 'Exchange']).map((t) => <option key={t}>{t}</option>)}
              </Select>
            </Field>
          ) : null}
          {meta.fields.includes('reason') ? (
            <Field label="Reason for return">
              <Select value={draft.reason} onChange={(e) => patch({ reason: e.target.value })}>
                <option value="">— Select —</option>
                {(isSalesReturn ? ['Defective Product', 'Wrong Item', 'Quality Issue', 'Customer Dissatisfaction', 'Late Delivery'] : ['Defective Product', 'Wrong Item', 'Quality Issue', 'Over Supply', 'Damaged in Transit']).map((t) => <option key={t}>{t}</option>)}
              </Select>
            </Field>
          ) : null}
          {meta.fields.includes('deliveryAddress') ? <Field label="Delivery address" className="sm:col-span-2"><Input value={draft.deliveryAddress} onChange={(e) => patch({ deliveryAddress: e.target.value })} /></Field> : null}
          <Field label="Status" required>
            <Select value={draft.status} onChange={(e) => patch({ status: e.target.value })}>{meta.statuses.map((s) => <option key={s}>{s}</option>)}</Select>
          </Field>
          {draft.refNo ? <Field label="Linked document"><div className="flex h-[42px] items-center"><Badge tone="info">{draft.refNo}</Badge></div></Field> : null}
        </section>

        {/* ---------------- lines ---------------- */}
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-[13px] font-bold tracking-wide text-silver-700 uppercase">Items</h3>
            <Button size="sm" variant="outline" icon={<Plus className="h-4 w-4" />} onClick={addLine}>Add item</Button>
          </div>
          <div className="overflow-x-auto rounded-xl ring-1 ring-silver-200">
            <table className="w-full min-w-[760px] border-collapse text-sm">
              <thead className="bg-silver-50 text-left">
                <tr>
                  <th className="w-8 px-2 py-2 text-[11px] font-bold text-silver-600">#</th>
                  {columns.map((c, i) => <th key={c} className={cn('px-2 py-2 text-[11px] font-bold tracking-[0.06em] text-silver-600 uppercase', i > 0 && 'text-right')}>{c}</th>)}
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-silver-200">
                {draft.lines.map((l, idx) => {
                  const item = byId(db.items, l.itemId)
                  const calc = calcLine(draft, l, db.taxes)
                  const prior = orig && isLive(orig) ? orig.lines.filter((x) => x.itemId === l.itemId).reduce((s, x) => s + x.qty, 0) : 0
                  const available = (stock.get(l.itemId) ?? 0) + (draft.kind === 'salesInvoice' ? prior : 0)
                  const unitAlias = db.units.find((u) => u.id === item?.baseUnitId)?.alias ?? ''
                  return (
                    <tr key={l.id} className="align-top">
                      <td className="px-2 py-2 text-xs text-silver-500">{idx + 1}</td>
                      <td className="min-w-[220px] px-2 py-2">
                        <Select aria-label="Item" value={l.itemId} onChange={(e) => chooseItem(l.id, e.target.value)} className="h-9 text-sm">
                          <option value="">Select item…</option>
                          {itemChoices.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
                        </Select>
                        {item ? (
                          <div className="mt-1 flex flex-wrap items-center gap-x-2 text-[11px] text-silver-600">
                            <span>{item.code}</span>
                            {meta.side === 'sales' && mode !== 'qty' ? <span className={cn(available < l.qty && draft.kind === 'salesInvoice' && 'font-semibold text-rose-600')}>In stock: {available}</span> : null}
                            {meta.hasSerials && item.serialRequired ? (
                              <button type="button" onClick={() => setSerialLine(l.id)} className="font-semibold text-sapphire-700 underline-offset-2 hover:underline">
                                Serials {l.serials.length}/{l.qty}
                              </button>
                            ) : null}
                          </div>
                        ) : null}
                      </td>

                      {mode === 'priced' ? (
                        <>
                          <td className="px-2 py-2"><NumCell aria-label="Quantity" value={l.qty} onChange={(n) => updateLine(l.id, { qty: n, serials: n === l.serials.length ? l.serials : l.serials.slice(0, n) })} /></td>
                          <td className="px-2 py-2"><NumCell aria-label="Rate" value={l.rate} onChange={(n) => updateLine(l.id, { rate: n })} /></td>
                          <td className="px-2 py-2"><NumCell aria-label="Discount percent" value={l.discountPct} onChange={(n) => updateLine(l.id, { discountPct: n })} /></td>
                          <td className="px-2 py-2 text-right">
                            <Select aria-label="Tax" value={l.taxId} onChange={(e) => updateLine(l.id, { taxId: e.target.value })} className="h-9 min-w-[96px] text-sm">
                              <option value="">0%</option>
                              {db.taxes.filter((t) => t.type === 'GST').map((t) => <option key={t.id} value={t.id}>{taxRate(t)}%</option>)}
                            </Select>
                          </td>
                          <td className="tnum px-2 py-2 text-right font-semibold text-navy-900">{formatMoney(calc.total)}</td>
                        </>
                      ) : null}

                      {mode === 'receipt' ? (
                        <>
                          <td className="px-2 py-2"><NumCell aria-label="Ordered" value={l.qty} onChange={(n) => updateLine(l.id, { qty: n })} /></td>
                          <td className="px-2 py-2"><NumCell aria-label="Received" value={l.received} onChange={(n) => updateLine(l.id, { received: n, accepted: Math.min(l.accepted || n, n), rejected: Math.max(0, n - Math.min(l.accepted || n, n)) })} /></td>
                          <td className="px-2 py-2"><NumCell aria-label="Accepted" value={l.accepted} onChange={(n) => updateLine(l.id, { accepted: n, rejected: Math.max(0, l.received - n) })} /></td>
                          <td className="tnum px-2 py-2 text-right text-rose-700">{Math.max(0, l.received - l.accepted)}</td>
                          <td className="px-2 py-2"><NumCell aria-label="Rate" value={l.rate} onChange={(n) => updateLine(l.id, { rate: n })} /></td>
                          <td className="tnum px-2 py-2 text-right font-semibold text-navy-900">{formatMoney(calc.total)}</td>
                        </>
                      ) : null}

                      {mode === 'delivery' ? (
                        <>
                          <td className="px-2 py-2"><NumCell aria-label="Ordered" value={l.qty} onChange={(n) => updateLine(l.id, { qty: n })} /></td>
                          <td className="px-2 py-2"><NumCell aria-label="Delivered" value={l.delivered} onChange={(n) => updateLine(l.id, { delivered: n })} /></td>
                          <td className="tnum px-2 py-2 text-right">{Math.max(0, l.qty - l.delivered)}</td>
                        </>
                      ) : null}

                      {mode === 'return' ? (
                        <>
                          <td className="px-2 py-2"><NumCell aria-label="Quantity" value={l.qty} onChange={(n) => updateLine(l.id, { qty: n })} /></td>
                          <td className="px-2 py-2"><NumCell aria-label="Rate" value={l.rate} onChange={(n) => updateLine(l.id, { rate: n })} /></td>
                          <td className="px-2 py-2">
                            {isSalesReturn ? (
                              <Select aria-label="Condition" value={l.condition} onChange={(e) => updateLine(l.id, { condition: e.target.value })} className="h-9 text-sm">
                                {['Good', 'Damaged', 'Defective'].map((c) => <option key={c}>{c}</option>)}
                              </Select>
                            ) : (
                              <Input aria-label="Reason" value={l.reason} onChange={(e) => updateLine(l.id, { reason: e.target.value })} className="h-9 text-sm" />
                            )}
                          </td>
                          <td className="tnum px-2 py-2 text-right font-semibold text-navy-900">{formatMoney(calc.total)}</td>
                        </>
                      ) : null}

                      {mode === 'qty' ? (
                        <>
                          <td className="px-2 py-2"><NumCell aria-label="Quantity" value={l.qty} onChange={(n) => updateLine(l.id, { qty: n })} /></td>
                          <td className="px-2 py-2 text-right text-silver-600">{unitAlias || '—'}</td>
                          <td className="px-2 py-2"><Input aria-label="Remarks" value={l.remarks} onChange={(e) => updateLine(l.id, { remarks: e.target.value })} className="h-9 text-sm" /></td>
                        </>
                      ) : null}

                      <td className="px-1 py-2 text-right">
                        <button type="button" aria-label="Remove line" onClick={() => removeLine(l.id)} disabled={draft.lines.length <= 1} className="rounded-md p-1.5 text-rose-600 hover:bg-rose-50 disabled:opacity-30">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {lineError.length > 0 && lineError[0] ? (
            <ul className="field-error mt-2 list-disc pl-5 text-xs font-medium text-rose-700">{lineError.map((m, i) => <li key={i}>{m}</li>)}</ul>
          ) : null}
        </section>

        {/* ---------------- sundries + totals ---------------- */}
        <section className="grid gap-5 lg:grid-cols-[1fr_340px]">
          <div className="flex flex-col gap-4">
            {meta.hasSundries ? (
              <div>
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-[13px] font-bold tracking-wide text-silver-700 uppercase">Bill sundry (charges / discounts)</h3>
                  <Select aria-label="Add charge" value="" onChange={(e) => { const s = byId(db.sundries, e.target.value); if (s) patch({ sundries: [...draft.sundries, sundryFrom(s)] }) }} className="h-9 w-auto! min-w-44 text-sm">
                    <option value="">+ Add charge…</option>
                    {db.sundries.filter((s) => s.status === 'Active').map((s) => <option key={s.id} value={s.id}>{s.name} ({s.sign})</option>)}
                  </Select>
                </div>
                {draft.sundries.length === 0 ? <p className="rounded-xl bg-silver-50 px-3 py-3 text-xs text-silver-600 ring-1 ring-silver-200">No charges or discounts added.</p> : (
                  <ul className="divide-y divide-silver-200 rounded-xl ring-1 ring-silver-200">
                    {draft.sundries.map((s) => (
                      <li key={s.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
                        <span className="min-w-32 flex-1 text-sm font-semibold text-navy-900">{s.name}</span>
                        <Select aria-label="Sign" value={s.sign} onChange={(e) => patch({ sundries: draft.sundries.map((x) => (x.id === s.id ? { ...x, sign: e.target.value as 'Add' | 'Subtract' } : x)) })} className="h-9 w-28! text-sm"><option>Add</option><option>Subtract</option></Select>
                        <Select aria-label="Mode" value={s.mode} onChange={(e) => patch({ sundries: draft.sundries.map((x) => (x.id === s.id ? { ...x, mode: e.target.value as 'Percent' | 'Amount' } : x)) })} className="h-9 w-28! text-sm"><option value="Amount">₹ Amount</option><option value="Percent">% Percent</option></Select>
                        <div className="w-28"><NumCell aria-label="Value" value={s.value} onChange={(n) => patch({ sundries: draft.sundries.map((x) => (x.id === s.id ? { ...x, value: n } : x)) })} /></div>
                        <button type="button" aria-label={`Remove ${s.name}`} className="rounded-md p-1.5 text-rose-600 hover:bg-rose-50" onClick={() => patch({ sundries: draft.sundries.filter((x) => x.id !== s.id) })}><X className="h-4 w-4" /></button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}
            <Field label="Notes"><Textarea value={draft.notes} onChange={(e) => patch({ notes: e.target.value })} placeholder="Internal or customer-facing notes" /></Field>
            <Field label="Terms & conditions"><Textarea value={draft.terms} onChange={(e) => patch({ terms: e.target.value })} /></Field>
          </div>

          {meta.moneyDoc ? (
            <aside className="h-fit rounded-2xl bg-silver-50 p-4 ring-1 ring-silver-200">
              <h3 className="mb-2 text-[13px] font-bold tracking-wide text-silver-700 uppercase">Summary</h3>
              <dl className="flex flex-col gap-1.5 text-sm">
                <Row label="Gross" value={totals.gross} />
                <Row label="Discount" value={-totals.discount} />
                <Row label="Taxable value" value={totals.taxable} strong />
                {draft.gstType === 'Inter' ? <Row label="IGST" value={totals.igst} /> : <><Row label="CGST" value={totals.cgst} /><Row label="SGST" value={totals.sgst} /></>}
                {draft.sundries.length > 0 ? <Row label="Charges / discounts" value={totals.sundryNet} /> : null}
                <Row label="Round off" value={totals.roundOff} />
                <div className="mt-2 flex items-center justify-between border-t border-silver-300 pt-3">
                  <dt className="text-sm font-bold text-navy-900">Grand total</dt>
                  <dd className="tnum text-xl font-extrabold text-navy-900">{formatMoney(totals.total)}</dd>
                </div>
              </dl>
            </aside>
          ) : (
            <aside className="h-fit rounded-2xl bg-silver-50 p-4 ring-1 ring-silver-200">
              <h3 className="mb-2 text-[13px] font-bold tracking-wide text-silver-700 uppercase">Summary</h3>
              <p className="text-sm text-silver-700">{draft.lines.filter((l) => l.itemId).length} item line(s)</p>
              <p className="tnum mt-1 text-2xl font-extrabold text-navy-900">{lineTotalQty(draft)} <span className="text-sm font-semibold text-silver-600">units</span></p>
            </aside>
          )}
        </section>
      </div>

      <SerialPicker
        open={Boolean(serialLine)}
        onClose={() => setSerialLine(null)}
        line={draft.lines.find((l) => l.id === serialLine) ?? null}
        docId={draft.id}
        onSave={(serials) => serialLine && updateLine(serialLine, { serials })}
      />
    </fieldset>
  )
}

function lineTotalQty(doc: Doc): number {
  return doc.lines.filter((l) => l.itemId).reduce((s, l) => s + lineQty(doc, l), 0)
}

function Row({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <dt className={cn('text-silver-700', strong && 'font-semibold text-navy-800')}>{label}</dt>
      <dd className={cn('tnum text-navy-900', strong && 'font-semibold')}>{formatMoney(value)}</dd>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Payment / receipt editor                                            */
/* ------------------------------------------------------------------ */

function PaymentEditor({
  draft, patch, errors, isNew, seriesOptions, displayNo, parties, choosePartyAndGst,
}: {
  draft: Doc
  patch: (p: Partial<Doc>) => void
  errors: Record<string, string>
  isNew: boolean
  seriesOptions: ReturnType<typeof seriesFor>
  displayNo: string
  parties: Database['parties']
  choosePartyAndGst: (id: string) => void
}) {
  const { db } = useData()
  const meta = DOC_META[draft.kind]
  const invoiceKind = draft.kind === 'receipt' ? 'salesInvoice' : 'purchaseInvoice'
  const orig = db.docs.find((d) => d.id === draft.id)
  const open = invoiceStates(db, invoiceKind)
    .filter((s) => s.doc.partyId === draft.partyId)
    .map((s) => {
      const own = orig?.allocations.find((a) => a.docId === s.doc.id)?.amount ?? 0
      return { ...s, available: round2(s.balance + own) }
    })
    .filter((s) => s.available > 0.5)
    .sort((a, b) => (a.doc.dueDate < b.doc.dueDate ? -1 : 1))
  const allocated = draft.allocations.reduce((s, a) => s + a.amount, 0)
  const tds = round2((draft.amount * (draft.tdsPct || 0)) / 100)
  const amountOf = (id: string) => draft.allocations.find((a) => a.docId === id)?.amount ?? 0
  const setAlloc = (id: string, amount: number) => {
    const rest = draft.allocations.filter((a) => a.docId !== id)
    patch({ allocations: amount > 0 ? [...rest, { docId: id, amount }] : rest })
  }
  const autoAllocate = () => {
    let remaining = draft.amount
    const next: Doc['allocations'] = []
    for (const s of open) {
      if (remaining <= 0) break
      const take = Math.min(remaining, s.available)
      next.push({ docId: s.doc.id, amount: round2(take) })
      remaining = round2(remaining - take)
    }
    patch({ allocations: next })
  }
  const methods = draft.kind === 'receipt' ? ['Cash', 'Cheque', 'Online Transfer', 'Bank Transfer', 'Credit Card'] : ['Cash', 'Bank Transfer', 'Cheque', 'UPI', 'Credit Card']

  return (
    <div className="flex flex-col gap-5">
      {Object.keys(errors).length > 0 ? (
        <div role="alert" className="flex gap-3 rounded-xl bg-rose-50 p-3.5 text-sm text-rose-900 ring-1 ring-rose-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <ul className="list-disc pl-4 text-[13px]">{Object.values(errors).map((m, i) => <li key={i}>{m}</li>)}</ul>
        </div>
      ) : null}
      <section className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Series" required error={errors.seriesId}>
          <Select value={draft.seriesId} onChange={(e) => patch({ seriesId: e.target.value })} disabled={!isNew}>{seriesOptions.map((s) => <option key={s.id} value={s.id}>{s.prefix}</option>)}</Select>
        </Field>
        <Field label="Payment no" hint={isNew ? 'Assigned on save' : undefined}><Input value={displayNo} readOnly className="font-mono" /></Field>
        <Field label={meta.dateLabel} required error={errors.date}><Input type="date" value={draft.date} onChange={(e) => patch({ date: e.target.value })} invalid={Boolean(errors.date)} /></Field>
        <Field label="Payment method" required>
          <Select value={draft.method} onChange={(e) => patch({ method: e.target.value })}>{methods.map((m) => <option key={m}>{m}</option>)}</Select>
        </Field>
        <Field label={meta.partyType} required error={errors.partyId} className="lg:col-span-2">
          <Select value={draft.partyId} onChange={(e) => choosePartyAndGst(e.target.value)} invalid={Boolean(errors.partyId)}>
            <option value="">Select {meta.partyType.toLowerCase()}…</option>
            {parties.map((p) => <option key={p.id} value={p.id}>{p.name} — {p.city}</option>)}
          </Select>
        </Field>
        <Field label="Amount (₹)" required error={errors.amount}>
          <NumCell aria-label="Amount" value={draft.amount} onChange={(n) => patch({ amount: n })} className="h-[42px] text-left" />
        </Field>
        {draft.kind === 'vendorPayment' ? (
          <Field label="TDS %" error={errors.tdsPct} hint={draft.tdsPct ? `TDS ${formatMoney(tds)} · net paid ${formatMoney(draft.amount - tds)}` : 'Deducted from the amount paid'}>
            <NumCell aria-label="TDS percent" value={draft.tdsPct} onChange={(n) => patch({ tdsPct: n })} className="h-[42px] text-left" />
          </Field>
        ) : <div className="hidden lg:block" />}
        <Field label="Reference / UTR / cheque no"><Input value={draft.reference} onChange={(e) => patch({ reference: e.target.value })} /></Field>
        <Field label="Bank details" className="lg:col-span-2"><Input value={draft.bankDetails} onChange={(e) => patch({ bankDetails: e.target.value })} placeholder="Bank / branch / account" /></Field>
        <Field label="Status"><Select value={draft.status} onChange={(e) => patch({ status: e.target.value })}>{meta.statuses.map((s) => <option key={s}>{s}</option>)}</Select></Field>
      </section>

      <section>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-[13px] font-bold tracking-wide text-silver-700 uppercase">Settle against {draft.kind === 'receipt' ? 'sales' : 'purchase'} invoices</h3>
          <Button size="sm" variant="outline" icon={<Wand2 className="h-4 w-4" />} onClick={autoAllocate} disabled={!draft.partyId || draft.amount <= 0}>Auto-allocate oldest first</Button>
        </div>
        {!draft.partyId ? (
          <p className="rounded-xl bg-silver-50 px-3 py-4 text-sm text-silver-600 ring-1 ring-silver-200">Choose a {meta.partyType.toLowerCase()} to see their open invoices.</p>
        ) : open.length === 0 ? (
          <p className="rounded-xl bg-silver-50 px-3 py-4 text-sm text-silver-600 ring-1 ring-silver-200">No outstanding invoices — the full amount will be recorded as an advance on account.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl ring-1 ring-silver-200">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead className="bg-silver-50 text-left text-[11px] font-bold tracking-[0.06em] text-silver-600 uppercase">
                <tr><th className="px-3 py-2">Invoice</th><th className="px-3 py-2">Date</th><th className="px-3 py-2">Due</th><th className="px-3 py-2 text-right">Total</th><th className="px-3 py-2 text-right">Outstanding</th><th className="w-40 px-3 py-2 text-right">Settle now</th></tr>
              </thead>
              <tbody className="divide-y divide-silver-200">
                {open.map((s) => (
                  <tr key={s.doc.id}>
                    <td className="px-3 py-2 font-semibold text-navy-900">{s.doc.no}{s.overdue ? <Badge tone="danger" className="ml-2">{s.daysOverdue}d overdue</Badge> : null}</td>
                    <td className="px-3 py-2">{formatDate(s.doc.date)}</td>
                    <td className="px-3 py-2">{formatDate(s.doc.dueDate)}</td>
                    <td className="tnum px-3 py-2 text-right">{formatMoney(s.total)}</td>
                    <td className="tnum px-3 py-2 text-right font-semibold">{formatMoney(s.available)}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        <NumCell aria-label={`Settle ${s.doc.no}`} value={amountOf(s.doc.id)} onChange={(n) => setAlloc(s.doc.id, Math.min(n, s.available))} />
                        <Button size="xs" variant="secondary" onClick={() => setAlloc(s.doc.id, Math.min(s.available, Math.max(draft.amount - (allocated - amountOf(s.doc.id)), 0) || s.available))}>Full</Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <Stat label="Payment amount" value={draft.amount} />
          <Stat label="Settled against invoices" value={allocated} />
          <Stat label="Advance on account" value={Math.max(0, round2(draft.amount - allocated))} tone={draft.amount - allocated > 0.5 ? 'amber' : undefined} />
        </div>
      </section>
      <Field label="Description / notes"><Textarea value={draft.notes} onChange={(e) => patch({ notes: e.target.value })} /></Field>
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: 'amber' }) {
  return (
    <div className={cn('rounded-xl p-3 ring-1', tone === 'amber' ? 'bg-amber-50 ring-amber-200' : 'bg-silver-50 ring-silver-200')}>
      <p className="text-[11px] font-bold tracking-wide text-silver-600 uppercase">{label}</p>
      <p className="tnum mt-0.5 text-lg font-extrabold text-navy-900">{formatMoney(value)}</p>
    </div>
  )
}

export { docsOf, uid }
