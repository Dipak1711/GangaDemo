import { useMemo, useState } from 'react'
import {
  Building2, FolderTree, Gauge as GaugeIcon, Handshake, Layers, MapPin, Network, Package, PackageCheck, Percent, ReceiptText, Ruler, Store,
  Tags, Truck, UserRoundCheck, Users, Warehouse, Plus, X, Calculator,
} from 'lucide-react'
import type { Database, Party, PartyType } from '@/types'
import { useData } from '@/store/DataContext'
import { CrudPage, opts, newId, type ColumnDef, type FieldDef, type Row } from '@/components/Crud'
import { PageHeader } from '@/components/ui/Layout'
import { SegmentedTabs } from '@/components/ui/SegmentedTabs'
import { Card, CardHeader } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select } from '@/components/ui/Form'
import { byId, nameOf, stockMap, stockStatus, stockValue, taxRate } from '@/lib/calc'
import { formatCurrency, formatNumber, uid } from '@/lib/utils'
import { ActiveBadge, dateCell, money, strong, sub } from '@/pages/common'

const status = (key = 'status'): FieldDef => ({ key, label: 'Status', type: 'select', required: true, options: [{ value: 'Active', label: 'Active' }, { value: 'Inactive', label: 'Inactive' }] })
const dup = (rows: Row[], key: string, value: string, id: string) => rows.some((r) => r.id !== id && String(r[key]).trim().toLowerCase() === value.trim().toLowerCase())

/* ------------------------------------------------------------------ */
/* Company                                                             */
/* ------------------------------------------------------------------ */

export function BranchesPage() {
  const statusOpts = [{ value: 'Open', label: 'Open' }, { value: 'Closed', label: 'Closed' }]
  return (
    <CrudPage
      collection="branches" entity="Branch" title="Branches" icon={<Store className="h-5 w-5" />} eyebrow="Company Profile"
      description="Offices, works and depots of the company."
      blank={(db) => ({ id: uid('br'), code: `BR${String(db.branches.length + 1).padStart(2, '0')}`, name: '', contact: '', address: '', status: 'Open' })}
      columns={[
        { key: 'code', label: 'ID', render: (r) => <span className="font-mono text-xs font-semibold">{r.code}</span> },
        { key: 'name', label: 'Name', render: (r) => strong(r.name) },
        { key: 'contact', label: 'Contact' },
        { key: 'address', label: 'Address', hideBelow: 'md' },
        { key: 'status', label: 'Status', render: (r) => <ActiveBadge status={r.status} />, text: (r) => r.status },
      ]}
      fields={[
        { key: 'code', label: 'Branch ID', required: true }, { key: 'name', label: 'Branch name', required: true },
        { key: 'contact', label: 'Contact number', type: 'tel' }, { key: 'status', label: 'Status', type: 'select', required: true, options: statusOpts },
        { key: 'address', label: 'Address', type: 'textarea' },
      ]}
      modalSize="md"
      validate={(d, db) => (dup(db.branches as unknown as Row[], 'code', d.code, d.id) ? { code: 'This branch ID already exists.' } : {})}
    />
  )
}

export function DepartmentsPage() {
  return (
    <CrudPage
      collection="departments" entity="Department" title="Departments" icon={<Network className="h-5 w-5" />} eyebrow="Company Profile"
      description="Departments under each branch."
      blank={(db) => ({ id: uid('dp'), branchId: db.branches[0]?.id ?? '', name: '' })}
      columns={[
        { key: 'branchId', label: 'Branch', render: (r, db) => nameOf(db.branches, r.branchId), text: (r, db) => nameOf(db.branches, r.branchId) },
        { key: 'name', label: 'Department', render: (r) => strong(r.name) },
        { key: 'staff', label: 'Employees', align: 'right', render: (r, db) => db.employees.filter((e) => e.departmentId === r.id).length },
      ]}
      fields={[
        { key: 'branchId', label: 'Branch', type: 'select', required: true, options: (db) => opts(db.branches) },
        { key: 'name', label: 'Department name', required: true },
      ]}
      filters={[{ key: 'branch', label: 'Branch', options: (db) => opts(db.branches), test: (r, v) => r.branchId === v }]}
      modalSize="md"
    />
  )
}

export function DesignationsPage() {
  return (
    <CrudPage
      collection="designations" entity="Designation" title="Designations" icon={<UserRoundCheck className="h-5 w-5" />} eyebrow="Company Profile"
      description="Designations with the person responsible."
      blank={(db) => ({ id: uid('ds'), branchId: db.branches[0]?.id ?? '', departmentId: '', name: '', person: '', contact: '' })}
      columns={[
        { key: 'branchId', label: 'Branch', render: (r, db) => nameOf(db.branches, r.branchId), text: (r, db) => nameOf(db.branches, r.branchId), hideBelow: 'md' },
        { key: 'departmentId', label: 'Department', render: (r, db) => nameOf(db.departments, r.departmentId), text: (r, db) => nameOf(db.departments, r.departmentId) },
        { key: 'name', label: 'Designation', render: (r) => strong(r.name) },
        { key: 'person', label: 'Person' },
        { key: 'contact', label: 'Contact', hideBelow: 'md' },
      ]}
      fields={[
        { key: 'branchId', label: 'Branch', type: 'select', required: true, options: (db) => opts(db.branches) },
        { key: 'departmentId', label: 'Department', type: 'select', required: true, options: (db, d) => opts(db.departments.filter((x) => x.branchId === d.branchId)), hint: 'Departments of the chosen branch' },
        { key: 'name', label: 'Designation', required: true }, { key: 'person', label: 'Person name' },
        { key: 'contact', label: 'Contact', type: 'tel' },
      ]}
      modalSize="md"
    />
  )
}

