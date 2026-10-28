import { useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { ArrowLeftRight, BookOpen, BookText, Check, Download, FilePlus2, Printer, ReceiptText, Tags, Wallet, X } from 'lucide-react'
import type { Database } from '@/types'
import { useData } from '@/store/DataContext'
import { useToast } from '@/store/ToastContext'
import { useAccess } from '@/hooks/useAccess'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Field, Input, Select } from '@/components/ui/Form'
import { PageHeader, SearchInput } from '@/components/ui/Layout'
import { SegmentedTabs } from '@/components/ui/SegmentedTabs'
import { StatCard } from '@/components/ui/StatCard'
import { Table, TableEmptyRow, TableShell, TBody, Td, Th, THead, TR } from '@/components/ui/Table'
import { CrudPage, opts, type Row } from '@/components/Crud'
import { accountList, buildLedger, netOf, SYS, type AccountInfo } from '@/lib/calc'
import { downloadCSV, formatCurrency, formatDate, formatMoney, printHTML, todayISO, uid } from '@/lib/utils'
import { money, strong, sub } from '@/pages/common'

const accountOptions = (db: Database, filter?: (a: AccountInfo) => boolean) =>
  accountList(db).filter((a) => (filter ? filter(a) : true)).map((a) => ({ value: a.id, label: `${a.name}${a.kind === 'System' || a.kind === 'Ledger' || a.kind === 'Expense' ? '' : ` (${a.kind})`}` }))

/* ------------------------------------------------------------------ */
/* Ledger master                                                       */
/* ------------------------------------------------------------------ */

