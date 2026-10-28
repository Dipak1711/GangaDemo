import type { LucideIcon } from 'lucide-react'
import {
  Activity, AlarmClock, Archive, BarChart3, BookOpen, BookText, Boxes, Briefcase, Building2, Calculator, CalendarCheck, CalendarOff,
  ClipboardList, Contact, Cog, Database as DatabaseIcon, Factory, FileBarChart, FileCheck2, FilePlus2, FileSpreadsheet, FileText,
  Gauge, Handshake, Headset, KeyRound, Landmark, Layers, LayoutDashboard, LayoutGrid, ListChecks, MapPin, Network, Package, PackageCheck,
  Percent, PieChart, Printer, Receipt, Recycle, Repeat, Ruler, ScrollText, Settings2, ShieldCheck, ShoppingCart, Store, Tags, Truck,
  Undo2, UserCog, Users, Wallet, Warehouse, Wrench, ArrowLeftRight, Banknote, BellRing, Hash, Scale, UserRoundCheck, Building,
  ReceiptText, TrendingUp, TrendingDown, FolderTree, HandCoins, FileInput, Lock, Navigation, Scissors, BadgeIndianRupee,
} from 'lucide-react'

export type SectionId =
  | 'main' | 'company' | 'masters' | 'sales' | 'purchase' | 'inventory' | 'production' | 'accounts' | 'reports'
  | 'crm' | 'hr' | 'logistics' | 'admin' | 'settings'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  description: string
  section: SectionId
  /** Role access group. */
  access: string
}

export interface NavSection {
  id: SectionId
  title: string
  icon: LucideIcon
  tone: string
}

export const SECTIONS: NavSection[] = [
  { id: 'main', title: 'Main Menu', icon: LayoutGrid, tone: 'bg-[#dbeafe] text-[#1d4ed8] dark:bg-[#1e3a8a]/40 dark:text-[#93c5fd]' },
  { id: 'company', title: 'Company Profile', icon: Building2, tone: 'bg-cyan-100 text-cyan-700' },
  { id: 'masters', title: 'Master Setup', icon: Layers, tone: 'bg-violet-100 text-violet-700' },
  { id: 'sales', title: 'Sales', icon: Briefcase, tone: 'bg-emerald-100 text-emerald-700' },
  { id: 'purchase', title: 'Purchase', icon: ShoppingCart, tone: 'bg-amber-100 text-amber-700' },
  { id: 'inventory', title: 'Inventory', icon: Boxes, tone: 'bg-[#fde3d3] text-[#b4501d] dark:bg-[#ed7333]/20 dark:text-[#f8aa77]' },
  { id: 'production', title: 'Production', icon: Factory, tone: 'bg-rose-100 text-rose-700' },
  { id: 'accounts', title: 'Full Account', icon: Wallet, tone: 'bg-gold-100 text-gold-700' },
  { id: 'reports', title: 'Report & Analyst', icon: BarChart3, tone: 'bg-cyan-100 text-cyan-700' },
  { id: 'crm', title: 'CRM / AMC', icon: Headset, tone: 'bg-violet-100 text-violet-700' },
  { id: 'hr', title: 'HR / Payroll', icon: Users, tone: 'bg-emerald-100 text-emerald-700' },
  { id: 'logistics', title: 'Dealer & Dispatch', icon: Truck, tone: 'bg-[#fde3d3] text-[#b4501d] dark:bg-[#ed7333]/20 dark:text-[#f8aa77]' },
  { id: 'admin', title: 'Admin / Security', icon: ShieldCheck, tone: 'bg-rose-100 text-rose-700' },
  { id: 'settings', title: 'Settings', icon: Cog, tone: 'bg-amber-100 text-amber-700' },
]

const n = (section: SectionId, access: string, to: string, label: string, icon: LucideIcon, description: string): NavItem => ({ to, label, icon, description, section, access })