/* ------------------------------------------------------------------ */
/* Masters                                                             */
/* ------------------------------------------------------------------ */

export function CategoriesPage() {
  return (
    <CrudPage
      collection="categories" entity="Category / Brand" title="Category / Brand" icon={<Tags className="h-5 w-5" />} eyebrow="Master Setup"
      description="Categories group items by function; brands record the make."
      blank={() => ({ id: uid('cat'), name: '', kind: 'Category', description: '' })}
      columns={[
        { key: 'name', label: 'Name', render: (r) => strong(r.name) },
        { key: 'kind', label: 'Type', render: (r) => <Badge tone={r.kind === 'Brand' ? 'purple' : 'info'}>{r.kind}</Badge>, text: (r) => r.kind },
        { key: 'description', label: 'Description', hideBelow: 'md' },
        { key: 'items', label: 'Items', align: 'right', render: (r, db) => db.items.filter((i) => i.categoryId === r.id || i.brandId === r.id).length },
      ]}
      fields={[
        { key: 'name', label: 'Name', required: true },
        { key: 'kind', label: 'Type', type: 'select', required: true, options: [{ value: 'Category', label: 'Category' }, { value: 'Brand', label: 'Brand' }] },
        { key: 'description', label: 'Description', type: 'textarea' },
      ]}
      filters={[{ key: 'kind', label: 'Type', options: [{ value: 'Category', label: 'Category' }, { value: 'Brand', label: 'Brand' }], test: (r, v) => r.kind === v }]}
      validate={(d, db) => (dup(db.categories as unknown as Row[], 'name', d.name, d.id) ? { name: 'This name already exists.' } : {})}
      modalSize="md"
    />
  )
}

export function ItemGroupsPage() {
  return (
    <CrudPage
      collection="itemGroups" entity="Item group" title="Item Group" icon={<FolderTree className="h-5 w-5" />} eyebrow="Master Setup"
      description="A tree of groups — primary groups have no parent."
      blank={() => ({ id: uid('ig'), name: '', isPrimary: false, parentId: '', description: '' })}
      columns={[
        { key: 'name', label: 'Name', render: (r) => strong(r.name) },
        { key: 'isPrimary', label: 'Primary', render: (r) => (r.isPrimary ? <Badge tone="success">Yes</Badge> : <Badge>No</Badge>), text: (r) => (r.isPrimary ? 'Yes' : 'No') },
        { key: 'parentId', label: 'Under group', render: (r, db) => nameOf(db.itemGroups, r.parentId), text: (r, db) => nameOf(db.itemGroups, r.parentId) },
        { key: 'items', label: 'Items', align: 'right', render: (r, db) => db.items.filter((i) => i.groupId === r.id).length },
      ]}
      fields={[
        { key: 'name', label: 'Group name', required: true },
        { key: 'isPrimary', label: 'Primary group', type: 'checkbox', hint: 'This is a primary (top-level) group' },
        { key: 'parentId', label: 'Under group', type: 'select', options: (db, d) => opts(db.itemGroups.filter((g) => g.id !== d.id)), visible: (d) => !d.isPrimary },
        { key: 'description', label: 'Description', type: 'textarea' },
      ]}
      prepare={(d) => ({ ...d, parentId: d.isPrimary ? '' : d.parentId })}
      validate={(d) => (!d.isPrimary && !d.parentId ? { parentId: 'Choose a parent group or mark it primary.' } : {})}
      modalSize="md"
    />
  )
}

