import type { Database, Doc, DocKind, DocLine, Item, Party, Tax } from '@/types'
import { DOC_META } from '@/lib/docConfig'
import { daysBetween, round2, todayISO } from '@/lib/utils'

/* ------------------------------------------------------------------ */
/* Lookups                                                             */
/* ------------------------------------------------------------------ */

export const byId = <T extends { id: string }>(list: T[], id: string | undefined): T | undefined =>
  id ? list.find((entry) => entry.id === id) : undefined

export const nameOf = <T extends { id: string; name: string }>(list: T[], id: string | undefined, fallback = '—') =>
  byId(list, id)?.name ?? fallback

export const taxRate = (tax: Tax | undefined): number => (tax ? tax.igst || tax.cgst + tax.sgst : 0)

export function docsOf(db: Database, kind: DocKind): Doc[] {
  return db.docs.filter((doc) => doc.kind === kind)
}

/** Cancelled / rejected documents never move stock or money. */
export const isLive = (doc: Doc): boolean => doc.status !== 'Cancelled'

/* ------------------------------------------------------------------ */
/* Document totals                                                     */
/* ------------------------------------------------------------------ */

export function lineQty(doc: Pick<Doc, 'kind'>, line: DocLine): number {
  if (doc.kind === 'goodsReceipt') return line.accepted
  if (doc.kind === 'deliveryNote' || doc.kind === 'purchaseDelivery') return line.delivered
  return line.qty
}

export interface LineCalc {
  gross: number
  discount: number
  net: number
  taxPct: number
  tax: number
  total: number
}

export function calcLine(doc: Pick<Doc, 'kind'>, line: DocLine, taxes: Tax[]): LineCalc {
  const qty = lineQty(doc, line)
  const gross = qty * line.rate
  const discount = (gross * (line.discountPct || 0)) / 100
  const net = gross - discount
  const taxPct = taxRate(byId(taxes, line.taxId))
  const tax = (net * taxPct) / 100
  return { gross, discount, net, taxPct, tax, total: net + tax }
}

export interface DocTotals {
  gross: number
  discount: number
  taxable: number
  cgst: number
  sgst: number
  igst: number
  tax: number
  sundryNet: number
  roundOff: number
  total: number
  qty: number
}

export function calcDoc(doc: Doc, taxes: Tax[]): DocTotals {
  if (doc.kind === 'receipt' || doc.kind === 'vendorPayment') {
    return { gross: doc.amount, discount: 0, taxable: doc.amount, cgst: 0, sgst: 0, igst: 0, tax: 0, sundryNet: 0, roundOff: 0, total: doc.amount, qty: 0 }
  }
  let gross = 0
  let discount = 0
  let taxable = 0
  let tax = 0
  let qty = 0
  for (const line of doc.lines) {
    const c = calcLine(doc, line, taxes)
    gross += c.gross
    discount += c.discount
    taxable += c.net
    tax += c.tax
    qty += lineQty(doc, line)
  }
  const inter = doc.gstType === 'Inter'
  const sundryNet = doc.sundries.reduce((sum, s) => {
    const base = s.mode === 'Percent' ? (taxable * s.value) / 100 : s.value
    return sum + (s.sign === 'Add' ? base : -base)
  }, 0)
  const pre = taxable + tax + sundryNet
  const total = Math.round(pre)
  return {
    gross: round2(gross),
    discount: round2(discount),
    taxable: round2(taxable),
    cgst: inter ? 0 : round2(tax / 2),
    sgst: inter ? 0 : round2(tax / 2),
    igst: inter ? round2(tax) : 0,
    tax: round2(tax),
    sundryNet: round2(sundryNet),
    roundOff: round2(total - pre),
    total,
    qty,
  }
}

export const docTotal = (doc: Doc, db: Database): number => calcDoc(doc, db.taxes).total

/* ------------------------------------------------------------------ */
/* Payments                                                            */
/* ------------------------------------------------------------------ */

/** Gross amount settled per invoice, from receipts and vendor payments. */
export function paidMap(db: Database): Map<string, number> {
  const map = new Map<string, number>()
  for (const doc of db.docs) {
    if ((doc.kind !== 'receipt' && doc.kind !== 'vendorPayment') || !isLive(doc)) continue
    for (const alloc of doc.allocations) map.set(alloc.docId, (map.get(alloc.docId) ?? 0) + alloc.amount)
  }
  return map
}

