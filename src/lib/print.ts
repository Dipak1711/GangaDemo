import type { Database, Doc } from '@/types'
import { DOC_META } from '@/lib/docConfig'
import { byId, calcDoc, calcLine, lineQty, taxRate } from '@/lib/calc'
import { formatDate, formatMoney, printHTML } from '@/lib/utils'

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

function twoDigits(n: number): string {
  return n < 20 ? ONES[n] : `${TENS[Math.floor(n / 10)]}${n % 10 ? ` ${ONES[n % 10]}` : ''}`
}
function threeDigits(n: number): string {
  const h = Math.floor(n / 100)
  const r = n % 100
  return `${h ? `${ONES[h]} Hundred${r ? ' ' : ''}` : ''}${r ? twoDigits(r) : ''}`
}

/** Indian-system amount in words, e.g. "Rupees One Lakh Twenty Thousand Only". */
export function amountInWords(value: number): string {
  const rupees = Math.floor(Math.abs(value))
  const paise = Math.round((Math.abs(value) - rupees) * 100)
  if (rupees === 0 && paise === 0) return 'Rupees Zero Only'
  const parts: string[] = []
  const crore = Math.floor(rupees / 10_000_000)
  const lakh = Math.floor((rupees % 10_000_000) / 100_000)
  const thousand = Math.floor((rupees % 100_000) / 1000)
  const rest = rupees % 1000
  if (crore) parts.push(`${threeDigits(crore)} Crore`)
  if (lakh) parts.push(`${twoDigits(lakh)} Lakh`)
  if (thousand) parts.push(`${twoDigits(thousand)} Thousand`)
  if (rest) parts.push(threeDigits(rest))
  let words = `Rupees ${parts.join(' ')}`.trim()
  if (paise) words += ` and ${twoDigits(paise)} Paise`
  return `${words} Only`
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export function printDocument(doc: Doc, db: Database): void {
  const meta = DOC_META[doc.kind]
  const party = byId(db.parties, doc.partyId)
  const c = db.company
  const t = calcDoc(doc, db.taxes)
  const isPayment = meta.lineMode === 'payment'
  const unit = (itemId: string) => db.units.find((u) => u.id === byId(db.items, itemId)?.baseUnitId)?.alias ?? ''

  const rows = doc.lines
    .map((l, i) => {
      const item = byId(db.items, l.itemId)
      const calc = calcLine(doc, l, db.taxes)
      const serial = l.serials.length ? `<div class="muted" style="font-size:10.5px">Serial: ${esc(l.serials.join(', '))}</div>` : ''
      if (!meta.moneyDoc) {
        return `<tr><td>${i + 1}</td><td>${esc(item?.name ?? '')}${serial}</td><td class="r">${lineQty(doc, l)}</td><td>${unit(l.itemId)}</td><td>${esc(l.remarks)}</td></tr>`
      }
      return `<tr><td>${i + 1}</td><td>${esc(item?.name ?? '')}<div class="muted" style="font-size:10.5px">HSN ${esc(item?.hsn ?? '')}</div>${serial}</td><td class="r">${lineQty(doc, l)} ${unit(l.itemId)}</td><td class="r">${formatMoney(l.rate)}</td><td class="r">${l.discountPct || 0}%</td><td class="r">${taxRate(byId(db.taxes, l.taxId))}%</td><td class="r">${formatMoney(calc.net)}</td></tr>`
    })
    .join('')
  const head = meta.moneyDoc
    ? '<tr><th>#</th><th>Item</th><th class="r">Qty</th><th class="r">Rate</th><th class="r">Disc</th><th class="r">GST</th><th class="r">Taxable</th></tr>'
    : '<tr><th>#</th><th>Item</th><th class="r">Qty</th><th>Unit</th><th>Remarks</th></tr>'

  const taxRows = doc.gstType === 'Inter'
    ? `<tr><td>IGST</td><td class="r">${formatMoney(t.igst)}</td></tr>`
    : `<tr><td>CGST</td><td class="r">${formatMoney(t.cgst)}</td></tr><tr><td>SGST</td><td class="r">${formatMoney(t.sgst)}</td></tr>`
  const sundryRows = doc.sundries.map((s) => `<tr><td>${esc(s.name)} (${s.sign === 'Add' ? '+' : '−'})</td><td class="r">${s.mode === 'Percent' ? `${s.value}%` : formatMoney(s.value)}</td></tr>`).join('')

  const totals = isPayment
    ? `<table class="tot" style="width:320px;margin-left:auto"><tr><td><strong>Amount ${doc.kind === 'receipt' ? 'received' : 'paid'}</strong></td><td class="r"><strong>${formatMoney(doc.amount)}</strong></td></tr>${doc.kind === 'vendorPayment' && doc.tdsPct ? `<tr><td>TDS @ ${doc.tdsPct}%</td><td class="r">${formatMoney((doc.amount * doc.tdsPct) / 100)}</td></tr>` : ''}</table>`
    : meta.moneyDoc
      ? `<table class="tot" style="width:320px;margin-left:auto"><tr><td>Gross</td><td class="r">${formatMoney(t.gross)}</td></tr><tr><td>Discount</td><td class="r">− ${formatMoney(t.discount)}</td></tr><tr><td>Taxable value</td><td class="r">${formatMoney(t.taxable)}</td></tr>${taxRows}${sundryRows}<tr><td>Round off</td><td class="r">${formatMoney(t.roundOff)}</td></tr><tr><td><strong>Grand total</strong></td><td class="r"><strong>${formatMoney(t.total)}</strong></td></tr></table>`
      : ''

  const allocRows = isPayment && doc.allocations.length
    ? `<h2>Settled against</h2><table><tr><th>Invoice</th><th class="r">Amount</th></tr>${doc.allocations.map((a) => `<tr><td>${esc(db.docs.find((d) => d.id === a.docId)?.no ?? '')}</td><td class="r">${formatMoney(a.amount)}</td></tr>`).join('')}</table>`
    : ''

  const labels = db.printSetup.copies > 1 ? db.printSetup.copyLabels.slice(0, db.printSetup.copies) : ['']
  const page = (label: string) => `
  <section style="page-break-after:always">
    <div class="head"><div>
      ${db.printSetup.showLogo ? `<div class="brand">${esc(c.name)}</div>` : ''}
      <div class="muted">${esc(c.address1)}, ${esc(c.city)}, ${esc(c.state)} ${esc(c.pin)}<br>GSTIN ${esc(c.gstin)} · ${esc(c.mobile)} · ${esc(c.email)}</div>
    </div><div style="text-align:right"><h1>${esc(doc.kind === 'salesInvoice' ? db.printSetup.headerTitle : meta.label.toUpperCase())}</h1>${label ? `<div class="muted">${esc(label)}</div>` : ''}</div></div>
    <div class="grid">
      <div class="box"><strong>${meta.partyType === 'Customer' ? 'Bill to' : 'Supplier'}</strong><br>${esc(party?.name ?? '')}<br>${esc(party?.address ?? '')}, ${esc(party?.city ?? '')}<br>${party?.gstin ? `GSTIN ${esc(party.gstin)}<br>` : ''}${esc(party?.phone ?? '')}</div>
      <div class="box"><strong>${esc(meta.label)} no:</strong> ${esc(doc.no)}<br><strong>Date:</strong> ${formatDate(doc.date)}${meta.extraDate && doc[meta.extraDate.key] ? `<br><strong>${esc(meta.extraDate.label)}:</strong> ${formatDate(doc[meta.extraDate.key])}` : ''}${doc.refNo ? `<br><strong>Ref:</strong> ${esc(doc.refNo)}` : ''}${doc.reference ? `<br><strong>Reference:</strong> ${esc(doc.reference)}` : ''}${doc.method && isPayment ? `<br><strong>Mode:</strong> ${esc(doc.method)}` : ''}${doc.vehicleNo ? `<br><strong>Vehicle:</strong> ${esc(doc.vehicleNo)}` : ''}</div>
    </div>
    ${isPayment ? '' : `<table>${head}${rows}</table>`}
    ${allocRows}
    <div style="margin-top:12px">${totals}</div>
    ${meta.moneyDoc ? `<p style="margin-top:10px"><strong>Amount in words:</strong> ${esc(amountInWords(isPayment ? doc.amount : t.total))}</p>` : ''}
    ${doc.notes ? `<p><strong>Notes:</strong> ${esc(doc.notes)}</p>` : ''}
    ${doc.terms ? `<h2>Terms &amp; conditions</h2><div class="muted" style="white-space:pre-line">${esc(doc.terms)}</div>` : ''}
    <div class="sig"><div>${db.printSetup.showSignature ? 'Receiver’s signature' : ''}</div><div style="text-align:right">${db.printSetup.showSignature ? `For ${esc(c.name)}<br><br><br>Authorised signatory` : ''}</div></div>
    <p class="muted" style="text-align:center;margin-top:18px">${esc(db.printSetup.footerNote)}</p>
  </section>`
  printHTML(`${meta.label} ${doc.no}`, labels.map(page).join(''))
}
