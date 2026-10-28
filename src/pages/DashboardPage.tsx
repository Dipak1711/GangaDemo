import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AlertTriangle, ArrowUpRight, Boxes, FileText, Hourglass, IndianRupee, LayoutDashboard, Plus, Receipt, ShoppingCart, TrendingUp, Wallet } from 'lucide-react'
import { Card, CardHeader } from '@/components/ui/Card'
import { Badge, StatusBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { EmptyState, PageHeader } from '@/components/ui/Layout'
import { StatCard } from '@/components/ui/StatCard'
import { CategoryBarChart, ComparisonBarChart, DonutChart, TrendAreaChart } from '@/components/charts/Charts'
import { Table, TBody, Td, Th, THead, TR } from '@/components/ui/Table'
import { useData } from '@/store/DataContext'
import { useAuth } from '@/store/AuthContext'
import { DOC_META } from '@/lib/docConfig'
import { dashboardMetrics, docsOf, docTotal, invoiceStates, isLive, lastMonths, monthKey, nameOf, pendingAlerts, stockMap, topParties } from '@/lib/calc'
import { addDaysISO, cn, formatCurrency, formatDate, formatMoney, todayISO } from '@/lib/utils'

export function DashboardPage() {
  const { db } = useData()
  const { user } = useAuth()
  const navigate = useNavigate()

  const m = useMemo(() => dashboardMetrics(db), [db])
  const alerts = useMemo(() => pendingAlerts(db), [db])
  const months = useMemo(() => lastMonths(6), [])

  const monthly = useMemo(() => {
    const sales = docsOf(db, 'salesInvoice').filter(isLive)
    const purchases = docsOf(db, 'purchaseInvoice').filter(isLive)
    return months.map((mo) => ({
      name: mo.label,
      Sales: Math.round(sales.filter((d) => monthKey(d.date) === mo.key).reduce((s, d) => s + docTotal(d, db), 0)),
      Purchase: Math.round(purchases.filter((d) => monthKey(d.date) === mo.key).reduce((s, d) => s + docTotal(d, db), 0)),
    }))
  }, [db, months])

  const trend = useMemo(() => {
    const today = todayISO()
    const sales = docsOf(db, 'salesInvoice').filter(isLive)
    return Array.from({ length: 30 }, (_, i) => {
      const date = addDaysISO(today, i - 29)
      return {
        name: formatDate(date).slice(0, 6),
        value: Math.round(sales.filter((d) => d.date === date).reduce((s, d) => s + docTotal(d, db), 0)),
      }
    })
  }, [db])

  const topCustomers = useMemo(() => topParties(db, 'salesInvoice', 5), [db])
  const topVendors = useMemo(() => topParties(db, 'purchaseInvoice', 5), [db])

  const recent = useMemo(
    () =>
      db.docs
        .filter((d) => ['salesInvoice', 'salesOrder', 'purchaseOrder', 'purchaseInvoice', 'receipt', 'vendorPayment', 'salesQuotation'].includes(d.kind))
        .slice()
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
        .slice(0, 7),
    [db],
  )

  const ageing = useMemo(() => {
    const buckets = { Current: 0, '1–30d': 0, '31–60d': 0, '60d+': 0 }
    invoiceStates(db, 'salesInvoice').forEach((s) => {
      if (s.balance <= 0) return
      if (!s.overdue) buckets.Current += s.balance
      else if (s.daysOverdue <= 30) buckets['1–30d'] += s.balance
      else if (s.daysOverdue <= 60) buckets['31–60d'] += s.balance
      else buckets['60d+'] += s.balance
    })
    return Object.entries(buckets).map(([name, value]) => ({ name, value: Math.round(value) }))
  }, [db])

  const stockByClass = useMemo(() => {
    const stock = stockMap(db)
    const by = new Map<string, number>()
    db.items.forEach((i) => by.set(i.itemClass, (by.get(i.itemClass) ?? 0) + Math.max(0, stock.get(i.id) ?? 0) * i.purchaseRate))
    return [...by.entries()].map(([name, value]) => ({ name, value: Math.round(value) }))
  }, [db])

  const lastMonthSales = monthly.at(-2)?.Sales ?? 0
  const thisMonthSales = monthly.at(-1)?.Sales ?? 0
  const salesTrend = lastMonthSales ? ((thisMonthSales - lastMonthSales) / lastMonthSales) * 100 : 0
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <>
      <PageHeader
        eyebrow={`${greeting}, ${user?.name.split(' ')[0] ?? ''}`}
        icon={<LayoutDashboard className="h-5 w-5" />}
        title="Ganga Dashboard"
        description={`${db.company.name} — sales, purchases, receivables, payables and stock at a glance.`}
        actions={
          <>
            <Button variant="outline" icon={<FileText className="h-4 w-4" />} onClick={() => navigate('/sales/quotations')}>New quotation</Button>
            <Button icon={<Plus className="h-4 w-4" />} onClick={() => navigate('/sales/invoices')}>New invoice</Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label="Total Sales (This Month)" value="" numericValue={m.salesThisMonth} format={(v) => formatCurrency(v, true)} icon={<IndianRupee className="h-5 w-5" />} tone="sapphire" trend={salesTrend ? { value: salesTrend } : undefined} hint="vs last month" spark={monthly.map((x) => x.Sales)} onClick={() => navigate('/sales/invoices')} />
        <StatCard label="Total Purchases (This Month)" value="" numericValue={m.purchasesThisMonth} format={(v) => formatCurrency(v, true)} icon={<ShoppingCart className="h-5 w-5" />} tone="amber" spark={monthly.map((x) => x.Purchase)} onClick={() => navigate('/purchase/invoices')} />
        <StatCard label="Total Revenue" value="" numericValue={m.totalRevenue} format={(v) => formatCurrency(v, true)} icon={<TrendingUp className="h-5 w-5" />} tone="emerald" hint="Net of sales returns" onClick={() => navigate('/reports/profit-loss')} />
        <StatCard label="Pending Customer Payments" value="" numericValue={m.pendingCustomer} format={(v) => formatCurrency(v, true)} icon={<Hourglass className="h-5 w-5" />} tone="rose" hint="Receivable" onClick={() => navigate('/reports/outstanding')} />
        <StatCard label="Pending Vendor Payments" value="" numericValue={m.pendingVendor} format={(v) => formatCurrency(v, true)} icon={<Wallet className="h-5 w-5" />} tone="violet" hint="Payable" onClick={() => navigate('/reports/outstanding')} />
        <StatCard label="Low Stock Alerts" value={`${m.lowStock} Items`} icon={<Boxes className="h-5 w-5" />} tone={m.lowStock ? 'rose' : 'emerald'} hint={m.lowStock ? 'View low stock items →' : 'Stock is healthy'} onClick={() => navigate('/inventory/low-stock')} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.35fr_1fr]">
        <Card>
          <CardHeader title="Sales vs Purchase (Monthly)" subtitle="Invoiced value over the last six months" accent="sapphire" />
          <div className="mt-3"><ComparisonBarChart data={monthly} series={[{ key: 'Sales', name: 'Sales', color: '#df6527' }, { key: 'Purchase', name: 'Purchase', color: '#0f766e' }]} /></div>
        </Card>
        <Card>
          <CardHeader title="Revenue Trend (Last 30 Days)" subtitle="Daily invoiced sales" accent="emerald" />
          <div className="mt-3"><TrendAreaChart data={trend} color="#059669" name="Sales" /></div>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-4">
        <Card className="xl:col-span-1">
          <CardHeader title="Top Customers" subtitle="By invoiced value" accent="sapphire" />
          {topCustomers.length === 0 ? <EmptyState title="No data available" description="Invoices will rank customers here." /> : (
            <ol className="mt-3 flex flex-col gap-2.5">
              {topCustomers.map((c, i) => (
                <li key={c.id} className="flex items-center gap-3">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-silver-100 text-xs font-bold text-navy-700 ring-1 ring-silver-200">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-navy-900">{c.name}</span>
                  <span className="tnum text-[13px] font-bold text-navy-900">{formatCurrency(c.total, true)}</span>
                </li>
              ))}
            </ol>
          )}
        </Card>
        <Card>
          <CardHeader title="Top Vendors" subtitle="By purchase value" accent="gold" />
          {topVendors.length === 0 ? <EmptyState title="No data available" /> : (
            <ol className="mt-3 flex flex-col gap-2.5">
              {topVendors.map((c, i) => (
                <li key={c.id} className="flex items-center gap-3">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-silver-100 text-xs font-bold text-navy-700 ring-1 ring-silver-200">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-navy-900">{c.name}</span>
                  <span className="tnum text-[13px] font-bold text-navy-900">{formatCurrency(c.total, true)}</span>
                </li>
              ))}
            </ol>
          )}
        </Card>
        <Card>
          <CardHeader title="Receivable ageing" subtitle="Outstanding by days overdue" accent="rose" />
          <CategoryBarChart data={ageing} currency height={210} color="#dc2626" />
        </Card>
        <Card>
          <CardHeader title="Stock value by class" subtitle="At purchase rate" accent="emerald" />
          <DonutChart data={stockByClass} currency height={230} centerLabel="Total" />
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
        <Card padded={false}>
          <div className="p-5 pb-3"><CardHeader title="Recent Activities" subtitle="Latest documents across sales and purchase" accent="sapphire" /></div>
          <div className="overflow-x-auto">
            <Table className="min-w-[620px]">
              <THead><tr><Th>Type</Th><Th>Reference</Th><Th>Date</Th><Th>Party</Th><Th align="right">Amount</Th></tr></THead>
              <TBody>
                {recent.map((d) => (
                  <TR key={d.id} onClick={() => navigate(DOC_META[d.kind].route, { state: { openId: d.id } })}>
                    <Td><Badge tone={DOC_META[d.kind].side === 'sales' ? 'success' : 'warning'}>{DOC_META[d.kind].label}</Badge></Td>
                    <Td><span className="font-mono text-[13px] font-semibold">{d.no}</span></Td>
                    <Td className="whitespace-nowrap">{formatDate(d.date)}</Td>
                    <Td>{nameOf(db.parties, d.partyId)}</Td>
                    <Td align="right" className="font-semibold">{formatMoney(docTotal(d, db))}</Td>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>
        </Card>
        <Card>
          <CardHeader title="Needs attention" subtitle={`${alerts.length} open item${alerts.length === 1 ? '' : 's'}`} accent="rose" action={<Link to="/logistics/alerts" className="inline-flex items-center gap-1 text-xs font-bold text-sapphire-700 hover:underline">Alert centre <ArrowUpRight className="h-3.5 w-3.5" /></Link>} />
          {alerts.length === 0 ? <EmptyState icon={<AlertTriangle className="h-5 w-5" />} title="All caught up" description="No overdue invoices, low stock or pending approvals." /> : (
            <ul className="mt-3 flex max-h-[360px] flex-col divide-y divide-silver-200 overflow-y-auto">
              {alerts.slice(0, 9).map((a) => (
                <li key={a.id}>
                  <Link to={a.to} className="flex items-start gap-3 py-2.5 transition-colors hover:bg-silver-50">
                    <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', a.severity === 'high' ? 'bg-rose-500' : a.severity === 'medium' ? 'bg-amber-500' : 'bg-blue-500')} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium text-navy-900">{a.label}</span>
                      <span className="block truncate text-xs text-silver-600">{a.detail}</span>
                    </span>
                    <StatusBadge status={a.kind === 'Low stock' ? 'Low stock' : a.kind === 'Overdue invoice' ? 'Overdue' : 'Pending'} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  )
}
