import type { Database } from '@/types'

type Check = { label: string; test: (db: Database, id: string) => boolean }

const any = <T,>(list: T[], fn: (x: T) => boolean) => list.some(fn)

/** Which records still point at a master record, keyed by collection. */
const CHECKS: Record<string, Check[]> = {
  parties: [
    { label: 'documents', test: (db, id) => any(db.docs, (d) => d.partyId === id) },
    { label: 'complaints or AMC contracts', test: (db, id) => any(db.complaints, (c) => c.partyId === id) || any(db.amcs, (a) => a.partyId === id) },
  ],
  items: [
    { label: 'document lines', test: (db, id) => any(db.docs, (d) => any(d.lines, (l) => l.itemId === id)) },
    { label: 'BOMs or work orders', test: (db, id) => any(db.boms, (b) => b.productId === id || any(b.components, (c) => c.itemId === id)) || any(db.workOrders, (w) => w.productId === id) },
    { label: 'stock movements', test: (db, id) => any(db.stockMoves, (m) => m.itemId === id) },
  ],
  taxes: [{ label: 'items', test: (db, id) => any(db.items, (i) => i.taxId === id) }],
  units: [{ label: 'items or packing units', test: (db, id) => any(db.items, (i) => i.baseUnitId === id || i.saleUnitId === id || i.purchaseUnitId === id) || any(db.packingUnits, (p) => p.baseUnitId === id) }],
  categories: [{ label: 'items', test: (db, id) => any(db.items, (i) => i.categoryId === id || i.brandId === id) }],
  itemGroups: [{ label: 'items or child groups', test: (db, id) => any(db.items, (i) => i.groupId === id) || any(db.itemGroups, (g) => g.parentId === id) }],
  accountGroups: [{ label: 'parties, ledgers or child groups', test: (db, id) => any(db.parties, (p) => p.accountGroupId === id) || any(db.ledgers, (l) => l.groupId === id) || any(db.accountGroups, (g) => g.parentId === id) }],
  branches: [{ label: 'departments, designations or employees', test: (db, id) => any(db.departments, (d) => d.branchId === id) || any(db.designations, (d) => d.branchId === id) || any(db.employees, (e) => e.branchId === id) }],
  departments: [{ label: 'designations or employees', test: (db, id) => any(db.designations, (d) => d.departmentId === id) || any(db.employees, (e) => e.departmentId === id) }],
  designations: [{ label: 'employees', test: (db, id) => any(db.employees, (e) => e.designationId === id) }],
  transporters: [{ label: 'delivery notes', test: (db, id) => any(db.docs, (d) => d.transporterId === id) }],
  warehouses: [{ label: 'stock movements', test: (db, id) => any(db.stockMoves, (m) => m.warehouseId === id) }],
  packingUnits: [{ label: 'items or conversions', test: (db, id) => any(db.items, (i) => i.packingUnitId === id) || any(db.packingConversions, (c) => c.fromId === id || c.toId === id) }],
  ledgers: [{ label: 'vouchers', test: (db, id) => any(db.vouchers, (v) => v.debitAcc === `led:${id}` || v.creditAcc === `led:${id}`) }],
  expenseCategories: [{ label: 'expenses', test: (db, id) => any(db.expenses, (e) => e.categoryId === id) }],
  employees: [{ label: 'attendance or leave records', test: (db, id) => any(db.attendance, (a) => a.employeeId === id) || any(db.leaves, (l) => l.employeeId === id) }],
  roles: [{ label: 'users', test: (db, id) => any(db.users, (u) => u.roleId === id) }],
  organizations: [{ label: 'users', test: (db, id) => any(db.users, (u) => u.orgId === id) }],
  boms: [{ label: 'work orders', test: (db, id) => any(db.workOrders, (w) => w.bomId === id) }],
  series: [{ label: 'documents', test: (db, id) => any(db.docs, (d) => d.seriesId === id) }],
}

/** A human reason the record cannot be deleted, or null when it is free to go. */
export function inUse(db: Database, collection: string, id: string): string | null {
  for (const check of CHECKS[collection] ?? []) {
    if (check.test(db, id)) return `It is still used by ${check.label}.`
  }
  return null
}
