export type ID = string

/* ------------------------------------------------------------------ */
/* Company & organisation                                              */
/* ------------------------------------------------------------------ */

export interface Company {
  name: string
  brand: string
  tagline: string
  owner: string
  gstin: string
  pan: string
  msme: string
  email: string
  mobile: string
  address1: string
  address2: string
  city: string
  taluka: string
  district: string
  state: string
  country: string
  pin: string
  website: string
  whatsapp: string
  facebook: string
  instagram: string
  linkedin: string
  youtube: string
  currency: string
  financialYearStart: string
}

export interface Organization {
  id: ID
  name: string
  gstin: string
  city: string
  state: string
  status: 'Active' | 'Inactive'
}

export interface Branch {
  id: ID
  code: string
  name: string
  contact: string
  address: string
  status: 'Open' | 'Closed'
}
export interface Department {
  id: ID
  branchId: ID
  name: string
}
export interface Designation {
  id: ID
  branchId: ID
  departmentId: ID
  name: string
  person: string
  contact: string
}

/* ------------------------------------------------------------------ */
/* Masters                                                             */
/* ------------------------------------------------------------------ */

export interface Category {
  id: ID
  name: string
  kind: 'Category' | 'Brand'
  description: string
}
export interface Unit {
  id: ID
  name: string
  alias: string
  printName: string
  category: 'Quantity' | 'Area' | 'Length' | 'Volume' | 'Mass' | 'Time' | 'Speed'
  status: 'Active' | 'Inactive'
}
export interface PackingUnit {
  id: ID
  name: string
  alias: string
  baseUnitId: ID
  qty: number
  description: string
  status: 'Active' | 'Inactive'
}
export interface PackingConversion {
  id: ID
  fromId: ID
  toId: ID
  factor: number
  description: string
  status: 'Active' | 'Inactive'
}
export interface GaugeEntry {
  id: ID
  gauge: string
  mm: number
  inch: number
  material: string
  shape: string
  description: string
  status: 'Active' | 'Inactive'
}
export interface Tax {
  id: ID
  name: string
  type: 'GST' | 'TCS' | 'TDS' | 'VAT'
  productType: 'Goods' | 'Services'
  location: 'Central' | 'State' | 'Inter-state'
  igst: number
  cgst: number
  sgst: number
  status: 'Active' | 'Inactive'
}
export interface Sundry {
  id: ID
  name: string
  group: 'General' | 'GST'
  sign: 'Add' | 'Subtract'
  mode: 'Percent' | 'Amount'
  value: number
  description: string
  status: 'Active' | 'Inactive'
}
export interface ItemGroup {
  id: ID
  name: string
  isPrimary: boolean
  parentId: ID
  description: string
}
export type ItemClass = 'Raw Material' | 'Redymat Part' | 'Finished Good' | 'Tractor'
export interface Item {
  id: ID
  code: string
  name: string
  groupId: ID
  categoryId: ID
  brandId: ID
  itemClass: ItemClass
  baseUnitId: ID
  saleUnitId: ID
  purchaseUnitId: ID
  packingUnitId: ID
  conversion: number
  taxId: ID
  hsn: string
  openingStock: number
  minStock: number
  maxStock: number
  purchaseRate: number
  sellingRate: number
  serialRequired: boolean
  description: string
  status: 'Active' | 'Inactive'
}
export interface AccountGroup {
  id: ID
  name: string
  isPrimary: boolean
  parentId: ID
  nature: 'Asset' | 'Liability' | 'Income' | 'Expense'
  description: string
}
export type PartyType = 'Customer' | 'Vendor' | 'Dealer'
export interface PartyDocument {
  type: string
  fileName: string
}
export interface Party {
  id: ID
  code: string
  type: PartyType
  name: string
  printName: string
  accountGroupId: ID
  category: string
  contactPerson: string
  phone: string
  phone2: string
  email: string
  fax: string
  gstin: string
  pan: string
  aadhar: string
  tin: string
  iec: string
  msme: string
  msmeType: string
  country: string
  state: string
  district: string
  city: string
  address: string
  pin: string
  bankName: string
  accountNo: string
  ifsc: string
  openingBalance: number
  balanceType: 'Dr' | 'Cr'
  creditDays: number
  status: 'Active' | 'Inactive'
  documents: PartyDocument[]
}
export interface Warehouse {
  id: ID
  name: string
}
export interface Transporter {
  id: ID
  name: string
  kind: 'Transport' | 'Courier'
  contact: string
  email: string
  address: string
  defaultCharge: number
}