/** Sales returns / purchase returns credited against an invoice. */
export function returnedMap(db: Database): Map<string, number> {
  const map = new Map<string, number>()
  for (const doc of db.docs) {
    if ((doc.kind !== 'salesReturn' && doc.kind !== 'purchaseReturn') || !isLive(doc) || !doc.refId) continue
    map.set(doc.refId, (map.get(doc.refId) ?? 0) + docTotal(doc, db))
  }
  return map
}

export type PayStatus = 'Unpaid' | 'Partial' | 'Paid' | 'Cancelled'
export interface InvoiceState {
  doc: Doc
  total: number
  paid: number
  balance: number
  status: PayStatus
  overdue: boolean
  daysOverdue: number
}

export function invoiceStates(db: Database, kind: 'salesInvoice' | 'purchaseInvoice'): InvoiceState[] {
  const paid = paidMap(db)
  const returned = returnedMap(db)
  const today = todayISO()
  return docsOf(db, kind).map((doc) => {
    const total = docTotal(doc, db) - (returned.get(doc.id) ?? 0)
    const p = paid.get(doc.id) ?? 0
    const balance = doc.status === 'Cancelled' ? 0 : Math.max(0, round2(total - p))
    const status: PayStatus = doc.status === 'Cancelled' ? 'Cancelled' : balance <= 0.5 ? 'Paid' : p > 0 ? 'Partial' : 'Unpaid'
    const late = balance > 0.5 && doc.dueDate && doc.dueDate < today
    return {
      doc,
      total,
      paid: p,
      balance,
      status,
      overdue: Boolean(late),
      daysOverdue: late ? daysBetween(doc.dueDate, today) : 0,
    }
  })
}

/* ------------------------------------------------------------------ */
/* Stock                                                               */
/* ------------------------------------------------------------------ */

export type StockStatus = 'Out of stock' | 'Low stock' | 'In stock' | 'Overstock'

export function stockStatus(item: Item, qty: number): StockStatus {
  if (qty <= 0) return 'Out of stock'
  if (qty <= item.minStock) return 'Low stock'
  if (item.maxStock > 0 && qty >= item.maxStock) return 'Overstock'
  return 'In stock'
}

const GRM_LIVE = new Set(['Received', 'Inspected', 'Accepted'])

/** Current stock per item, derived from opening stock, documents, adjustments and production. */
export function stockMap(db: Database): Map<string, number> {
  const map = new Map<string, number>()
  const add = (id: string, qty: number) => map.set(id, (map.get(id) ?? 0) + qty)
  for (const item of db.items) map.set(item.id, item.openingStock)
  for (const doc of db.docs) {
    if (!isLive(doc)) continue
    switch (doc.kind) {
      case 'goodsReceipt':
        if (GRM_LIVE.has(doc.status)) doc.lines.forEach((l) => add(l.itemId, l.accepted))
        break
      case 'purchaseInvoice': {
        const viaGrm = db.docs.find((d) => d.id === doc.refId)?.kind === 'goodsReceipt'
        if (!viaGrm) doc.lines.forEach((l) => add(l.itemId, l.qty))
        break
      }
      case 'purchaseReturn':
        doc.lines.forEach((l) => add(l.itemId, -l.qty))
        break
      case 'salesInvoice':
        doc.lines.forEach((l) => add(l.itemId, -l.qty))
        break
      case 'salesReturn':
        doc.lines.forEach((l) => l.condition === 'Good' && add(l.itemId, l.qty))
        break
      default:
        break
    }
  }
  for (const move of db.stockMoves) add(move.itemId, move.qty)
  for (const wo of db.workOrders) {
    const bom = byId(db.boms, wo.bomId)
    for (const entry of wo.entries) {
      add(wo.productId, entry.qty)
      bom?.components.forEach((c) => add(c.itemId, -c.qty * entry.qty))
    }
  }
  return map
}

