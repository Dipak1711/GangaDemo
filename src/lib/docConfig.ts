import type { DocKind } from '@/types'

export type LineMode = 'priced' | 'receipt' | 'delivery' | 'qty' | 'return' | 'payment'
export type HeaderField =
  | 'reference'
  | 'paymentTerms'
  | 'gstType'
  | 'transporter'
  | 'vehicle'
  | 'tracking'
  | 'personCarrying'
  | 'receiver'
  | 'gateType'
  | 'purpose'
  | 'returnType'
  | 'reason'
  | 'dealer'
  | 'deliveryAddress'

export interface DocMeta {
  kind: DocKind
  label: string
  plural: string
  side: 'sales' | 'purchase'
  partyType: 'Customer' | 'Vendor'
  route: string
  statuses: string[]
  lineMode: LineMode
  dateLabel: string
  extraDate?: { key: 'dueDate' | 'validTill' | 'deliveryDate'; label: string; offsetDays: number }
  fields: HeaderField[]
  hasSundries: boolean
  hasSerials: boolean
  moneyDoc: boolean
  convert: Array<{ to: DocKind; label: string }>
  series: Array<{ prefix: string; pad: number }>
  description: string
}

const S = 'sales' as const
const P = 'purchase' as const

export const DOC_META: Record<DocKind, DocMeta> = {
  salesQuotation: {
    kind: 'salesQuotation', label: 'Sales Quotation', plural: 'Sales Quotations', side: S, partyType: 'Customer',
    route: '/sales/quotations', statuses: ['Draft', 'Sent', 'Approved', 'Rejected', 'Converted'],
    lineMode: 'priced', dateLabel: 'Quotation date', extraDate: { key: 'validTill', label: 'Valid till', offsetDays: 15 },
    fields: ['gstType', 'reference', 'dealer'], hasSundries: true, hasSerials: false, moneyDoc: true,
    convert: [{ to: 'salesOrder', label: 'Create sales order' }],
    series: [{ prefix: 'SQ-26-', pad: 4 }, { prefix: 'AGRI-', pad: 4 }],
    description: 'Price offers sent to customers, valid until a date, convertible to a sales order.',
  },
  salesOrder: {
    kind: 'salesOrder', label: 'Sales Order', plural: 'Sales Orders', side: S, partyType: 'Customer',
    route: '/sales/orders', statuses: ['Open', 'Packed', 'Invoiced', 'Cancelled'],
    lineMode: 'priced', dateLabel: 'Order date', extraDate: { key: 'deliveryDate', label: 'Delivery date (tentative)', offsetDays: 10 },
    fields: ['gstType', 'reference', 'dealer'], hasSundries: true, hasSerials: false, moneyDoc: true,
    convert: [
      { to: 'salesPacking', label: 'Create packaging list' },
      { to: 'salesInvoice', label: 'Create sales invoice' },
    ],
    series: [{ prefix: 'GST/', pad: 4 }, { prefix: 'SO-', pad: 4 }],
    description: 'Confirmed customer orders with delivery commitments.',
  },
  salesPacking: {
    kind: 'salesPacking', label: 'Packaging List', plural: 'Packaging Lists', side: S, partyType: 'Customer',
    route: '/sales/packaging', statuses: ['Pending', 'Packed', 'Dispatched'],
    lineMode: 'qty', dateLabel: 'Packing date', extraDate: { key: 'deliveryDate', label: 'Delivery date', offsetDays: 5 },
    fields: ['reference'], hasSundries: false, hasSerials: false, moneyDoc: false,
    convert: [{ to: 'salesInvoice', label: 'Create sales invoice' }],
    series: [{ prefix: 'PKG-', pad: 3 }, { prefix: 'PACK-', pad: 3 }],
    description: 'What is packed for each order, ready for billing and dispatch.',
  },
  salesInvoice: {
    kind: 'salesInvoice', label: 'Sales Invoice', plural: 'Sales Invoices', side: S, partyType: 'Customer',
    route: '/sales/invoices', statuses: ['Issued', 'Cancelled'],
    lineMode: 'priced', dateLabel: 'Invoice date', extraDate: { key: 'dueDate', label: 'Due date', offsetDays: 30 },
    fields: ['gstType', 'paymentTerms', 'reference', 'dealer'], hasSundries: true, hasSerials: true, moneyDoc: true,
    convert: [
      { to: 'receipt', label: 'Receive payment' },
      { to: 'deliveryNote', label: 'Create delivery note' },
      { to: 'gatePass', label: 'Create gate pass' },
      { to: 'salesReturn', label: 'Create sales return' },
    ],
    series: [{ prefix: 'DS-', pad: 2 }, { prefix: 'INV-', pad: 4 }],
    description: 'Tax invoices. Posting an invoice reduces stock and raises the receivable.',
  },
  deliveryNote: {
    kind: 'deliveryNote', label: 'Delivery Note', plural: 'Delivery Notes', side: S, partyType: 'Customer',
    route: '/sales/delivery', statuses: ['Pending', 'In Transit', 'Delivered'],
    lineMode: 'delivery', dateLabel: 'DN date', extraDate: { key: 'deliveryDate', label: 'Delivery date', offsetDays: 3 },
    fields: ['reference', 'transporter', 'vehicle', 'tracking', 'receiver', 'deliveryAddress'], hasSundries: false, hasSerials: false, moneyDoc: false,
    convert: [{ to: 'gatePass', label: 'Create gate pass' }],
    series: [{ prefix: 'DN-', pad: 3 }, { prefix: 'DEL-', pad: 3 }],
    description: 'Proof of delivery with transporter, tracking and receiver details.',
  },
  gatePass: {
    kind: 'gatePass', label: 'Gate Pass', plural: 'Gate Passes', side: S, partyType: 'Customer',
    route: '/sales/gate-pass', statuses: ['Active', 'Closed', 'Cancelled'],
    lineMode: 'qty', dateLabel: 'Gate pass date',
    fields: ['gateType', 'purpose', 'vehicle', 'personCarrying'], hasSundries: false, hasSerials: false, moneyDoc: false,
    convert: [],
    series: [{ prefix: 'GP-', pad: 3 }, { prefix: 'OUT-', pad: 3 }],
    description: 'Authorises material to leave (or enter) the premises.',
  },
  salesReturn: {
    kind: 'salesReturn', label: 'Sales Return', plural: 'Sales Returns', side: S, partyType: 'Customer',
    route: '/sales/returns', statuses: ['Pending', 'Approved', 'Closed'],
    lineMode: 'return', dateLabel: 'Return date',
    fields: ['returnType', 'reason'], hasSundries: false, hasSerials: false, moneyDoc: true,
    convert: [],
    series: [{ prefix: 'SR-', pad: 3 }, { prefix: 'RTN-', pad: 3 }],
    description: 'Goods returned by customers. Good-condition items go back into stock.',
  },
  receipt: {
    kind: 'receipt', label: 'Receive Payment', plural: 'Customer Receipts', side: S, partyType: 'Customer',
    route: '/sales/receipts', statuses: ['Posted', 'Cancelled'],
    lineMode: 'payment', dateLabel: 'Payment date',
    fields: ['reference'], hasSundries: false, hasSerials: false, moneyDoc: true,
    convert: [],
    series: [{ prefix: 'REC-', pad: 3 }, { prefix: 'PAY-', pad: 3 }],
    description: 'Money received from customers, allocated against open invoices.',
  },
  purchaseQuotation: {
    kind: 'purchaseQuotation', label: 'Purchase Quotation', plural: 'Purchase Quotations', side: P, partyType: 'Vendor',
    route: '/purchase/quotations', statuses: ['Draft', 'Received', 'Approved', 'Rejected', 'Converted'],
    lineMode: 'priced', dateLabel: 'Quotation date', extraDate: { key: 'validTill', label: 'Valid till', offsetDays: 15 },
    fields: ['gstType', 'reference'], hasSundries: true, hasSerials: false, moneyDoc: true,
    convert: [{ to: 'purchaseOrder', label: 'Create purchase order' }],
    series: [{ prefix: 'PQ-', pad: 3 }],
    description: 'Price offers received from vendors.',
  },
  purchaseOrder: {
    kind: 'purchaseOrder', label: 'Purchase Order', plural: 'Purchase Orders', side: P, partyType: 'Vendor',
    route: '/purchase/orders', statuses: ['Open', 'Partially Received', 'Received', 'Cancelled'],
    lineMode: 'priced', dateLabel: 'Order date', extraDate: { key: 'deliveryDate', label: 'Delivery date', offsetDays: 10 },
    fields: ['gstType', 'reference'], hasSundries: true, hasSerials: false, moneyDoc: true,
    convert: [
      { to: 'goodsReceipt', label: 'Create goods receipt' },
      { to: 'purchaseInvoice', label: 'Create purchase invoice' },
    ],
    series: [{ prefix: 'PO-', pad: 3 }],
    description: 'Orders placed with vendors.',
  },
  goodsReceipt: {
    kind: 'goodsReceipt', label: 'Goods Receipt (GRM)', plural: 'Goods Receipts', side: P, partyType: 'Vendor',
    route: '/purchase/receipts', statuses: ['Draft', 'Received', 'Inspected', 'Accepted', 'Rejected'],
    lineMode: 'receipt', dateLabel: 'Receipt date',
    fields: ['reference'], hasSundries: false, hasSerials: false, moneyDoc: true,
    convert: [{ to: 'purchaseInvoice', label: 'Create purchase invoice' }],
    series: [{ prefix: 'GRM-', pad: 3 }],
    description: 'Goods received against a PO with quality inspection. Accepted quantity enters stock.',
  },
  purchasePacking: {
    kind: 'purchasePacking', label: 'Packaging List', plural: 'Purchase Packaging Lists', side: P, partyType: 'Vendor',
    route: '/purchase/packaging', statuses: ['Pending', 'Packed', 'Dispatched'],
    lineMode: 'qty', dateLabel: 'Packing date', extraDate: { key: 'deliveryDate', label: 'Delivery date', offsetDays: 5 },
    fields: ['reference'], hasSundries: false, hasSerials: false, moneyDoc: false,
    convert: [],
    series: [{ prefix: 'PPK-', pad: 3 }],
    description: 'Vendor packing details for inbound consignments.',
  },
  purchaseInvoice: {
    kind: 'purchaseInvoice', label: 'Purchase Invoice', plural: 'Purchase Invoices', side: P, partyType: 'Vendor',
    route: '/purchase/invoices', statuses: ['Issued', 'Cancelled'],
    lineMode: 'priced', dateLabel: 'Invoice date', extraDate: { key: 'dueDate', label: 'Due date', offsetDays: 30 },
    fields: ['gstType', 'paymentTerms', 'reference'], hasSundries: true, hasSerials: false, moneyDoc: true,
    convert: [
      { to: 'vendorPayment', label: 'Pay vendor' },
      { to: 'purchaseReturn', label: 'Create purchase return' },
    ],
    series: [{ prefix: 'DP-', pad: 2 }, { prefix: 'PINV-', pad: 3 }],
    description: 'Vendor bills. Posting raises the payable (and stock, unless received via a GRM).',
  },
  purchaseDelivery: {
    kind: 'purchaseDelivery', label: 'Delivery Note', plural: 'Purchase Delivery Notes', side: P, partyType: 'Vendor',
    route: '/purchase/delivery', statuses: ['Pending', 'In Transit', 'Delivered'],
    lineMode: 'delivery', dateLabel: 'DN date', extraDate: { key: 'deliveryDate', label: 'Delivery date', offsetDays: 3 },
    fields: ['reference', 'transporter', 'vehicle', 'tracking'], hasSundries: false, hasSerials: false, moneyDoc: false,
    convert: [],
    series: [{ prefix: 'PDN-', pad: 3 }],
    description: 'Inbound delivery tracking from vendors.',
  },
  purchaseGatePass: {
    kind: 'purchaseGatePass', label: 'Gate Pass', plural: 'Purchase Gate Passes', side: P, partyType: 'Vendor',
    route: '/purchase/gate-pass', statuses: ['Active', 'Closed', 'Cancelled'],
    lineMode: 'qty', dateLabel: 'Gate pass date',
    fields: ['gateType', 'purpose', 'vehicle', 'personCarrying'], hasSundries: false, hasSerials: false, moneyDoc: false,
    convert: [],
    series: [{ prefix: 'PGP-', pad: 3 }],
    description: 'Entry/exit authorisation for vendor material.',
  },
  purchaseReturn: {
    kind: 'purchaseReturn', label: 'Purchase Return', plural: 'Purchase Returns', side: P, partyType: 'Vendor',
    route: '/purchase/returns', statuses: ['Pending', 'Approved', 'Closed'],
    lineMode: 'return', dateLabel: 'Return date',
    fields: ['returnType', 'reason'], hasSundries: false, hasSerials: false, moneyDoc: true,
    convert: [],
    series: [{ prefix: 'PR-', pad: 3 }],
    description: 'Goods sent back to vendors; reduces stock and the payable.',
  },
  vendorPayment: {
    kind: 'vendorPayment', label: 'Pay Payment', plural: 'Vendor Payments', side: P, partyType: 'Vendor',
    route: '/purchase/payments', statuses: ['Posted', 'Cancelled'],
    lineMode: 'payment', dateLabel: 'Payment date',
    fields: ['reference'], hasSundries: false, hasSerials: false, moneyDoc: true,
    convert: [],
    series: [{ prefix: 'VPAY-', pad: 3 }],
    description: 'Payments to vendors with optional TDS, allocated against purchase invoices.',
  },
}

export const DOC_KINDS = Object.keys(DOC_META) as DocKind[]
