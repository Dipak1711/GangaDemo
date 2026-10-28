import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  ArrowRightCircle, ChevronDown, ChevronLeft, ChevronRight, Download, Eye, FilePlus2, Pencil, Plus, Printer, Trash2,
  IndianRupee, Hourglass, ClipboardList, CheckCircle2, FileText,
} from 'lucide-react'
import type { Doc, DocKind } from '@/types'
import { useData } from '@/store/DataContext'
import { useToast } from '@/store/ToastContext'
import { useAccess } from '@/hooks/useAccess'
import { useClickOutside } from '@/hooks'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Form'
import { PageHeader, SearchInput } from '@/components/ui/Layout'
import { ConfirmDialog, Modal } from '@/components/ui/Modal'
import { SegmentedTabs } from '@/components/ui/SegmentedTabs'
import { StatCard, type StatCardProps } from '@/components/ui/StatCard'
import { StatusBadge } from '@/components/ui/Badge'
import { Table, TableEmptyRow, TableShell, TBody, Td, Th, THead, TR } from '@/components/ui/Table'
import { DocEditor, validateDoc } from '@/components/doc/DocEditor'
import { DOC_META } from '@/lib/docConfig'
import { applyCascade, blankDoc, defaultSeriesId, deriveDoc, takeDocNo, termsFor } from '@/lib/docs'
import { byId, calcDoc, docsOf, docTotal, invoiceStates, isLive, nameOf, type InvoiceState } from '@/lib/calc'
import { printDocument } from '@/lib/print'
import { addDaysISO, cn, downloadCSV, formatCurrency, formatDate, formatMoney, todayISO } from '@/lib/utils'

const PERIODS = [
  { value: 'all', label: 'All time' },
  { value: 'month', label: 'This month' },
  { value: '90', label: 'Last 90 days' },
  { value: 'fy', label: 'This financial year' },
]