/** Stock per item per warehouse. Documents and production sit in the first (main) warehouse. */
export function warehouseStock(db: Database): Map<string, Map<string, number>> {
  const main = db.warehouses[0]?.id ?? ''
  const total = stockMap(db)
  const result = new Map<string, Map<string, number>>()
  for (const item of db.items) {
    const moved = db.stockMoves.filter((m) => m.itemId === item.id)
    const perWh = new Map<string, number>()
    let movedSum = 0
    for (const m of moved) {
      if (m.type === 'Transfer In' || m.type === 'Transfer Out') {
        perWh.set(m.warehouseId, (perWh.get(m.warehouseId) ?? 0) + m.qty)
        movedSum += m.qty
      }
    }
    perWh.set(main, (perWh.get(main) ?? 0) + (total.get(item.id) ?? 0) - movedSum)
    result.set(item.id, perWh)
  }
  return result
}

export function stockValue(db: Database, stock = stockMap(db)): number {
  return db.items.reduce((sum, item) => sum + Math.max(0, stock.get(item.id) ?? 0) * item.purchaseRate, 0)
}

export function lowStockItems(db: Database): Array<{ item: Item; qty: number }> {
  const stock = stockMap(db)
  return db.items
    .map((item) => ({ item, qty: stock.get(item.id) ?? 0 }))
    .filter(({ item, qty }) => item.status === 'Active' && stockStatus(item, qty) !== 'In stock' && stockStatus(item, qty) !== 'Overstock')
}

/** Serial numbers already consumed by a live sales invoice. */
export function soldSerials(db: Database, exceptDocId?: string): Set<string> {
  const sold = new Set<string>()
  for (const doc of db.docs) {
    if (doc.kind !== 'salesInvoice' || !isLive(doc) || doc.id === exceptDocId) continue
    doc.lines.forEach((l) => l.serials.forEach((s) => sold.add(s)))
  }
  return sold
}

/* ------------------------------------------------------------------ */
/* Ledger & accounting                                                 */
/* ------------------------------------------------------------------ */

export interface AccountInfo {
  id: string
  name: string
  kind: 'System' | 'Customer' | 'Vendor' | 'Dealer' | 'Ledger' | 'Expense'
  nature: 'Asset' | 'Liability' | 'Income' | 'Expense'
}

export const SYS = {
  cash: 'sys:cash',
  bank: 'sys:bank',
  sales: 'sys:sales',
  salesReturn: 'sys:salesReturn',
  purchases: 'sys:purchases',
  purchaseReturn: 'sys:purchaseReturn',
  gstOut: 'sys:gstOut',
  gstIn: 'sys:gstIn',
  tds: 'sys:tds',
  capital: 'sys:capital',
  roundOff: 'sys:roundOff',
  expenses: 'sys:expenses',
} as const

const SYSTEM_ACCOUNTS: AccountInfo[] = [
  { id: SYS.cash, name: 'Cash-in-hand', kind: 'System', nature: 'Asset' },
  { id: SYS.bank, name: 'Bank Accounts', kind: 'System', nature: 'Asset' },
  { id: SYS.gstIn, name: 'GST Input Credit', kind: 'System', nature: 'Asset' },
  { id: SYS.sales, name: 'Sales Account', kind: 'System', nature: 'Income' },
  { id: SYS.purchaseReturn, name: 'Purchase Returns', kind: 'System', nature: 'Income' },
  { id: SYS.purchases, name: 'Purchase Account', kind: 'System', nature: 'Expense' },
  { id: SYS.salesReturn, name: 'Sales Returns', kind: 'System', nature: 'Expense' },
  { id: SYS.expenses, name: 'General Expenses', kind: 'System', nature: 'Expense' },
  { id: SYS.roundOff, name: 'Round Off', kind: 'System', nature: 'Expense' },
  { id: SYS.gstOut, name: 'GST Output Payable', kind: 'System', nature: 'Liability' },
  { id: SYS.tds, name: 'TDS Payable', kind: 'System', nature: 'Liability' },
  { id: SYS.capital, name: 'Capital Account', kind: 'System', nature: 'Liability' },
]

