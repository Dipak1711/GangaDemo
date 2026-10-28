import { useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { BadgeIndianRupee, BarChart3, BookOpen, Banknote, Download, FileBarChart, Landmark, Navigation, Percent, PieChart as PieIcon, Printer, Scale, TrendingUp } from 'lucide-react'
import type { Doc } from '@/types'
import { useData } from '@/store/DataContext'
import { Badge, StatusBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { Field, Input, Select } from '@/components/ui/Form'
import { PageHeader, SearchInput } from '@/components/ui/Layout'
import { SegmentedTabs } from '@/components/ui/SegmentedTabs'
import { StatCard } from '@/components/ui/StatCard'
import { Table, TableEmptyRow, TableShell, TBody, Td, Th, THead, TR } from '@/components/ui/Table'
import { CategoryBarChart, ComparisonBarChart, DonutChart } from '@/components/charts/Charts'
import { DOC_META } from '@/lib/docConfig'
import {
  accountList, balanceSheet, buildLedger, byId, calcDoc, calcLine, docsOf, docTotal, invoiceStates, isLive, lastMonths, monthKey, nameOf, netOf,
  profitLoss, SYS, trialBalance,
} from '@/lib/calc'
import { addDaysISO, downloadCSV, formatCurrency, formatDate, formatMoney, printHTML, round2, todayISO } from '@/lib/utils'
import { strong, sub } from '@/pages/common'

/* ------------------------------------------------------------------ */
/* Shared                                                              */
/* ------------------------------------------------------------------ */

function DateRange({ from, to, setFrom, setTo, extra }: { from: string; to: string; setFrom: (v: string) => void; setTo: (v: string) => void; extra?: ReactNode }) {
  const { db } = useData()
  const preset = (key: string) => {
    const today = todayISO()
    if (key === 'month') { setFrom(`${today.slice(0, 7)}-01`); setTo(today) }
    if (key === 'quarter') { setFrom(addDaysISO(today, -90)); setTo(today) }
    if (key === 'fy') { setFrom(db.company.financialYearStart); setTo(today) }
  }
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-2xl bg-surface p-4 shadow-lift">
      <Field label="From"><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-44" /></Field>
      <Field label="To"><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-44" /></Field>
      <div className="flex gap-1.5 pb-0.5">
        <Button size="sm" variant="outline" onClick={() => preset('month')}>This month</Button>
        <Button size="sm" variant="outline" onClick={() => preset('quarter')}>Last 90 days</Button>
        <Button size="sm" variant="outline" onClick={() => preset('fy')}>Financial year</Button>
      </div>
      {extra}
    </div>
  )
}

function useRange() {
  const { db } = useData()
  const [from, setFrom] = useState(db.company.financialYearStart)
  const [to, setTo] = useState(todayISO())
  return { from, to, setFrom, setTo }
}

const Money = ({ v, strongText }: { v: number; strongText?: boolean }) => <span className={strongText ? 'font-bold text-navy-900' : ''}>{v ? formatMoney(v) : <span className="text-silver-400">—</span>}</span>

/* ------------------------------------------------------------------ */
/* Day / cash / bank books                                             */
/* ------------------------------------------------------------------ */

export function BookPage({ book }: { book: 'day' | 'cash' | 'bank' }) {
  const { db } = useData()
  const { from, to, setFrom, setTo } = useRange()
  const [query, setQuery] = useState('')
  const entries = useMemo(() => buildLedger(db), [db])
  const meta = {
    day: { title: 'Day Book', icon: <BookOpen className="h-5 w-5" />, desc: 'Every voucher posted in the period, in date order.' },
    cash: { title: 'Cash Book', icon: <Banknote className="h-5 w-5" />, desc: 'Receipts and payments through the cash account, with a running balance.' },
    bank: { title: 'Bank Book', icon: <Landmark className="h-5 w-5" />, desc: 'Receipts and payments through bank accounts, with a running balance.' },
  }[book]
  const bankIds = useMemo(() => new Set([SYS.bank, ...db.ledgers.filter((l) => l.groupId === 'ag3').map((l) => `led:${l.id}`)]), [db.ledgers])
  const inBook = (account: string) => (book === 'day' ? true : book === 'cash' ? account === SYS.cash : bankIds.has(account))

  const { opening, rows, dr, cr } = useMemo(() => {
    const mine = entries.filter((e) => inBook(e.account))
    const opening = book === 'day' ? 0 : mine.filter((e) => e.date < from).reduce((s, e) => s + e.debit - e.credit, 0)
    let running = opening
    const rows = mine.filter((e) => e.date >= from && e.date <= to && (!query || `${e.voucher} ${e.narration} ${e.type}`.toLowerCase().includes(query.toLowerCase()))).map((e) => {
      running += e.debit - e.credit
      return { ...e, running }
    })
    return { opening, rows, dr: rows.reduce((s, r) => s + r.debit, 0), cr: rows.reduce((s, r) => s + r.credit, 0) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, from, to, query, book, bankIds])
  const accName = (id: string) => accountList(db).find((a) => a.id === id)?.name ?? id

  return (
    <>
      <PageHeader title={meta.title} icon={meta.icon} eyebrow="Report & Analyst" description={meta.desc}
        actions={<Button variant="outline" icon={<Download className="h-4 w-4" />} onClick={() => downloadCSV(`${book}-book.csv`, ['Date', 'Voucher', 'Type', 'Account', 'Narration', 'Debit', 'Credit'], rows.map((r) => [r.date, r.voucher, r.type, accName(r.account), r.narration, r.debit, r.credit]))}>Export</Button>} />
      <DateRange from={from} to={to} setFrom={setFrom} setTo={setTo} extra={<SearchInput value={query} onChange={setQuery} placeholder="Search voucher or narration…" className="w-64 self-end" />} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {book !== 'day' ? <StatCard label="Opening balance" value={`${formatMoney(Math.abs(opening))} ${opening >= 0 ? 'Dr' : 'Cr'}`} icon={meta.icon} tone="navy" /> : <StatCard label="Vouchers" value={rows.length} numericValue={rows.length} icon={meta.icon} tone="navy" />}
        <StatCard label={book === 'day' ? 'Total debit' : 'Receipts'} value="" numericValue={dr} format={(v) => formatCurrency(v, true)} icon={<TrendingUp className="h-5 w-5" />} tone="emerald" />
        <StatCard label={book === 'day' ? 'Total credit' : 'Payments'} value="" numericValue={cr} format={(v) => formatCurrency(v, true)} icon={<TrendingUp className="h-5 w-5" />} tone="rose" />
        <StatCard label={book === 'day' ? 'Difference' : 'Closing balance'} value={book === 'day' ? formatMoney(dr - cr) : `${formatMoney(Math.abs(opening + dr - cr))} ${opening + dr - cr >= 0 ? 'Dr' : 'Cr'}`} icon={<Scale className="h-5 w-5" />} tone="amber" />
      </div>
      <TableShell>
        <Table className="min-w-[880px]">
          <THead><tr><Th>Date</Th><Th>Voucher</Th>{book === 'day' ? <Th>Account</Th> : null}<Th>Narration</Th><Th align="right">Debit</Th><Th align="right">Credit</Th>{book !== 'day' ? <Th align="right">Balance</Th> : null}</tr></THead>
          <TBody>
            {rows.length === 0 ? <TableEmptyRow colSpan={7}>No entries in this period</TableEmptyRow> : rows.map((r) => (
              <TR key={r.id}><Td className="whitespace-nowrap">{formatDate(r.date)}</Td><Td><span className="font-mono text-[13px] font-semibold">{r.voucher}</span>{sub(r.type)}</Td>
                {book === 'day' ? <Td>{accName(r.account)}</Td> : null}<Td className="text-silver-700">{r.narration}</Td>
                <Td align="right"><Money v={r.debit} /></Td><Td align="right"><Money v={r.credit} /></Td>
                {book !== 'day' ? <Td align="right" className="font-semibold text-navy-900">{formatMoney(Math.abs(r.running))} {r.running >= 0 ? 'Dr' : 'Cr'}</Td> : null}</TR>
            ))}
            {rows.length ? <TR><Td /><Td /><Td colSpan={book === 'day' ? 2 : 1} className="font-bold">Total</Td><Td align="right" className="font-bold">{formatMoney(dr)}</Td><Td align="right" className="font-bold">{formatMoney(cr)}</Td>{book !== 'day' ? <Td /> : null}</TR> : null}
          </TBody>
        </Table>
      </TableShell>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Outstanding                                                         */
/* ------------------------------------------------------------------ */

const BUCKETS = ['Current', '1–30', '31–60', '61–90', '90+'] as const
const bucketOf = (days: number, overdue: boolean) => (!overdue ? 0 : days <= 30 ? 1 : days <= 60 ? 2 : days <= 90 ? 3 : 4)

export function OutstandingPage() {
  const { db } = useData()
  const navigate = useNavigate()
  const [side, setSide] = useState<'receivable' | 'payable'>('receivable')
  const [view, setView] = useState<'party' | 'invoice'>('party')
  const entries = useMemo(() => buildLedger(db), [db])
  const kind = side === 'receivable' ? 'salesInvoice' : 'purchaseInvoice'
  const states = useMemo(() => invoiceStates(db, kind).filter((s) => s.balance > 0.5), [db, kind])

  const parties = useMemo(() => {
    const type = side === 'receivable' ? ['Customer', 'Dealer'] : ['Vendor']
    return db.parties.filter((p) => type.includes(p.type)).map((p) => {
      const mine = states.filter((s) => s.doc.partyId === p.id)
      const buckets = BUCKETS.map((_, i) => mine.filter((s) => bucketOf(s.daysOverdue, s.overdue) === i).reduce((a, s) => a + s.balance, 0))
      const invoicesTotal = buckets.reduce((a, b) => a + b, 0)
      const ledgerNet = netOf(entries, `party:${p.id}`) * (side === 'receivable' ? 1 : -1)
      return { party: p, buckets, invoicesTotal, other: round2(ledgerNet - invoicesTotal), total: round2(ledgerNet) }
    }).filter((r) => Math.abs(r.total) > 0.5 || r.invoicesTotal > 0.5).sort((a, b) => b.total - a.total)
  }, [db.parties, states, entries, side])

  const totals = BUCKETS.map((_, i) => parties.reduce((s, r) => s + r.buckets[i], 0))
  const grand = parties.reduce((s, r) => s + r.total, 0)

  return (
    <>
      <PageHeader title="Outstanding Report" eyebrow="Report & Analyst" icon={<Scale className="h-5 w-5" />} description="What customers owe you and what you owe vendors, aged by how far past due each invoice is. Totals tie to the party ledgers."
        actions={<Button variant="outline" icon={<Download className="h-4 w-4" />} onClick={() => downloadCSV(`outstanding-${side}.csv`, ['Party', ...BUCKETS, 'Opening / advances', 'Total'], parties.map((r) => [r.party.name, ...r.buckets, r.other, r.total]))}>Export</Button>} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedTabs value={side} onChange={setSide} items={[{ value: 'receivable', label: 'Receivable (customers)' }, { value: 'payable', label: 'Payable (vendors)' }]} />
        <SegmentedTabs value={view} onChange={setView} size="sm" items={[{ value: 'party', label: 'By party' }, { value: 'invoice', label: 'By invoice' }]} />
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
        {BUCKETS.map((b, i) => <StatCard key={b} label={`${b}${i ? ' days' : ''}`} value="" numericValue={totals[i]} format={(v) => formatCurrency(v, true)} icon={<Scale className="h-5 w-5" />} tone={i === 0 ? 'emerald' : i < 3 ? 'amber' : 'rose'} />)}
        <StatCard label="Total outstanding" value="" numericValue={grand} format={(v) => formatCurrency(v, true)} icon={<BadgeIndianRupee className="h-5 w-5" />} tone="sapphire" />
      </div>
      <TableShell>
        {view === 'party' ? (
          <Table className="min-w-[900px]">
            <THead><tr><Th>{side === 'receivable' ? 'Customer' : 'Vendor'}</Th>{BUCKETS.map((b) => <Th key={b} align="right">{b}</Th>)}<Th align="right">Opening / advance</Th><Th align="right">Total</Th></tr></THead>
            <TBody>
              {parties.length === 0 ? <TableEmptyRow colSpan={8}>Nothing outstanding</TableEmptyRow> : parties.map((r) => (
                <TR key={r.party.id} onClick={() => navigate('/accounts/ledger', { state: { account: `party:${r.party.id}` } })}>
                  <Td>{strong(r.party.name)}{sub(r.party.city)}</Td>
                  {r.buckets.map((b, i) => <Td key={i} align="right" className={i >= 3 && b ? 'font-semibold text-rose-700' : ''}><Money v={b} /></Td>)}
                  <Td align="right"><Money v={r.other} /></Td><Td align="right"><Money v={r.total} strongText /></Td>
                </TR>
              ))}
            </TBody>
          </Table>
        ) : (
          <Table className="min-w-[860px]">
            <THead><tr><Th>Invoice</Th><Th>{side === 'receivable' ? 'Customer' : 'Vendor'}</Th><Th>Date</Th><Th>Due</Th><Th align="right">Total</Th><Th align="right">Paid</Th><Th align="right">Balance</Th><Th>Ageing</Th></tr></THead>
            <TBody>
              {states.length === 0 ? <TableEmptyRow colSpan={8}>Nothing outstanding</TableEmptyRow> : states.sort((a, b) => b.daysOverdue - a.daysOverdue).map((s) => (
                <TR key={s.doc.id} onClick={() => navigate(DOC_META[kind].route, { state: { openId: s.doc.id } })}>
                  <Td><span className="font-mono text-[13px] font-semibold">{s.doc.no}</span></Td><Td>{nameOf(db.parties, s.doc.partyId)}</Td><Td className="whitespace-nowrap">{formatDate(s.doc.date)}</Td><Td className="whitespace-nowrap">{formatDate(s.doc.dueDate)}</Td>
                  <Td align="right">{formatMoney(s.total)}</Td><Td align="right">{formatMoney(s.paid)}</Td><Td align="right" className="font-bold text-navy-900">{formatMoney(s.balance)}</Td>
                  <Td>{s.overdue ? <Badge tone={s.daysOverdue > 60 ? 'danger' : 'warning'} dot>{s.daysOverdue} days overdue</Badge> : <Badge tone="success" dot>Not due</Badge>}</Td>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </TableShell>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Trial balance, P&L, balance sheet                                   */
/* ------------------------------------------------------------------ */

export function TrialBalancePage() {
  const { db } = useData()
  const rows = useMemo(() => trialBalance(db), [db])
  const dr = rows.reduce((s, r) => s + r.debit, 0)
  const cr = rows.reduce((s, r) => s + r.credit, 0)
  const balanced = Math.abs(dr - cr) < 0.5
  return (
    <>
      <PageHeader title="Trial Balance" eyebrow="Report & Analyst" icon={<Scale className="h-5 w-5" />} description="Closing debit and credit balance of every account. Debits and credits must always agree."
        actions={<Button variant="outline" icon={<Download className="h-4 w-4" />} onClick={() => downloadCSV('trial-balance.csv', ['Account', 'Type', 'Debit', 'Credit'], rows.map((r) => [r.account.name, r.account.kind, r.debit, r.credit]))}>Export</Button>} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total debit" value="" numericValue={dr} format={(v) => formatCurrency(v, true)} icon={<Scale className="h-5 w-5" />} tone="sapphire" />
        <StatCard label="Total credit" value="" numericValue={cr} format={(v) => formatCurrency(v, true)} icon={<Scale className="h-5 w-5" />} tone="violet" />
        <StatCard label="Books" value={balanced ? 'Balanced' : `Off by ${formatMoney(Math.abs(dr - cr))}`} icon={<Scale className="h-5 w-5" />} tone={balanced ? 'emerald' : 'rose'} />
      </div>
      <TableShell>
        <Table>
          <THead><tr><Th>Account</Th><Th>Type</Th><Th align="right">Debit</Th><Th align="right">Credit</Th></tr></THead>
          <TBody>
            {rows.map((r) => <TR key={r.account.id}><Td>{strong(r.account.name)}</Td><Td><Badge tone="silver">{r.account.kind}</Badge></Td><Td align="right"><Money v={r.debit} /></Td><Td align="right"><Money v={r.credit} /></Td></TR>)}
            <TR><Td className="font-bold">Total</Td><Td /><Td align="right" className="font-extrabold text-navy-900">{formatMoney(dr)}</Td><Td align="right" className="font-extrabold text-navy-900">{formatMoney(cr)}</Td></TR>
          </TBody>
        </Table>
      </TableShell>
    </>
  )
}

function StatementRow({ label, value, bold, indent, positiveGood }: { label: string; value: number; bold?: boolean; indent?: boolean; positiveGood?: boolean }) {
  return (
    <tr className={bold ? 'bg-silver-50' : ''}>
      <td className={`px-4 py-2.5 ${indent ? 'pl-9 text-silver-700' : ''} ${bold ? 'font-bold text-navy-900' : ''}`}>{label}</td>
      <td className={`tnum px-4 py-2.5 text-right ${bold ? 'font-extrabold text-navy-900' : ''} ${positiveGood && value < 0 ? 'text-rose-700' : ''}`}>{formatMoney(value)}</td>
    </tr>
  )
}

export function ProfitLossPage() {
  const { db } = useData()
  const pl = useMemo(() => profitLoss(db), [db])
  const cogs = pl.purchases - pl.purchaseReturns + pl.openingStock - pl.closingStock
  const margin = pl.sales - pl.salesReturns ? (pl.grossProfit / (pl.sales - pl.salesReturns)) * 100 : 0
  return (
    <>
      <PageHeader title="Profit / Loss Statement" eyebrow="Report & Analyst" icon={<TrendingUp className="h-5 w-5" />} description="Trading and profit & loss for the current financial year, with closing stock valued at purchase rate."
        actions={<Button variant="outline" icon={<Printer className="h-4 w-4" />} onClick={() => printHTML('Profit & Loss', `<div class="head"><div class="brand">${db.company.name}</div></div><h1>Profit &amp; Loss Statement</h1><table>${[['Net sales', pl.sales - pl.salesReturns], ['Cost of goods sold', cogs], ['Gross profit', pl.grossProfit], ['Operating expenses', pl.totalExpenses], ['Net profit', pl.netProfit]].map(([k, v]) => `<tr><td>${k}</td><td class="r">${formatMoney(Number(v))}</td></tr>`).join('')}</table>`)}>Print</Button>} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Net sales" value="" numericValue={pl.sales - pl.salesReturns} format={(v) => formatCurrency(v, true)} icon={<TrendingUp className="h-5 w-5" />} tone="sapphire" />
        <StatCard label="Gross profit" value="" numericValue={pl.grossProfit} format={(v) => formatCurrency(v, true)} icon={<TrendingUp className="h-5 w-5" />} tone="emerald" hint={`${margin.toFixed(1)}% margin`} />
        <StatCard label="Expenses" value="" numericValue={pl.totalExpenses} format={(v) => formatCurrency(v, true)} icon={<Banknote className="h-5 w-5" />} tone="amber" />
        <StatCard label="Net profit" value="" numericValue={pl.netProfit} format={(v) => formatCurrency(v, true)} icon={<BadgeIndianRupee className="h-5 w-5" />} tone={pl.netProfit >= 0 ? 'emerald' : 'rose'} />
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <TableShell>
          <table className="w-full text-sm">
            <thead className="bg-silver-50 text-left text-[11px] font-bold tracking-[0.06em] text-silver-600 uppercase"><tr><th className="px-4 py-3">Trading account</th><th className="px-4 py-3 text-right">Amount</th></tr></thead>
            <tbody className="divide-y divide-silver-200">
              <StatementRow label="Sales" value={pl.sales} indent /><StatementRow label="Less: sales returns" value={-pl.salesReturns} indent /><StatementRow label="Net sales" value={pl.sales - pl.salesReturns} bold />
              <StatementRow label="Opening stock" value={pl.openingStock} indent /><StatementRow label="Add: purchases" value={pl.purchases} indent /><StatementRow label="Less: purchase returns" value={-pl.purchaseReturns} indent /><StatementRow label="Less: closing stock" value={-pl.closingStock} indent />
              <StatementRow label="Cost of goods sold" value={cogs} bold /><StatementRow label="Gross profit" value={pl.grossProfit} bold positiveGood />
            </tbody>
          </table>
        </TableShell>
        <TableShell>
          <table className="w-full text-sm">
            <thead className="bg-silver-50 text-left text-[11px] font-bold tracking-[0.06em] text-silver-600 uppercase"><tr><th className="px-4 py-3">Profit &amp; loss account</th><th className="px-4 py-3 text-right">Amount</th></tr></thead>
            <tbody className="divide-y divide-silver-200">
              <StatementRow label="Gross profit" value={pl.grossProfit} bold positiveGood />
              {pl.expenses.map((e) => <StatementRow key={e.name} label={e.name} value={-e.amount} indent />)}
              {pl.roundOff ? <StatementRow label="Round off" value={-pl.roundOff} indent /> : null}
              <StatementRow label="Total expenses" value={-(pl.totalExpenses + pl.roundOff)} bold />
              <StatementRow label="Net profit / (loss)" value={pl.netProfit} bold positiveGood />
            </tbody>
          </table>
        </TableShell>
      </div>
    </>
  )
}

export function BalanceSheetPage() {
  const { db } = useData()
  const bs = useMemo(() => balanceSheet(db), [db])
  const diff = round2(bs.totalAssets - bs.totalLiabilities)
  return (
    <>
      <PageHeader title="Balance Sheet" eyebrow="Report & Analyst" icon={<Landmark className="h-5 w-5" />} description="Assets against liabilities and capital as on today. Closing stock is valued at purchase rate."
        actions={<Button variant="outline" icon={<Download className="h-4 w-4" />} onClick={() => downloadCSV('balance-sheet.csv', ['Side', 'Particulars', 'Amount'], [...bs.liabilities.map((l) => ['Liabilities', l.name, l.amount]), ...bs.assets.map((a) => ['Assets', a.name, a.amount])])}>Export</Button>} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total liabilities & capital" value="" numericValue={bs.totalLiabilities} format={(v) => formatCurrency(v, true)} icon={<Landmark className="h-5 w-5" />} tone="violet" />
        <StatCard label="Total assets" value="" numericValue={bs.totalAssets} format={(v) => formatCurrency(v, true)} icon={<Landmark className="h-5 w-5" />} tone="sapphire" />
        <StatCard label="Check" value={Math.abs(diff) < 1 ? 'Balanced' : `Difference ${formatMoney(diff)}`} icon={<Scale className="h-5 w-5" />} tone={Math.abs(diff) < 1 ? 'emerald' : 'rose'} />
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <TableShell>
          <table className="w-full text-sm">
            <thead className="bg-silver-50 text-left text-[11px] font-bold tracking-[0.06em] text-silver-600 uppercase"><tr><th className="px-4 py-3">Liabilities &amp; capital</th><th className="px-4 py-3 text-right">Amount</th></tr></thead>
            <tbody className="divide-y divide-silver-200">{bs.liabilities.map((l) => <StatementRow key={l.name} label={l.name} value={l.amount} indent positiveGood />)}<StatementRow label="Total" value={bs.totalLiabilities} bold /></tbody>
          </table>
        </TableShell>
        <TableShell>
          <table className="w-full text-sm">
            <thead className="bg-silver-50 text-left text-[11px] font-bold tracking-[0.06em] text-silver-600 uppercase"><tr><th className="px-4 py-3">Assets</th><th className="px-4 py-3 text-right">Amount</th></tr></thead>
            <tbody className="divide-y divide-silver-200">{bs.assets.map((a) => <StatementRow key={a.name} label={a.name} value={a.amount} indent />)}<StatementRow label="Total" value={bs.totalAssets} bold /></tbody>
          </table>
        </TableShell>
      </div>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* GST & TDS                                                           */
/* ------------------------------------------------------------------ */

export function GstReportPage() {
  const { db } = useData()
  const { from, to, setFrom, setTo } = useRange()
  const rows = useMemo(() => {
    const kinds: Array<[Doc['kind'], 1 | -1, 'Output' | 'Input']> = [['salesInvoice', 1, 'Output'], ['salesReturn', -1, 'Output'], ['purchaseInvoice', 1, 'Input'], ['purchaseReturn', -1, 'Input']]
    return kinds.flatMap(([kind, sign, side]) => docsOf(db, kind).filter((d) => isLive(d) && d.date >= from && d.date <= to).map((d) => {
      const t = calcDoc(d, db.taxes)
      return { doc: d, side, sign, taxable: t.taxable * sign, cgst: t.cgst * sign, sgst: t.sgst * sign, igst: t.igst * sign, total: t.total * sign }
    })).sort((a, b) => (a.doc.date < b.doc.date ? 1 : -1))
  }, [db, from, to])
  const sum = (side: 'Output' | 'Input', k: 'taxable' | 'cgst' | 'sgst' | 'igst') => rows.filter((r) => r.side === side).reduce((s, r) => s + r[k], 0)
  const out = sum('Output', 'cgst') + sum('Output', 'sgst') + sum('Output', 'igst')
  const inp = sum('Input', 'cgst') + sum('Input', 'sgst') + sum('Input', 'igst')
  const byRate = useMemo(() => {
    const map = new Map<string, { rate: number; taxableOut: number; taxOut: number; taxableIn: number; taxIn: number }>()
    for (const r of rows) for (const l of r.doc.lines) {
      const c = calcLine(r.doc, l, db.taxes)
      const key = String(c.taxPct)
      const cur = map.get(key) ?? { rate: c.taxPct, taxableOut: 0, taxOut: 0, taxableIn: 0, taxIn: 0 }
      if (r.side === 'Output') { cur.taxableOut += c.net * r.sign; cur.taxOut += c.tax * r.sign } else { cur.taxableIn += c.net * r.sign; cur.taxIn += c.tax * r.sign }
      map.set(key, cur)
    }
    return [...map.values()].sort((a, b) => a.rate - b.rate)
  }, [rows, db.taxes])
  return (
    <>
      <PageHeader title="GST Report" eyebrow="Report & Analyst" icon={<BadgeIndianRupee className="h-5 w-5" />} description="Output GST on sales, input credit on purchases, and the net payable — net of returns."
        actions={<Button variant="outline" icon={<Download className="h-4 w-4" />} onClick={() => downloadCSV('gst-report.csv', ['Date', 'Document', 'Party', 'Side', 'Taxable', 'CGST', 'SGST', 'IGST', 'Total'], rows.map((r) => [r.doc.date, r.doc.no, nameOf(db.parties, r.doc.partyId), r.side, r.taxable, r.cgst, r.sgst, r.igst, r.total]))}>Export</Button>} />
      <DateRange from={from} to={to} setFrom={setFrom} setTo={setTo} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Output GST (sales)" value="" numericValue={out} format={(v) => formatCurrency(v, true)} icon={<Percent className="h-5 w-5" />} tone="rose" />
        <StatCard label="Input credit (purchases)" value="" numericValue={inp} format={(v) => formatCurrency(v, true)} icon={<Percent className="h-5 w-5" />} tone="emerald" />
        <StatCard label={out - inp >= 0 ? 'Net GST payable' : 'Net credit carried'} value="" numericValue={Math.abs(out - inp)} format={(v) => formatCurrency(v, true)} icon={<BadgeIndianRupee className="h-5 w-5" />} tone="amber" />
        <StatCard label="Taxable sales" value="" numericValue={sum('Output', 'taxable')} format={(v) => formatCurrency(v, true)} icon={<BarChart3 className="h-5 w-5" />} tone="sapphire" />
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <TableShell>
          <table className="w-full text-sm">
            <thead className="bg-silver-50 text-left text-[11px] font-bold tracking-[0.06em] text-silver-600 uppercase"><tr><th className="px-4 py-3">Component</th><th className="px-4 py-3 text-right">Output</th><th className="px-4 py-3 text-right">Input</th><th className="px-4 py-3 text-right">Net</th></tr></thead>
            <tbody className="divide-y divide-silver-200">
              {(['cgst', 'sgst', 'igst'] as const).map((k) => <tr key={k}><td className="px-4 py-2.5 font-semibold uppercase">{k}</td><td className="tnum px-4 py-2.5 text-right">{formatMoney(sum('Output', k))}</td><td className="tnum px-4 py-2.5 text-right">{formatMoney(sum('Input', k))}</td><td className="tnum px-4 py-2.5 text-right font-bold">{formatMoney(sum('Output', k) - sum('Input', k))}</td></tr>)}
              <tr className="bg-silver-50"><td className="px-4 py-2.5 font-bold">Total</td><td className="tnum px-4 py-2.5 text-right font-bold">{formatMoney(out)}</td><td className="tnum px-4 py-2.5 text-right font-bold">{formatMoney(inp)}</td><td className="tnum px-4 py-2.5 text-right font-extrabold">{formatMoney(out - inp)}</td></tr>
            </tbody>
          </table>
        </TableShell>
        <TableShell>
          <table className="w-full text-sm">
            <thead className="bg-silver-50 text-left text-[11px] font-bold tracking-[0.06em] text-silver-600 uppercase"><tr><th className="px-4 py-3">Rate</th><th className="px-4 py-3 text-right">Sales taxable</th><th className="px-4 py-3 text-right">Output tax</th><th className="px-4 py-3 text-right">Purchase taxable</th><th className="px-4 py-3 text-right">Input tax</th></tr></thead>
            <tbody className="divide-y divide-silver-200">
              {byRate.map((r) => <tr key={r.rate}><td className="px-4 py-2.5 font-semibold">{r.rate}%</td><td className="tnum px-4 py-2.5 text-right">{formatMoney(r.taxableOut)}</td><td className="tnum px-4 py-2.5 text-right">{formatMoney(r.taxOut)}</td><td className="tnum px-4 py-2.5 text-right">{formatMoney(r.taxableIn)}</td><td className="tnum px-4 py-2.5 text-right">{formatMoney(r.taxIn)}</td></tr>)}
            </tbody>
          </table>
        </TableShell>
      </div>
      <TableShell>
        <Table className="min-w-[900px]">
          <THead><tr><Th>Date</Th><Th>Document</Th><Th>Party</Th><Th>Side</Th><Th align="right">Taxable</Th><Th align="right">CGST</Th><Th align="right">SGST</Th><Th align="right">IGST</Th><Th align="right">Total</Th></tr></THead>
          <TBody>{rows.length === 0 ? <TableEmptyRow colSpan={9}>No taxable documents in this period</TableEmptyRow> : rows.map((r) => (
            <TR key={r.doc.id}><Td className="whitespace-nowrap">{formatDate(r.doc.date)}</Td><Td><span className="font-mono text-[13px] font-semibold">{r.doc.no}</span>{sub(DOC_META[r.doc.kind].label)}</Td><Td>{nameOf(db.parties, r.doc.partyId)}</Td><Td><Badge tone={r.side === 'Output' ? 'danger' : 'success'}>{r.side}</Badge></Td>
              <Td align="right">{formatMoney(r.taxable)}</Td><Td align="right">{formatMoney(r.cgst)}</Td><Td align="right">{formatMoney(r.sgst)}</Td><Td align="right">{formatMoney(r.igst)}</Td><Td align="right" className="font-semibold">{formatMoney(r.total)}</Td></TR>
          ))}</TBody>
        </Table>
      </TableShell>
    </>
  )
}

export function TdsReportPage() {
  const { db } = useData()
  const { from, to, setFrom, setTo } = useRange()
  const rows = useMemo(() => docsOf(db, 'vendorPayment').filter((d) => isLive(d) && d.tdsPct > 0 && d.date >= from && d.date <= to).map((d) => ({ doc: d, tds: round2((d.amount * d.tdsPct) / 100) })).sort((a, b) => (a.doc.date < b.doc.date ? 1 : -1)), [db, from, to])
  const total = rows.reduce((s, r) => s + r.tds, 0)
  const gross = rows.reduce((s, r) => s + r.doc.amount, 0)
  const byVendor = useMemo(() => { const m = new Map<string, number>(); rows.forEach((r) => m.set(r.doc.partyId, (m.get(r.doc.partyId) ?? 0) + r.tds)); return [...m.entries()].map(([id, v]) => ({ name: nameOf(db.parties, id), value: Math.round(v) })) }, [rows, db.parties])
  return (
    <>
      <PageHeader title="TDS Report" eyebrow="Report & Analyst" icon={<Percent className="h-5 w-5" />} description="Tax deducted at source on vendor payments, ready for the quarterly return."
        actions={<Button variant="outline" icon={<Download className="h-4 w-4" />} onClick={() => downloadCSV('tds-report.csv', ['Date', 'Payment', 'Vendor', 'Gross', 'TDS %', 'TDS', 'Net paid'], rows.map((r) => [r.doc.date, r.doc.no, nameOf(db.parties, r.doc.partyId), r.doc.amount, r.doc.tdsPct, r.tds, r.doc.amount - r.tds]))}>Export</Button>} />
      <DateRange from={from} to={to} setFrom={setFrom} setTo={setTo} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="TDS deducted" value="" numericValue={total} format={(v) => formatCurrency(v, true)} icon={<Percent className="h-5 w-5" />} tone="amber" />
        <StatCard label="Gross payments" value="" numericValue={gross} format={(v) => formatCurrency(v, true)} icon={<Banknote className="h-5 w-5" />} tone="sapphire" />
        <StatCard label="Payments with TDS" value={rows.length} numericValue={rows.length} icon={<FileBarChart className="h-5 w-5" />} tone="violet" />
      </div>
      {byVendor.length ? <Card><CardHeader title="TDS by vendor" accent="gold" /><CategoryBarChart data={byVendor} currency height={200} color="#d97706" /></Card> : null}
      <TableShell>
        <Table>
          <THead><tr><Th>Date</Th><Th>Payment</Th><Th>Vendor</Th><Th align="right">Gross</Th><Th align="right">TDS %</Th><Th align="right">TDS</Th><Th align="right">Net paid</Th></tr></THead>
          <TBody>{rows.length === 0 ? <TableEmptyRow colSpan={7}>No TDS deducted in this period. Enter a TDS % on a vendor payment to see it here.</TableEmptyRow> : rows.map((r) => (
            <TR key={r.doc.id}><Td>{formatDate(r.doc.date)}</Td><Td><span className="font-mono text-[13px] font-semibold">{r.doc.no}</span></Td><Td>{nameOf(db.parties, r.doc.partyId)}</Td><Td align="right">{formatMoney(r.doc.amount)}</Td><Td align="right">{r.doc.tdsPct}%</Td><Td align="right" className="font-bold">{formatMoney(r.tds)}</Td><Td align="right">{formatMoney(r.doc.amount - r.tds)}</Td></TR>
          ))}</TBody>
        </Table>
      </TableShell>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Report analyst                                                      */
/* ------------------------------------------------------------------ */

export function AnalystPage() {
  const { db } = useData()
  const months = useMemo(() => lastMonths(12), [])
  const monthly = useMemo(() => {
    const sales = docsOf(db, 'salesInvoice').filter(isLive)
    const buys = docsOf(db, 'purchaseInvoice').filter(isLive)
    return months.map((m) => ({
      name: m.label,
      Sales: Math.round(sales.filter((d) => monthKey(d.date) === m.key).reduce((s, d) => s + docTotal(d, db), 0)),
      Purchase: Math.round(buys.filter((d) => monthKey(d.date) === m.key).reduce((s, d) => s + docTotal(d, db), 0)),
    }))
  }, [db, months])
  const pl = useMemo(() => profitLoss(db), [db])
  const itemRevenue = useMemo(() => {
    const m = new Map<string, number>()
    docsOf(db, 'salesInvoice').filter(isLive).forEach((d) => d.lines.forEach((l) => m.set(l.itemId, (m.get(l.itemId) ?? 0) + calcLine(d, l, db.taxes).net)))
    return [...m.entries()].map(([id, v]) => ({ name: nameOf(db.items, id).split(' ').slice(0, 3).join(' '), value: Math.round(v) })).sort((a, b) => b.value - a.value).slice(0, 8)
  }, [db])
  const customerMix = useMemo(() => {
    const m = new Map<string, number>()
    docsOf(db, 'salesInvoice').filter(isLive).forEach((d) => m.set(d.partyId, (m.get(d.partyId) ?? 0) + docTotal(d, db)))
    const sorted = [...m.entries()].map(([id, v]) => ({ name: nameOf(db.parties, id).split(' ').slice(0, 2).join(' '), value: Math.round(v) })).sort((a, b) => b.value - a.value)
    const top = sorted.slice(0, 5)
    const rest = sorted.slice(5).reduce((s, x) => s + x.value, 0)
    return rest ? [...top, { name: 'Others', value: rest }] : top
  }, [db])
  const modes = useMemo(() => { const m = new Map<string, number>(); docsOf(db, 'receipt').filter(isLive).forEach((d) => m.set(d.method, (m.get(d.method) ?? 0) + d.amount)); return [...m.entries()].map(([name, value]) => ({ name, value: Math.round(value) })) }, [db])
  const expenseMix = pl.expenses.map((e) => ({ name: e.name, value: Math.round(e.amount) }))
  const netSales = pl.sales - pl.salesReturns
  const receivable = invoiceStates(db, 'salesInvoice').reduce((s, i) => s + i.balance, 0)
  const dso = netSales ? Math.round((receivable / netSales) * 365) : 0
  return (
    <>
      <PageHeader title="Report Analyst" eyebrow="Report & Analyst" icon={<PieIcon className="h-5 w-5" />} description="Trends and mix across sales, purchases, expenses and collections — computed live from your records." />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Gross margin" value={`${netSales ? ((pl.grossProfit / netSales) * 100).toFixed(1) : '0.0'}%`} icon={<TrendingUp className="h-5 w-5" />} tone="emerald" hint="Gross profit / net sales" />
        <StatCard label="Net profit margin" value={`${netSales ? ((pl.netProfit / netSales) * 100).toFixed(1) : '0.0'}%`} icon={<TrendingUp className="h-5 w-5" />} tone={pl.netProfit >= 0 ? 'sapphire' : 'rose'} />
        <StatCard label="Days sales outstanding" value={`${dso} days`} icon={<Banknote className="h-5 w-5" />} tone="amber" hint="Receivable ÷ sales × 365" />
        <StatCard label="Average invoice" value="" numericValue={docsOf(db, 'salesInvoice').filter(isLive).length ? pl.sales / docsOf(db, 'salesInvoice').filter(isLive).length : 0} format={(v) => formatCurrency(v, true)} icon={<BadgeIndianRupee className="h-5 w-5" />} tone="violet" />
      </div>
      <Card><CardHeader title="Sales vs purchase — 12 months" accent="sapphire" /><div className="mt-3"><ComparisonBarChart data={monthly} series={[{ key: 'Sales', name: 'Sales', color: '#df6527' }, { key: 'Purchase', name: 'Purchase', color: '#0f766e' }]} /></div></Card>
      <div className="grid gap-5 lg:grid-cols-2">
        <Card><CardHeader title="Top products by revenue" subtitle="Taxable value invoiced" accent="gold" /><CategoryBarChart data={itemRevenue} currency horizontal height={290} /></Card>
        <Card><CardHeader title="Customer concentration" subtitle="Share of invoiced value" accent="emerald" /><DonutChart data={customerMix} currency height={290} centerLabel="Sales" /></Card>
        <Card><CardHeader title="Expense mix" subtitle="Approved expenses" accent="rose" />{expenseMix.length ? <DonutChart data={expenseMix} currency height={260} centerLabel="Expenses" /> : <p className="py-10 text-center text-sm text-silver-600">No approved expenses yet.</p>}</Card>
        <Card><CardHeader title="Collections by payment mode" accent="sapphire" />{modes.length ? <DonutChart data={modes} currency height={260} centerLabel="Received" /> : <p className="py-10 text-center text-sm text-silver-600">No receipts yet.</p>}</Card>
      </div>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Sales & purchase reports                                            */
/* ------------------------------------------------------------------ */

export function SideReportPage({ side }: { side: 'sales' | 'purchase' }) {
  const { db } = useData()
  const [tab, setTab] = useState<'party' | 'monthly' | 'pending' | 'product'>('party')
  const [year, setYear] = useState('all')
  const [month, setMonth] = useState('all')
  const kind = side === 'sales' ? 'salesInvoice' : 'purchaseInvoice'
  const label = side === 'sales' ? 'Customer' : 'Supplier'
  const states = useMemo(() => invoiceStates(db, kind).filter((s) => s.doc.status !== 'Cancelled'), [db, kind])
  const years = useMemo(() => [...new Set(states.map((s) => s.doc.date.slice(0, 4)))].sort().reverse(), [states])
  const filtered = useMemo(() => states.filter((s) => (year === 'all' || s.doc.date.slice(0, 4) === year) && (month === 'all' || s.doc.date.slice(5, 7) === month)), [states, year, month])

  const byParty = useMemo(() => {
    const m = new Map<string, { id: string; count: number; total: number; paid: number; pending: number; last: string }>()
    filtered.forEach((s) => {
      const cur = m.get(s.doc.partyId) ?? { id: s.doc.partyId, count: 0, total: 0, paid: 0, pending: 0, last: '' }
      m.set(s.doc.partyId, { ...cur, count: cur.count + 1, total: cur.total + s.total, paid: cur.paid + s.paid, pending: cur.pending + s.balance, last: s.doc.date > cur.last ? s.doc.date : cur.last })
    })
    return [...m.values()].sort((a, b) => b.total - a.total)
  }, [filtered])
  const byMonth = useMemo(() => {
    const m = new Map<string, { key: string; count: number; total: number; paid: number; pending: number }>()
    filtered.forEach((s) => {
      const key = monthKey(s.doc.date)
      const cur = m.get(key) ?? { key, count: 0, total: 0, paid: 0, pending: 0 }
      m.set(key, { ...cur, count: cur.count + 1, total: cur.total + s.total, paid: cur.paid + s.paid, pending: cur.pending + s.balance })
    })
    return [...m.values()].sort((a, b) => (a.key < b.key ? 1 : -1))
  }, [filtered])
  const byProduct = useMemo(() => {
    const m = new Map<string, { id: string; qty: number; amount: number; last: string }>()
    filtered.forEach((s) => s.doc.lines.forEach((l) => {
      const cur = m.get(l.itemId) ?? { id: l.itemId, qty: 0, amount: 0, last: '' }
      m.set(l.itemId, { ...cur, qty: cur.qty + l.qty, amount: cur.amount + calcLine(s.doc, l, db.taxes).total, last: s.doc.date > cur.last ? s.doc.date : cur.last })
    }))
    return [...m.values()].sort((a, b) => b.amount - a.amount)
  }, [filtered, db.taxes])
  const pending = states.filter((s) => s.balance > 0.5).sort((a, b) => b.daysOverdue - a.daysOverdue)
  const total = filtered.reduce((s, x) => s + x.total, 0)
  const paid = filtered.reduce((s, x) => s + x.paid, 0)

  const exportNow = () => {
    if (tab === 'party') downloadCSV(`${side}-by-party.csv`, [label, 'Invoices', 'Total', 'Paid', 'Pending', 'Last'], byParty.map((r) => [nameOf(db.parties, r.id), r.count, r.total, r.paid, r.pending, r.last]))
    if (tab === 'monthly') downloadCSV(`${side}-monthly.csv`, ['Month', 'Invoices', 'Total', 'Paid', 'Pending'], byMonth.map((r) => [r.key, r.count, r.total, r.paid, r.pending]))
    if (tab === 'pending') downloadCSV(`${side}-pending.csv`, ['Invoice', label, 'Due', 'Total', 'Paid', 'Pending', 'Days overdue'], pending.map((s) => [s.doc.no, nameOf(db.parties, s.doc.partyId), s.doc.dueDate, s.total, s.paid, s.balance, s.daysOverdue]))
    if (tab === 'product') downloadCSV(`${side}-by-product.csv`, ['Product', 'Qty', 'Amount', 'Average price', 'Last'], byProduct.map((r) => [nameOf(db.items, r.id), r.qty, r.amount, r.qty ? r.amount / r.qty : 0, r.last]))
  }

  return (
    <>
      <PageHeader title={side === 'sales' ? 'Sales Report' : 'Purchase Report'} eyebrow={side === 'sales' ? 'Sales' : 'Purchase'} icon={<FileBarChart className="h-5 w-5" />} description={`${label}-wise, monthly, pending-payment and product-wise analysis of ${side === 'sales' ? 'sales' : 'purchase'} invoices (net of returns).`}
        actions={<Button variant="outline" icon={<Download className="h-4 w-4" />} onClick={exportNow}>Export</Button>} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Invoices" value={filtered.length} numericValue={filtered.length} icon={<FileBarChart className="h-5 w-5" />} tone="sapphire" />
        <StatCard label="Total value" value="" numericValue={total} format={(v) => formatCurrency(v, true)} icon={<BadgeIndianRupee className="h-5 w-5" />} tone="emerald" />
        <StatCard label={side === 'sales' ? 'Collected' : 'Paid'} value="" numericValue={paid} format={(v) => formatCurrency(v, true)} icon={<Banknote className="h-5 w-5" />} tone="cyan" />
        <StatCard label="Pending" value="" numericValue={filtered.reduce((s, x) => s + x.balance, 0)} format={(v) => formatCurrency(v, true)} icon={<Scale className="h-5 w-5" />} tone="rose" />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="overflow-x-auto"><SegmentedTabs value={tab} onChange={setTab} items={[{ value: 'party', label: `${label}-wise` }, { value: 'monthly', label: 'Monthly' }, { value: 'pending', label: 'Pending payments', count: pending.length }, { value: 'product', label: 'Product-wise' }]} /></div>
        {tab !== 'pending' ? (
          <div className="ml-auto flex gap-2">
            <Select aria-label="Year" value={year} onChange={(e) => setYear(e.target.value)} className="h-10 w-auto! min-w-32"><option value="all">All years</option>{years.map((y) => <option key={y}>{y}</option>)}</Select>
            <Select aria-label="Month" value={month} onChange={(e) => setMonth(e.target.value)} className="h-10 w-auto! min-w-36"><option value="all">All months</option>{['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'].map((m, i) => <option key={m} value={m}>{new Date(2000, i, 1).toLocaleDateString('en-IN', { month: 'long' })}</option>)}</Select>
          </div>
        ) : null}
      </div>
      <div className="tab-swap" key={tab}>
        <TableShell>
          {tab === 'party' ? (
            <Table><THead><tr><Th>{label}</Th><Th align="right">Invoices</Th><Th align="right">Total</Th><Th align="right">Paid</Th><Th align="right">Pending</Th><Th>Last</Th></tr></THead>
              <TBody>{byParty.length === 0 ? <TableEmptyRow colSpan={6}>No invoices for this selection</TableEmptyRow> : byParty.map((r) => <TR key={r.id}><Td>{strong(nameOf(db.parties, r.id))}</Td><Td align="right">{r.count}</Td><Td align="right" className="font-bold">{formatMoney(r.total)}</Td><Td align="right">{formatMoney(r.paid)}</Td><Td align="right" className={r.pending ? 'font-semibold text-rose-700' : ''}>{formatMoney(r.pending)}</Td><Td>{formatDate(r.last)}</Td></TR>)}</TBody></Table>
          ) : tab === 'monthly' ? (
            <Table><THead><tr><Th>Month</Th><Th align="right">Invoices</Th><Th align="right">Total</Th><Th align="right">Paid</Th><Th align="right">Pending</Th></tr></THead>
              <TBody>{byMonth.length === 0 ? <TableEmptyRow colSpan={5}>No invoices for this selection</TableEmptyRow> : byMonth.map((r) => <TR key={r.key}><Td>{strong(new Date(`${r.key}-01`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }))}</Td><Td align="right">{r.count}</Td><Td align="right" className="font-bold">{formatMoney(r.total)}</Td><Td align="right">{formatMoney(r.paid)}</Td><Td align="right">{formatMoney(r.pending)}</Td></TR>)}</TBody></Table>
          ) : tab === 'pending' ? (
            <Table><THead><tr><Th>Invoice</Th><Th>{label}</Th><Th>Due</Th><Th align="right">Total</Th><Th align="right">Paid</Th><Th align="right">Pending</Th><Th>Status</Th></tr></THead>
              <TBody>{pending.length === 0 ? <TableEmptyRow colSpan={7}>No pending payments</TableEmptyRow> : pending.map((s) => <TR key={s.doc.id}><Td><span className="font-mono text-[13px] font-semibold">{s.doc.no}</span></Td><Td>{nameOf(db.parties, s.doc.partyId)}</Td><Td>{formatDate(s.doc.dueDate)}</Td><Td align="right">{formatMoney(s.total)}</Td><Td align="right">{formatMoney(s.paid)}</Td><Td align="right" className="font-bold">{formatMoney(s.balance)}</Td><Td>{s.overdue ? <Badge tone="danger" dot>{s.daysOverdue}d overdue</Badge> : <Badge tone="success" dot>Not due</Badge>}</Td></TR>)}</TBody></Table>
          ) : (
            <Table><THead><tr><Th>Product</Th><Th align="right">Quantity</Th><Th align="right">Amount (incl. GST)</Th><Th align="right">Average price</Th><Th>Last</Th></tr></THead>
              <TBody>{byProduct.length === 0 ? <TableEmptyRow colSpan={5}>No invoices for this selection</TableEmptyRow> : byProduct.map((r) => <TR key={r.id}><Td>{strong(nameOf(db.items, r.id))}</Td><Td align="right">{r.qty}</Td><Td align="right" className="font-bold">{formatMoney(r.amount)}</Td><Td align="right">{formatMoney(r.qty ? r.amount / r.qty : 0)}</Td><Td>{formatDate(r.last)}</Td></TR>)}</TBody></Table>
          )}
        </TableShell>
      </div>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Tracking                                                            */
/* ------------------------------------------------------------------ */

export function TrackingPage({ side }: { side: 'sales' | 'purchase' }) {
  const { db } = useData()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [module, setModule] = useState('')
  const kinds = (Object.keys(DOC_META) as Array<keyof typeof DOC_META>).filter((k) => DOC_META[k].side === side)
  const rows = useMemo(() => db.docs.filter((d) => kinds.includes(d.kind)).filter((d) => (!module || d.kind === module) && (!query || `${d.no} ${d.refNo} ${nameOf(db.parties, d.partyId, '')} ${d.trackingNo} ${d.vehicleNo}`.toLowerCase().includes(query.toLowerCase()))).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).slice(0, 80), [db, kinds, module, query])
  return (
    <>
      <PageHeader title="Tracking" eyebrow={side === 'sales' ? 'Sales' : 'Purchase'} icon={<Navigation className="h-5 w-5" />} description={`A single timeline of every ${side} document — quotations through deliveries and payments. Click a row to open it.`} />
      <div className="flex flex-wrap items-center gap-2.5">
        <SearchInput value={query} onChange={setQuery} placeholder="Search number, party, tracking no…" className="w-full sm:w-80" />
        <Select aria-label="Module" value={module} onChange={(e) => setModule(e.target.value)} className="h-10 w-auto! min-w-52"><option value="">Module: all</option>{kinds.map((k) => <option key={k} value={k}>{DOC_META[k].label}</option>)}</Select>
      </div>
      <TableShell>
        <Table className="min-w-[900px]">
          <THead><tr><Th>Date</Th><Th>Module</Th><Th>Reference</Th><Th>{side === 'sales' ? 'Customer' : 'Supplier'}</Th><Th>Status / method</Th><Th>Details</Th><Th align="right">Amount</Th></tr></THead>
          <TBody>{rows.length === 0 ? <TableEmptyRow colSpan={7}>No documents found</TableEmptyRow> : rows.map((d) => {
            const meta = DOC_META[d.kind]
            const detail = [d.transporterId && `Carrier: ${nameOf(db.transporters, d.transporterId)}`, d.trackingNo && `Tracking: ${d.trackingNo}`, d.vehicleNo && `Vehicle: ${d.vehicleNo}`, d.method && meta.lineMode === 'payment' && `Ref: ${d.reference || '—'}`].filter(Boolean).join(' · ')
            return (
              <TR key={d.id} onClick={() => navigate(meta.route, { state: { openId: d.id } })}>
                <Td className="whitespace-nowrap">{formatDate(d.date)}</Td><Td><Badge tone="info">{meta.label}</Badge></Td><Td><span className="font-mono text-[13px] font-semibold">{d.no}</span>{d.refNo ? sub(`from ${d.refNo}`) : null}</Td>
                <Td>{nameOf(db.parties, d.partyId)}</Td><Td>{meta.lineMode === 'payment' ? <Badge tone="success">{d.method}</Badge> : <StatusBadge status={d.status} />}</Td><Td className="max-w-[260px] truncate text-silver-600">{detail || '—'}</Td>
                <Td align="right" className="font-semibold">{meta.moneyDoc ? formatMoney(docTotal(d, db)) : '—'}</Td>
              </TR>
            )
          })}</TBody>
        </Table>
      </TableShell>
    </>
  )
}
