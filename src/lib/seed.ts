import type {
  AccountGroup, Allocation, Amc, Attendance, Bom, Branch, Category, Complaint, Database, Department, Designation, Design,
  Doc, DocKind, DocLine, Employee, Expense, GaugeEntry, Item, ItemClass, ItemGroup, Ledger, Leave, Organization, PackingConversion,
  PackingUnit, Party, PartyType, Role, SerialNumber, StockMove, Sundry, Tax, Transporter, Unit, User, Voucher, WorkOrder, Access,
} from '@/types'
import { DOC_KINDS, DOC_META } from '@/lib/docConfig'
import { blankDoc, blankLine, lineFromItem, sundryFrom, takeDocNo } from '@/lib/docs'
import { addDaysISO, todayISO } from '@/lib/utils'

export const DB_VERSION = 1

/** Access groups used by roles and the sidebar. */
export const ACCESS_GROUPS: Array<{ id: string; label: string }> = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'company', label: 'Company Profile' },
  { id: 'masters', label: 'Master Setup' },
  { id: 'sales', label: 'Sales' },
  { id: 'purchase', label: 'Purchase' },
  { id: 'inventory', label: 'Inventory' },
  { id: 'production', label: 'Production' },
  { id: 'accounts', label: 'Full Account' },
  { id: 'crm', label: 'CRM & AMC' },
  { id: 'hr', label: 'HR / Payroll' },
  { id: 'logistics', label: 'Dealer, Transport & Contacts' },
  { id: 'reports', label: 'Reports & Analyst' },
  { id: 'admin', label: 'Admin / Security' },
  { id: 'settings', label: 'Settings' },
]