export function ItemsPage() {
  const classOpts = ['Tractor', 'Finished Good', 'Redymat Part', 'Raw Material'].map((c) => ({ value: c, label: c }))
  const unitOpts = (db: Database) => opts(db.units)
  return (
    <CrudPage
      collection="items" entity="Item" title="Items" icon={<Package className="h-5 w-5" />} eyebrow="Master Setup"
      description="Tractors, spare parts, raw materials and implements with pricing, tax and stock levels."
      blank={(db) => ({
        id: uid('it'), code: '', name: '', groupId: '', categoryId: '', brandId: '', itemClass: 'Redymat Part', baseUnitId: db.units[0]?.id ?? '', saleUnitId: '', purchaseUnitId: '',
        packingUnitId: '', conversion: 1, taxId: db.taxes.find((t) => t.type === 'GST')?.id ?? '', hsn: '', openingStock: 0, minStock: 0, maxStock: 0, purchaseRate: 0, sellingRate: 0,
        serialRequired: false, description: '', status: 'Active',
      })}
      columns={[
        { key: 'code', label: 'Code', render: (r) => <span className="font-mono text-xs font-semibold">{r.code}</span> },
        { key: 'name', label: 'Item', render: (r, db) => <>{strong(r.name)}{sub(`${nameOf(db.categories, r.categoryId)} · ${nameOf(db.categories, r.brandId)}`)}</>, text: (r) => r.name },
        { key: 'itemClass', label: 'Class', hideBelow: 'md' },
        { key: 'unit', label: 'Unit', render: (r, db) => db.units.find((u) => u.id === r.baseUnitId)?.alias ?? '—', hideBelow: 'lg' },
        { key: 'tax', label: 'GST', align: 'right', render: (r, db) => `${taxRate(byId(db.taxes, r.taxId))}%`, hideBelow: 'lg' },
        { key: 'purchaseRate', label: 'Buy rate', align: 'right', render: (r) => money(r.purchaseRate), hideBelow: 'lg' },
        { key: 'sellingRate', label: 'Sell rate', align: 'right', render: (r) => (r.sellingRate ? money(r.sellingRate) : '—') },
        { key: 'stock', label: 'Stock', align: 'right', render: (r, db) => formatNumber(stockMap(db).get(r.id) ?? 0), text: (r, db) => stockMap(db).get(r.id) ?? 0 },
        { key: 'serial', label: 'Serial', align: 'center', render: (r) => (r.serialRequired ? <Badge tone="info">Yes</Badge> : <span className="text-silver-500">—</span>), text: (r) => (r.serialRequired ? 'Y' : 'N'), hideBelow: 'lg' },
      ]}
      fields={[
        { key: 'code', label: 'Item code', required: true, section: 'Basic details' }, { key: 'name', label: 'Item name', required: true, full: true },
        { key: 'itemClass', label: 'Stock class', type: 'select', required: true, options: classOpts, hint: 'Raw material, Redymat (ready-made) part, finished good or tractor' },
        { key: 'groupId', label: 'Item group', type: 'select', options: (db) => opts(db.itemGroups) },
        { key: 'categoryId', label: 'Category', type: 'select', options: (db) => opts(db.categories.filter((c) => c.kind === 'Category')) },
        { key: 'brandId', label: 'Brand', type: 'select', options: (db) => opts(db.categories.filter((c) => c.kind === 'Brand')) },
        { key: 'hsn', label: 'HSN / SAC code' }, status(),
        { key: 'baseUnitId', label: 'Base unit', type: 'select', required: true, options: (db) => unitOpts(db), section: 'Units & packing' },
        { key: 'saleUnitId', label: 'Sale unit', type: 'select', options: (db) => unitOpts(db) },
        { key: 'purchaseUnitId', label: 'Purchase unit', type: 'select', options: (db) => unitOpts(db) },
        { key: 'packingUnitId', label: 'Packing unit', type: 'select', options: (db) => opts(db.packingUnits) },
        { key: 'conversion', label: 'Conversion factor', type: 'number', min: 0, hint: 'Base units per packing unit' },
        { key: 'taxId', label: 'Tax (GST)', type: 'select', required: true, options: (db) => opts(db.taxes.filter((t) => t.type === 'GST')), section: 'Pricing & tax' },
        { key: 'purchaseRate', label: 'Purchase rate (₹)', type: 'number', min: 0 }, { key: 'sellingRate', label: 'Selling rate (₹)', type: 'number', min: 0 },
        { key: 'openingStock', label: 'Opening stock', type: 'number', min: 0, section: 'Stock control' },
        { key: 'minStock', label: 'Minimum level', type: 'number', min: 0, hint: 'Below this the item is flagged low' },
        { key: 'maxStock', label: 'Maximum level', type: 'number', min: 0 },
        { key: 'serialRequired', label: 'Serial tracking', type: 'checkbox', hint: 'Each unit carries a serial number (tractors)' },
        { key: 'description', label: 'Description', type: 'textarea' },
      ]}
      filters={[
        { key: 'class', label: 'Class', options: classOpts, test: (r, v) => r.itemClass === v },
        { key: 'cat', label: 'Category', options: (db) => opts(db.categories.filter((c) => c.kind === 'Category')), test: (r, v) => r.categoryId === v },
      ]}
      stats={(rows, db) => {
        const stock = stockMap(db)
        const low = rows.filter((r) => ['Low stock', 'Out of stock'].includes(stockStatus(r as never, stock.get(r.id) ?? 0))).length
        return [
          { label: 'Total items', value: rows.length, numericValue: rows.length, icon: <Package className="h-5 w-5" />, tone: 'sapphire' },
          { label: 'Stock value', value: '', numericValue: stockValue(db, stock), format: (v) => formatCurrency(v, true), icon: <Layers className="h-5 w-5" />, tone: 'emerald' },
          { label: 'Low / out of stock', value: low, numericValue: low, icon: <Warehouse className="h-5 w-5" />, tone: 'rose' },
          { label: 'Serial-tracked', value: 0, numericValue: rows.filter((r) => r.serialRequired).length, icon: <Tags className="h-5 w-5" />, tone: 'violet' },
        ]
      }}
      validate={(d, db) => {
        const e: Record<string, string> = {}
        if (dup(db.items as unknown as Row[], 'code', d.code, d.id)) e.code = 'This item code already exists.'
        if (d.maxStock && d.minStock > d.maxStock) e.maxStock = 'Maximum must be above the minimum level.'
        return e
      }}
      prepare={(d) => ({ ...d, saleUnitId: d.saleUnitId || d.baseUnitId, purchaseUnitId: d.purchaseUnitId || d.baseUnitId })}
      modalSize="xl"
    />
  )
}

export function UnitsPage() {
  const cats = ['Quantity', 'Area', 'Length', 'Volume', 'Mass', 'Time', 'Speed'].map((c) => ({ value: c, label: c }))
  return (
    <CrudPage
      collection="units" entity="Unit" title="Units" icon={<Ruler className="h-5 w-5" />} eyebrow="Master Setup" description="Units of measure used on items and documents."
      blank={() => ({ id: uid('un'), name: '', alias: '', printName: '', category: 'Quantity', status: 'Active' })}
      columns={[
        { key: 'name', label: 'Unit name', render: (r) => strong(r.name) }, { key: 'alias', label: 'Alias' }, { key: 'printName', label: 'Print name', hideBelow: 'md' },
        { key: 'category', label: 'Category', render: (r) => <Badge tone="info">{r.category}</Badge>, text: (r) => r.category },
        { key: 'status', label: 'Status', render: (r) => <ActiveBadge status={r.status} />, text: (r) => r.status },
      ]}
      fields={[
        { key: 'name', label: 'Unit name', required: true }, { key: 'alias', label: 'Alias', required: true }, { key: 'printName', label: 'Print name' },
        { key: 'category', label: 'Category', type: 'select', required: true, options: cats }, status(),
      ]}
      filters={[{ key: 'cat', label: 'Category', options: cats, test: (r, v) => r.category === v }]}
      prepare={(d) => ({ ...d, printName: d.printName || d.alias })}
      validate={(d, db) => (dup(db.units as unknown as Row[], 'alias', d.alias, d.id) ? { alias: 'This alias already exists.' } : {})}
      modalSize="md"
    />
  )
}