/* ------------------------------------------------------------------ */
/* Documents (sales & purchase)                                        */
/* ------------------------------------------------------------------ */

export type DocKind =
  | 'salesQuotation'
  | 'salesOrder'
  | 'salesPacking'
  | 'salesInvoice'
  | 'deliveryNote'
  | 'gatePass'
  | 'salesReturn'
  | 'receipt'
  | 'purchaseQuotation'
  | 'purchaseOrder'
  | 'goodsReceipt'
  | 'purchasePacking'
  | 'purchaseInvoice'
  | 'purchaseDelivery'
  | 'purchaseGatePass'
  | 'purchaseReturn'
  | 'vendorPayment'

export interface DocLine {
  id: ID
  itemId: ID
  qty: number
  rate: number
  discountPct: number
  taxId: ID
  serials: string[]
  /* goods receipt */
  received: number
  accepted: number
  rejected: number
  /* delivery */
  delivered: number
  /* returns */
  condition: string
  reason: string
  remarks: string
}
export interface DocSundry {
  id: ID
  sundryId: ID
  name: string
  sign: 'Add' | 'Subtract'
  mode: 'Percent' | 'Amount'
  value: number
}
export interface Allocation {
  docId: ID
  amount: number
}
export interface Doc {
  id: ID
  kind: DocKind
  seriesId: ID
  no: string
  date: string
  partyId: ID
  refId: ID
  refNo: string
  reference: string
  dueDate: string
  validTill: string
  deliveryDate: string
  status: string
  gstType: 'Intra' | 'Inter'
  paymentTerms: string
  lines: DocLine[]
  sundries: DocSundry[]
  notes: string
  terms: string
  /* receipts & payments */
  method: string
  bankDetails: string
  amount: number
  tdsPct: number
  allocations: Allocation[]
  /* logistics */
  transporterId: ID
  vehicleNo: string
  trackingNo: string
  personCarrying: string
  receiverName: string
  receiverMobile: string
  deliveryAddress: string
  gateType: string
  purpose: string
  returnType: string
  reason: string
  dealerCode: string
  empCode: string
  createdAt: string
}

export interface DocSeries {
  id: ID
  kind: DocKind
  prefix: string
  next: number
  pad: number
}

/* ------------------------------------------------------------------ */
/* Inventory & production                                              */
/* ------------------------------------------------------------------ */

export type MoveType = 'Adjustment' | 'Transfer In' | 'Transfer Out' | 'Production In' | 'Production Out'
export interface StockMove {
  id: ID
  itemId: ID
  date: string
  qty: number
  type: MoveType
  warehouseId: ID
  note: string
  ref: string
}
export interface SerialNumber {
  id: ID
  itemId: ID
  serial: string
  dealerCode: string
  empCode: string
}
export interface Bom {
  id: ID
  productId: ID
  version: string
  components: Array<{ itemId: ID; qty: number }>
  notes: string
}
export interface Design {
  id: ID
  code: string
  name: string
  productId: ID
  revision: string
  status: 'Draft' | 'Approved' | 'Obsolete'
  fileName: string
  notes: string
  date: string
}
export interface WorkOrder {
  id: ID
  no: string
  type: 'Custom' | 'Regular' | 'Job Work'
  productId: ID
  bomId: ID
  qty: number
  produced: number
  customerId: ID
  vendorId: ID
  startDate: string
  dueDate: string
  status: 'Planned' | 'In Progress' | 'Completed' | 'Cancelled'
  notes: string
  entries: Array<{ id: ID; date: string; qty: number; note: string }>
}

/* ------------------------------------------------------------------ */
/* Accounts                                                            */
/* ------------------------------------------------------------------ */

export interface Ledger {
  id: ID
  name: string
  groupId: ID
  openingBalance: number
  balanceType: 'Dr' | 'Cr'
}
export type VoucherKind = 'Journal' | 'Contra' | 'Debit Note' | 'Credit Note'
export interface Voucher {
  id: ID
  kind: VoucherKind
  no: string
  date: string
  debitAcc: string
  creditAcc: string
  amount: number
  narration: string
}
export interface Expense {
  id: ID
  no: string
  date: string
  categoryId: ID
  accountName: string
  amount: number
  mode: 'Cash' | 'Bank' | 'UPI' | 'Credit' | 'Others'
  billName: string
  description: string
  status: 'Pending' | 'Approved' | 'Rejected'
}
export interface ExpenseCategory {
  id: ID
  name: string
}

