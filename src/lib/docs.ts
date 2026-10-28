import type { Database, Doc, DocKind, DocLine, DocSundry, Item, Sundry } from '@/types'
import { DOC_META } from '@/lib/docConfig'
import { addDaysISO, pad, todayISO, uid } from '@/lib/utils'

export function blankLine(): DocLine {
  return {
    id: uid('ln'), itemId: '', qty: 1, rate: 0, discountPct: 0, taxId: '', serials: [],
    received: 0, accepted: 0, rejected: 0, delivered: 0, condition: 'Good', reason: '', remarks: '',
  }
}

export function lineFromItem(item: Item, kind: DocKind, qty = 1): DocLine {
  const purchaseSide = DOC_META[kind].side === 'purchase'
  const line = blankLine()
  line.itemId = item.id
  line.qty = qty
  line.rate = purchaseSide ? item.purchaseRate : item.sellingRate
  line.taxId = item.taxId
  if (kind === 'goodsReceipt') {
    line.received = qty
    line.accepted = qty
  }
  if (kind === 'deliveryNote' || kind === 'purchaseDelivery') line.delivered = qty
  return line
}

export function sundryFrom(s: Sundry): DocSundry {
  return { id: uid('sd'), sundryId: s.id, name: s.name, sign: s.sign, mode: s.mode, value: s.value }
}

export function blankDoc(kind: DocKind, seriesId = '', no = ''): Doc {
  const meta = DOC_META[kind]
  const today = todayISO()
  return {
    id: uid('doc'), kind, seriesId, no, date: today, partyId: '', refId: '', refNo: '', reference: '',
    dueDate: meta.extraDate?.key === 'dueDate' ? addDaysISO(today, meta.extraDate.offsetDays) : '',
    validTill: meta.extraDate?.key === 'validTill' ? addDaysISO(today, meta.extraDate.offsetDays) : '',
    deliveryDate: meta.extraDate?.key === 'deliveryDate' ? addDaysISO(today, meta.extraDate.offsetDays) : '',
    status: meta.statuses[0], gstType: 'Intra', paymentTerms: 'Net 30',
    lines: meta.lineMode === 'payment' ? [] : [blankLine()], sundries: [], notes: '', terms: '',
    method: 'Bank Transfer', bankDetails: '', amount: 0, tdsPct: 0, allocations: [],
    transporterId: '', vehicleNo: '', trackingNo: '', personCarrying: '', receiverName: '', receiverMobile: '',
    deliveryAddress: '', gateType: 'Material Out', purpose: '', returnType: 'Sales Return', reason: '',
    dealerCode: '', empCode: '', createdAt: new Date().toISOString(),
  }
}

/* ------------------------------------------------------------------ */
/* Numbering                                                           */
/* ------------------------------------------------------------------ */

export function seriesFor(db: Database, kind: DocKind) {
  return db.series.filter((s) => s.kind === kind)
}

export function formatSeriesNo(prefix: string, next: number, width: number): string {
  return `${prefix}${pad(next, width)}`
}

/** Next number for a series without consuming it. */
export function peekDocNo(db: Database, seriesId: string): string {
  const s = db.series.find((x) => x.id === seriesId)
  return s ? formatSeriesNo(s.prefix, s.next, s.pad) : ''
}

/** Consume the next number of a series on a mutable draft. */
export function takeDocNo(draft: Database, seriesId: string): string {
  const s = draft.series.find((x) => x.id === seriesId)
  if (!s) return ''
  const no = formatSeriesNo(s.prefix, s.next, s.pad)
  s.next += 1
  return no
}

export function defaultSeriesId(db: Database, kind: DocKind): string {
  return seriesFor(db, kind)[0]?.id ?? ''
}

export function termsFor(db: Database, kind: DocKind): string {
  return db.terms.find((t) => t.kind === kind)?.text ?? ''
}

/** Build a follow-on document (e.g. quotation → order) copying lines and party. */
export function deriveDoc(db: Database, source: Doc, to: DocKind): Doc {
  const next = blankDoc(to, defaultSeriesId(db, to))
  next.partyId = source.partyId
  next.refId = source.id
  next.refNo = source.no
  next.gstType = source.gstType
  next.sundries = source.sundries.map((s) => ({ ...s, id: uid('sd') }))
  next.terms = termsFor(db, to)
  next.dealerCode = source.dealerCode
  next.empCode = source.empCode
  next.deliveryAddress = source.deliveryAddress
  next.transporterId = source.transporterId
  next.vehicleNo = source.vehicleNo
  if (DOC_META[to].lineMode === 'payment') {
    next.lines = []
    return next
  }
  next.lines = source.lines.map((l) => {
    const copy: DocLine = { ...l, id: uid('ln'), serials: [...l.serials] }
    if (to === 'goodsReceipt') {
      copy.received = l.qty
      copy.accepted = l.qty
      copy.rejected = 0
    }
    if (to === 'deliveryNote' || to === 'purchaseDelivery') copy.delivered = l.qty
    if (to === 'salesReturn' || to === 'purchaseReturn') {
      copy.condition = 'Good'
      copy.reason = ''
    }
    if (to === 'salesInvoice') copy.serials = []
    return copy
  })
  if (to === 'salesReturn') next.returnType = 'Sales Return'
  if (to === 'purchaseReturn') next.returnType = 'Purchase Return'
  return next
}

/** After saving a document created from another, advance the source document's status. */
export function applyCascade(db: Database, doc: Doc): void {
  const src = db.docs.find((d) => d.id === doc.refId)
  if (!src || src.status === 'Cancelled') return
  const map: Partial<Record<DocKind, Partial<Record<DocKind, string>>>> = {
    salesQuotation: { salesOrder: 'Converted' },
    salesOrder: { salesPacking: 'Packed', salesInvoice: 'Invoiced' },
    purchaseQuotation: { purchaseOrder: 'Converted' },
  }
  const next = map[src.kind]?.[doc.kind]
  if (next) src.status = next
  if (src.kind === 'purchaseOrder' && doc.kind === 'goodsReceipt') {
    const received = new Map<string, number>()
    db.docs
      .filter((d) => d.kind === 'goodsReceipt' && d.refId === src.id && d.status !== 'Rejected' && d.status !== 'Cancelled')
      .forEach((d) => d.lines.forEach((l) => received.set(l.itemId, (received.get(l.itemId) ?? 0) + l.accepted)))
    const complete = src.lines.every((l) => (received.get(l.itemId) ?? 0) >= l.qty)
    src.status = complete ? 'Received' : 'Partially Received'
  }
}