function ConvertMenu({ doc, onPick }: { doc: Doc; onPick: (to: DocKind) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useClickOutside<HTMLDivElement>(() => setOpen(false))
  const options = DOC_META[doc.kind].convert
  if (options.length === 0) return null
  return (
    <div ref={ref} className="relative">
      <Button variant="ghost" size="icon" aria-label="Next step" title="Create next document" aria-expanded={open} onClick={() => setOpen((v) => !v)} icon={<ArrowRightCircle className="h-4 w-4 text-sapphire-600" />} />
      {open ? (
        <div className="animate-pop-in absolute right-0 top-9 z-20 w-56 origin-top-right overflow-hidden rounded-xl bg-surface text-left shadow-panel">
          <p className="border-b border-silver-100 bg-silver-50/70 px-3 py-2 text-[11px] font-bold tracking-wide text-silver-600 uppercase">Next step</p>
          {options.map((o) => (
            <button key={o.to} type="button" onClick={() => { setOpen(false); onPick(o.to) }} className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-[13px] font-medium text-navy-800 hover:bg-silver-50">
              <FilePlus2 className="h-4 w-4 text-sapphire-600" /> {o.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

export function DocumentPage({ kind }: { kind: DocKind }) {
  const meta = DOC_META[kind]
  const { db, mutate, remove } = useData()
  const toast = useToast()
  const navigate = useNavigate()
  const location = useLocation()
  const { canEdit } = useAccess()

  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [period, setPeriod] = useState('all')
  const [page, setPage] = useState(1)
  const [draft, setDraft] = useState<Doc | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [deleting, setDeleting] = useState<Doc | null>(null)
  const pageSize = 10
  const isInvoice = kind === 'salesInvoice' || kind === 'purchaseInvoice'

  const states = useMemo(() => (isInvoice ? new Map<string, InvoiceState>(invoiceStates(db, kind as 'salesInvoice' | 'purchaseInvoice').map((s) => [s.doc.id, s])) : null), [db, isInvoice, kind])
  const allRows = useMemo(() => docsOf(db, kind).slice().sort((a, b) => (a.date === b.date ? b.no.localeCompare(a.no, undefined, { numeric: true }) : a.date < b.date ? 1 : -1)), [db, kind])

  const statusOf = (d: Doc): string => (states ? (states.get(d.id)?.overdue ? 'Overdue' : states.get(d.id)?.status ?? d.status) : d.status)
  const statusKeys = isInvoice ? ['Unpaid', 'Partial', 'Paid', 'Overdue', 'Cancelled'] : meta.statuses

  const inPeriod = (d: Doc) => {
    if (period === 'all') return true
    if (period === 'month') return d.date.slice(0, 7) === todayISO().slice(0, 7)
    if (period === '90') return d.date >= addDaysISO(todayISO(), -90)
    return d.date >= db.company.financialYearStart
  }

  const rows = useMemo(() => {
    const term = query.trim().toLowerCase()
    return allRows.filter((d) => {
      if (!inPeriod(d)) return false
      if (status !== 'all') {
        if (isInvoice) {
          const s = states?.get(d.id)
          if (status === 'Overdue' ? !s?.overdue : s?.status !== status) return false
        } else if (d.status !== status) return false
      }
      if (!term) return true
      const items = d.lines.map((l) => nameOf(db.items, l.itemId, '')).join(' ')
      return `${d.no} ${d.refNo} ${nameOf(db.parties, d.partyId, '')} ${items} ${d.reference}`.toLowerCase().includes(term)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allRows, query, status, period, states, db])

  useEffect(() => setPage(1), [query, status, period])
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize))
  const safePage = Math.min(page, pageCount)
  const visible = rows.slice((safePage - 1) * pageSize, safePage * pageSize)

  /* ---------- opening from search / conversion ---------- */
  const handled = useRef('')
  const navState = location.state as { openId?: string; newFromInvoice?: string } | null
  useEffect(() => {
    const key = `${location.key}`
    if (handled.current === key) return
    if (navState?.openId) {
      const found = allRows.find((d) => d.id === navState.openId)
      if (found) {
        handled.current = key
        setDraft(structuredClone(found))
        setIsNew(false)
        setErrors({})
      }
    } else if (navState?.newFromInvoice && (kind === 'receipt' || kind === 'vendorPayment')) {
      const inv = db.docs.find((d) => d.id === navState.newFromInvoice)
      if (inv) {
        handled.current = key
        const base = blankDoc(kind, defaultSeriesId(db, kind))
        const balance = invoiceStates(db, kind === 'receipt' ? 'salesInvoice' : 'purchaseInvoice').find((s) => s.doc.id === inv.id)?.balance ?? 0
        base.partyId = inv.partyId
        base.amount = balance
        base.refId = inv.id
        base.refNo = inv.no
        base.allocations = balance > 0 ? [{ docId: inv.id, amount: balance }] : []
        setDraft(base)
        setIsNew(true)
        setErrors({})
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key, allRows])

  const openNew = () => {
    const d = blankDoc(kind, defaultSeriesId(db, kind))
    d.terms = termsFor(db, kind)
    setDraft(d)
    setIsNew(true)
    setErrors({})
  }
  const openEdit = (d: Doc) => {
    setDraft(structuredClone(d))
    setIsNew(false)
    setErrors({})
  }

  const save = () => {
    if (!draft) return
    const cleaned: Doc = { ...draft, lines: meta.lineMode === 'payment' ? [] : draft.lines.filter((l) => l.itemId) }
    if (kind === 'goodsReceipt') cleaned.lines = cleaned.lines.map((l) => ({ ...l, rejected: Math.max(0, l.received - l.accepted) }))
    const found = validateDoc(cleaned, db)
    if (Object.keys(found).length) {
      setErrors(found)
      toast.error('Please fix the highlighted problems.')
      return
    }
    const saved = mutate(
      (d) => {
        const idx = d.docs.findIndex((x) => x.id === cleaned.id)
        const doc = { ...cleaned }
        if (idx < 0) {
          doc.no = takeDocNo(d, doc.seriesId) || doc.no
          doc.createdAt = new Date().toISOString()
          d.docs.push(doc)
        } else {
          d.docs[idx] = doc
        }
        if (idx < 0) applyCascade(d, doc)
        return doc
      },
      { action: isNew ? 'Created' : 'Updated', entity: 'docs', detail: `${meta.label} ${cleaned.no || ''}`.trim() },
    )
    toast.success(`${meta.label} ${saved.no} ${isNew ? 'created' : 'updated'}.`)
    setDraft(null)
  }

  const convert = (source: Doc, to: DocKind) => {
    if (to === 'receipt' || to === 'vendorPayment') {
      navigate(DOC_META[to].route, { state: { newFromInvoice: source.id } })
      return
    }
    const next = deriveDoc(db, source, to)
    const created = mutate(
      (d) => {
        next.no = takeDocNo(d, next.seriesId)
        next.createdAt = new Date().toISOString()
        d.docs.push(next)
        applyCascade(d, next)
        return next
      },
      { action: 'Created', entity: 'docs', detail: `${DOC_META[to].label} ${next.no} from ${source.no}` },
    )
    toast.success(`${DOC_META[to].label} ${created.no} created from ${source.no}.`)
    navigate(DOC_META[to].route, { state: { openId: created.id } })
  }

  const askDelete = (d: Doc) => {
    const settled = db.docs.some((x) => (x.kind === 'receipt' || x.kind === 'vendorPayment') && isLive(x) && x.allocations.some((a) => a.docId === d.id))
    if (settled) return toast.error(`Cannot delete ${d.no}: payments are settled against it. Delete or cancel those payments first.`)
    setDeleting(d)
  }
  const confirmDelete = () => {
    if (!deleting) return
    remove('docs', deleting.id, `${meta.label} ${deleting.no}`, 'docs')
    toast.success(`${meta.label} moved to the recycle bin.`)
    setDeleting(null)
  }

  const exportCsv = () =>
    downloadCSV(`${kind}-${todayISO()}.csv`, ['No', 'Date', meta.partyType, 'Reference', 'Items', 'Total', 'Status'],
      rows.map((d) => [d.no, d.date, nameOf(db.parties, d.partyId), d.refNo, d.lines.length, meta.moneyDoc ? docTotal(d, db) : '', statusOf(d)]))

  /* ---------- stats ---------- */
  const live = allRows.filter(isLive)
  const total = live.reduce((s, d) => s + docTotal(d, db), 0)
  const stats: StatCardProps[] = useMemo(() => {
    const count: StatCardProps = { label: `Total ${meta.plural.toLowerCase()}`, value: live.length, numericValue: live.length, icon: <FileText className="h-5 w-5" />, tone: 'sapphire' }
    if (isInvoice && states) {
      const all = [...states.values()]
      const outstanding = all.reduce((s, x) => s + x.balance, 0)
      const overdue = all.filter((x) => x.overdue)
      return [
        count,
        { label: 'Invoiced value', value: '', numericValue: total, format: (v) => formatCurrency(v, true), icon: <IndianRupee className="h-5 w-5" />, tone: 'emerald' },
        { label: 'Outstanding', value: '', numericValue: outstanding, format: (v) => formatCurrency(v, true), icon: <Hourglass className="h-5 w-5" />, tone: 'amber' },
        { label: 'Overdue invoices', value: overdue.length, numericValue: overdue.length, icon: <ClipboardList className="h-5 w-5" />, tone: 'rose', hint: overdue.length ? formatCurrency(overdue.reduce((s, x) => s + x.balance, 0), true) : 'All on time' },
      ]
    }
    if (kind === 'receipt' || kind === 'vendorPayment') {
      const month = live.filter((d) => d.date.slice(0, 7) === todayISO().slice(0, 7))
      return [
        count,
        { label: 'Total amount', value: '', numericValue: live.reduce((s, d) => s + d.amount, 0), format: (v) => formatCurrency(v, true), icon: <IndianRupee className="h-5 w-5" />, tone: 'emerald' },
        { label: 'This month', value: '', numericValue: month.reduce((s, d) => s + d.amount, 0), format: (v) => formatCurrency(v, true), icon: <CheckCircle2 className="h-5 w-5" />, tone: 'cyan' },
        { label: 'Advance on account', value: '', numericValue: live.reduce((s, d) => s + Math.max(0, d.amount - d.allocations.reduce((a, x) => a + x.amount, 0)), 0), format: (v) => formatCurrency(v, true), icon: <Hourglass className="h-5 w-5" />, tone: 'amber' },
      ]
    }
    const open = live.filter((d) => meta.statuses.slice(0, 2).includes(d.status)).length
    const done = live.filter((d) => d.status === meta.statuses[meta.statuses.length - (meta.statuses.includes('Cancelled') ? 2 : 1)]).length
    return [
      count,
      meta.moneyDoc ? { label: 'Total value', value: '', numericValue: total, format: (v) => formatCurrency(v, true), icon: <IndianRupee className="h-5 w-5" />, tone: 'emerald' } : { label: 'Item lines', value: 0, numericValue: live.reduce((s, d) => s + d.lines.length, 0), icon: <ClipboardList className="h-5 w-5" />, tone: 'emerald' },
      { label: `${meta.statuses[0]} / ${meta.statuses[1]}`, value: open, numericValue: open, icon: <Hourglass className="h-5 w-5" />, tone: 'amber' },
      { label: meta.statuses[meta.statuses.length - (meta.statuses.includes('Cancelled') ? 2 : 1)], value: done, numericValue: done, icon: <CheckCircle2 className="h-5 w-5" />, tone: 'cyan' },
    ]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, kind, states])

  const tabs = [{ value: 'all', label: 'All', count: allRows.length }, ...statusKeys.map((s) => ({ value: s, label: s, count: allRows.filter((d) => statusOf(d) === s).length }))]

  const itemSummary = (d: Doc) => {
    const names = d.lines.map((l) => nameOf(db.items, l.itemId, '')).filter(Boolean)
    if (names.length === 0) return '—'
    return names.length === 1 ? names[0] : `${names[0]} +${names.length - 1} more`
  }

  const extraKey = meta.extraDate?.key

  return (
    <>
      <PageHeader
        title={meta.plural}
        description={meta.description}
        eyebrow={meta.side === 'sales' ? 'Sales' : 'Purchase'}
        icon={<FileText className="h-5 w-5" />}
        actions={
          <>
            <Button variant="outline" icon={<Download className="h-4 w-4" />} onClick={exportCsv} disabled={rows.length === 0}>Export</Button>
            {canEdit ? <Button icon={<Plus className="h-4 w-4" />} onClick={openNew}>New {meta.label.toLowerCase()}</Button> : null}
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((s) => <StatCard key={s.label} {...s} />)}
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <SearchInput value={query} onChange={setQuery} placeholder={`Search ${meta.plural.toLowerCase()}…`} className="w-full sm:w-72" />
        <Select aria-label="Period" value={period} onChange={(e) => setPeriod(e.target.value)} className="h-10 w-auto! min-w-40">
          {PERIODS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
        </Select>
        <span className="tnum ml-auto text-xs font-medium text-silver-600">{rows.length} {rows.length === 1 ? 'record' : 'records'}</span>
      </div>
      <div className="-mt-1 overflow-x-auto pb-1"><SegmentedTabs value={status} onChange={setStatus} items={tabs} size="sm" /></div>

      <TableShell>
        <Table className="min-w-[880px]">
          <THead>
            <tr>
              <Th>{meta.label} no</Th><Th>Date</Th><Th>{meta.partyType}</Th>
              {mode(meta.lineMode) ? <Th className="hidden lg:table-cell">Items</Th> : null}
              {extraKey ? <Th className="hidden md:table-cell">{meta.extraDate!.label}</Th> : null}
              {meta.moneyDoc ? <Th align="right">{meta.lineMode === 'payment' ? 'Amount' : 'Total'}</Th> : null}
              {isInvoice ? <Th align="right">Balance</Th> : null}
              <Th>Status</Th><Th align="right">Actions</Th>
            </tr>
          </THead>
          <TBody>
            {visible.length === 0 ? (
              <TableEmptyRow colSpan={9}>No {meta.plural.toLowerCase()} found</TableEmptyRow>
            ) : (
              visible.map((d) => {
                const st = states?.get(d.id)
                return (
                  <TR key={d.id} onClick={() => openEdit(d)}>
                    <Td>
                      <span className="font-mono text-[13px] font-semibold text-navy-900">{d.no}</span>
                      {d.refNo ? <span className="block text-[11px] text-silver-600">from {d.refNo}</span> : null}
                    </Td>
                    <Td className="whitespace-nowrap">{formatDate(d.date)}</Td>
                    <Td className="min-w-[170px]"><span className="font-medium text-navy-900">{nameOf(db.parties, d.partyId)}</span></Td>
                    {mode(meta.lineMode) ? <Td className="hidden max-w-[220px] truncate lg:table-cell">{itemSummary(d)}</Td> : null}
                    {extraKey ? <Td className="hidden whitespace-nowrap md:table-cell">{formatDate(d[extraKey])}</Td> : null}
                    {meta.moneyDoc ? <Td align="right" className="font-semibold text-navy-900">{formatMoney(docTotal(d, db))}</Td> : null}
                    {isInvoice ? <Td align="right" className={cn(st && st.balance > 0 ? 'font-semibold text-rose-700' : 'text-silver-500')}>{st ? formatMoney(st.balance) : '—'}</Td> : null}
                    <Td><StatusBadge status={statusOf(d)} /></Td>
                    <Td align="right">
                      <div className="flex items-center justify-end gap-0.5" onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" aria-label={`Print ${d.no}`} title="Print" onClick={() => printDocument(d, db)} icon={<Printer className="h-4 w-4" />} />
                        {canEdit ? <ConvertMenu doc={d} onPick={(to) => convert(d, to)} /> : null}
                        <Button variant="ghost" size="icon" aria-label={`${canEdit ? 'Edit' : 'View'} ${d.no}`} title={canEdit ? 'Edit' : 'View'} onClick={() => openEdit(d)} icon={canEdit ? <Pencil className="h-4 w-4" /> : <Eye className="h-4 w-4" />} />
                        {canEdit ? <Button variant="ghost" size="icon" aria-label={`Delete ${d.no}`} title="Delete" className="text-rose-600 hover:bg-rose-50 hover:text-rose-700" onClick={() => askDelete(d)} icon={<Trash2 className="h-4 w-4" />} /> : null}
                      </div>
                    </Td>
                  </TR>
                )
              })
            )}
          </TBody>
        </Table>
        {rows.length > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-silver-200 bg-silver-50/60 px-4 py-2.5 text-xs text-silver-600">
            <span className="tnum">{(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, rows.length)} of {rows.length}</span>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" aria-label="Previous page" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)} icon={<ChevronLeft className="h-4 w-4" />} />
              <span className="tnum px-2">Page {safePage} / {pageCount}</span>
              <Button variant="outline" size="icon" aria-label="Next page" disabled={safePage >= pageCount} onClick={() => setPage(safePage + 1)} icon={<ChevronRight className="h-4 w-4" />} />
            </div>
          </div>
        ) : null}
      </TableShell>

      <Modal
        open={Boolean(draft)}
        onClose={() => setDraft(null)}
        size="full"
        title={`${isNew ? 'New' : canEdit ? 'Edit' : 'View'} ${meta.label.toLowerCase()}`}
        subtitle={draft ? `${isNew ? 'Number assigned on save' : draft.no} · ${nameOf(db.parties, draft.partyId, meta.partyType)}${draft.refNo ? ` · from ${draft.refNo}` : ''}` : ''}
        footer={
          <>
            {draft && !isNew ? <Button variant="outline" icon={<Printer className="h-4 w-4" />} onClick={() => printDocument({ ...draft, lines: draft.lines.filter((l) => l.itemId) }, db)} className="mr-auto">Print</Button> : null}
            <Button variant="outline" onClick={() => setDraft(null)}>{canEdit ? 'Cancel' : 'Close'}</Button>
            {canEdit ? <Button onClick={save}>{isNew ? `Create ${meta.label.toLowerCase()}` : 'Save changes'}</Button> : null}
          </>
        }
      >
        {draft ? <DocEditor draft={draft} setDraft={(fn) => setDraft((d) => (d ? fn(d) : d))} errors={errors} isNew={isNew} readOnly={!canEdit} /> : null}
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        title={`Delete ${meta.label.toLowerCase()}?`}
        message={<><strong className="text-navy-900">{deleting?.no}</strong> will be moved to the recycle bin and its effect on stock and ledgers is reversed. You can restore it from Settings → Recycling.</>}
        confirmLabel="Delete"
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </>
  )
}

/** Whether an "Items" column makes sense for the document mode. */
function mode(m: string): boolean {
  return m !== 'payment'
}

