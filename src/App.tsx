import { lazy, type ComponentType, type ReactElement } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { LoginPage } from '@/pages/LoginPage'
import { useAuth } from '@/store/AuthContext'
import { DocumentPage } from '@/pages/DocumentPage'
import { DOC_KINDS, DOC_META } from '@/lib/docConfig'

type Loader = () => Promise<Record<string, unknown>>
type Props = Record<string, unknown>

/** Lazy-load a named export, optionally pre-binding props. */
const L = (loader: Loader, name: string, props?: Props) =>
  lazy(() =>
    loader().then((m) => {
      const Component = m[name] as ComponentType<Props>
      return { default: props ? () => <Component {...props} /> : (Component as ComponentType) }
    }),
  )

const masters = () => import('@/pages/MasterPages')
const extras = () => import('@/pages/MasterExtras')
const inventory = () => import('@/pages/InventoryPages')
const production = () => import('@/pages/ProductionPages')
const accounts = () => import('@/pages/AccountPages')
const reports = () => import('@/pages/ReportPages')
const ops = () => import('@/pages/OperationsPages')
const admin = () => import('@/pages/AdminPages')
const settings = () => import('@/pages/SettingsPages')

const ROUTES: Array<[string, ComponentType]> = [
  ['/', L(() => import('@/pages/DashboardPage'), 'DashboardPage')],

  ['/company/profile', L(settings, 'ProfilePage')],
  ['/company/branches', L(masters, 'BranchesPage')],
  ['/company/departments', L(masters, 'DepartmentsPage')],
  ['/company/designations', L(masters, 'DesignationsPage')],

  ['/masters/categories', L(masters, 'CategoriesPage')],
  ['/masters/item-groups', L(masters, 'ItemGroupsPage')],
  ['/masters/items', L(masters, 'ItemsPage')],
  ['/masters/serials', L(extras, 'SerialsPage')],
  ['/masters/units', L(masters, 'UnitsPage')],
  ['/masters/converters', L(extras, 'ConvertersPage')],
  ['/masters/gauge', L(masters, 'GaugePage')],
  ['/masters/packing', L(masters, 'PackingPage')],
  ['/masters/taxes', L(masters, 'TaxesPage')],
  ['/masters/sundry', L(masters, 'SundryPage')],
  ['/masters/customers', L(masters, 'PartiesPage', { type: 'Customer' })],
  ['/masters/vendors', L(masters, 'PartiesPage', { type: 'Vendor' })],
  ['/masters/account-groups', L(masters, 'AccountGroupsPage')],
  ['/masters/print', L(extras, 'PrintSetupPage')],
  ['/masters/terms', L(extras, 'TermsPage')],

  ['/sales/tracking', L(reports, 'TrackingPage', { side: 'sales' })],
  ['/sales/report', L(reports, 'SideReportPage', { side: 'sales' })],
  ['/purchase/tracking', L(reports, 'TrackingPage', { side: 'purchase' })],
  ['/purchase/report', L(reports, 'SideReportPage', { side: 'purchase' })],

  ['/inventory/stock', L(inventory, 'StockPage')],
  ['/inventory/movements', L(inventory, 'MovementsPage')],
  ['/inventory/transfer', L(inventory, 'TransferPage')],
  ['/inventory/low-stock', L(inventory, 'LowStockPage')],
  ['/inventory/warehouses', L(masters, 'WarehousesPage')],
  ['/inventory/report', L(inventory, 'InventoryReportPage')],

  ['/production/designs', L(production, 'DesignsPage')],
  ['/production/bom', L(production, 'BomPage')],
  ['/production/custom', L(production, 'WorkOrdersPage', { type: 'Custom' })],
  ['/production/regular', L(production, 'WorkOrdersPage', { type: 'Regular' })],
  ['/production/job-work', L(production, 'WorkOrdersPage', { type: 'Job Work' })],
  ['/production/entry', L(production, 'ProductionEntryPage')],
  ['/production/report', L(production, 'ProductionReportPage')],

  ['/accounts/ledgers', L(accounts, 'LedgerMasterPage')],
  ['/accounts/ledger', L(accounts, 'AccountLedgerPage')],
  ['/accounts/journal', L(accounts, 'VouchersPage', { page: 'Journal' })],
  ['/accounts/contra', L(accounts, 'VouchersPage', { page: 'Contra' })],
  ['/accounts/notes', L(accounts, 'VouchersPage', { page: 'Notes' })],
  ['/accounts/expenses', L(accounts, 'ExpensesPage')],
  ['/accounts/expense-categories', L(accounts, 'ExpenseCategoriesPage')],

  ['/reports/day-book', L(reports, 'BookPage', { book: 'day' })],
  ['/reports/cash-book', L(reports, 'BookPage', { book: 'cash' })],
  ['/reports/bank-book', L(reports, 'BookPage', { book: 'bank' })],
  ['/reports/outstanding', L(reports, 'OutstandingPage')],
  ['/reports/trial-balance', L(reports, 'TrialBalancePage')],
  ['/reports/profit-loss', L(reports, 'ProfitLossPage')],
  ['/reports/balance-sheet', L(reports, 'BalanceSheetPage')],
  ['/reports/gst', L(reports, 'GstReportPage')],
  ['/reports/tds', L(reports, 'TdsReportPage')],
  ['/reports/analyst', L(reports, 'AnalystPage')],

  ['/crm/complaints', L(ops, 'ComplaintsPage')],
  ['/crm/amc', L(ops, 'AmcPage')],

  ['/hr/employees', L(ops, 'EmployeesPage')],
  ['/hr/attendance', L(ops, 'AttendancePage')],
  ['/hr/leave', L(ops, 'LeavePage')],
  ['/hr/payroll', L(ops, 'PayrollPage')],

  ['/logistics/dealers', L(masters, 'PartiesPage', { type: 'Dealer' })],
  ['/logistics/transport', L(masters, 'TransportPage', { kind: 'Transport' })],
  ['/logistics/couriers', L(masters, 'TransportPage', { kind: 'Courier' })],
  ['/logistics/contacts', L(ops, 'ContactsPage')],
  ['/logistics/map', L(ops, 'MapPage')],
  ['/logistics/alerts', L(ops, 'AlertsPage')],

  ['/admin/organizations', L(admin, 'OrganizationsPage')],
  ['/admin/users', L(admin, 'UsersPage')],
  ['/admin/roles', L(admin, 'RolesPage')],
  ['/admin/activity', L(admin, 'ActivityPage')],
  ['/admin/switch', L(admin, 'SwitchProfilePage')],

  ['/settings/config', L(settings, 'ConfigPage')],
  ['/settings/data', L(settings, 'DataPage')],
  ['/settings/recycle', L(settings, 'RecyclePage')],
  ['/settings/sitemap', L(settings, 'SitemapPage')],
]

export default function App(): ReactElement {
  const { user } = useAuth()
  if (!user) return <LoginPage />
  return (
    <Routes>
      <Route element={<AppLayout />}>
        {ROUTES.map(([path, Page]) => (
          <Route key={path} path={path} element={<Page />} />
        ))}
        {DOC_KINDS.map((kind) => (
          <Route key={kind} path={DOC_META[kind].route} element={<DocumentPage kind={kind} />} />
        ))}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