export const NAV_ITEMS: NavItem[] = [
  n('main', 'dashboard', '/', 'Dashboard', LayoutDashboard, 'Business health at a glance'),

  n('company', 'company', '/company/profile', 'My Profile', Building2, 'Company identity, GST and contact details'),
  n('company', 'company', '/company/branches', 'Branches', Store, 'Offices, works and depots'),
  n('company', 'company', '/company/departments', 'Department', Network, 'Departments per branch'),
  n('company', 'company', '/company/designations', 'Designation', UserRoundCheck, 'Designations and responsible persons'),

  n('masters', 'masters', '/masters/categories', 'Category / Brand', Tags, 'Item categories and brands'),
  n('masters', 'masters', '/masters/item-groups', 'Item Group', FolderTree, 'Hierarchical item groups'),
  n('masters', 'masters', '/masters/items', 'Item', Package, 'Tractors, parts, raw materials and implements'),
  n('masters', 'masters', '/masters/serials', 'Serial Numbers', Hash, 'Generate and track serial-number ranges'),
  n('masters', 'masters', '/masters/units', 'Unit', Ruler, 'Units of measure'),
  n('masters', 'masters', '/masters/converters', 'Unit Calculators', Calculator, 'Area, length, volume, speed, time and mass'),
  n('masters', 'masters', '/masters/gauge', 'Unit Chart (Gauge → MM)', Gauge, 'Gauge to millimetre reference'),
  n('masters', 'masters', '/masters/packing', 'Packing Units', PackageCheck, 'Packing units and conversions'),
  n('masters', 'masters', '/masters/taxes', 'Taxes (GST/TCS/TDS)', Percent, 'Tax rates and types'),
  n('masters', 'masters', '/masters/sundry', 'Bill Sundry', ReceiptText, 'Extra charges and discounts'),
  n('masters', 'masters', '/masters/customers', 'All Account (Customers)', Users, 'Customer master'),
  n('masters', 'masters', '/masters/vendors', 'Supply / Vendor List', Handshake, 'Vendor master'),
  n('masters', 'masters', '/masters/account-groups', 'Account Group', FolderTree, 'Chart-of-accounts groups'),
  n('masters', 'masters', '/masters/print', 'Print Setup', Printer, 'Copies, header and signature'),
  n('masters', 'masters', '/masters/terms', 'Terms & Conditions', ScrollText, 'Default terms per document'),

  n('sales', 'sales', '/sales/quotations', 'Sales Quotation', FileText, 'Offers sent to customers'),
  n('sales', 'sales', '/sales/orders', 'Sales Order', ClipboardList, 'Confirmed customer orders'),
  n('sales', 'sales', '/sales/packaging', 'Packaging List', PackageCheck, 'Packing before dispatch'),
  n('sales', 'sales', '/sales/invoices', 'Sales Invoice', Receipt, 'Tax invoices and balances'),
  n('sales', 'sales', '/sales/delivery', 'Delivery Notes', Truck, 'Delivery and receiver details'),
  n('sales', 'sales', '/sales/gate-pass', 'Gate Pass', FileCheck2, 'Material out authorisation'),
  n('sales', 'sales', '/sales/returns', 'Sales Return', Undo2, 'Goods returned by customers'),
  n('sales', 'sales', '/sales/receipts', 'Receive Payment', HandCoins, 'Customer receipts'),
  n('sales', 'sales', '/sales/tracking', 'Tracking', Navigation, 'Sales document timeline'),
  n('sales', 'sales', '/sales/report', 'Sales Report', FileBarChart, 'Customer, month and product analysis'),

  n('purchase', 'purchase', '/purchase/quotations', 'Purchase Quotation', FileText, 'Vendor price offers'),
  n('purchase', 'purchase', '/purchase/orders', 'Purchase Order', ClipboardList, 'Orders to vendors'),
  n('purchase', 'purchase', '/purchase/receipts', 'Good Receipt (GRM)', FileInput, 'Goods received with inspection'),
  n('purchase', 'purchase', '/purchase/packaging', 'Packaging List', PackageCheck, 'Inbound packing details'),
  n('purchase', 'purchase', '/purchase/invoices', 'Purchase Invoice', Receipt, 'Vendor bills and payables'),
  n('purchase', 'purchase', '/purchase/delivery', 'Delivery Notes', Truck, 'Inbound delivery tracking'),
  n('purchase', 'purchase', '/purchase/gate-pass', 'Gate Pass', FileCheck2, 'Material in authorisation'),
  n('purchase', 'purchase', '/purchase/returns', 'Purchase Return', Undo2, 'Goods sent back to vendors'),
  n('purchase', 'purchase', '/purchase/payments', 'Pay Payment', Banknote, 'Vendor payments'),
  n('purchase', 'purchase', '/purchase/tracking', 'Tracking', Navigation, 'Purchase document timeline'),
  n('purchase', 'purchase', '/purchase/report', 'Purchase Report', FileBarChart, 'Supplier, month and product analysis'),

  n('inventory', 'inventory', '/inventory/stock', 'Stock Availability', Boxes, 'Raw material, Redymat and finished stock'),
  n('inventory', 'inventory', '/inventory/movements', 'Stock In / Out', ArrowLeftRight, 'Manual adjustments and movements'),
  n('inventory', 'inventory', '/inventory/transfer', 'Stock Transfer', Repeat, 'Move stock between warehouses'),
  n('inventory', 'inventory', '/inventory/low-stock', 'Low Stock Alert', BellRing, 'Items below minimum level'),
  n('inventory', 'inventory', '/inventory/warehouses', 'Warehouses', Warehouse, 'Storage locations'),
  n('inventory', 'inventory', '/inventory/report', 'Inventory Report', PieChart, 'Valuation and stock health'),

  n('production', 'production', '/production/designs', 'Final Design', Scissors, 'Drawings, specs and revisions'),
  n('production', 'production', '/production/bom', 'Bill of Material (BOM)', ListChecks, 'Components per finished product'),
  n('production', 'production', '/production/custom', 'Custom Production', Wrench, 'Made-to-order work orders'),
  n('production', 'production', '/production/regular', 'Regular Production', Factory, 'Stock-building work orders'),
  n('production', 'production', '/production/job-work', 'Work Order / Job Work', Briefcase, 'Outsourced job work'),
  n('production', 'production', '/production/entry', 'Production Entry', FilePlus2, 'Log produced quantities'),
  n('production', 'production', '/production/report', 'Production Report', FileSpreadsheet, 'Output and material consumption'),

  n('accounts', 'accounts', '/accounts/ledgers', 'Ledger Master', BookOpen, 'Chart of accounts and balances'),
  n('accounts', 'accounts', '/accounts/ledger', 'Account Ledger', BookText, 'Statement for any account'),
  n('accounts', 'accounts', '/accounts/journal', 'General Entry', FilePlus2, 'Journal vouchers'),
  n('accounts', 'accounts', '/accounts/contra', 'Contra Entry', ArrowLeftRight, 'Cash / bank transfers'),
  n('accounts', 'accounts', '/accounts/notes', 'Debit / Credit Notes', ReceiptText, 'Adjustment notes'),
  n('accounts', 'accounts', '/accounts/expenses', 'Expense Payment (Approval)', Wallet, 'Expenses with approval'),
  n('accounts', 'accounts', '/accounts/expense-categories', 'Expense Master', Tags, 'Expense categories'),

  n('reports', 'reports', '/reports/day-book', 'Day Book', BookOpen, 'All vouchers by date'),
  n('reports', 'reports', '/reports/cash-book', 'Cash Book', Banknote, 'Cash account'),
  n('reports', 'reports', '/reports/bank-book', 'Bank Book', Landmark, 'Bank accounts'),
  n('reports', 'reports', '/reports/outstanding', 'Outstanding Report', Scale, 'Receivables & payables with ageing'),
  n('reports', 'reports', '/reports/trial-balance', 'Trial Balance', Scale, 'Debit and credit totals'),
  n('reports', 'reports', '/reports/profit-loss', 'Profit / Loss Statement', TrendingUp, 'Income and expense'),
  n('reports', 'reports', '/reports/balance-sheet', 'Balance Sheet', Landmark, 'Assets and liabilities'),
  n('reports', 'reports', '/reports/gst', 'GST Report', BadgeIndianRupee, 'Output, input and net GST'),
  n('reports', 'reports', '/reports/tds', 'TDS Report', Percent, 'Deductions on vendor payments'),
  n('reports', 'reports', '/reports/analyst', 'Report Analyst', PieChart, 'Charts and trends'),

  n('crm', 'crm', '/crm/complaints', 'CRM / Complaints', Headset, 'Customer complaints and service'),
  n('crm', 'crm', '/crm/amc', 'AMC / Services', CalendarCheck, 'Annual maintenance contracts'),

  n('hr', 'hr', '/hr/employees', 'Employee', Users, 'Employee master'),
  n('hr', 'hr', '/hr/attendance', 'Attendance', CalendarCheck, 'Daily attendance'),
  n('hr', 'hr', '/hr/leave', 'Leave Tracker', CalendarOff, 'Leave requests and approvals'),
  n('hr', 'hr', '/hr/payroll', 'Payroll', HandCoins, 'Monthly salary sheet'),

  n('logistics', 'logistics', '/logistics/dealers', 'Dealer', Handshake, 'Dealer network'),
  n('logistics', 'logistics', '/logistics/transport', 'Transport', Truck, 'Transporters and default charges'),
  n('logistics', 'logistics', '/logistics/couriers', 'Courier List', Package, 'Courier partners'),
  n('logistics', 'logistics', '/logistics/contacts', 'Customer Contact List', Contact, 'Unified contact directory'),
  n('logistics', 'logistics', '/logistics/map', 'Map Location', MapPin, 'Parties by state, district and city'),
  n('logistics', 'logistics', '/logistics/alerts', 'Communications Alert System', AlarmClock, 'Alert rules, queue and log'),

  n('admin', 'admin', '/admin/organizations', 'Company Profiles', Building, 'Organisations'),
  n('admin', 'admin', '/admin/users', 'User Assignments', UserCog, 'Users and their roles'),
  n('admin', 'admin', '/admin/roles', 'Roles & Permissions', KeyRound, 'Access matrix per module'),
  n('admin', 'admin', '/admin/activity', 'Activity Log', Activity, 'Audit trail'),
  n('admin', 'admin', '/admin/switch', 'Switch Profile', Lock, 'Change active company'),

  n('settings', 'settings', '/settings/config', 'ERP Configuration', Settings2, 'Financial year, currency and numbering'),
  n('settings', 'settings', '/settings/data', 'Backup & Data', DatabaseIcon, 'Export, import, reset and erase'),
  n('settings', 'settings', '/settings/recycle', 'Recycling', Recycle, 'Restore deleted records'),
  n('settings', 'settings', '/settings/sitemap', 'Sitemap', Archive, 'Every screen in one place'),
]

export function navItemFor(pathname: string): NavItem | undefined {
  const clean = pathname.replace(/\/+$/, '') || '/'
  return NAV_ITEMS.find((item) => item.to === clean)
}

/** Icons referenced by pages that are not in the nav. */
export const EXTRA_ICONS = { TrendingDown, Banknote, Store, Percent, Briefcase }