export function accountList(db: Database): AccountInfo[] {
  const list: AccountInfo[] = [...SYSTEM_ACCOUNTS]
  db.expenseCategories.forEach((c) => list.push({ id: `exp:${c.id}`, name: `Expense — ${c.name}`, kind: 'Expense', nature: 'Expense' }))
  db.parties.forEach((p) =>
    list.push({ id: `party:${p.id}`, name: p.name, kind: p.type, nature: p.type === 'Vendor' ? 'Liability' : 'Asset' }),
  )
  db.ledgers.forEach((l) => {
    const group = byId(db.accountGroups, l.groupId)
    list.push({ id: `led:${l.id}`, name: l.name, kind: 'Ledger', nature: group?.nature ?? 'Asset' })
  })
  return list
}

export interface LedgerEntry {
  id: string
  date: string
  voucher: string
  type: string
  account: string
  debit: number
  credit: number
  narration: string
}

export function buildLedger(db: Database): LedgerEntry[] {
  const entries: LedgerEntry[] = []
  let n = 0
  const post = (date: string, voucher: string, type: string, account: string, debit: number, credit: number, narration: string) => {
    if (!debit && !credit) return
    n += 1
    entries.push({ id: `le${n}`, date, voucher, type, account, debit: round2(debit), credit: round2(credit), narration })
  }
  const fy = db.company.financialYearStart
  const partyAcc = (id: string) => `party:${id}`
  const cashOrBank = (method: string) => (method === 'Cash' ? SYS.cash : SYS.bank)
  const partyName = (id: string) => byId(db.parties, id)?.name ?? ''

  // Opening balances, balanced against capital.
  let openingDiff = 0
  for (const party of db.parties) {
    if (!party.openingBalance) continue
    const dr = party.balanceType === 'Dr'
    post(fy, 'Opening', 'Opening', partyAcc(party.id), dr ? party.openingBalance : 0, dr ? 0 : party.openingBalance, 'Opening balance')
    openingDiff += dr ? party.openingBalance : -party.openingBalance
  }
  for (const led of db.ledgers) {
    if (!led.openingBalance) continue
    const dr = led.balanceType === 'Dr'
    post(fy, 'Opening', 'Opening', `led:${led.id}`, dr ? led.openingBalance : 0, dr ? 0 : led.openingBalance, 'Opening balance')
    openingDiff += dr ? led.openingBalance : -led.openingBalance
  }
  if (openingDiff) post(fy, 'Opening', 'Opening', SYS.capital, openingDiff < 0 ? -openingDiff : 0, openingDiff > 0 ? openingDiff : 0, 'Opening balance difference')

  for (const doc of db.docs) {
    if (!isLive(doc)) continue
    const t = calcDoc(doc, db.taxes)
    const name = partyName(doc.partyId)
    const ref = `${DOC_META[doc.kind].label} ${doc.no}`
    switch (doc.kind) {
      case 'salesInvoice':
        post(doc.date, doc.no, 'Sales', partyAcc(doc.partyId), t.total, 0, `${ref} — ${name}`)
        post(doc.date, doc.no, 'Sales', SYS.sales, 0, t.total - t.tax - t.roundOff, ref)
        post(doc.date, doc.no, 'Sales', SYS.gstOut, 0, t.tax, `GST on ${doc.no}`)
        break
      case 'salesReturn':
        post(doc.date, doc.no, 'Sales Return', SYS.salesReturn, t.total - t.tax, 0, ref)
        post(doc.date, doc.no, 'Sales Return', SYS.gstOut, t.tax, 0, `GST reversed on ${doc.no}`)
        post(doc.date, doc.no, 'Sales Return', partyAcc(doc.partyId), 0, t.total, `${ref} — ${name}`)
        break
      case 'receipt':
        post(doc.date, doc.no, 'Receipt', cashOrBank(doc.method), doc.amount, 0, `${ref} — ${name}`)
        post(doc.date, doc.no, 'Receipt', partyAcc(doc.partyId), 0, doc.amount, `${ref} (${doc.method})`)
        break
      case 'purchaseInvoice':
        post(doc.date, doc.no, 'Purchase', SYS.purchases, t.total - t.tax - t.roundOff, 0, ref)
        post(doc.date, doc.no, 'Purchase', SYS.gstIn, t.tax, 0, `GST on ${doc.no}`)
        post(doc.date, doc.no, 'Purchase', partyAcc(doc.partyId), 0, t.total, `${ref} — ${name}`)
        break
      case 'purchaseReturn':
        post(doc.date, doc.no, 'Purchase Return', partyAcc(doc.partyId), t.total, 0, `${ref} — ${name}`)
        post(doc.date, doc.no, 'Purchase Return', SYS.purchaseReturn, 0, t.total - t.tax, ref)
        post(doc.date, doc.no, 'Purchase Return', SYS.gstIn, 0, t.tax, `GST reversed on ${doc.no}`)
        break
      case 'vendorPayment': {
        const tds = round2((doc.amount * (doc.tdsPct || 0)) / 100)
        post(doc.date, doc.no, 'Payment', partyAcc(doc.partyId), doc.amount, 0, `${ref} — ${name}`)
        post(doc.date, doc.no, 'Payment', cashOrBank(doc.method), 0, doc.amount - tds, `${ref} (${doc.method})`)
        post(doc.date, doc.no, 'Payment', SYS.tds, 0, tds, `TDS on ${doc.no}`)
        break
      }
      default:
        break
    }
  }

  for (const exp of db.expenses) {
    if (exp.status !== 'Approved') continue
    post(exp.date, exp.no, 'Expense', `exp:${exp.categoryId}`, exp.amount, 0, exp.description || 'Expense')
    post(exp.date, exp.no, 'Expense', cashOrBank(exp.mode === 'Cash' ? 'Cash' : 'Bank'), 0, exp.amount, `${exp.accountName} (${exp.mode})`)
  }
  for (const v of db.vouchers) {
    post(v.date, v.no, v.kind, v.debitAcc, v.amount, 0, v.narration)
    post(v.date, v.no, v.kind, v.creditAcc, 0, v.amount, v.narration)
  }
  return entries.sort((a, b) => (a.date === b.date ? a.id.localeCompare(b.id, undefined, { numeric: true }) : a.date < b.date ? -1 : 1))
}