/* deterministic pseudo-random so every fresh install looks the same */
function rng(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function createSeedDatabase(): Database {
  const rand = rng(20260)
  const pick = <T,>(list: T[]): T => list[Math.floor(rand() * list.length)]
  const today = todayISO()
  const ago = (days: number) => addDaysISO(today, -days)
  const fwd = (days: number) => addDaysISO(today, days)
  let seq = 0
  const nid = (p: string) => `${p}${++seq}`
  const iso = (days: number) => `${ago(days)}T10:30:00.000Z`

  /* -------------------------------- company -------------------------------- */
  const company: Database['company'] = {
    name: 'Ganga Agro Machinery Pvt. Ltd.', brand: 'Ganga', tagline: 'Tractors · Implements · Genuine Spares',
    owner: 'Hasmukh Patel', gstin: '24AABCG1234F1Z5', pan: 'AABCG1234F', msme: 'UDYAM-GJ-24-0012345',
    email: 'accounts@gangaagro.example', mobile: '+91 98250 12345', address1: 'Plot 14, GIDC Industrial Estate', address2: 'Gondal Road',
    city: 'Rajkot', taluka: 'Rajkot', district: 'Rajkot', state: 'Gujarat', country: 'India', pin: '360004',
    website: 'www.gangaagro.example', whatsapp: '+91 98250 12345', facebook: '', instagram: '', linkedin: '', youtube: '',
    currency: 'INR', financialYearStart: `${new Date().getMonth() >= 3 ? new Date().getFullYear() : new Date().getFullYear() - 1}-04-01`,
  }

  const organizations: Organization[] = [
    { id: 'org1', name: 'Ganga Agro Machinery Pvt. Ltd.', gstin: '24AABCG1234F1Z5', city: 'Rajkot', state: 'Gujarat', status: 'Active' },
    { id: 'org2', name: 'Ganga Spares & Services', gstin: '24AABCG5678K1Z2', city: 'Jasdan', state: 'Gujarat', status: 'Active' },
  ]

  /* -------------------------------- branches -------------------------------- */
  const branches: Branch[] = [
    { id: 'br1', code: 'BR01', name: 'Rajkot Head Office', contact: '+91 281 2345678', address: 'GIDC Industrial Estate, Rajkot', status: 'Open' },
    { id: 'br2', code: 'BR02', name: 'Jasdan Works', contact: '+91 2821 223344', address: 'Bhadla Road, Jasdan', status: 'Open' },
    { id: 'br3', code: 'BR03', name: 'Morbi Depot', contact: '+91 2822 334455', address: 'Highway Chokdi, Morbi', status: 'Open' },
    { id: 'br4', code: 'BR04', name: 'Ahmedabad Sales Office', contact: '+91 79 40012345', address: 'SG Highway, Ahmedabad', status: 'Closed' },
  ]
  const departments: Department[] = [
    { id: 'dp1', branchId: 'br1', name: 'Sales & Marketing' }, { id: 'dp2', branchId: 'br1', name: 'Purchase' },
    { id: 'dp3', branchId: 'br1', name: 'Stores & Inventory' }, { id: 'dp4', branchId: 'br2', name: 'Production' },
    { id: 'dp5', branchId: 'br1', name: 'Accounts & Finance' }, { id: 'dp6', branchId: 'br1', name: 'Human Resources' },
    { id: 'dp7', branchId: 'br3', name: 'Service & Spares' },
  ]
  const designations: Designation[] = [
    { id: 'ds1', branchId: 'br1', departmentId: 'dp1', name: 'Sales Manager', person: 'Priya Shah', contact: '+91 98250 11001' },
    { id: 'ds2', branchId: 'br1', departmentId: 'dp2', name: 'Purchase Officer', person: 'Kunal Mehta', contact: '+91 98250 11002' },
    { id: 'ds3', branchId: 'br1', departmentId: 'dp3', name: 'Store Keeper', person: 'Rajesh Solanki', contact: '+91 98250 11003' },
    { id: 'ds4', branchId: 'br2', departmentId: 'dp4', name: 'Production Supervisor', person: 'Dinesh Vaghela', contact: '+91 98250 11004' },
    { id: 'ds5', branchId: 'br1', departmentId: 'dp5', name: 'Accountant', person: 'Nirali Joshi', contact: '+91 98250 11005' },
    { id: 'ds6', branchId: 'br1', departmentId: 'dp6', name: 'HR Executive', person: 'Meera Pandya', contact: '+91 98250 11006' },
    { id: 'ds7', branchId: 'br3', departmentId: 'dp7', name: 'Service Engineer', person: 'Bharat Chauhan', contact: '+91 98250 11007' },
  ]

  /* ---------------------------------- masters --------------------------------- */
  const cat = (name: string, kind: Category['kind'], description = ''): Category => ({ id: nid('cat'), name, kind, description })
  const categories: Category[] = [
    cat('Engine Parts', 'Category', 'Pistons, rings, injectors, gaskets'), cat('Hydraulics', 'Category', 'Pumps, cylinders, seal kits'),
    cat('Transmission', 'Category', 'Clutch, gearbox, shafts'), cat('Electrical', 'Category', 'Alternators, starters, lamps'),
    cat('Brakes & Steering', 'Category', 'Brake pads, steering cylinders'), cat('Filters', 'Category', 'Air, oil and fuel filters'),
    cat('Tractors', 'Category', 'Complete tractors'), cat('Implements', 'Category', 'Rotavators, cultivators, trolleys'),
    cat('Raw Material', 'Category', 'Steel, brass, aluminium, consumables'), cat('Bearings & Fasteners', 'Category', 'Bearings, sprockets, bolts'),
    cat('Fenner', 'Brand'), cat('Bosch', 'Brand'), cat('Mahindra', 'Brand'), cat('Swaraj', 'Brand'), cat('Sonalika', 'Brand'),
    cat('SKF', 'Brand'), cat('Gabriel', 'Brand'), cat('Exide', 'Brand'), cat('John Deere', 'Brand'), cat('Eicher', 'Brand'),
    cat('Kubota', 'Brand'), cat('Ganga', 'Brand', 'In-house manufactured'), cat('Local Make', 'Brand'),
  ]
  const catId = (n: string) => categories.find((c) => c.name === n)!.id

  const unit = (name: string, alias: string, category: Unit['category']): Unit => ({ id: nid('un'), name, alias, printName: alias, category, status: 'Active' })
  const units: Unit[] = [
    unit('Pieces', 'PCS', 'Quantity'), unit('Set', 'SET', 'Quantity'), unit('Box', 'BOX', 'Quantity'), unit('Kilogram', 'KG', 'Mass'),
    unit('Tonne', 'TON', 'Mass'), unit('Gram', 'GM', 'Mass'), unit('Metre', 'MTR', 'Length'), unit('Centimeter', 'CM', 'Length'),
    unit('Foot', 'FT', 'Length'), unit('Inch', 'IN', 'Length'), unit('Litre', 'LTR', 'Volume'), unit('Cubic Metre', 'CUM', 'Volume'),
    unit('Acre', 'ACRE', 'Area'), unit('Hectare', 'HA', 'Area'), unit('Square Foot', 'SQFT', 'Area'), unit('Hour', 'HR', 'Time'),
    unit('Day', 'DAY', 'Time'), unit('Kilometre/Hour', 'KMPH', 'Speed'),
  ]
  const unitId = (alias: string) => units.find((u) => u.alias === alias)!.id

  const packingUnits: PackingUnit[] = [
    { id: 'pk1', name: 'Carton', alias: 'CTN', baseUnitId: unitId('PCS'), qty: 12, description: 'Standard spare-part carton', status: 'Active' },
    { id: 'pk2', name: 'Pallet', alias: 'PLT', baseUnitId: unitId('PCS'), qty: 240, description: 'Wooden pallet of cartons', status: 'Active' },
    { id: 'pk3', name: 'Bundle', alias: 'BDL', baseUnitId: unitId('KG'), qty: 25, description: 'Steel bar bundle', status: 'Active' },
    { id: 'pk4', name: 'Trolly', alias: 'TRL', baseUnitId: unitId('PCS'), qty: 1, description: 'Single trolley pack', status: 'Active' },
  ]
  const packingConversions: PackingConversion[] = [
    { id: 'pc1', fromId: 'pk2', toId: 'pk1', factor: 20, description: '1 Pallet = 20 Cartons', status: 'Active' },
    { id: 'pc2', fromId: 'pk1', toId: 'pk4', factor: 12, description: 'Carton to single packs', status: 'Active' },
  ]
  const gauges: GaugeEntry[] = [
    ['SWG 10', 3.25, 0.128, 'MS', 'Sheet'], ['SWG 12', 2.64, 0.104, 'MS', 'Sheet'], ['SWG 14', 2.03, 0.08, 'MS', 'Sheet'],
    ['SWG 16', 1.63, 0.064, 'GI', 'Sheet'], ['SWG 18', 1.22, 0.048, 'GI', 'Sheet'], ['SWG 20', 0.91, 0.036, 'GP', 'Sheet'],
    ['A - 2.00', 3.18, 0.125, 'ALU', 'Angle'], ['Dia 25', 25, 0.984, 'MS', 'Round-Bar'], ['Dia 12', 12, 0.472, 'BRASS', 'Round-Bar'],
    ['40x40x5', 40, 1.575, 'MS', 'Square-Tube'],
  ].map(([gauge, mm, inch, material, shape]) => ({
    id: nid('gg'), gauge: String(gauge), mm: Number(mm), inch: Number(inch), material: String(material), shape: String(shape),
    description: `${gauge} gauge to millimetre`, status: 'Active' as const,
  }))

  const tax = (name: string, type: Tax['type'], productType: Tax['productType'], rate: number, status: Tax['status'] = 'Active'): Tax =>
    type === 'GST'
      ? { id: nid('tx'), name, type, productType, location: 'Central', igst: rate, cgst: rate / 2, sgst: rate / 2, status }
      : { id: nid('tx'), name, type, productType, location: 'Central', igst: rate, cgst: 0, sgst: 0, status }
  const taxes: Tax[] = [
    tax('GST 5%', 'GST', 'Goods', 5), tax('GST 12%', 'GST', 'Goods', 12), tax('GST 18%', 'GST', 'Goods', 18), tax('GST 28%', 'GST', 'Goods', 28),
    tax('GST 18% (Services)', 'GST', 'Services', 18), tax('TCS 0.1%', 'TCS', 'Goods', 0.1), tax('TDS 194C 1%', 'TDS', 'Services', 1),
    tax('TDS 194C 2%', 'TDS', 'Services', 2), tax('TDS 194Q 0.1%', 'TDS', 'Goods', 0.1), tax('VAT 14.5% (On hold)', 'VAT', 'Goods', 14.5, 'Inactive'),
  ]
  const taxId = (n: string) => taxes.find((t) => t.name === n)!.id

  const sdy = (name: string, group: Sundry['group'], sign: Sundry['sign'], mode: Sundry['mode'], value: number, description = ''): Sundry => ({
    id: nid('sd'), name, group, sign, mode, value, description, status: 'Active',
  })
  const sundries: Sundry[] = [
    sdy('Packing Charges', 'General', 'Add', 'Amount', 500, 'Per document packing'), sdy('Freight', 'General', 'Add', 'Amount', 1500, 'Outward freight'),
    sdy('Installation Charge', 'General', 'Add', 'Amount', 2500, 'On-site fitment'), sdy('Cash Discount', 'General', 'Subtract', 'Percent', 2, 'Prompt-payment discount'),
    sdy('Insurance', 'General', 'Add', 'Percent', 0.5, 'Transit insurance'), sdy('TCS 0.1%', 'GST', 'Add', 'Percent', 0.1, 'Tax collected at source'),
    sdy('Trade Discount', 'General', 'Subtract', 'Amount', 1000, 'Flat trade discount'),
  ]

  const itemGroups: ItemGroup[] = [
    { id: 'ig1', name: 'Tractors', isPrimary: true, parentId: '', description: 'Complete tractors' },
    { id: 'ig2', name: 'Spare Parts', isPrimary: true, parentId: '', description: 'Genuine and aftermarket spares' },
    { id: 'ig3', name: 'Raw Materials', isPrimary: true, parentId: '', description: 'Fabrication inputs' },
    { id: 'ig4', name: 'Implements', isPrimary: true, parentId: '', description: 'Tractor-mounted implements' },
    { id: 'ig5', name: 'Engine Spares', isPrimary: false, parentId: 'ig2', description: '' },
    { id: 'ig6', name: 'Hydraulic Spares', isPrimary: false, parentId: 'ig2', description: '' },
  ]

  /* code, name, group, category, brand, class, unit, tax, hsn, opening, min, max, purchase, sell, serial */
  type ItemRow = [string, string, string, string, string, ItemClass, string, string, string, number, number, number, number, number, boolean]
  const itemRows: ItemRow[] = [
    ['TR-575', 'Mahindra 575 DI Tractor', 'ig1', 'Tractors', 'Mahindra', 'Tractor', 'PCS', 'GST 12%', '8701', 8, 2, 20, 545000, 624000, true],
    ['TR-744', 'Swaraj 744 FE Tractor', 'ig1', 'Tractors', 'Swaraj', 'Tractor', 'PCS', 'GST 12%', '8701', 6, 2, 15, 575000, 655200, true],
    ['TR-750', 'Sonalika DI 750 III Tractor', 'ig1', 'Tractors', 'Sonalika', 'Tractor', 'PCS', 'GST 12%', '8701', 5, 2, 12, 560000, 640000, true],
    ['TR-5105', 'John Deere 5105 Tractor', 'ig1', 'Tractors', 'John Deere', 'Tractor', 'PCS', 'GST 12%', '8701', 3, 1, 8, 690000, 785000, true],
    ['TR-380', 'Eicher 380 Tractor', 'ig1', 'Tractors', 'Eicher', 'Tractor', 'PCS', 'GST 12%', '8701', 1, 2, 8, 470000, 538000, true],
    ['EN-AF1', 'Air Filter Primary', 'ig5', 'Filters', 'Bosch', 'Redymat Part', 'PCS', 'GST 18%', '8421', 120, 30, 400, 640, 820, false],
    ['EN-OF1', 'Oil Filter Spin-on', 'ig5', 'Filters', 'Bosch', 'Redymat Part', 'PCS', 'GST 18%', '8421', 150, 40, 500, 210, 295, false],
    ['EN-FF1', 'Fuel Filter Element', 'ig5', 'Filters', 'Bosch', 'Redymat Part', 'PCS', 'GST 18%', '8421', 90, 30, 300, 180, 255, false],
    ['EN-PR1', 'Piston Ring Set', 'ig5', 'Engine Parts', 'Mahindra', 'Redymat Part', 'SET', 'GST 28%', '8409', 40, 15, 120, 1450, 1980, false],
    ['EN-FI1', 'Fuel Injector Nozzle', 'ig5', 'Engine Parts', 'Bosch', 'Redymat Part', 'PCS', 'GST 28%', '8409', 14, 15, 80, 1850, 2490, false],
    ['EN-FB1', 'Fan Belt Heavy Duty', 'ig5', 'Engine Parts', 'Fenner', 'Redymat Part', 'PCS', 'GST 18%', '4010', 100, 25, 300, 280, 420, false],
    ['EN-RD1', 'Radiator Assembly', 'ig5', 'Engine Parts', 'Local Make', 'Redymat Part', 'PCS', 'GST 28%', '8708', 12, 6, 40, 6200, 8450, false],
    ['HY-SK1', 'Hydraulic Seal Kit', 'ig6', 'Hydraulics', 'Local Make', 'Redymat Part', 'SET', 'GST 18%', '4016', 8, 10, 60, 780, 1150, false],
    ['HY-PU1', 'Hydraulic Pump Assembly', 'ig6', 'Hydraulics', 'Mahindra', 'Redymat Part', 'PCS', 'GST 28%', '8413', 9, 4, 25, 11800, 15900, false],
    ['TM-CP1', 'Clutch Plate 11 inch', 'ig2', 'Transmission', 'Mahindra', 'Redymat Part', 'PCS', 'GST 28%', '8708', 30, 10, 100, 2150, 2890, false],
    ['TM-GS1', 'Gear Box Shaft', 'ig2', 'Transmission', 'Swaraj', 'Redymat Part', 'PCS', 'GST 28%', '8708', 16, 6, 50, 3400, 4650, false],
    ['EL-AL1', 'Alternator 12V Tractor', 'ig2', 'Electrical', 'Bosch', 'Redymat Part', 'PCS', 'GST 18%', '8511', 22, 8, 60, 2650, 3550, false],
    ['EL-SM1', 'Starter Motor 12V', 'ig2', 'Electrical', 'Bosch', 'Redymat Part', 'PCS', 'GST 18%', '8511', 18, 8, 50, 3100, 4180, false],
    ['EL-BT1', 'Battery 12V 88Ah', 'ig2', 'Electrical', 'Exide', 'Redymat Part', 'PCS', 'GST 28%', '8507', 11, 6, 40, 6900, 8800, false],
    ['BR-BP1', 'Brake Pad Set', 'ig2', 'Brakes & Steering', 'Local Make', 'Redymat Part', 'SET', 'GST 18%', '8708', 45, 15, 150, 520, 760, false],
    ['BR-SC1', 'Steering Cylinder', 'ig2', 'Brakes & Steering', 'Gabriel', 'Redymat Part', 'PCS', 'GST 28%', '8708', 10, 5, 30, 4300, 5890, false],
    ['BF-B62', 'Bearing 6208 ZZ', 'ig2', 'Bearings & Fasteners', 'SKF', 'Redymat Part', 'PCS', 'GST 18%', '8482', 200, 50, 600, 145, 220, false],
    ['BF-B63', 'Bearing 6310 ZZ', 'ig2', 'Bearings & Fasteners', 'SKF', 'Redymat Part', 'PCS', 'GST 18%', '8482', 160, 50, 500, 260, 380, false],
    ['BF-CS1', 'Chain Sprocket Set', 'ig2', 'Bearings & Fasteners', 'Local Make', 'Redymat Part', 'SET', 'GST 18%', '7315', 35, 12, 120, 880, 1290, false],
    ['RM-MS2', 'MS Sheet 2mm', 'ig3', 'Raw Material', 'Local Make', 'Raw Material', 'KG', 'GST 18%', '7208', 1800, 500, 5000, 62, 0, false],
    ['RM-RB25', 'MS Round Bar 25mm', 'ig3', 'Raw Material', 'Local Make', 'Raw Material', 'KG', 'GST 18%', '7228', 1400, 400, 4000, 66, 0, false],
    ['RM-BR12', 'Brass Rod 12mm', 'ig3', 'Raw Material', 'Local Make', 'Raw Material', 'KG', 'GST 18%', '7407', 60, 40, 300, 540, 0, false],
    ['RM-WR1', 'Welding Rod 3.15mm', 'ig3', 'Raw Material', 'Local Make', 'Raw Material', 'BOX', 'GST 18%', '8311', 80, 30, 250, 410, 0, false],
    ['RM-PN1', 'Industrial Paint (Red)', 'ig3', 'Raw Material', 'Local Make', 'Raw Material', 'LTR', 'GST 18%', '3208', 150, 60, 400, 310, 0, false],
    ['IM-RT6', 'Rotavator 6 ft', 'ig4', 'Implements', 'Ganga', 'Finished Good', 'PCS', 'GST 12%', '8432', 4, 3, 15, 74000, 96500, false],
    ['IM-CV9', 'Cultivator 9 Tyne', 'ig4', 'Implements', 'Ganga', 'Finished Good', 'PCS', 'GST 12%', '8432', 6, 3, 18, 21500, 28900, false],
    ['IM-TR2', 'Trolley 2 Wheel', 'ig4', 'Implements', 'Ganga', 'Finished Good', 'PCS', 'GST 12%', '8716', 3, 3, 12, 58000, 76500, false],
    ['IM-DH1', 'Disc Harrow 14 Disc', 'ig4', 'Implements', 'Ganga', 'Finished Good', 'PCS', 'GST 12%', '8432', 5, 2, 10, 46000, 62000, false],
  ]
  const items: Item[] = itemRows.map(([code, name, group, category, brand, itemClass, u, tx, hsn, opening, min, max, buy, sell, serial]) => ({
    id: `it_${code.toLowerCase()}`, code, name, groupId: group, categoryId: catId(category), brandId: catId(brand), itemClass,
    baseUnitId: unitId(u), saleUnitId: unitId(u), purchaseUnitId: unitId(u), packingUnitId: 'pk1', conversion: 1, taxId: taxId(tx), hsn,
    openingStock: opening, minStock: min, maxStock: max, purchaseRate: buy, sellingRate: sell, serialRequired: serial, description: '', status: 'Active',
  }))
  const itemBy = (code: string) => items.find((i) => i.code === code)!

  const accountGroups: AccountGroup[] = [
    ['ag1', 'Sundry Debtors', true, '', 'Asset'], ['ag2', 'Sundry Creditors', true, '', 'Liability'], ['ag3', 'Bank Accounts', true, '', 'Asset'],
    ['ag4', 'Cash-in-hand', true, '', 'Asset'], ['ag5', 'Capital Account', true, '', 'Liability'], ['ag6', 'Loans (Liability)', true, '', 'Liability'],
    ['ag7', 'Fixed Assets', true, '', 'Asset'], ['ag8', 'Duties & Taxes', true, '', 'Liability'], ['ag9', 'Direct Expenses', true, '', 'Expense'],
    ['ag10', 'Indirect Expenses', true, '', 'Expense'], ['ag11', 'Sales Accounts', true, '', 'Income'], ['ag12', 'Bank O/D Account', false, 'ag6', 'Liability'],
  ].map(([id, name, isPrimary, parentId, nature]) => ({ id: String(id), name: String(name), isPrimary: Boolean(isPrimary), parentId: String(parentId), nature: nature as AccountGroup['nature'], description: '' }))

  /* ---------------------------------- parties --------------------------------- */
  const cities: Array<[string, string]> = [['Rajkot', 'Rajkot'], ['Jasdan', 'Rajkot'], ['Gondal', 'Rajkot'], ['Morbi', 'Morbi'], ['Junagadh', 'Junagadh'], ['Amreli', 'Amreli'], ['Surendranagar', 'Surendranagar'], ['Jamnagar', 'Jamnagar']]
  let phoneSeed = 9825000100
  const mkParty = (type: PartyType, code: string, name: string, extra: Partial<Party> = {}): Party => {
    const [city, district] = cities[seq % cities.length]
    phoneSeed += 37
    return {
      id: nid('pt'), code, type, name, printName: name, accountGroupId: type === 'Vendor' ? 'ag2' : 'ag1', category: type === 'Customer' ? 'Registered person' : type === 'Vendor' ? 'Manufacturer' : 'Dealer',
      contactPerson: name.split(' ')[0], phone: `+91 ${phoneSeed}`, phone2: '', email: `${name.split(' ')[0].toLowerCase()}@mail.example`, fax: '',
      gstin: type === 'Customer' && rand() > 0.5 ? '' : `24AA${Math.floor(1000 + rand() * 8999)}C1Z${Math.floor(rand() * 9)}`, pan: '', aadhar: '', tin: '', iec: '', msme: '', msmeType: '',
      country: 'India', state: 'Gujarat', district, city, address: `${Math.floor(rand() * 90 + 1)}, Main Road, ${city}`, pin: '360001',
      bankName: type === 'Customer' ? '' : 'Bank of Baroda', accountNo: type === 'Customer' ? '' : String(Math.floor(1e11 + rand() * 9e11)), ifsc: type === 'Customer' ? '' : 'BARB0RAJKOT',
      openingBalance: 0, balanceType: 'Dr', creditDays: type === 'Vendor' ? 30 : 30, status: 'Active', documents: [], ...extra,
    }
  }
  const customerNames = [
    'Rameshbhai Jivabhai Patel', 'Arjanbhai Valjibhai Bharwad', 'Krishna Tractor House', 'Bharat Krushi Equipment', 'Radhe Farm Machinery Dealer',
    'Kalubhai Hirabhai Thakor', 'Manubhai Dahyabhai Patel', 'Prakashbhai Vallabhbhai Patel', 'Bhavani Krushi Yantra', 'Saurashtra Farm Equipment',
    'Umiya Agro Machinery', 'Shiv Shakti Thresher Sales', 'Maa Khodiyar Tractor Spares', 'Jay Ambe Agro Implements',
  ]
  const customers = customerNames.map((n, i) => mkParty('Customer', `C${String(i + 1).padStart(3, '0')}`, n, i === 3 ? { openingBalance: 42000 } : {}))
  const vendors = ['Azalia Components Pvt Ltd', 'Shree Ganesh Auto Spares', 'Rajkot Steel Traders', 'Fenner India Distributors', 'Bosch Agri Parts Depot'].map((n, i) =>
    mkParty('Vendor', `V${String(i + 1).padStart(3, '0')}`, n, { category: pick(['Manufacturer', 'Distributor', 'Wholesaler']), openingBalance: i === 2 ? 65000 : 0, balanceType: 'Cr' }),
  )
  const dealers = ['GI Dealers Jasdan', 'Patel Agro Dealers', 'Sardar Farm Mart', 'Dwarkadhish Tractors', 'Kisan Seva Kendra'].map((n, i) => mkParty('Dealer', `D${String(i + 1).padStart(3, '0')}`, n, { category: 'Dealer' }))
  const parties: Party[] = [...customers, ...vendors, ...dealers]

  const warehouses = [{ id: 'wh1', name: 'Main Warehouse' }, { id: 'wh2', name: 'Shop Floor' }, { id: 'wh3', name: 'Morbi Depot Godown' }]
  const mkTr = (name: string, kind: Transporter['kind'], charge: number): Transporter => ({ id: nid('tp'), name, kind, contact: `+91 ${98240 + seq}${10000 + seq * 7}`, email: '', address: 'Rajkot', defaultCharge: charge })
  const transporters: Transporter[] = [
    mkTr('Krishna Implement Logistics', 'Transport', 5000), mkTr('Bajrang Rural Transport Service', 'Transport', 4200), mkTr('Chamunda Heavy Machinery Movers', 'Transport', 7500),
    mkTr('Gujarat Agro Machinery Transport', 'Transport', 6000), mkTr('Kisan Agro Delivery Carrier', 'Courier', 800), mkTr('Safe Express Courier', 'Courier', 450),
  ]

  /* --------------------------------- series & terms --------------------------------- */
  const series: Database['series'] = []
  for (const kind of DOC_KINDS) {
    DOC_META[kind].series.forEach((s) => series.push({ id: nid('sr'), kind, prefix: s.prefix, next: 1, pad: s.pad }))
  }
  const termsText: Partial<Record<DocKind, string>> = {
    salesQuotation: '1. Prices are ex-works Rajkot.\n2. Quotation valid for the period stated.\n3. Delivery within 10 working days of confirmed order.\n4. Subject to Rajkot jurisdiction.',
    salesOrder: '1. Advance of 25% required on order confirmation.\n2. Delivery date is tentative and subject to availability.',
    salesInvoice: '1. Goods once sold will not be taken back except under warranty.\n2. Interest @ 18% p.a. on overdue payments.\n3. Warranty as per manufacturer policy.',
    purchaseOrder: '1. Supply as per approved samples.\n2. Rejected goods will be returned at supplier cost.',
    purchaseInvoice: '1. Payment as per agreed credit terms.\n2. GST input credit subject to supplier filing.',
  }
  const terms = DOC_KINDS.map((kind) => ({ id: nid('tm'), kind, text: termsText[kind] ?? '' }))

  /* ------------------------------------ build DB shell ------------------------------------ */
  const db: Database = {
    version: DB_VERSION, seededAt: new Date().toISOString(), company,
    printSetup: { copies: 2, copyLabels: ['Original for Recipient', 'Duplicate for Transporter', 'Triplicate for Supplier'], headerTitle: 'TAX INVOICE', showLogo: true, showSignature: true, footerNote: 'This is a computer generated document.' },
    organizations, branches, departments, designations, categories, units, packingUnits, packingConversions, gauges, taxes, sundries, itemGroups, items,
    accountGroups, parties, warehouses, transporters, docs: [], series, terms, stockMoves: [], serials: [], boms: [], designs: [], workOrders: [],
    ledgers: [], vouchers: [], expenseCategories: [], expenses: [], complaints: [], amcs: [], employees: [], attendance: [], leaves: [],
    roles: [], users: [], activity: [], trash: [], alertRules: [], alertLogs: [],
  }
  const seriesOf = (kind: DocKind, idx = 0) => db.series.filter((s) => s.kind === kind)[idx]

  /* serial numbers for tractors */
  const serialPool = new Map<string, string[]>()
  items.filter((i) => i.serialRequired).forEach((item) => {
    const prefix = item.code.replace('TR-', '') + '26'
    const list: string[] = []
    for (let n = 1; n <= 14; n++) {
      const serial = `${prefix}-${String(n).padStart(4, '0')}`
      list.push(serial)
      db.serials.push({ id: nid('sn'), itemId: item.id, serial, dealerCode: n % 2 ? 'D001' : 'D002', empCode: 'E001' } as SerialNumber)
    }
    serialPool.set(item.id, list)
  })

  /* document builder */
  const taken = new Map<string, number>()
  const line = (code: string, qty: number, over: Partial<DocLine> = {}, kind: DocKind = 'salesInvoice'): DocLine => ({ ...lineFromItem(itemBy(code), kind, qty), ...over })
  const mk = (kind: DocKind, daysAgo: number, partyId: string, lines: DocLine[], over: Partial<Doc> = {}): Doc => {
    const meta = DOC_META[kind]
    const sr = seriesOf(kind, 0)
    const doc = blankDoc(kind, sr.id, takeDocNo(db, sr.id))
    doc.date = ago(daysAgo)
    doc.partyId = partyId
    doc.lines = lines
    doc.createdAt = iso(daysAgo)
    doc.terms = terms.find((t) => t.kind === kind)?.text ?? ''
    if (meta.extraDate) {
      const key = meta.extraDate.key
      doc[key] = addDaysISO(doc.date, meta.extraDate.offsetDays)
    }
    Object.assign(doc, over)
    db.docs.push(doc)
    return doc
  }
  /** Take N unsold serials of a tractor. */
  const takeSerials = (itemId: string, qty: number): string[] => {
    const pool = serialPool.get(itemId) ?? []
    const start = taken.get(itemId) ?? 0
    taken.set(itemId, start + qty)
    return pool.slice(start, start + qty)
  }
  const salesLine = (code: string, qty: number, over: Partial<DocLine> = {}): DocLine => {
    const item = itemBy(code)
    const l = line(code, qty, over)
    if (item.serialRequired) l.serials = takeSerials(item.id, qty)
    return l
  }
  const cust = (i: number) => customers[i % customers.length].id
  const vend = (i: number) => vendors[i % vendors.length].id

  /* ----- sales quotations ----- */
  const quotes = [
    mk('salesQuotation', 58, cust(0), [line('TR-575', 1, {}, 'salesQuotation'), line('IM-RT6', 1, {}, 'salesQuotation')], { status: 'Converted' }),
    mk('salesQuotation', 44, cust(2), [line('TR-750', 1, {}, 'salesQuotation')], { status: 'Converted' }),
    mk('salesQuotation', 30, cust(4), [line('EN-PR1', 12, {}, 'salesQuotation'), line('EN-AF1', 24, {}, 'salesQuotation')], { status: 'Approved' }),
    mk('salesQuotation', 21, cust(5), [line('TM-CP1', 6, { discountPct: 3 }, 'salesQuotation')], { status: 'Sent' }),
    mk('salesQuotation', 14, cust(7), [line('IM-CV9', 2, {}, 'salesQuotation'), line('IM-TR2', 1, {}, 'salesQuotation')], { status: 'Sent', validTill: fwd(4) }),
    mk('salesQuotation', 9, cust(9), [line('TR-5105', 1, {}, 'salesQuotation')], { status: 'Draft', validTill: fwd(6) }),
    mk('salesQuotation', 40, cust(11), [line('HY-PU1', 2, {}, 'salesQuotation')], { status: 'Rejected' }),
    mk('salesQuotation', 5, cust(13), [line('EL-BT1', 4, {}, 'salesQuotation'), line('EL-AL1', 3, {}, 'salesQuotation')], { status: 'Draft', validTill: fwd(10) }),
  ]
  quotes.forEach((q) => (q.sundries = [sundryFrom(sundries[0])]))

  /* ----- sales orders ----- */
  const orders = [
    mk('salesOrder', 54, cust(0), [line('TR-575', 1, {}, 'salesOrder'), line('IM-RT6', 1, {}, 'salesOrder')], { status: 'Invoiced', refId: quotes[0].id, refNo: quotes[0].no }),
    mk('salesOrder', 40, cust(2), [line('TR-750', 1, {}, 'salesOrder')], { status: 'Invoiced', refId: quotes[1].id, refNo: quotes[1].no }),
    mk('salesOrder', 26, cust(4), [line('EN-PR1', 12, {}, 'salesOrder'), line('EN-AF1', 24, {}, 'salesOrder')], { status: 'Packed', refId: quotes[2].id, refNo: quotes[2].no }),
    mk('salesOrder', 12, cust(6), [line('TR-744', 1, {}, 'salesOrder')], { status: 'Open' }),
    mk('salesOrder', 6, cust(8), [line('IM-DH1', 1, {}, 'salesOrder'), line('BF-CS1', 4, {}, 'salesOrder')], { status: 'Open' }),
  ]

  /* ----- sales packing ----- */
  mk('salesPacking', 25, cust(4), orders[2].lines.map((l) => ({ ...l, id: blankLine().id })), { status: 'Packed', refId: orders[2].id, refNo: orders[2].no })
  mk('salesPacking', 52, cust(0), orders[0].lines.map((l) => ({ ...l, id: blankLine().id })), { status: 'Dispatched', refId: orders[0].id, refNo: orders[0].no })
  mk('salesPacking', 5, cust(8), orders[4].lines.map((l) => ({ ...l, id: blankLine().id })), { status: 'Pending', refId: orders[4].id, refNo: orders[4].no })

  /* ----- sales invoices (spread across months) ----- */
  const invPlan: Array<[number, number, Array<[string, number]>, Partial<Doc>?]> = [
    [160, 1, [['EN-AF1', 30], ['EN-OF1', 30], ['BF-B62', 40]]],
    [142, 3, [['TM-CP1', 5], ['BR-BP1', 20], ['EL-AL1', 4]]],
    [128, 5, [['TR-380', 1]]],
    [112, 7, [['IM-CV9', 2], ['HY-SK1', 5]]],
    [96, 8, [['EN-RD1', 3], ['EN-FB1', 20]]],
    [80, 10, [['TR-744', 1]], { gstType: 'Inter' }],
    [64, 12, [['EL-SM1', 4], ['EL-BT1', 3]]],
    [54, 0, [['TR-575', 1], ['IM-RT6', 1]], { refId: orders[0].id, refNo: orders[0].no }],
    [40, 2, [['TR-750', 1]], { refId: orders[1].id, refNo: orders[1].no }],
    [30, 4, [['BF-B63', 30], ['BF-CS1', 8]]],
    [22, 6, [['BR-SC1', 3], ['TM-GS1', 3]]],
    [14, 9, [['IM-TR2', 1]], { gstType: 'Inter' }],
    [8, 11, [['EN-PR1', 10], ['EN-FI1', 6]]],
    [3, 13, [['TR-5105', 1]]],
  ]
  const invoices = invPlan.map(([d, c, ls, over]) => {
    const doc = mk('salesInvoice', d, cust(c), ls.map(([code, q]) => salesLine(code, q)), { dueDate: addDaysISO(ago(d), 30), ...(over ?? {}) })
    if (d % 2 === 0) doc.sundries = [sundryFrom(sundries[1])]
    return doc
  })

  /* ----- receipts ----- */
  const totalOf = (doc: Doc): number => {
    let taxable = 0
    let taxAmt = 0
    doc.lines.forEach((l) => {
      const net = l.qty * l.rate * (1 - l.discountPct / 100)
      const t = taxes.find((x) => x.id === l.taxId)
      taxable += net
      taxAmt += (net * (t ? t.igst : 0)) / 100
    })
    const sd = doc.sundries.reduce((s, x) => s + (x.mode === 'Percent' ? (taxable * x.value) / 100 : x.value) * (x.sign === 'Add' ? 1 : -1), 0)
    return Math.round(taxable + taxAmt + sd)
  }
  const pay = (idx: number, daysAgo: number, fraction: number, method: string): void => {
    const inv = invoices[idx]
    const amount = Math.round(totalOf(inv) * fraction)
    const alloc: Allocation[] = [{ docId: inv.id, amount }]
    mk('receipt', daysAgo, inv.partyId, [], { amount, method, allocations: alloc, reference: `${method === 'Cash' ? 'CASH' : 'UTR'}${Math.floor(1e5 + rand() * 9e5)}`, refId: inv.id, refNo: inv.no, status: 'Posted' })
  }
  pay(0, 150, 1, 'Bank Transfer'); pay(1, 130, 1, 'Cheque'); pay(2, 120, 1, 'Online Transfer'); pay(3, 100, 1, 'Cash'); pay(4, 85, 1, 'Bank Transfer')
  pay(5, 70, 0.6, 'Bank Transfer'); pay(6, 50, 1, 'Cash'); pay(7, 45, 0.5, 'Cheque'); pay(8, 33, 1, 'Online Transfer'); pay(9, 12, 0.4, 'Cash'); pay(10, 6, 0.5, 'Bank Transfer')

  /* ----- delivery notes, gate passes, returns ----- */
  const tp = transporters
  const dns = [invoices[7], invoices[8], invoices[11], invoices[13]].map((inv, i) =>
    mk('deliveryNote', Math.max(1, Math.round((new Date(today).getTime() - new Date(inv.date).getTime()) / 86_400_000) - 1), inv.partyId, inv.lines.map((l) => ({ ...l, id: blankLine().id, serials: [], delivered: l.qty })), {
      refId: inv.id, refNo: inv.no, transporterId: tp[i % 4].id, vehicleNo: `GJ03 AB ${1200 + i * 37}`, trackingNo: `TRK${70000 + i * 91}`, receiverName: 'Authorised receiver', receiverMobile: '9825000011',
      status: i < 3 ? 'Delivered' : 'In Transit', deliveryAddress: 'Customer site',
    }),
  )
  dns.forEach(() => undefined)
  ;[invoices[7], invoices[8], invoices[13]].forEach((inv, i) =>
    mk('gatePass', Math.max(1, 50 - i * 20), inv.partyId, inv.lines.map((l) => ({ ...l, id: blankLine().id, serials: [] })), {
      refId: inv.id, refNo: inv.no, gateType: 'Material Out', purpose: 'Delivery against invoice', vehicleNo: `GJ03 AB ${1200 + i * 37}`, personCarrying: 'Driver — transporter', status: i === 2 ? 'Active' : 'Closed',
    }),
  )
  mk('salesReturn', 18, invoices[9].partyId, [line('BF-B63', 2, { condition: 'Good', reason: 'Wrong item' }, 'salesReturn')], { refId: invoices[9].id, refNo: invoices[9].no, returnType: 'Sales Return', reason: 'Wrong Item', status: 'Approved' })

  /* ----- purchase side ----- */
  const pq = [
    mk('purchaseQuotation', 70, vend(0), [line('EN-PR1', 60, { rate: 1420 }, 'purchaseQuotation'), line('EN-FI1', 40, { rate: 1820 }, 'purchaseQuotation')], { status: 'Converted' }),
    mk('purchaseQuotation', 35, vend(3), [line('EN-FB1', 150, { rate: 270 }, 'purchaseQuotation')], { status: 'Approved' }),
    mk('purchaseQuotation', 15, vend(2), [line('RM-MS2', 3000, { rate: 61 }, 'purchaseQuotation')], { status: 'Received' }),
    mk('purchaseQuotation', 4, vend(4), [line('EL-BT1', 20, { rate: 6850 }, 'purchaseQuotation')], { status: 'Draft', validTill: fwd(9) }),
  ]
  const po = [
    mk('purchaseOrder', 66, vend(0), [line('EN-PR1', 60, { rate: 1420 }, 'purchaseOrder'), line('EN-FI1', 40, { rate: 1820 }, 'purchaseOrder')], { status: 'Received', refId: pq[0].id, refNo: pq[0].no }),
    mk('purchaseOrder', 50, vend(1), [line('BF-B62', 300, { rate: 142 }, 'purchaseOrder'), line('BF-B63', 200, { rate: 255 }, 'purchaseOrder')], { status: 'Received' }),
    mk('purchaseOrder', 33, vend(3), [line('EN-FB1', 150, { rate: 270 }, 'purchaseOrder')], { status: 'Received', refId: pq[1].id, refNo: pq[1].no }),
    mk('purchaseOrder', 20, vend(2), [line('RM-MS2', 3000, { rate: 61 }, 'purchaseOrder'), line('RM-RB25', 2000, { rate: 65 }, 'purchaseOrder')], { status: 'Partially Received' }),
    mk('purchaseOrder', 10, vend(4), [line('EL-AL1', 20, { rate: 2600 }, 'purchaseOrder'), line('EL-SM1', 15, { rate: 3050 }, 'purchaseOrder')], { status: 'Open' }),
    mk('purchaseOrder', 3, vend(1), [line('BR-BP1', 100, { rate: 510 }, 'purchaseOrder')], { status: 'Open' }),
  ]
  const grn = [
    mk('goodsReceipt', 60, vend(0), po[0].lines.map((l) => ({ ...l, id: blankLine().id, received: l.qty, accepted: l.itemId.includes('fi1') ? l.qty - 2 : l.qty, rejected: l.itemId.includes('fi1') ? 2 : 0 })), { status: 'Accepted', refId: po[0].id, refNo: po[0].no }),
    mk('goodsReceipt', 44, vend(1), po[1].lines.map((l) => ({ ...l, id: blankLine().id, received: l.qty, accepted: l.qty })), { status: 'Accepted', refId: po[1].id, refNo: po[1].no }),
    mk('goodsReceipt', 28, vend(3), po[2].lines.map((l) => ({ ...l, id: blankLine().id, received: l.qty, accepted: l.qty })), { status: 'Accepted', refId: po[2].id, refNo: po[2].no }),
    mk('goodsReceipt', 12, vend(2), [line('RM-MS2', 1800, { rate: 61, received: 1800, accepted: 1800 }, 'goodsReceipt')], { status: 'Inspected', refId: po[3].id, refNo: po[3].no }),
  ]
  const pinv = [
    mk('purchaseInvoice', 58, vend(0), grn[0].lines.map((l) => ({ ...l, id: blankLine().id, qty: l.accepted })), { refId: grn[0].id, refNo: grn[0].no, dueDate: ago(28) }),
    mk('purchaseInvoice', 42, vend(1), grn[1].lines.map((l) => ({ ...l, id: blankLine().id, qty: l.accepted })), { refId: grn[1].id, refNo: grn[1].no, dueDate: ago(12) }),
    mk('purchaseInvoice', 26, vend(3), grn[2].lines.map((l) => ({ ...l, id: blankLine().id, qty: l.accepted })), { refId: grn[2].id, refNo: grn[2].no, dueDate: fwd(4) }),
    mk('purchaseInvoice', 100, vend(0), [line('EN-AF1', 200, { rate: 630 }, 'purchaseInvoice'), line('EN-OF1', 250, { rate: 205 }, 'purchaseInvoice')], { dueDate: ago(70) }),
    mk('purchaseInvoice', 82, vend(2), [line('RM-MS2', 2500, { rate: 62 }, 'purchaseInvoice')], { dueDate: ago(52) }),
    mk('purchaseInvoice', 11, vend(2), [line('RM-MS2', 1800, { rate: 61 }, 'purchaseInvoice')], { refId: grn[3].id, refNo: grn[3].no, dueDate: fwd(19) }),
    mk('purchaseInvoice', 8, vend(4), [line('EL-BT1', 12, { rate: 6850 }, 'purchaseInvoice')], { dueDate: fwd(22), gstType: 'Inter' }),
  ]
  const payV = (idx: number, d: number, fraction: number, tdsPct: number, method: string) => {
    const inv = pinv[idx]
    const amount = Math.round(totalOf(inv) * fraction)
    mk('vendorPayment', d, inv.partyId, [], { amount, method, tdsPct, allocations: [{ docId: inv.id, amount }], refId: inv.id, refNo: inv.no, reference: `UTR${Math.floor(1e5 + rand() * 9e5)}`, status: 'Posted' })
  }
  payV(3, 75, 1, 0, 'Bank Transfer'); payV(4, 60, 1, 1, 'Cheque'); payV(0, 45, 1, 0, 'Bank Transfer'); payV(1, 20, 0.5, 0, 'Online Transfer'); payV(6, 4, 0.3, 0, 'Bank Transfer')
  mk('purchaseReturn', 38, vend(0), [line('EN-FI1', 2, { rate: 1820, reason: 'Defective' }, 'purchaseReturn')], { refId: pinv[0].id, refNo: pinv[0].no, returnType: 'Purchase Return', reason: 'Defective Product', status: 'Approved' })
  mk('purchaseDelivery', 9, vend(4), po[4].lines.map((l) => ({ ...l, id: blankLine().id, delivered: l.qty })), { refId: po[4].id, refNo: po[4].no, transporterId: tp[1].id, vehicleNo: 'GJ05 XY 4411', trackingNo: 'IN-7741', status: 'In Transit' })
  mk('purchaseGatePass', 12, vend(2), [line('RM-MS2', 1800, {}, 'purchaseGatePass')], { gateType: 'Material In', purpose: 'Steel inward', vehicleNo: 'GJ03 TT 9021', personCarrying: 'Driver', status: 'Closed' })
  mk('purchasePacking', 9, vend(4), [line('EL-AL1', 20, {}, 'purchasePacking')], { status: 'Packed' })

  /* ----- stock adjustments & transfers ----- */
  const move = (itemCode: string, days: number, qty: number, type: StockMove['type'], wh: string, note: string): StockMove => ({ id: nid('mv'), itemId: itemBy(itemCode).id, date: ago(days), qty, type, warehouseId: wh, note, ref: '' })
  db.stockMoves.push(
    move('EN-AF1', 20, -3, 'Adjustment', 'wh1', 'Damaged in handling'),
    move('BF-B62', 15, 12, 'Adjustment', 'wh1', 'Physical count surplus'),
    move('EL-AL1', 10, -2, 'Transfer Out', 'wh1', 'To Morbi Depot'), move('EL-AL1', 10, 2, 'Transfer In', 'wh3', 'From Main Warehouse'),
    move('EN-FB1', 6, -20, 'Transfer Out', 'wh1', 'To Shop Floor'), move('EN-FB1', 6, 20, 'Transfer In', 'wh2', 'From Main Warehouse'),
  )

  /* ----- production ----- */
  const boms: Bom[] = [
    { id: 'bom1', productId: itemBy('IM-RT6').id, version: 'v1.0', notes: '6 ft rotavator with 36 blades', components: [{ itemId: itemBy('RM-MS2').id, qty: 180 }, { itemId: itemBy('RM-RB25').id, qty: 95 }, { itemId: itemBy('BF-B63').id, qty: 8 }, { itemId: itemBy('RM-PN1').id, qty: 6 }, { itemId: itemBy('RM-WR1').id, qty: 2 }] },
    { id: 'bom2', productId: itemBy('IM-CV9').id, version: 'v1.0', notes: '9 tyne spring-loaded', components: [{ itemId: itemBy('RM-MS2').id, qty: 60 }, { itemId: itemBy('RM-RB25').id, qty: 55 }, { itemId: itemBy('RM-PN1').id, qty: 3 }, { itemId: itemBy('RM-WR1').id, qty: 1 }] },
    { id: 'bom3', productId: itemBy('IM-TR2').id, version: 'v2.1', notes: 'Two-wheel hydraulic trolley', components: [{ itemId: itemBy('RM-MS2').id, qty: 320 }, { itemId: itemBy('RM-RB25').id, qty: 140 }, { itemId: itemBy('BF-B62').id, qty: 4 }, { itemId: itemBy('HY-PU1').id, qty: 1 }, { itemId: itemBy('RM-PN1').id, qty: 10 }] },
  ]
  db.boms = boms
  db.designs = [
    { id: nid('dg'), code: 'FD-RT6-01', name: 'Rotavator 6 ft — assembly drawing', productId: itemBy('IM-RT6').id, revision: 'C', status: 'Approved', fileName: 'rotavator-6ft-rev-c.pdf', notes: 'Approved by R&D', date: ago(120) },
    { id: nid('dg'), code: 'FD-TR2-02', name: 'Trolley chassis — fabrication spec', productId: itemBy('IM-TR2').id, revision: 'B', status: 'Approved', fileName: 'trolley-chassis-rev-b.pdf', notes: '', date: ago(90) },
    { id: nid('dg'), code: 'FD-CV9-01', name: 'Cultivator tyne bracket', productId: itemBy('IM-CV9').id, revision: 'A', status: 'Draft', fileName: 'cultivator-bracket.dwg', notes: 'Awaiting load test', date: ago(14) },
  ]
  const wo = (no: string, type: WorkOrder['type'], code: string, bomId: string, qty: number, produced: number, status: WorkOrder['status'], d: number, extra: Partial<WorkOrder> = {}): WorkOrder => ({
    id: nid('wo'), no, type, productId: itemBy(code).id, bomId, qty, produced, customerId: '', vendorId: '', startDate: ago(d), dueDate: addDaysISO(ago(d), 14), status, notes: '',
    entries: produced ? [{ id: nid('pe'), date: ago(Math.max(d - 5, 1)), qty: produced, note: 'Batch completed' }] : [], ...extra,
  })
  db.workOrders = [
    wo('WO-001', 'Regular', 'IM-RT6', 'bom1', 4, 4, 'Completed', 45), wo('WO-002', 'Regular', 'IM-CV9', 'bom2', 6, 3, 'In Progress', 14),
    wo('WO-003', 'Custom', 'IM-TR2', 'bom3', 2, 0, 'Planned', 4, { customerId: customers[6].id, notes: 'Custom 6-tonne chassis for customer' }),
    wo('WO-004', 'Job Work', 'IM-RT6', 'bom1', 2, 0, 'Planned', 2, { vendorId: vendors[2].id, notes: 'Blade fabrication outsourced' }),
  ]
  db.workOrders[1].entries.push({ id: nid('pe'), date: ago(4), qty: 0, note: 'Welding in progress' })

  /* ----- accounts ----- */
  db.ledgers = [
    { id: 'lg1', name: 'Bank of Baroda — Current A/c', groupId: 'ag3', openingBalance: 0, balanceType: 'Dr' },
    { id: 'lg2', name: 'Plant & Machinery', groupId: 'ag7', openingBalance: 1250000, balanceType: 'Dr' },
    { id: 'lg3', name: 'Term Loan — SBI', groupId: 'ag6', openingBalance: 850000, balanceType: 'Cr' },
    { id: 'lg4', name: 'Salary & Wages', groupId: 'ag10', openingBalance: 0, balanceType: 'Dr' },
  ]
  db.expenseCategories = ['Travel', 'Food', 'Supplies', 'Fuel', 'Rent', 'Electricity', 'Repairs & Maintenance', 'Marketing'].map((name, i) => ({ id: `ec${i + 1}`, name }))
  const exp = (n: number, d: number, cat: string, who: string, amount: number, mode: Expense['mode'], status: Expense['status'], description: string): Expense => ({
    id: nid('ex'), no: `EXP-${String(n).padStart(3, '0')}`, date: ago(d), categoryId: cat, accountName: who, amount, mode, billName: '', description, status,
  })
  db.expenses = [
    exp(1, 80, 'ec5', 'Gondal Road Estate Owner', 45000, 'Bank', 'Approved', 'Monthly godown rent'), exp(2, 52, 'ec5', 'Gondal Road Estate Owner', 45000, 'Bank', 'Approved', 'Monthly godown rent'),
    exp(3, 24, 'ec5', 'Gondal Road Estate Owner', 45000, 'Bank', 'Approved', 'Monthly godown rent'), exp(4, 33, 'ec6', 'PGVCL', 18650, 'UPI', 'Approved', 'Factory electricity bill'),
    exp(5, 17, 'ec4', 'Diesel — Jasdan pump', 7400, 'Cash', 'Approved', 'Delivery vehicle fuel'), exp(6, 11, 'ec1', 'Priya Shah', 6200, 'Cash', 'Approved', 'Dealer meet travel'),
    exp(7, 7, 'ec8', 'Local newspaper', 12000, 'Bank', 'Pending', 'Festival offer advert'), exp(8, 3, 'ec7', 'Chauhan Garage', 8900, 'Cash', 'Pending', 'Delivery van repair'),
    exp(9, 2, 'ec2', 'Dealer lunch', 3400, 'Cash', 'Rejected', 'Entertainment — over limit'),
  ]
  const vch = (n: number, kind: Voucher['kind'], d: number, dr: string, cr: string, amount: number, narration: string): Voucher => ({ id: nid('vc'), kind, no: `${kind === 'Journal' ? 'JV' : kind === 'Contra' ? 'CV' : kind === 'Debit Note' ? 'DN' : 'CN'}-${String(n).padStart(3, '0')}`, date: ago(d), debitAcc: dr, creditAcc: cr, amount, narration })
  db.vouchers = [
    vch(1, 'Journal', 170, 'led:lg1', 'sys:capital', 2500000, 'Capital introduced by promoters'),
    vch(2, 'Contra', 90, 'led:lg1', 'sys:cash', 80000, 'Cash deposited to bank'),
    vch(3, 'Journal', 60, 'led:lg4', 'led:lg1', 185000, 'Salary paid for the month'),
    vch(4, 'Credit Note', 25, 'sys:salesReturn', `party:${customers[4].id}`, 4200, 'Rate difference allowed'),
  ]

  /* ----- CRM / AMC ----- */
  const subjects = ['Gear shifting hard', 'Hydraulic lift not working', 'Oil leakage near clutch housing', 'Battery draining overnight', 'Unusual engine noise', 'Rotavator blade breakage', 'Starter motor slow cranking', 'Steering heavy on rough terrain']
  db.complaints = subjects.map((s, i): Complaint => ({
    id: nid('cp'), no: `CMP-${String(i + 1).padStart(3, '0')}`, partyId: customers[(i * 2) % customers.length].id, amcId: '', quotationId: '', subject: s,
    description: `${s} reported by customer; service visit requested.`, priority: (['High', 'Medium', 'Low'] as const)[i % 3],
    status: (['Open', 'In Progress', 'Resolved', 'Closed', 'Open', 'Closed', 'In Progress', 'Resolved'] as const)[i], createdAt: iso(40 - i * 5),
  }))
  db.amcs = [0, 2, 4, 6, 8, 10].map((c, i): Amc => {
    const start = ago(300 - i * 55)
    const end = addDaysISO(start, 365)
    return {
      id: nid('amc'), contractNo: `AMC/AGRI/${String(i + 1).padStart(4, '0')}`, partyId: customers[c].id, start, end, amount: 12000 + i * 3500,
      status: end < today ? 'Expired' : 'Active', remarks: 'Two scheduled services per year', services: i % 2 === 0 ? [{ id: nid('sv'), date: addDaysISO(start, 120), notes: 'First half-yearly service done' }] : [],
    }
  })
  db.complaints[0].amcId = db.amcs[0].id

  /* ----- HR ----- */
  const empNames = ['Priya Shah', 'Kunal Mehta', 'Rajesh Solanki', 'Dinesh Vaghela', 'Nirali Joshi', 'Meera Pandya', 'Bharat Chauhan', 'Jignesh Rathod', 'Hetal Trivedi', 'Mahesh Bhatt']
  const empDesignation = ['ds1', 'ds2', 'ds3', 'ds4', 'ds5', 'ds6', 'ds7', 'ds4', 'ds1', 'ds3']
  db.employees = empNames.map((name, i): Employee => {
    const d = designations.find((x) => x.id === empDesignation[i])!
    return { id: nid('em'), code: `E${String(i + 1).padStart(3, '0')}`, name, branchId: d.branchId, departmentId: d.departmentId, designationId: d.id, phone: `+91 98250 2${String(1000 + i * 13)}`, email: `${name.split(' ')[0].toLowerCase()}@gangaagro.example`, joinDate: ago(900 - i * 70), salary: 22000 + i * 3500, status: i === 9 ? 'Inactive' : 'Active' }
  })
  const att: Attendance[] = []
  for (let d = 12; d >= 1; d--) {
    const date = ago(d)
    const dow = new Date(date).getDay()
    if (dow === 0) continue
    db.employees.filter((e) => e.status === 'Active').forEach((e, i) => {
      const r = rand()
      const status: Attendance['status'] = r > 0.93 ? 'Absent' : r > 0.88 ? 'Half Day' : 'Present'
      att.push({ id: nid('at'), date, employeeId: e.id, status, inTime: status === 'Absent' ? '' : `09:${String(5 + ((i * 7) % 40)).padStart(2, '0')}`, outTime: status === 'Absent' ? '' : status === 'Half Day' ? '13:30' : '18:10' })
    })
  }
  db.attendance = att
  db.leaves = [
    { id: nid('lv'), employeeId: db.employees[0].id, from: fwd(3), to: fwd(5), type: 'Casual', status: 'Pending', reason: 'Family function' },
    { id: nid('lv'), employeeId: db.employees[3].id, from: ago(10), to: ago(9), type: 'Sick', status: 'Approved', reason: 'Fever' },
    { id: nid('lv'), employeeId: db.employees[5].id, from: fwd(12), to: fwd(16), type: 'Earned', status: 'Pending', reason: 'Vacation' },
    { id: nid('lv'), employeeId: db.employees[6].id, from: ago(30), to: ago(29), type: 'Casual', status: 'Rejected', reason: 'Peak service season' },
  ]

  /* ----- admin ----- */
  const access = (map: Partial<Record<string, Access>>, fallback: Access = 'none'): Record<string, Access> =>
    Object.fromEntries(ACCESS_GROUPS.map((g) => [g.id, map[g.id] ?? fallback]))
  const roles: Role[] = [
    { id: 'role1', name: 'Administrator', description: 'Full access to every module and security setting', access: access({}, 'edit') },
    { id: 'role2', name: 'Sales Manager', description: 'Sales, CRM and dealer network; read-only elsewhere', access: access({ dashboard: 'view', masters: 'view', company: 'view', sales: 'edit', purchase: 'view', inventory: 'view', production: 'view', crm: 'edit', logistics: 'edit', reports: 'view' }) },
    { id: 'role3', name: 'Accountant', description: 'Accounts, reports and payments', access: access({ dashboard: 'view', masters: 'view', sales: 'view', purchase: 'view', accounts: 'edit', reports: 'edit', hr: 'view', inventory: 'view' }) },
    { id: 'role4', name: 'Store Keeper', description: 'Inventory, purchase receipts and production', access: access({ dashboard: 'view', masters: 'view', purchase: 'edit', inventory: 'edit', production: 'edit', sales: 'view', logistics: 'view' }) },
  ]
  db.roles = roles
  db.users = [
    { id: 'u1', username: 'admin', password: 'admin123', name: 'Hasmukh Patel', roleId: 'role1', email: 'admin@gangaagro.example', status: 'Active', orgId: 'org1' },
    { id: 'u2', username: 'manager', password: 'manager123', name: 'Priya Shah', roleId: 'role2', email: 'priya@gangaagro.example', status: 'Active', orgId: 'org1' },
    { id: 'u3', username: 'accounts', password: 'accounts123', name: 'Nirali Joshi', roleId: 'role3', email: 'nirali@gangaagro.example', status: 'Active', orgId: 'org1' },
    { id: 'u4', username: 'store', password: 'store123', name: 'Rajesh Solanki', roleId: 'role4', email: 'rajesh@gangaagro.example', status: 'Active', orgId: 'org1' },
  ] as User[]
  db.alertRules = [
    { id: 'ar1', name: 'Low stock warning', trigger: 'Low stock', channel: 'Email', enabled: true, threshold: 0 },
    { id: 'ar2', name: 'Overdue invoice reminder', trigger: 'Overdue invoice', channel: 'WhatsApp', enabled: true, threshold: 7 },
    { id: 'ar3', name: 'Quotation expiry nudge', trigger: 'Quotation expiring', channel: 'SMS', enabled: true, threshold: 3 },
    { id: 'ar4', name: 'AMC renewal reminder', trigger: 'AMC expiring', channel: 'WhatsApp', enabled: false, threshold: 30 },
    { id: 'ar5', name: 'Payment received thank-you', trigger: 'Payment received', channel: 'SMS', enabled: true, threshold: 0 },
  ]
  db.alertLogs = [
    { id: nid('al'), at: iso(3), rule: 'Overdue invoice reminder', channel: 'WhatsApp', to: customers[6].phone, message: `Dear ${customers[6].name}, invoice ${invoices[4].no} is overdue. Kindly arrange payment.` },
    { id: nid('al'), at: iso(1), rule: 'Low stock warning', channel: 'Email', to: 'store@gangaagro.example', message: 'Fuel Injector Nozzle, Hydraulic Seal Kit are below minimum stock.' },
  ]
  db.activity = [
    { id: nid('act'), at: iso(2), user: 'Priya Shah', action: 'Created', entity: 'docs', detail: `Sales Invoice ${invoices[13].no}` },
    { id: nid('act'), at: iso(5), user: 'Nirali Joshi', action: 'Updated', entity: 'expenses', detail: 'EXP-006 approved' },
    { id: nid('act'), at: iso(9), user: 'Rajesh Solanki', action: 'Created', entity: 'docs', detail: 'Goods Receipt GRM-004' },
    { id: nid('act'), at: iso(14), user: 'Hasmukh Patel', action: 'System', entity: 'erp', detail: 'Demo data installed' },
  ]
  return db
}