/* ------------------------------------------------------------------ */
/* CRM / AMC / HR                                                      */
/* ------------------------------------------------------------------ */

export interface Complaint {
  id: ID
  no: string
  partyId: ID
  amcId: ID
  quotationId: ID
  subject: string
  description: string
  priority: 'Low' | 'Medium' | 'High'
  status: 'Open' | 'In Progress' | 'Resolved' | 'Closed'
  createdAt: string
}
export interface Amc {
  id: ID
  contractNo: string
  partyId: ID
  start: string
  end: string
  amount: number
  status: 'Active' | 'Expired' | 'Cancelled'
  remarks: string
  services: Array<{ id: ID; date: string; notes: string }>
}
export interface Employee {
  id: ID
  code: string
  name: string
  branchId: ID
  departmentId: ID
  designationId: ID
  phone: string
  email: string
  joinDate: string
  salary: number
  status: 'Active' | 'Inactive'
}
export interface Attendance {
  id: ID
  date: string
  employeeId: ID
  status: 'Present' | 'Absent' | 'Half Day' | 'Leave'
  inTime: string
  outTime: string
}
export interface Leave {
  id: ID
  employeeId: ID
  from: string
  to: string
  type: 'Casual' | 'Sick' | 'Earned' | 'Unpaid'
  status: 'Pending' | 'Approved' | 'Rejected'
  reason: string
}

/* ------------------------------------------------------------------ */
/* Admin                                                               */
/* ------------------------------------------------------------------ */

export type Access = 'none' | 'view' | 'edit'
export interface Role {
  id: ID
  name: string
  description: string
  access: Record<string, Access>
}
export interface User {
  id: ID
  username: string
  password: string
  name: string
  roleId: ID
  email: string
  status: 'Active' | 'Disabled'
  orgId: ID
}
export interface ActivityEntry {
  id: ID
  at: string
  user: string
  action: 'Created' | 'Updated' | 'Deleted' | 'Restored' | 'Login' | 'Logout' | 'System'
  entity: string
  detail: string
}
export interface TrashEntry {
  id: ID
  collection: string
  label: string
  deletedAt: string
  deletedBy: string
  record: Record<string, unknown>
}
export interface AlertRule {
  id: ID
  name: string
  trigger: 'Low stock' | 'Overdue invoice' | 'Quotation expiring' | 'AMC expiring' | 'Payment received'
  channel: 'Email' | 'SMS' | 'WhatsApp'
  enabled: boolean
  threshold: number
}
export interface AlertLog {
  id: ID
  at: string
  rule: string
  channel: string
  to: string
  message: string
}
export interface TermsEntry {
  id: ID
  kind: DocKind
  text: string
}
export interface PrintSetup {
  copies: number
  copyLabels: string[]
  headerTitle: string
  showLogo: boolean
  showSignature: boolean
  footerNote: string
}

/* ------------------------------------------------------------------ */
/* Database                                                            */
/* ------------------------------------------------------------------ */

export interface Database {
  version: number
  seededAt: string
  company: Company
  printSetup: PrintSetup
  organizations: Organization[]
  branches: Branch[]
  departments: Department[]
  designations: Designation[]
  categories: Category[]
  units: Unit[]
  packingUnits: PackingUnit[]
  packingConversions: PackingConversion[]
  gauges: GaugeEntry[]
  taxes: Tax[]
  sundries: Sundry[]
  itemGroups: ItemGroup[]
  items: Item[]
  accountGroups: AccountGroup[]
  parties: Party[]
  warehouses: Warehouse[]
  transporters: Transporter[]
  docs: Doc[]
  series: DocSeries[]
  terms: TermsEntry[]
  stockMoves: StockMove[]
  serials: SerialNumber[]
  boms: Bom[]
  designs: Design[]
  workOrders: WorkOrder[]
  ledgers: Ledger[]
  vouchers: Voucher[]
  expenseCategories: ExpenseCategory[]
  expenses: Expense[]
  complaints: Complaint[]
  amcs: Amc[]
  employees: Employee[]
  attendance: Attendance[]
  leaves: Leave[]
  roles: Role[]
  users: User[]
  activity: ActivityEntry[]
  trash: TrashEntry[]
  alertRules: AlertRule[]
  alertLogs: AlertLog[]
}

/** Collections whose rows are plain `{ id }` records (everything but singletons). */
export type CollectionKey = {
  [K in keyof Database]: Database[K] extends Array<{ id: string }> ? K : never
}[keyof Database]