export const netOf = (entries: LedgerEntry[], account: string): number =>
  entries.reduce((sum, e) => (e.account === account ? sum + e.debit - e.credit : sum), 0)

export interface TrialRow {
  account: AccountInfo
  debit: number
  credit: number
}

export function trialBalance(db: Database, entries = buildLedger(db)): TrialRow[] {
  const rows: TrialRow[] = []
  for (const account of accountList(db)) {
    const net = round2(netOf(entries, account.id))
    if (Math.abs(net) < 0.005) continue
    rows.push({ account, debit: net > 0 ? net : 0, credit: net < 0 ? -net : 0 })
  }
  return rows
}

export interface ProfitLoss {
  sales: number
  salesReturns: number
  purchases: number
  purchaseReturns: number
  openingStock: number
  closingStock: number
  grossProfit: number
  expenses: Array<{ name: string; amount: number }>
  totalExpenses: number
  roundOff: number
  netProfit: number
}

export function profitLoss(db: Database, entries = buildLedger(db)): ProfitLoss {
  const stock = stockMap(db)
  const openingStock = db.items.reduce((s, i) => s + i.openingStock * i.purchaseRate, 0)
  const closingStock = stockValue(db, stock)
  const sales = -netOf(entries, SYS.sales)
  const salesReturns = netOf(entries, SYS.salesReturn)
  const purchases = netOf(entries, SYS.purchases)
  const purchaseReturns = -netOf(entries, SYS.purchaseReturn)
  const grossProfit = sales - salesReturns - (purchases - purchaseReturns + openingStock - closingStock)
  const expenses = accountList(db)
    .filter((a) => a.kind === 'Expense' || a.id === SYS.expenses)
    .map((a) => ({ name: a.name.replace('Expense — ', ''), amount: round2(netOf(entries, a.id)) }))
    .filter((e) => e.amount !== 0)
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0)
  const roundOff = netOf(entries, SYS.roundOff)
  return {
    sales: round2(sales), salesReturns: round2(salesReturns), purchases: round2(purchases), purchaseReturns: round2(purchaseReturns),
    openingStock: round2(openingStock), closingStock: round2(closingStock), grossProfit: round2(grossProfit),
    expenses, totalExpenses: round2(totalExpenses), roundOff: round2(roundOff),
    netProfit: round2(grossProfit - totalExpenses - roundOff),
  }
}