/* ------------------------------------------------------------------ */
/* Gauge chart + converter                                             */
/* ------------------------------------------------------------------ */

export function GaugePage() {
  const { db } = useData()
  const [gaugeId, setGaugeId] = useState('')
  const [value, setValue] = useState(1)
  const [mode, setMode] = useState<'mm' | 'inch'>('mm')
  const entry = db.gauges.find((g) => g.id === (gaugeId || db.gauges[0]?.id))
  const converted = entry ? (mode === 'mm' ? value * entry.mm : value * entry.inch) : 0
  return (
    <>
      <CrudPage
        collection="gauges" entity="Gauge entry" title="Unit Chart (Gauge → MM)" icon={<GaugeIcon className="h-5 w-5" />} eyebrow="Master Setup"
        description="Reference of sheet gauges and sections converted to millimetres and inches, by material and shape."
        blank={() => ({ id: uid('gg'), gauge: '', mm: 0, inch: 0, material: 'MS', shape: 'Sheet', description: '', status: 'Active' })}
        columns={[
          { key: 'gauge', label: 'Gauge', render: (r) => strong(r.gauge) },
          { key: 'mm', label: 'MM', align: 'right' }, { key: 'inch', label: 'Inch', align: 'right' },
          { key: 'material', label: 'Material', render: (r) => <Badge tone="silver">{r.material}</Badge>, text: (r) => r.material },
          { key: 'shape', label: 'Shape', hideBelow: 'md' }, { key: 'description', label: 'Description', hideBelow: 'lg' },
          { key: 'status', label: 'Status', render: (r) => <ActiveBadge status={r.status} />, text: (r) => r.status },
        ]}
        fields={[
          { key: 'gauge', label: 'Gauge / size', required: true }, { key: 'mm', label: 'Millimetres', type: 'number', required: true, min: 0 }, { key: 'inch', label: 'Inches', type: 'number', min: 0 },
          { key: 'material', label: 'Material', type: 'select', required: true, options: ['GP', 'GI', 'MS', 'ALU', 'BRASS', 'SS'].map((m) => ({ value: m, label: m })) },
          { key: 'shape', label: 'Shape', type: 'select', required: true, options: ['Sheet', 'Angle', 'Round-Bar', 'Channel', 'Flat-Bar', 'Round-Tube', 'Square-Tube', 'Hexagon', 'H-Beam'].map((m) => ({ value: m, label: m })) },
          status(), { key: 'description', label: 'Description', type: 'textarea' },
        ]}
        modalSize="md"
      />
      <Card>
        <CardHeader title="Quick converter" subtitle="Pick a gauge, enter a value and read the result in millimetres or inches." icon={<Calculator className="h-4 w-4" />} accent="sapphire" />
        <div className="mt-4 grid gap-4 sm:grid-cols-4">
          <Field label="Gauge">
            <Select value={entry?.id ?? ''} onChange={(e) => setGaugeId(e.target.value)}>{db.gauges.map((g) => <option key={g.id} value={g.id}>{g.gauge} ({g.material} {g.shape})</option>)}</Select>
          </Field>
          <Field label="Multiplier / quantity"><Input type="number" min={0} step="any" value={value} onChange={(e) => setValue(Number(e.target.value))} /></Field>
          <Field label="Convert to">
            <Select value={mode} onChange={(e) => setMode(e.target.value as 'mm' | 'inch')}><option value="mm">Millimetres</option><option value="inch">Inches</option></Select>
          </Field>
          <div className="rounded-xl bg-sapphire-50 p-3 ring-1 ring-sapphire-200">
            <p className="text-[11px] font-bold tracking-wide text-sapphire-700 uppercase">Result</p>
            <p className="tnum mt-1 text-2xl font-extrabold text-navy-900">{converted.toFixed(3)} <span className="text-sm font-semibold text-silver-600">{mode}</span></p>
          </div>
        </div>
      </Card>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Packing                                                             */
/* ------------------------------------------------------------------ */

export function PackingPage() {
  const [tab, setTab] = useState<'units' | 'conversions'>('units')
  return (
    <>
      <PageHeader title="Packing Units" icon={<PackageCheck className="h-5 w-5" />} eyebrow="Master Setup" description="Packing units (carton, pallet, bundle…) and how they convert into one another." />
      <SegmentedTabs value={tab} onChange={setTab} items={[{ value: 'units', label: 'Packing units' }, { value: 'conversions', label: 'Conversions' }]} />
      <div className="tab-swap flex flex-col gap-4" key={tab}>
        {tab === 'units' ? (
          <CrudPage
            embedded collection="packingUnits" entity="Packing unit" title="Packing Units"
            blank={(db) => ({ id: uid('pk'), name: '', alias: '', baseUnitId: db.units[0]?.id ?? '', qty: 1, description: '', status: 'Active' })}
            columns={[
              { key: 'name', label: 'Packing name', render: (r) => strong(r.name) }, { key: 'alias', label: 'Alias' },
              { key: 'base', label: 'Base unit', render: (r, db) => nameOf(db.units, r.baseUnitId), text: (r, db) => nameOf(db.units, r.baseUnitId) },
              { key: 'qty', label: 'Qty / pack', align: 'right' }, { key: 'description', label: 'Description', hideBelow: 'md' },
              { key: 'status', label: 'Status', render: (r) => <ActiveBadge status={r.status} />, text: (r) => r.status },
            ]}
            fields={[
              { key: 'name', label: 'Packing name', required: true }, { key: 'alias', label: 'Alias', required: true },
              { key: 'baseUnitId', label: 'Base unit', type: 'select', required: true, options: (db) => opts(db.units) },
              { key: 'qty', label: 'Quantity per pack', type: 'number', required: true, min: 0.0001 }, status(), { key: 'description', label: 'Description', type: 'textarea' },
            ]}
            modalSize="md"
          />
        ) : (
          <CrudPage
            embedded collection="packingConversions" entity="Conversion" title="Packing Conversions"
            blank={(db) => ({ id: uid('pc'), fromId: db.packingUnits[0]?.id ?? '', toId: db.packingUnits[1]?.id ?? '', factor: 1, description: '', status: 'Active' })}
            columns={[
              { key: 'from', label: 'From', render: (r, db) => strong(nameOf(db.packingUnits, r.fromId)), text: (r, db) => nameOf(db.packingUnits, r.fromId) },
              { key: 'to', label: 'To', render: (r, db) => nameOf(db.packingUnits, r.toId), text: (r, db) => nameOf(db.packingUnits, r.toId) },
              { key: 'factor', label: 'Factor', align: 'right' },
              { key: 'display', label: 'Display', render: (r, db) => `1 ${nameOf(db.packingUnits, r.fromId)} = ${r.factor} ${nameOf(db.packingUnits, r.toId)}`, text: (r, db) => `1 ${nameOf(db.packingUnits, r.fromId)} = ${r.factor} ${nameOf(db.packingUnits, r.toId)}`, hideBelow: 'md' },
              { key: 'status', label: 'Status', render: (r) => <ActiveBadge status={r.status} />, text: (r) => r.status },
            ]}
            fields={[
              { key: 'fromId', label: 'From packing unit', type: 'select', required: true, options: (db) => opts(db.packingUnits) },
              { key: 'toId', label: 'To packing unit', type: 'select', required: true, options: (db) => opts(db.packingUnits) },
              { key: 'factor', label: 'Conversion factor', type: 'number', required: true, min: 0.0001 }, status(), { key: 'description', label: 'Description', type: 'textarea' },
            ]}
            validate={(d) => (d.fromId && d.fromId === d.toId ? { toId: 'Choose a different packing unit.' } : {})}
            modalSize="md"
          />
        )}
      </div>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Taxes & sundries                                                    */
/* ------------------------------------------------------------------ */

export function TaxesPage() {
  const [type, setType] = useState<'GST' | 'TCS' | 'TDS' | 'VAT'>('GST')
  const { db } = useData()
  const scope = useMemo(() => (r: Row) => r.type === type, [type])
  return (
    <>
      <PageHeader title="Taxes" icon={<Percent className="h-5 w-5" />} eyebrow="Master Setup" description="GST, TCS and TDS rates applied on documents. VAT is kept for reference and is on hold." />
      <SegmentedTabs value={type} onChange={setType} items={(['GST', 'TCS', 'TDS', 'VAT'] as const).map((t) => ({ value: t, label: t === 'VAT' ? 'VAT (on hold)' : t, count: db.taxes.filter((x) => x.type === t).length }))} />
      <div className="tab-swap flex flex-col gap-4" key={type}>
        <CrudPage
          embedded collection="taxes" entity={`${type} rate`} title="Taxes" scope={scope}
          blank={() => ({ id: uid('tx'), name: '', type, productType: 'Goods', location: 'Central', igst: 0, cgst: 0, sgst: 0, status: 'Active' })}
          columns={[
            { key: 'name', label: 'Name', render: (r) => strong(r.name) }, { key: 'productType', label: 'Product type' }, { key: 'location', label: 'Location', hideBelow: 'md' },
            { key: 'rate', label: 'Rate', align: 'right', render: (r) => `${r.igst}%`, text: (r) => r.igst },
            { key: 'igst', label: 'IGST %', align: 'right', hideBelow: 'md' }, { key: 'cgst', label: 'CGST %', align: 'right', hideBelow: 'lg' }, { key: 'sgst', label: 'SGST %', align: 'right', hideBelow: 'lg' },
            { key: 'status', label: 'Status', render: (r) => <ActiveBadge status={r.status} />, text: (r) => r.status },
          ]}
          fields={[
            { key: 'name', label: 'Name', required: true },
            { key: 'productType', label: 'Product type', type: 'select', required: true, options: [{ value: 'Goods', label: 'Goods' }, { value: 'Services', label: 'Services' }] },
            { key: 'location', label: 'Location', type: 'select', options: ['Central', 'State', 'Inter-state'].map((l) => ({ value: l, label: l })) },
            { key: 'igst', label: 'Rate / IGST %', type: 'number', required: true, min: 0, hint: 'Total tax rate' },
            { key: 'cgst', label: 'CGST %', type: 'number', min: 0, visible: () => type === 'GST' }, { key: 'sgst', label: 'SGST %', type: 'number', min: 0, visible: () => type === 'GST' }, status(),
          ]}
          prepare={(d) => (type === 'GST' ? { ...d, cgst: d.cgst || d.igst / 2, sgst: d.sgst || d.igst / 2 } : { ...d, cgst: 0, sgst: 0 })}
          validate={(d) => (type === 'GST' && Math.abs((d.cgst || d.igst / 2) + (d.sgst || d.igst / 2) - d.igst) > 0.001 ? { igst: 'CGST + SGST must equal IGST.' } : {})}
          modalSize="md"
        />
      </div>
    </>
  )
}

export function SundryPage() {
  const [group, setGroup] = useState<'General' | 'GST'>('General')
  const scope = useMemo(() => (r: Row) => r.group === group, [group])
  return (
    <>
      <PageHeader title="Bill Sundry" icon={<ReceiptText className="h-5 w-5" />} eyebrow="Master Setup" description="Extra charges and discounts that can be added to quotations, orders and invoices." />
      <SegmentedTabs value={group} onChange={setGroup} items={[{ value: 'General', label: 'General' }, { value: 'GST', label: 'GST / tax-related' }]} />
      <div className="tab-swap flex flex-col gap-4" key={group}>
        <CrudPage
          embedded collection="sundries" entity="Sundry" title="Bill Sundry" scope={scope}
          blank={() => ({ id: uid('sd'), name: '', group, sign: 'Add', mode: 'Amount', value: 0, description: '', status: 'Active' })}
          columns={[
            { key: 'name', label: 'Name', render: (r) => strong(r.name) },
            { key: 'sign', label: 'Sign', render: (r) => <Badge tone={r.sign === 'Add' ? 'success' : 'warning'}>{r.sign}</Badge>, text: (r) => r.sign },
            { key: 'value', label: 'Default value', align: 'right', render: (r) => (r.mode === 'Percent' ? `${r.value}%` : money(r.value)), text: (r) => r.value },
            { key: 'example', label: 'Example', hideBelow: 'md', render: (r) => `${r.sign} ${r.mode === 'Percent' ? `${r.value}%` : money(r.value)}`, text: (r) => `${r.sign} ${r.value}` },
            { key: 'description', label: 'Description', hideBelow: 'lg' },
            { key: 'status', label: 'Status', render: (r) => <ActiveBadge status={r.status} />, text: (r) => r.status },
          ]}
          fields={[
            { key: 'name', label: 'Sundry name', required: true },
            { key: 'sign', label: 'Sign', type: 'select', required: true, options: [{ value: 'Add', label: 'Add (+)' }, { value: 'Subtract', label: 'Subtract (−)' }] },
            { key: 'mode', label: 'Value type', type: 'select', required: true, options: [{ value: 'Amount', label: 'Fixed amount' }, { value: 'Percent', label: 'Percent of taxable' }] },
            { key: 'value', label: 'Default value', type: 'number', required: true, min: 0 }, status(), { key: 'description', label: 'Description', type: 'textarea' },
          ]}
          modalSize="md"
        />
      </div>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Parties                                                             */
/* ------------------------------------------------------------------ */

const PARTY_CATEGORIES: Record<PartyType, string[]> = {
  Customer: ['Registered person', 'Unregistered person', 'Government Body'],
  Vendor: ['Manufacturer', 'Distributor', 'Retailer', 'Wholesaler', 'Service Provider'],
  Dealer: ['Dealer'],
}
const DOC_TYPES = ['Aadhar', 'Bank Passbook', 'GST Certificate', 'IEC Certificate', 'MSME Certificate', 'PAN Card', 'Agreement']

function PartyDocuments({ draft, set }: { draft: Row; set: (k: string, v: unknown) => void }) {
  const [type, setType] = useState(DOC_TYPES[0])
  const docs = (draft.documents ?? []) as Array<{ type: string; fileName: string }>
  return (
    <div className="rounded-xl bg-silver-50 p-3 ring-1 ring-silver-200">
      <div className="flex flex-wrap items-end gap-2">
        <Field label="Document type" className="min-w-44 flex-1">
          <Select value={type} onChange={(e) => setType(e.target.value)}>{DOC_TYPES.map((d) => <option key={d}>{d}</option>)}</Select>
        </Field>
        <label className="pressable inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg bg-surface px-4 text-[13.5px] font-semibold text-navy-800 shadow-flat hover:bg-silver-50">
          <Plus className="h-4 w-4" /> Attach file
          <input type="file" className="sr-only" onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) set('documents', [...docs, { type, fileName: f.name }])
            e.target.value = ''
          }} />
        </label>
      </div>
      {docs.length > 0 ? (
        <ul className="mt-3 divide-y divide-silver-200 rounded-lg bg-surface ring-1 ring-silver-200">
          {docs.map((d, i) => (
            <li key={i} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <span><strong className="text-navy-900">{d.type}</strong> · <span className="text-silver-600">{d.fileName}</span></span>
              <button type="button" aria-label="Remove document" className="rounded-md p-1 text-rose-600 hover:bg-rose-50" onClick={() => set('documents', docs.filter((_, j) => j !== i))}><X className="h-4 w-4" /></button>
            </li>
          ))}
        </ul>
      ) : <p className="mt-2 text-xs text-silver-600">Only the file name is kept in this demo.</p>}
    </div>
  )
}

export function PartiesPage({ type }: { type: PartyType }) {
  const scope = useMemo(() => (r: Row) => r.type === type, [type])
  const plural = type === 'Customer' ? 'Customers' : type === 'Vendor' ? 'Vendors' : 'Dealers'
  const eyebrow = type === 'Dealer' ? 'Dealer & Dispatch' : 'Master Setup'
  const desc = type === 'Customer' ? 'Everyone you sell to — with GST, bank and credit details.' : type === 'Vendor' ? 'Suppliers of tractors, spares and raw material.' : 'Dealer network for sales and service.'
  const groupFor = type === 'Vendor' ? 'ag2' : 'ag1'
  return (
    <CrudPage
      collection="parties" entity={type} title={plural} scope={scope} icon={type === 'Vendor' ? <Handshake className="h-5 w-5" /> : <Users className="h-5 w-5" />} eyebrow={eyebrow} description={desc}
      blank={(d) => ({
        id: uid('pt'), code: `${type[0]}${String(d.parties.filter((p) => p.type === type).length + 1).padStart(3, '0')}`, type, name: '', printName: '', accountGroupId: groupFor, category: PARTY_CATEGORIES[type][0],
        contactPerson: '', phone: '', phone2: '', email: '', fax: '', gstin: '', pan: '', aadhar: '', tin: '', iec: '', msme: '', msmeType: '', country: 'India', state: 'Gujarat', district: '', city: '', address: '', pin: '',
        bankName: '', accountNo: '', ifsc: '', openingBalance: 0, balanceType: type === 'Vendor' ? 'Cr' : 'Dr', creditDays: 30, status: 'Active', documents: [],
      })}
      columns={[
        { key: 'code', label: 'Code', render: (r) => <span className="font-mono text-xs font-semibold">{r.code}</span> },
        { key: 'name', label: 'Name', render: (r) => <>{strong(r.name)}{sub(r.category)}</>, text: (r) => r.name },
        { key: 'phone', label: 'Phone', render: (r) => <a className="text-sapphire-700 hover:underline" href={`tel:${r.phone}`}>{r.phone || '—'}</a>, text: (r) => r.phone },
        { key: 'city', label: 'City', render: (r) => `${r.city}${r.state ? `, ${r.state}` : ''}`, text: (r) => r.city, hideBelow: 'md' },
        { key: 'gstin', label: 'GSTIN', render: (r) => r.gstin || <span className="text-silver-500">Unregistered</span>, text: (r) => r.gstin, hideBelow: 'lg' },
        { key: 'balance', label: 'Opening bal.', align: 'right', render: (r) => (r.openingBalance ? `${money(r.openingBalance)} ${r.balanceType}` : '—'), text: (r) => r.openingBalance, hideBelow: 'lg' },
        { key: 'status', label: 'Status', render: (r) => <ActiveBadge status={r.status} />, text: (r) => r.status },
      ]}
      fields={[
        { key: 'name', label: `${type} name`, required: true, section: 'Identity', full: true }, { key: 'code', label: 'Code', required: true }, { key: 'printName', label: 'Print name' },
        { key: 'accountGroupId', label: 'Account group', type: 'select', options: (d) => opts(d.accountGroups) },
        { key: 'category', label: type === 'Vendor' ? 'Vendor type' : 'Category', type: 'select', required: true, options: PARTY_CATEGORIES[type].map((c) => ({ value: c, label: c })) },
        { key: 'contactPerson', label: 'Contact person' }, status(),
        { key: 'phone', label: 'Phone', type: 'tel', required: true, section: 'Contact' }, { key: 'phone2', label: 'Alternate phone', type: 'tel' }, { key: 'email', label: 'Email', type: 'email' }, { key: 'fax', label: 'Fax' },
        { key: 'gstin', label: 'GST number', section: 'Tax & registration', hint: '15 characters, if registered' }, { key: 'pan', label: 'PAN' }, { key: 'aadhar', label: 'Aadhar number' },
        { key: 'tin', label: 'TIN' }, { key: 'iec', label: 'IEC' }, { key: 'msme', label: 'MSME number' }, { key: 'msmeType', label: 'MSME type', type: 'select', options: ['Micro', 'Small', 'Medium'].map((m) => ({ value: m, label: m })) },
        { key: 'country', label: 'Country', section: 'Address' }, { key: 'state', label: 'State', type: 'select', options: ['Gujarat', 'Maharashtra', 'Rajasthan', 'Madhya Pradesh', 'Karnataka', 'Tamil Nadu', 'Punjab', 'Haryana'].map((s) => ({ value: s, label: s })) },
        { key: 'district', label: 'District' }, { key: 'city', label: 'City / village', required: true }, { key: 'pin', label: 'PIN code' }, { key: 'address', label: 'Address', type: 'textarea' },
        { key: 'bankName', label: 'Beneficiary bank', section: 'Bank details' }, { key: 'accountNo', label: 'Account number' }, { key: 'ifsc', label: 'IFSC code' },
        { key: 'openingBalance', label: 'Opening balance (₹)', type: 'number', min: 0, section: 'Credit & opening' },
        { key: 'balanceType', label: 'Dr / Cr', type: 'select', options: [{ value: 'Dr', label: 'Debit (receivable)' }, { value: 'Cr', label: 'Credit (payable)' }] },
        { key: 'creditDays', label: 'Credit days', type: 'number', min: 0 },
        { key: 'documents', label: 'Documents', section: 'Documents', render: (d, set) => <PartyDocuments draft={d} set={set} /> },
      ]}
      filters={[
        { key: 'state', label: 'State', options: (d) => [...new Set(d.parties.filter((p) => p.type === type).map((p) => p.state))].filter(Boolean).map((s) => ({ value: s, label: s })), test: (r, v) => r.state === v },
        { key: 'city', label: 'City', options: (d) => [...new Set(d.parties.filter((p) => p.type === type).map((p) => p.city))].filter(Boolean).sort().map((s) => ({ value: s, label: s })), test: (r, v) => r.city === v },
      ]}
      stats={(rows) => [
        { label: `Total ${plural.toLowerCase()}`, value: rows.length, numericValue: rows.length, icon: <Users className="h-5 w-5" />, tone: 'sapphire' },
        { label: 'GST registered', value: 0, numericValue: rows.filter((r) => r.gstin).length, icon: <Percent className="h-5 w-5" />, tone: 'emerald' },
        { label: 'Active', value: 0, numericValue: rows.filter((r) => r.status === 'Active').length, icon: <MapPin className="h-5 w-5" />, tone: 'cyan' },
        { label: 'Cities covered', value: 0, numericValue: new Set(rows.map((r) => r.city)).size, icon: <MapPin className="h-5 w-5" />, tone: 'violet' },
      ]}
      validate={(d, database) => {
        const e: Record<string, string> = {}
        if (dup(database.parties as unknown as Row[], 'code', d.code, d.id)) e.code = 'This code is already used.'
        if (d.gstin && !/^[0-9A-Z]{15}$/i.test(String(d.gstin).trim())) e.gstin = 'GSTIN must be 15 letters/digits.'
        if (d.pan && !/^[A-Z]{5}[0-9]{4}[A-Z]$/i.test(String(d.pan).trim())) e.pan = 'PAN looks like ABCDE1234F.'
        if (d.phone && String(d.phone).replace(/\D/g, '').length < 10) e.phone = 'Enter a valid phone number.'
        return e
      }}
      modalSize="xl"
    />
  )
}

export function AccountGroupsPage() {
  const nat = ['Asset', 'Liability', 'Income', 'Expense'].map((n) => ({ value: n, label: n }))
  return (
    <CrudPage
      collection="accountGroups" entity="Account group" title="Account Group" icon={<FolderTree className="h-5 w-5" />} eyebrow="Master Setup"
      description="Chart-of-accounts groups. Each group has a nature that decides where it reports."
      blank={() => ({ id: uid('ag'), name: '', isPrimary: true, parentId: '', nature: 'Asset', description: '' })}
      columns={[
        { key: 'name', label: 'Name', render: (r) => strong(r.name) },
        { key: 'nature', label: 'Nature', render: (r) => <Badge tone={r.nature === 'Asset' ? 'success' : r.nature === 'Liability' ? 'warning' : r.nature === 'Income' ? 'info' : 'danger'}>{r.nature}</Badge>, text: (r) => r.nature },
        { key: 'isPrimary', label: 'Primary', render: (r) => (r.isPrimary ? 'Yes' : 'No'), text: (r) => (r.isPrimary ? 'Yes' : 'No') },
        { key: 'parentId', label: 'Under', render: (r, db) => nameOf(db.accountGroups, r.parentId), text: (r, db) => nameOf(db.accountGroups, r.parentId), hideBelow: 'md' },
        { key: 'description', label: 'Description', hideBelow: 'lg' },
      ]}
      fields={[
        { key: 'name', label: 'Group name', required: true }, { key: 'nature', label: 'Nature', type: 'select', required: true, options: nat },
        { key: 'isPrimary', label: 'Primary', type: 'checkbox', hint: 'Primary (top-level) group' },
        { key: 'parentId', label: 'Under group', type: 'select', options: (db, d) => opts(db.accountGroups.filter((g) => g.id !== d.id)), visible: (d) => !d.isPrimary },
        { key: 'description', label: 'Description', type: 'textarea' },
      ]}
      prepare={(d) => ({ ...d, parentId: d.isPrimary ? '' : d.parentId })}
      validate={(d) => (!d.isPrimary && !d.parentId ? { parentId: 'Choose a parent group or mark it primary.' } : {})}
      modalSize="md"
    />
  )
}

export function WarehousesPage() {
  return (
    <CrudPage
      collection="warehouses" entity="Warehouse" title="Warehouses" icon={<Warehouse className="h-5 w-5" />} eyebrow="Inventory" description="Storage locations. The first warehouse is the main one that receives purchases and production."
      blank={() => ({ id: uid('wh'), name: '' })}
      columns={[{ key: 'name', label: 'Warehouse', render: (r) => strong(r.name) }, { key: 'main', label: 'Role', render: (r, db) => (db.warehouses[0]?.id === r.id ? <Badge tone="success">Main</Badge> : <Badge>Secondary</Badge>), text: (r, db) => (db.warehouses[0]?.id === r.id ? 'Main' : 'Secondary') }]}
      fields={[{ key: 'name', label: 'Warehouse name', required: true }]}
      validate={(d, db) => (dup(db.warehouses as unknown as Row[], 'name', d.name, d.id) ? { name: 'This warehouse already exists.' } : {})}
      modalSize="sm"
    />
  )
}

export function TransportPage({ kind }: { kind: 'Transport' | 'Courier' }) {
  const scope = useMemo(() => (r: Row) => r.kind === kind, [kind])
  return (
    <CrudPage
      collection="transporters" entity={kind === 'Transport' ? 'Transporter' : 'Courier'} title={kind === 'Transport' ? 'Transport' : 'Courier List'} scope={scope}
      icon={<Truck className="h-5 w-5" />} eyebrow="Dealer & Dispatch" description={kind === 'Transport' ? 'Transporters with their default freight charge.' : 'Courier partners for parcels and documents.'}
      blank={() => ({ id: uid('tp'), name: '', kind, contact: '', email: '', address: '', defaultCharge: 0 })}
      columns={[
        { key: 'name', label: kind === 'Transport' ? 'Transporter' : 'Courier', render: (r) => strong(r.name) }, { key: 'contact', label: 'Contact' }, { key: 'email', label: 'Email', hideBelow: 'md' },
        { key: 'address', label: 'Address', hideBelow: 'lg' }, { key: 'defaultCharge', label: 'Default charge', align: 'right', render: (r) => money(r.defaultCharge), text: (r) => r.defaultCharge },
        { key: 'used', label: 'Deliveries', align: 'right', render: (r, db) => db.docs.filter((d) => d.transporterId === r.id).length },
      ]}
      fields={[
        { key: 'name', label: 'Name', required: true }, { key: 'contact', label: 'Contact number', type: 'tel' }, { key: 'email', label: 'Email', type: 'email' },
        { key: 'defaultCharge', label: 'Default charge (₹)', type: 'number', min: 0 }, { key: 'address', label: 'Address', type: 'textarea' },
      ]}
      modalSize="md"
    />
  )
}

