import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AlertTriangle, ArrowUpRight, Boxes, FileText, Hourglass, IndianRupee, LayoutDashboard, Plus, Receipt, ShoppingCart, TrendingUp, Wallet } from 'lucide-react'
import { Card, CardHeader } from '@/components/ui/Card'
import { Badge, StatusBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { EmptyState, PageHeader, ProgressBar } from '@/components/ui/Layout'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { Sparkline } from '@/components/ui/Sparkline'
import { StatCard } from '@/components/ui/StatCard'
import { CategoryBarChart, ComparisonBarChart, DonutChart, TrendAreaChart } from '@/components/charts/Charts'
import { Table, TBody, Td, Th, THead, TR } from '@/components/ui/Table'
import { useData } from '@/store/DataContext'
import { useAuth } from '@/store/AuthContext'
import { DOC_META } from '@/lib/docConfig'
import { dashboardMetrics, docsOf, docTotal, invoiceStates, isLive, lastMonths, monthKey, nameOf, pendingAlerts, stockMap, topParties } from '@/lib/calc'
import { addDaysISO, cn, formatCurrency, formatDate, formatMoney, todayISO } from '@/lib/utils'

/* Collection rate as a ring that draws itself on load. */
function CollectionRing({ rate }: { rate: number }) {
  const size = 156
  const stroke = 12
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const clamped = Math.max(0, Math.min(100, rate))
  const [shown, setShown] = useState(0)
  useEffect(() => {
    const frame = requestAnimationFrame(() => setShown(clamped))
    return () => cancelAnimationFrame(frame)
  }, [clamped])

  return (
    <div className="relative" style={{ width: size, height: size }} role="img" aria-label={`${Math.round(clamped)}% of invoiced value collected`}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id="ring-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#fff1c2" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.28)" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="url(#ring-grad)" strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={circumference * (1 - shown / 100)}
          style={{ transition: 'stroke-dashoffset 1400ms cubic-bezier(0.16, 1, 0.3, 1)', filter: 'drop-shadow(0 0 6px rgba(255,255,255,0.6))' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-[#1a1612]">
        <span className="tnum text-[34px] leading-none font-extrabold tracking-[-0.03em]">
          <AnimatedNumber value={clamped} format={(v) => `${Math.round(v)}%`} duration={1400} />
        </span>
        <span className="mt-1 text-[10.5px] font-bold tracking-[0.14em] text-[#3a342d] uppercase">Collected</span>
      </div>
    </div>
  )
}

/* A frosted tile for one headline figure on the hero band. */
function HeroTile({ label, icon, value, chip, spark }: { label: string; icon: ReactNode; value: number; chip: { text: string; good: boolean }; spark?: ReactNode }) {
  return (
    <div className="group relative overflow-hidden rounded-2xl bg-white/85 p-4 shadow-[0_10px_24px_-14px_rgba(122,46,14,0.55)] ring-1 ring-white/70 backdrop-blur transition-[translate,background-color] duration-200 ease-out hover:-translate-y-0.5 hover:bg-white/95">
      <span className="absolute inset-x-0 top-0 h-[3px] bg-linear-to-r from-[#f58a4e] to-[#ed7333]/10" aria-hidden="true" />
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-[11px] font-bold tracking-[0.1em] text-[#5a5146] uppercase">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-[#fde3d3] text-[#c4531c]">{icon}</span>
          {label}
        </span>
        <span className={cn('tnum rounded-full px-2 py-0.5 text-[10.5px] font-bold', chip.good ? 'bg-[#d1fae5] text-[#065f46]' : 'bg-[#fee2e2] text-[#991b1b]')}>{chip.text}</span>
      </div>
      <p className="tnum mt-3 text-[28px] leading-none font-extrabold tracking-[-0.03em] text-[#1a1612]">
        <AnimatedNumber value={value} format={(v) => formatCurrency(v, true)} duration={1100} />
      </p>
      <div className="mt-2">{spark}</div>
    </div>
  )
}

const pctChange = (current: number, previous: number) => (previous === 0 ? (current > 0 ? 100 : 0) : ((current - previous) / previous) * 100)

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

  const hero = useMemo(() => {
    const invoices = docsOf(db, 'salesInvoice').filter(isLive)
    const receipts = docsOf(db, 'receipt').filter(isLive)
    const invoiced = invoices.reduce((sum, d) => sum + docTotal(d, db), 0)
    const collected = receipts.reduce((sum, d) => sum + d.amount, 0)
    const invoicedSeries = months.map((mo) => invoices.filter((d) => monthKey(d.date) === mo.key).reduce((sum, d) => sum + docTotal(d, db), 0))
    const collectedSeries = months.map((mo) => receipts.filter((d) => monthKey(d.date) === mo.key).reduce((sum, d) => sum + d.amount, 0))
    return {
      invoiced, collected, invoicedSeries, collectedSeries,
      rate: invoiced ? Math.min(100, (collected / invoiced) * 100) : 0,
      invoiceCount: invoices.length,
      openOrders: docsOf(db, 'salesOrder').filter((d) => d.status === 'Open' || d.status === 'Packed').length,
      overdue: invoiceStates(db, 'salesInvoice').filter((s) => s.overdue).length,
      invoicedTrend: pctChange(invoicedSeries.at(-1) ?? 0, invoicedSeries.at(-2) ?? 0),
    }
  }, [db, months])
  const collectedTrend = pctChange(hero.collectedSeries.at(-1) ?? 0, hero.collectedSeries.at(-2) ?? 0)

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

      {/* ---------------- Hero band ---------------- */}
      <Card variant="sunset" padded={false} className="overflow-hidden">
        <div className="relative p-5 lg:p-6">
          <div className="pointer-events-none absolute -top-24 -right-16 h-72 w-72 rounded-full bg-white/30 blur-3xl" aria-hidden="true" />
          <div className="pointer-events-none absolute -bottom-28 -left-16 h-72 w-72 rounded-full bg-rose-500/30 blur-3xl" aria-hidden="true" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(520px_240px_at_100%_100%,rgba(122,46,14,0.45),transparent_70%)]" aria-hidden="true" />
          <span className="hero-sweep pointer-events-none absolute inset-y-0 -left-1/3 w-1/4 -skew-x-12 bg-linear-to-r from-transparent via-white/25 to-transparent blur-md" aria-hidden="true" />
          <IndianRupee className="pointer-events-none absolute -right-6 -bottom-10 h-56 w-56 -rotate-12 text-white/[0.045]" aria-hidden="true" />

          <div className="relative grid items-center gap-6 lg:grid-cols-[auto_1fr] lg:gap-8">
            <div className="flex flex-col items-center gap-3">
              <CollectionRing rate={hero.rate} />
              <div className="flex items-center gap-2 rounded-full border border-white/70 bg-white/85 px-3 py-1.5 backdrop-blur">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#10b981] opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-[#10b981]" />
                </span>
                <span className="text-[11.5px] font-semibold text-[#1a1612]">{hero.invoiceCount} invoices · {hero.openOrders} orders open</span>
              </div>
            </div>

            <div className="min-w-0">
              <h2 className="text-[20px] font-extrabold tracking-[-0.02em] text-white lg:text-[24px]">Revenue and fulfilment at a glance</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <HeroTile label="Invoiced" icon={<Receipt className="h-4 w-4" />} value={hero.invoiced} chip={{ text: `${hero.invoicedTrend >= 0 ? '+' : ''}${hero.invoicedTrend.toFixed(1)}%`, good: hero.invoicedTrend >= 0 }} spark={<Sparkline data={hero.invoicedSeries} tone="sapphire" height={30} />} />
                <HeroTile label="Collected" icon={<Wallet className="h-4 w-4" />} value={hero.collected} chip={{ text: `${collectedTrend >= 0 ? '+' : ''}${collectedTrend.toFixed(1)}%`, good: collectedTrend >= 0 }} spark={<Sparkline data={hero.collectedSeries} tone="emerald" height={30} />} />
                <HeroTile label="Outstanding" icon={<Hourglass className="h-4 w-4" />} value={m.pendingCustomer} chip={{ text: hero.overdue > 0 ? `${hero.overdue} overdue` : 'current', good: hero.overdue === 0 }} spark={<ProgressBar value={100 - hero.rate} tone="gold" track="bg-[#f3e8dd]" className="mt-2.5" />} />
              </div>
            </div>
          </div>
        </div>
      </Card>

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