export interface BalanceSheet {
  assets: Array<{ name: string; amount: number }>
  liabilities: Array<{ name: string; amount: number }>
  totalAssets: number
  totalLiabilities: number
}

export function balanceSheet(db: Database, entries = buildLedger(db)): BalanceSheet {
  const pl = profitLoss(db, entries)
  const assets: BalanceSheet['assets'] = []
  const liabilities: BalanceSheet['liabilities'] = []
  let debtors = 0
  let creditors = 0
  for (const a of accountList(db)) {
    if (a.kind === 'Expense') continue
    const net = round2(netOf(entries, a.id))
    if (a.kind === 'Customer' || a.kind === 'Dealer') {
      if (net >= 0) debtors += net
      else creditors += -net
      continue
    }
    if (a.kind === 'Vendor') {
      if (net <= 0) creditors += -net
      else debtors += net
      continue
    }
    if (a.nature === 'Asset') {
      if (net >= 0) assets.push({ name: a.name, amount: net })
      else liabilities.push({ name: a.name, amount: -net })
    } else if (a.nature === 'Liability') {
      if (a.id === SYS.capital) continue
      if (net <= 0) liabilities.push({ name: a.name, amount: -net })
      else assets.push({ name: a.name, amount: net })
    }
  }
  assets.push({ name: 'Sundry Debtors', amount: round2(debtors) })
  assets.push({ name: 'Closing Stock', amount: pl.closingStock })
  liabilities.push({ name: 'Sundry Creditors', amount: round2(creditors) })
  const capital = -netOf(entries, SYS.capital) + pl.openingStock
  liabilities.push({ name: 'Capital Account', amount: round2(capital) })
  liabilities.push({ name: 'Net Profit (current year)', amount: pl.netProfit })
  const filter = (rows: Array<{ name: string; amount: number }>) => rows.filter((r) => Math.abs(r.amount) >= 0.005)
  const a = filter(assets)
  const l = filter(liabilities)
  return {
    assets: a,
    liabilities: l,
    totalAssets: round2(a.reduce((s, r) => s + r.amount, 0)),
    totalLiabilities: round2(l.reduce((s, r) => s + r.amount, 0)),
  }
}

/* ------------------------------------------------------------------ */
/* Party balances                                                      */
/* ------------------------------------------------------------------ */

export function partyBalance(entries: LedgerEntry[], partyId: string): number {
  return netOf(entries, `party:${partyId}`)
}

export function receivables(db: Database): number {
  return invoiceStates(db, 'salesInvoice').reduce((s, i) => s + i.balance, 0)
}
export function payables(db: Database): number {
  return invoiceStates(db, 'purchaseInvoice').reduce((s, i) => s + i.balance, 0)
}

/* ------------------------------------------------------------------ */
/* Alerts & tasks                                                      */
/* ------------------------------------------------------------------ */

export interface AlertItem {
  id: string
  severity: 'high' | 'medium' | 'low'
  kind: 'Low stock' | 'Overdue invoice' | 'Quotation expiring' | 'AMC expiring' | 'Open complaint' | 'Leave request' | 'Expense approval'
  label: string
  detail: string
  to: string
  partyId?: string
}