export function LedgerMasterPage() {
  const { db } = useData()
  const [tab, setTab] = useState<'all' | 'custom'>('all')
  const [query, setQuery] = useState('')
  const [kind, setKind] = useState('')
  const entries = useMemo(() => buildLedger(db), [db])
  const accounts = useMemo(() => accountList(db).map((a) => ({ a, net: netOf(entries, a.id) })), [db, entries])
  const rows = accounts.filter(({ a }) => (!kind || a.kind === kind) && (!query || a.name.toLowerCase().includes(query.toLowerCase())))
  return (
    <>
      <PageHeader title="Ledger Master" eyebrow="Full Account" icon={<BookOpen className="h-5 w-5" />} description="Every account in the books — system accounts, customers, vendors, expense heads and your own ledgers — with its closing balance." />
      <SegmentedTabs value={tab} onChange={setTab} items={[{ value: 'all', label: 'All accounts', count: accounts.length }, { value: 'custom', label: 'Custom ledgers', count: db.ledgers.length }]} />
      <div className="tab-swap flex flex-col gap-4" key={tab}>
        {tab === 'all' ? (
          <>
            <div className="flex flex-wrap items-center gap-2.5">
              <SearchInput value={query} onChange={setQuery} placeholder="Search accounts…" className="w-full sm:w-72" />
              <Select aria-label="Account type" value={kind} onChange={(e) => setKind(e.target.value)} className="h-10 w-auto! min-w-44">
                <option value="">Type: all</option>{['System', 'Customer', 'Vendor', 'Dealer', 'Ledger', 'Expense'].map((k) => <option key={k}>{k}</option>)}
              </Select>
              <Button variant="outline" className="ml-auto" icon={<Download className="h-4 w-4" />} onClick={() => downloadCSV(`ledger-master-${todayISO()}.csv`, ['Account', 'Type', 'Nature', 'Balance', 'Dr/Cr'], rows.map(({ a, net }) => [a.name, a.kind, a.nature, Math.abs(net), net >= 0 ? 'Dr' : 'Cr']))}>Export</Button>
            </div>
            <TableShell>
              <Table>
                <THead><tr><Th>Account</Th><Th>Type</Th><Th>Nature</Th><Th align="right">Closing balance</Th></tr></THead>
                <TBody>
                  {rows.length === 0 ? <TableEmptyRow colSpan={4}>No accounts match</TableEmptyRow> : rows.map(({ a, net }) => (
                    <TR key={a.id}><Td>{strong(a.name)}</Td><Td><Badge tone="silver">{a.kind}</Badge></Td><Td>{a.nature}</Td>
                      <Td align="right" className="font-semibold">{Math.abs(net) < 0.005 ? <span className="text-silver-500">—</span> : <span className={net > 0 ? 'text-navy-900' : 'text-violet-700'}>{formatMoney(Math.abs(net))} {net > 0 ? 'Dr' : 'Cr'}</span>}</Td></TR>
                  ))}
                </TBody>
              </Table>
            </TableShell>
          </>
        ) : (
          <CrudPage
            embedded collection="ledgers" entity="Ledger" title="Custom ledgers" description="Your own accounts — bank accounts, fixed assets, loans and indirect expenses."
            blank={(d) => ({ id: uid('lg'), name: '', groupId: d.accountGroups[0]?.id ?? '', openingBalance: 0, balanceType: 'Dr' })}
            columns={[
              { key: 'name', label: 'Ledger', render: (r) => strong(r.name) },
              { key: 'groupId', label: 'Group', render: (r, d) => sub(d.accountGroups.find((g) => g.id === r.groupId)?.name ?? '—'), text: (r, d) => d.accountGroups.find((g) => g.id === r.groupId)?.name ?? '' },
              { key: 'openingBalance', label: 'Opening', align: 'right', render: (r) => `${money(r.openingBalance)} ${r.balanceType}`, text: (r) => r.openingBalance },
              { key: 'closing', label: 'Closing', align: 'right', render: (r, d) => { const n = netOf(buildLedger(d), `led:${r.id}`); return `${formatMoney(Math.abs(n))} ${n >= 0 ? 'Dr' : 'Cr'}` }, text: (r, d) => netOf(buildLedger(d), `led:${r.id}`) },
            ]}
            fields={[
              { key: 'name', label: 'Ledger name', required: true }, { key: 'groupId', label: 'Account group', type: 'select', required: true, options: (d) => opts(d.accountGroups) },
              { key: 'openingBalance', label: 'Opening balance (₹)', type: 'number', min: 0 }, { key: 'balanceType', label: 'Dr / Cr', type: 'select', options: [{ value: 'Dr', label: 'Debit' }, { value: 'Cr', label: 'Credit' }] },
            ]}
            validate={(d, db2) => (db2.ledgers.some((l) => l.id !== d.id && l.name.toLowerCase() === String(d.name).trim().toLowerCase()) ? { name: 'A ledger with this name exists.' } : {})}
            modalSize="md"
          />
        )}
      </div>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Account ledger statement                                            */
/* ------------------------------------------------------------------ */

export function AccountLedgerPage() {
  const { db } = useData()
  const location = useLocation()
  const initial = (location.state as { account?: string } | null)?.account
  const accounts = useMemo(() => accountList(db), [db])
  const [accountId, setAccountId] = useState(initial ?? accounts.find((a) => a.kind === 'Customer')?.id ?? SYS.cash)
  const [from, setFrom] = useState(db.company.financialYearStart)
  const [to, setTo] = useState(todayISO())
  const entries = useMemo(() => buildLedger(db), [db])
  const account = accounts.find((a) => a.id === accountId)

  const { opening, rows, totalDr, totalCr, closing } = useMemo(() => {
    const mine = entries.filter((e) => e.account === accountId)
    const opening = mine.filter((e) => e.date < from).reduce((s, e) => s + e.debit - e.credit, 0)
    let running = opening
    const rows = mine.filter((e) => e.date >= from && e.date <= to).map((e) => {
      running += e.debit - e.credit
      return { ...e, running }
    })
    return { opening, rows, totalDr: rows.reduce((s, r) => s + r.debit, 0), totalCr: rows.reduce((s, r) => s + r.credit, 0), closing: running }
  }, [entries, accountId, from, to])

  const dc = (n: number) => `${formatMoney(Math.abs(n))} ${n >= 0 ? 'Dr' : 'Cr'}`
  const print = () => printHTML(`Ledger — ${account?.name}`, `<div class="head"><div><div class="brand">${db.company.name}</div><div class="muted">Account ledger · ${account?.name} · ${formatDate(from)} to ${formatDate(to)}</div></div></div>
    <table><tr><th>Date</th><th>Voucher</th><th>Particulars</th><th class="r">Debit</th><th class="r">Credit</th><th class="r">Balance</th></tr>
    <tr><td></td><td></td><td>Opening balance</td><td></td><td></td><td class="r">${dc(opening)}</td></tr>
    ${rows.map((r) => `<tr><td>${formatDate(r.date)}</td><td>${r.voucher}</td><td>${r.narration}</td><td class="r">${r.debit ? formatMoney(r.debit) : ''}</td><td class="r">${r.credit ? formatMoney(r.credit) : ''}</td><td class="r">${dc(r.running)}</td></tr>`).join('')}
    <tr><th colspan="3">Total</th><th class="r">${formatMoney(totalDr)}</th><th class="r">${formatMoney(totalCr)}</th><th class="r">${dc(closing)}</th></tr></table>`)

  return (
    <>
      <PageHeader title="Account Ledger" eyebrow="Full Account" icon={<BookText className="h-5 w-5" />} description="A running statement for any customer, vendor, bank, cash or expense account."
        actions={<><Button variant="outline" icon={<Printer className="h-4 w-4" />} onClick={print}>Print</Button><Button variant="outline" icon={<Download className="h-4 w-4" />} onClick={() => downloadCSV(`ledger-${account?.name}.csv`, ['Date', 'Voucher', 'Type', 'Particulars', 'Debit', 'Credit', 'Balance'], rows.map((r) => [r.date, r.voucher, r.type, r.narration, r.debit, r.credit, r.running]))}>Export</Button></>} />
      <div className="grid gap-4 rounded-2xl bg-surface p-4 shadow-lift sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Account" className="lg:col-span-2"><Select value={accountId} onChange={(e) => setAccountId(e.target.value)}>{accountOptions(db).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</Select></Field>
        <Field label="From"><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
        <Field label="To"><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Opening balance" value={dc(opening)} icon={<BookText className="h-5 w-5" />} tone="navy" />
        <StatCard label="Total debit" value="" numericValue={totalDr} format={(v) => formatCurrency(v, true)} icon={<ArrowLeftRight className="h-5 w-5" />} tone="sapphire" />
        <StatCard label="Total credit" value="" numericValue={totalCr} format={(v) => formatCurrency(v, true)} icon={<ArrowLeftRight className="h-5 w-5" />} tone="emerald" />
        <StatCard label="Closing balance" value={dc(closing)} icon={<Wallet className="h-5 w-5" />} tone={closing >= 0 ? 'amber' : 'violet'} />
      </div>
      <TableShell>
        <Table className="min-w-[820px]">
          <THead><tr><Th>Date</Th><Th>Voucher</Th><Th>Particulars</Th><Th align="right">Debit</Th><Th align="right">Credit</Th><Th align="right">Balance</Th></tr></THead>
          <TBody>
            <TR><Td className="text-silver-500">—</Td><Td /><Td className="font-semibold">Opening balance</Td><Td /><Td /><Td align="right" className="font-semibold">{dc(opening)}</Td></TR>
            {rows.length === 0 ? <TableEmptyRow colSpan={6}>No transactions in this period</TableEmptyRow> : rows.map((r) => (
              <TR key={r.id}><Td className="whitespace-nowrap">{formatDate(r.date)}</Td><Td><span className="font-mono text-[13px] font-semibold">{r.voucher}</span>{sub(r.type)}</Td><Td>{r.narration}</Td>
                <Td align="right">{r.debit ? formatMoney(r.debit) : ''}</Td><Td align="right">{r.credit ? formatMoney(r.credit) : ''}</Td><Td align="right" className="font-semibold text-navy-900">{dc(r.running)}</Td></TR>
            ))}
            <TR><Td /><Td /><Td className="font-bold">Total / closing</Td><Td align="right" className="font-bold">{formatMoney(totalDr)}</Td><Td align="right" className="font-bold">{formatMoney(totalCr)}</Td><Td align="right" className="font-extrabold text-navy-900">{dc(closing)}</Td></TR>
          </TBody>
        </Table>
      </TableShell>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Vouchers                                                            */
/* ------------------------------------------------------------------ */

type VoucherPage = 'Journal' | 'Contra' | 'Notes'

export function VouchersPage({ page }: { page: VoucherPage }) {
  const meta = {
    Journal: { title: 'General Entry', desc: 'Journal vouchers — a debit and a credit between any two accounts.', prefix: 'JV', kinds: ['Journal'] },
    Contra: { title: 'Contra Entry', desc: 'Cash-to-bank, bank-to-cash and bank-to-bank transfers.', prefix: 'CV', kinds: ['Contra'] },
    Notes: { title: 'Debit / Credit Notes', desc: 'Adjustment notes to customers and vendors for rate differences, returns and charges.', prefix: 'DN', kinds: ['Debit Note', 'Credit Note'] },
  }[page]
  const scope = useMemo(() => (r: Row) => meta.kinds.includes(r.kind), [meta.kinds])
  const bankCash = (a: AccountInfo, db: Database) => a.id === SYS.cash || a.id === SYS.bank || (a.kind === 'Ledger' && ['ag3', 'ag4'].includes(db.ledgers.find((l) => `led:${l.id}` === a.id)?.groupId ?? ''))
  return (
    <CrudPage
      collection="vouchers" entity={page === 'Notes' ? 'Note' : page === 'Contra' ? 'Contra entry' : 'Journal entry'} title={meta.title} scope={scope} icon={page === 'Notes' ? <ReceiptText className="h-5 w-5" /> : <FilePlus2 className="h-5 w-5" />} eyebrow="Full Account" description={meta.desc}
      labelOf={(r) => r.no}
      blank={(db) => ({ id: uid('vc'), kind: meta.kinds[0], no: `${meta.prefix}-${String(db.vouchers.filter((v) => meta.kinds.includes(v.kind)).length + 1).padStart(3, '0')}`, date: todayISO(), debitAcc: '', creditAcc: '', amount: 0, narration: '' })}
      columns={[
        { key: 'no', label: 'Voucher', render: (r) => <><span className="font-mono text-[13px] font-semibold text-navy-900">{r.no}</span>{sub(r.kind)}</>, text: (r) => r.no },
        { key: 'date', label: 'Date', render: (r) => formatDate(r.date), text: (r) => r.date },
        { key: 'debitAcc', label: 'Debit', render: (r, db) => accountList(db).find((a) => a.id === r.debitAcc)?.name ?? '—', text: (r, db) => accountList(db).find((a) => a.id === r.debitAcc)?.name ?? '' },
        { key: 'creditAcc', label: 'Credit', render: (r, db) => accountList(db).find((a) => a.id === r.creditAcc)?.name ?? '—', text: (r, db) => accountList(db).find((a) => a.id === r.creditAcc)?.name ?? '' },
        { key: 'amount', label: 'Amount', align: 'right', render: (r) => <span className="font-semibold text-navy-900">{formatMoney(r.amount)}</span>, text: (r) => r.amount },
        { key: 'narration', label: 'Narration', hideBelow: 'lg' },
      ]}
      fields={[
        { key: 'kind', label: 'Note type', type: 'select', required: true, options: meta.kinds.map((k) => ({ value: k, label: k })), visible: () => page === 'Notes' },
        { key: 'no', label: 'Voucher no', required: true }, { key: 'date', label: 'Date', type: 'date', required: true },
        { key: 'debitAcc', label: 'Debit account', type: 'select', required: true, options: (db) => accountOptions(db, page === 'Contra' ? (a) => bankCash(a, db) : undefined) },
        { key: 'creditAcc', label: 'Credit account', type: 'select', required: true, options: (db) => accountOptions(db, page === 'Contra' ? (a) => bankCash(a, db) : undefined) },
        { key: 'amount', label: 'Amount (₹)', type: 'number', required: true, min: 0 },
        { key: 'narration', label: 'Narration', type: 'textarea' },
      ]}
      validate={(d, db) => {
        const e: Record<string, string> = {}
        if (!(d.amount > 0)) e.amount = 'Amount must be greater than zero.'
        if (d.debitAcc && d.debitAcc === d.creditAcc) e.creditAcc = 'Debit and credit accounts must differ.'
        if (db.vouchers.some((v) => v.id !== d.id && v.no.toLowerCase() === String(d.no).toLowerCase())) e.no = 'This voucher number is already used.'
        return e
      }}
      modalSize="md"
    />
  )
}

/* ------------------------------------------------------------------ */
/* Expenses                                                            */
/* ------------------------------------------------------------------ */

export function ExpensesPage() {
  const { mutate } = useData()
  const toast = useToast()
  const { canEdit } = useAccess()
  const decide = (id: string, no: string, status: 'Approved' | 'Rejected') => {
    mutate((d) => { const e = d.expenses.find((x) => x.id === id); if (e) e.status = status }, { action: 'Updated', entity: 'expenses', detail: `${no} ${status.toLowerCase()}` })
    toast.success(`${no} ${status.toLowerCase()}.`)
  }
  return (
    <CrudPage
      collection="expenses" entity="Expense" title="Expense Payment (Approval)" icon={<Wallet className="h-5 w-5" />} eyebrow="Full Account"
      description="Expenses are recorded, then approved. Only approved expenses post to the books." labelOf={(r) => r.no}
      blank={(db) => ({ id: uid('ex'), no: `EXP-${String(db.expenses.length + 1).padStart(3, '0')}`, date: todayISO(), categoryId: db.expenseCategories[0]?.id ?? '', accountName: '', amount: 0, mode: 'Cash', billName: '', description: '', status: 'Pending' })}
      columns={[
        { key: 'no', label: 'No', render: (r) => <span className="font-mono text-[13px] font-semibold">{r.no}</span> },
        { key: 'date', label: 'Date', render: (r) => formatDate(r.date), text: (r) => r.date },
        { key: 'categoryId', label: 'Category', render: (r, db) => <>{strong(db.expenseCategories.find((c) => c.id === r.categoryId)?.name ?? '—')}{sub(r.accountName)}</>, text: (r, db) => db.expenseCategories.find((c) => c.id === r.categoryId)?.name ?? '' },
        { key: 'mode', label: 'Mode', hideBelow: 'md' },
        { key: 'amount', label: 'Amount', align: 'right', render: (r) => <span className="font-semibold text-navy-900">{formatMoney(r.amount)}</span>, text: (r) => r.amount },
        { key: 'status', label: 'Status', render: (r) => <Badge tone={r.status === 'Approved' ? 'success' : r.status === 'Rejected' ? 'danger' : 'warning'} dot>{r.status}</Badge>, text: (r) => r.status },
      ]}
      fields={[
        { key: 'no', label: 'Expense no', required: true }, { key: 'date', label: 'Date', type: 'date', required: true },
        { key: 'categoryId', label: 'Expense category', type: 'select', required: true, options: (db) => opts(db.expenseCategories) },
        { key: 'accountName', label: 'Paid to', required: true }, { key: 'amount', label: 'Amount (₹)', type: 'number', required: true, min: 0 },
        { key: 'mode', label: 'Payment type', type: 'select', required: true, options: ['Cash', 'Bank', 'UPI', 'Credit', 'Others'].map((m) => ({ value: m, label: m })) },
        { key: 'billName', label: 'Bill / receipt', hint: 'File name of the attached bill copy' },
        { key: 'status', label: 'Status', type: 'select', required: true, options: ['Pending', 'Approved', 'Rejected'].map((m) => ({ value: m, label: m })) },
        { key: 'description', label: 'Description', type: 'textarea' },
      ]}
      validate={(d, db) => {
        const e: Record<string, string> = {}
        if (!(d.amount > 0)) e.amount = 'Amount must be greater than zero.'
        if (db.expenses.some((x) => x.id !== d.id && x.no.toLowerCase() === String(d.no).toLowerCase())) e.no = 'This expense number is already used.'
        return e
      }}
      stats={(rows) => [
        { label: 'Approved expenses', value: '', numericValue: rows.filter((r) => r.status === 'Approved').reduce((s, r) => s + r.amount, 0), format: (v) => formatCurrency(v, true), icon: <Check className="h-5 w-5" />, tone: 'emerald' },
        { label: 'Awaiting approval', value: '', numericValue: rows.filter((r) => r.status === 'Pending').reduce((s, r) => s + r.amount, 0), format: (v) => formatCurrency(v, true), icon: <Wallet className="h-5 w-5" />, tone: 'amber', hint: `${rows.filter((r) => r.status === 'Pending').length} pending` },
        { label: 'Rejected', value: 0, numericValue: rows.filter((r) => r.status === 'Rejected').length, icon: <X className="h-5 w-5" />, tone: 'rose' },
        { label: 'All expenses', value: 0, numericValue: rows.length, icon: <ReceiptText className="h-5 w-5" />, tone: 'sapphire' },
      ]}
      filters={[{ key: 'status', label: 'Status', options: ['Pending', 'Approved', 'Rejected'].map((s) => ({ value: s, label: s })), test: (r, v) => r.status === v }]}
      rowActions={(r) => canEdit && r.status === 'Pending' ? (
        <>
          <Button size="icon" variant="ghost" aria-label={`Approve ${r.no}`} title="Approve" className="text-emerald-600 hover:bg-emerald-50" onClick={() => decide(r.id, r.no, 'Approved')} icon={<Check className="h-4 w-4" />} />
          <Button size="icon" variant="ghost" aria-label={`Reject ${r.no}`} title="Reject" className="text-rose-600 hover:bg-rose-50" onClick={() => decide(r.id, r.no, 'Rejected')} icon={<X className="h-4 w-4" />} />
        </>
      ) : null}
      modalSize="lg"
    />
  )
}

export function ExpenseCategoriesPage() {
  return (
    <CrudPage
      collection="expenseCategories" entity="Expense category" title="Expense Master" icon={<Tags className="h-5 w-5" />} eyebrow="Full Account" description="Heads under which expenses are recorded and reported."
      blank={() => ({ id: uid('ec'), name: '' })}
      columns={[{ key: 'name', label: 'Category', render: (r) => strong(r.name) }, { key: 'count', label: 'Expenses', align: 'right', render: (r, db) => db.expenses.filter((e) => e.categoryId === r.id).length }, { key: 'total', label: 'Total approved', align: 'right', render: (r, db) => formatMoney(db.expenses.filter((e) => e.categoryId === r.id && e.status === 'Approved').reduce((s, e) => s + e.amount, 0)) }]}
      fields={[{ key: 'name', label: 'Category name', required: true }]}
      validate={(d, db) => (db.expenseCategories.some((c) => c.id !== d.id && c.name.toLowerCase() === String(d.name).trim().toLowerCase()) ? { name: 'This category already exists.' } : {})}
      modalSize="sm"
    />
  )
}