export function pendingAlerts(db: Database): AlertItem[] {
  const today = todayISO()
  const out: AlertItem[] = []
  const stock = stockMap(db)
  for (const item of db.items) {
    const qty = stock.get(item.id) ?? 0
    const st = stockStatus(item, qty)
    if (item.status === 'Active' && (st === 'Low stock' || st === 'Out of stock')) {
      out.push({
        id: `ls-${item.id}`, severity: st === 'Out of stock' ? 'high' : 'medium', kind: 'Low stock', label: item.name,
        detail: `${qty} in stock · minimum ${item.minStock}`, to: '/sales/stock',
      })
    }
  }
  for (const inv of invoiceStates(db, 'salesInvoice')) {
    if (inv.overdue) {
      out.push({
        id: `od-${inv.doc.id}`, severity: inv.daysOverdue > 30 ? 'high' : 'medium', kind: 'Overdue invoice', label: `${inv.doc.no} · ${nameOf(db.parties, inv.doc.partyId)}`,
        detail: `${inv.daysOverdue} days overdue`, to: '/sales/invoices', partyId: inv.doc.partyId,
      })
    }
  }
  for (const q of docsOf(db, 'salesQuotation')) {
    if ((q.status === 'Draft' || q.status === 'Sent') && q.validTill) {
      const left = daysBetween(today, q.validTill)
      if (left >= 0 && left <= 7) {
        out.push({ id: `qe-${q.id}`, severity: 'low', kind: 'Quotation expiring', label: `${q.no} · ${nameOf(db.parties, q.partyId)}`, detail: `Expires in ${left} day${left === 1 ? '' : 's'}`, to: '/sales/quotations', partyId: q.partyId })
      }
    }
  }
  for (const a of db.amcs) {
    if (a.status !== 'Active') continue
    const left = daysBetween(today, a.end)
    if (left >= 0 && left <= 30) {
      out.push({ id: `amc-${a.id}`, severity: 'low', kind: 'AMC expiring', label: `${a.contractNo} · ${nameOf(db.parties, a.partyId)}`, detail: `Ends in ${left} days`, to: '/crm/amc', partyId: a.partyId })
    }
  }
  for (const c of db.complaints) {
    if (c.status === 'Open') {
      out.push({ id: `cp-${c.id}`, severity: c.priority === 'High' ? 'high' : 'medium', kind: 'Open complaint', label: `${c.no} · ${c.subject}`, detail: nameOf(db.parties, c.partyId), to: '/crm/complaints' })
    }
  }
  db.leaves.filter((l) => l.status === 'Pending').forEach((l) =>
    out.push({ id: `lv-${l.id}`, severity: 'low', kind: 'Leave request', label: `Leave · ${nameOf(db.employees, l.employeeId)}`, detail: `${l.from} → ${l.to}`, to: '/hr/leave' }),
  )
  db.expenses.filter((e) => e.status === 'Pending').forEach((e) =>
    out.push({ id: `ex-${e.id}`, severity: 'low', kind: 'Expense approval', label: `${e.no} · ${e.accountName}`, detail: `Awaiting approval`, to: '/accounts/expenses' }),
  )
  const rank = { high: 0, medium: 1, low: 2 }
  return out.sort((a, b) => rank[a.severity] - rank[b.severity])
}

/* ------------------------------------------------------------------ */
/* Dashboard                                                           */
/* ------------------------------------------------------------------ */

export function monthKey(iso: string): string {
  return iso.slice(0, 7)
}

export function lastMonths(count: number): Array<{ key: string; label: string }> {
  const out: Array<{ key: string; label: string }> = []
  const now = new Date()
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    out.push({ key, label: d.toLocaleDateString('en-IN', { month: 'short' }) })
  }
  return out
}

export function dashboardMetrics(db: Database) {
  const month = monthKey(todayISO())
  const sales = docsOf(db, 'salesInvoice').filter(isLive)
  const purchases = docsOf(db, 'purchaseInvoice').filter(isLive)
  const salesThisMonth = sales.filter((d) => monthKey(d.date) === month).reduce((s, d) => s + docTotal(d, db), 0)
  const purchasesThisMonth = purchases.filter((d) => monthKey(d.date) === month).reduce((s, d) => s + docTotal(d, db), 0)
  const totalSales = sales.reduce((s, d) => s + docTotal(d, db), 0)
  const returns = docsOf(db, 'salesReturn').filter(isLive).reduce((s, d) => s + docTotal(d, db), 0)
  const totalPurchases = purchases.reduce((s, d) => s + docTotal(d, db), 0)
  return {
    salesThisMonth,
    purchasesThisMonth,
    totalRevenue: totalSales - returns,
    totalSales,
    totalPurchases,
    pendingCustomer: receivables(db),
    pendingVendor: payables(db),
    lowStock: lowStockItems(db).length,
  }
}

export function topParties(db: Database, kind: 'salesInvoice' | 'purchaseInvoice', limit = 5) {
  const totals = new Map<string, number>()
  docsOf(db, kind).filter(isLive).forEach((d) => totals.set(d.partyId, (totals.get(d.partyId) ?? 0) + docTotal(d, db)))
  return [...totals.entries()]
    .map(([id, total]) => ({ id, name: nameOf(db.parties, id), total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, limit)
}

export function partyOf(db: Database, id: string): Party | undefined {
  return byId(db.parties, id)
}
