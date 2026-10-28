import { useMemo, useState } from 'react'
import { ArrowLeftRight, Calculator, Hash, Printer, Save, ScrollText, Wand2 } from 'lucide-react'
import type { DocKind, PrintSetup } from '@/types'
import { useData } from '@/store/DataContext'
import { useToast } from '@/store/ToastContext'
import { useAccess } from '@/hooks/useAccess'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Card, CardHeader } from '@/components/ui/Card'
import { Checkbox, Field, Input, Select, Textarea } from '@/components/ui/Form'
import { PageHeader } from '@/components/ui/Layout'
import { Modal } from '@/components/ui/Modal'
import { SegmentedTabs } from '@/components/ui/SegmentedTabs'
import { CrudPage } from '@/components/Crud'
import { soldSerials, nameOf } from '@/lib/calc'
import { DOC_META } from '@/lib/docConfig'
import { formatMoney, pad, uid } from '@/lib/utils'
import { strong, sub } from '@/pages/common'

/* ------------------------------------------------------------------ */
/* Serial numbers                                                      */
/* ------------------------------------------------------------------ */

export function SerialsPage() {
  const { db, mutate } = useData()
  const toast = useToast()
  const { canEdit } = useAccess()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ itemId: '', prefix: '', start: 1, digits: 4, qty: 5, dealerCode: '', empCode: '' })
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }))
  const sold = useMemo(() => soldSerials(db), [db])
  const tractorItems = db.items.filter((i) => i.serialRequired)
  const preview = form.itemId && form.qty > 0 ? `${form.prefix}${pad(form.start, form.digits)} … ${form.prefix}${pad(form.start + form.qty - 1, form.digits)}` : ''

  const generate = () => {
    if (!form.itemId) return toast.error('Choose a serial-tracked item.')
    if (!(form.qty >= 1 && form.qty <= 500)) return toast.error('Quantity must be between 1 and 500.')
    if (!(form.digits >= 1 && form.digits <= 10)) return toast.error('Digits must be between 1 and 10.')
    const serials = Array.from({ length: form.qty }, (_, i) => `${form.prefix}${pad(form.start + i, form.digits)}`)
    const clash = serials.find((s) => db.serials.some((x) => x.serial === s))
    if (clash) return toast.error(`Serial ${clash} already exists. Change the prefix or starting number.`)
    mutate((d) => { serials.forEach((serial) => d.serials.push({ id: uid('sn'), itemId: form.itemId, serial, dealerCode: form.dealerCode, empCode: form.empCode })) }, { action: 'Created', entity: 'serials', detail: `${serials.length} serials for ${nameOf(db.items, form.itemId)}` })
    toast.success(`${serials.length} serial number(s) generated.`)
    setOpen(false)
  }

  return (
    <>
      <CrudPage
        collection="serials" entity="Serial number" title="Serial Numbers" icon={<Hash className="h-5 w-5" />} eyebrow="Master Setup" labelOf={(r) => r.serial}
        description="Serial numbers for tractors and other tracked items. Generate a range, then pick from it when invoicing."
        blank={() => ({ id: uid('sn'), itemId: '', serial: '', dealerCode: '', empCode: '' })}
        columns={[
          { key: 'serial', label: 'Serial', render: (r) => <span className="font-mono text-[13px] font-semibold text-navy-900">{r.serial}</span> },
          { key: 'itemId', label: 'Item', render: (r, d) => nameOf(d.items, r.itemId), text: (r, d) => nameOf(d.items, r.itemId) },
          { key: 'dealerCode', label: 'Dealer', hideBelow: 'md' }, { key: 'empCode', label: 'Employee', hideBelow: 'md' },
          { key: 'status', label: 'Status', render: (r) => <Badge tone={sold.has(r.serial) ? 'warning' : 'success'} dot>{sold.has(r.serial) ? 'Sold' : 'Available'}</Badge>, text: (r) => (sold.has(r.serial) ? 'Sold' : 'Available') },
        ]}
        fields={[
          { key: 'itemId', label: 'Item', type: 'select', required: true, options: () => tractorItems.map((i) => ({ value: i.id, label: i.name })) }, { key: 'serial', label: 'Serial number', required: true },
          { key: 'dealerCode', label: 'Dealer code / name' }, { key: 'empCode', label: 'Employee code / name' },
        ]}
        filters={[
          { key: 'item', label: 'Item', options: () => tractorItems.map((i) => ({ value: i.id, label: i.name })), test: (r, v) => r.itemId === v },
          { key: 'st', label: 'Status', options: [{ value: 'Available', label: 'Available' }, { value: 'Sold', label: 'Sold' }], test: (r, v) => (v === 'Sold') === sold.has(r.serial) },
        ]}
        validate={(d, database) => (database.serials.some((s) => s.id !== d.id && s.serial === String(d.serial).trim()) ? { serial: 'This serial number already exists.' } : {})}
        canDelete={(r) => (sold.has(r.serial) ? 'This serial number is on a sold invoice.' : null)}
        headerActions={canEdit ? <Button variant="secondary" icon={<Wand2 className="h-4 w-4" />} onClick={() => { setForm((f) => ({ ...f, itemId: tractorItems[0]?.id ?? '' })); setOpen(true) }}>Generate range</Button> : null}
        modalSize="md" pageSize={25}
      />
      <Modal open={open} onClose={() => setOpen(false)} size="md" title="Generate serial numbers" subtitle="Creates a numbered range for one item"
        footer={<><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={generate} icon={<Wand2 className="h-4 w-4" />}>Generate</Button></>}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Item" required className="sm:col-span-2"><Select value={form.itemId} onChange={(e) => set('itemId', e.target.value)}><option value="">Select item…</option>{tractorItems.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}</Select></Field>
          <Field label="Serial prefix"><Input value={form.prefix} onChange={(e) => set('prefix', e.target.value)} placeholder="e.g. MH575-26-" /></Field>
          <Field label="Starting number"><Input type="number" min={0} value={form.start} onChange={(e) => set('start', Number(e.target.value))} /></Field>
          <Field label="Number of digits"><Input type="number" min={1} value={form.digits} onChange={(e) => set('digits', Number(e.target.value))} /></Field>
          <Field label="Quantity to generate" required><Input type="number" min={1} value={form.qty} onChange={(e) => set('qty', Number(e.target.value))} /></Field>
          <Field label="Dealer code / name"><Input value={form.dealerCode} onChange={(e) => set('dealerCode', e.target.value)} /></Field>
          <Field label="Employee code / name"><Input value={form.empCode} onChange={(e) => set('empCode', e.target.value)} /></Field>
        </div>
        {preview ? <p className="mt-4 rounded-xl bg-silver-50 px-3 py-2.5 font-mono text-xs text-navy-800 ring-1 ring-silver-200">{preview}</p> : null}
      </Modal>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Print setup                                                         */
/* ------------------------------------------------------------------ */

export function PrintSetupPage() {
  const { db, mutate } = useData()
  const toast = useToast()
  const { canEdit } = useAccess()
  const [form, setForm] = useState<PrintSetup>(db.printSetup)
  const dirty = JSON.stringify(form) !== JSON.stringify(db.printSetup)
  const set = <K extends keyof PrintSetup>(k: K, v: PrintSetup[K]) => setForm((f) => ({ ...f, [k]: v }))
  const labels = Array.from({ length: Math.max(form.copies, 1) }, (_, i) => form.copyLabels[i] ?? `Copy ${i + 1}`)
  const save = () => {
    if (!(form.copies >= 1 && form.copies <= 5)) return toast.error('Copies must be between 1 and 5.')
    mutate((d) => { d.printSetup = { ...form, copyLabels: labels } }, { action: 'Updated', entity: 'printSetup', detail: 'Print setup saved' })
    toast.success('Print setup saved.')
  }
  return (
    <>
      <PageHeader title="Print Setup" eyebrow="Master Setup" icon={<Printer className="h-5 w-5" />} description="How printed documents look: number of copies, copy labels, header, logo and signature."
        actions={canEdit ? <><Button variant="outline" disabled={!dirty} onClick={() => setForm(db.printSetup)}>Discard</Button><Button icon={<Save className="h-4 w-4" />} disabled={!dirty} onClick={save}>Save</Button></> : undefined} />
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Layout" accent="sapphire" />
          <fieldset disabled={!canEdit} className="mt-4 grid gap-4">
            <Field label="Number of copies (1–5)"><Input type="number" min={1} max={5} value={form.copies} onChange={(e) => set('copies', Math.min(5, Math.max(1, Number(e.target.value))))} /></Field>
            {labels.map((l, i) => <Field key={i} label={`Copy ${i + 1} label`}><Input value={l} onChange={(e) => set('copyLabels', labels.map((x, j) => (j === i ? e.target.value : x)))} /></Field>)}
            <Field label="Invoice header title"><Input value={form.headerTitle} onChange={(e) => set('headerTitle', e.target.value)} /></Field>
            <Field label="Footer note"><Input value={form.footerNote} onChange={(e) => set('footerNote', e.target.value)} /></Field>
            <div className="flex flex-wrap gap-5"><Checkbox label="Show company name / logo" checked={form.showLogo} onChange={(e) => set('showLogo', e.target.checked)} /><Checkbox label="Show signature block" checked={form.showSignature} onChange={(e) => set('showSignature', e.target.checked)} /></div>
          </fieldset>
        </Card>
        <Card>
          <CardHeader title="Preview" subtitle={`${form.copies} copy page${form.copies === 1 ? '' : 's'} per print`} accent="gold" />
          <div className="mt-4 rounded-xl bg-white p-5 text-[11px] text-slate-800 shadow-card ring-1 ring-silver-200">
            <div className="flex items-start justify-between border-b-2 border-[#ed7333] pb-3">
              <div>{form.showLogo ? <p className="text-base font-extrabold text-[#c4531c]">{db.company.name}</p> : null}<p className="text-slate-500">{db.company.address1}, {db.company.city}</p></div>
              <div className="text-right"><p className="text-lg font-extrabold">{form.headerTitle}</p><p className="text-slate-500">{labels[0]}</p></div>
            </div>
            <table className="mt-3 w-full border-collapse"><thead><tr className="bg-slate-100 text-left"><th className="border border-slate-300 p-1.5">Item</th><th className="border border-slate-300 p-1.5 text-right">Qty</th><th className="border border-slate-300 p-1.5 text-right">Amount</th></tr></thead>
              <tbody><tr><td className="border border-slate-300 p-1.5">Fuel Injector Nozzle</td><td className="border border-slate-300 p-1.5 text-right">6</td><td className="border border-slate-300 p-1.5 text-right">{formatMoney(14940)}</td></tr></tbody></table>
            {form.showSignature ? <div className="mt-8 flex justify-between"><span>Receiver’s signature</span><span>Authorised signatory</span></div> : null}
            <p className="mt-4 text-center text-slate-500">{form.footerNote}</p>
          </div>
        </Card>
      </div>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Terms & conditions                                                  */
/* ------------------------------------------------------------------ */

export function TermsPage() {
  const { db, mutate } = useData()
  const toast = useToast()
  const { canEdit } = useAccess()
  const [side, setSide] = useState<'sales' | 'purchase'>('sales')
  const kinds = (Object.keys(DOC_META) as DocKind[]).filter((k) => DOC_META[k].side === side)
  const [edits, setEdits] = useState<Record<string, string>>({})
  const textOf = (kind: DocKind) => edits[kind] ?? db.terms.find((t) => t.kind === kind)?.text ?? ''
  const dirty = kinds.some((k) => edits[k] !== undefined && edits[k] !== (db.terms.find((t) => t.kind === k)?.text ?? ''))
  const save = () => {
    mutate((d) => {
      kinds.forEach((k) => {
        if (edits[k] === undefined) return
        const t = d.terms.find((x) => x.kind === k)
        if (t) t.text = edits[k]
        else d.terms.push({ id: uid('tm'), kind: k, text: edits[k] })
      })
    }, { action: 'Updated', entity: 'terms', detail: `${side} terms` })
    setEdits((e) => Object.fromEntries(Object.entries(e).filter(([k]) => !kinds.includes(k as DocKind))))
    toast.success('Terms saved. New documents will use them.')
  }
  return (
    <>
      <PageHeader title="Terms & Conditions" eyebrow="Master Setup" icon={<ScrollText className="h-5 w-5" />} description="Default terms printed at the foot of each document. Existing documents keep the terms they were created with."
        actions={canEdit ? <Button icon={<Save className="h-4 w-4" />} disabled={!dirty} onClick={save}>Save terms</Button> : undefined} />
      <SegmentedTabs value={side} onChange={setSide} items={[{ value: 'sales', label: 'Sales documents' }, { value: 'purchase', label: 'Purchase documents' }]} />
      <div className="tab-swap grid gap-4 md:grid-cols-2" key={side}>
        {kinds.map((k) => (
          <Card key={k}>
            <Field label={DOC_META[k].label}><Textarea value={textOf(k)} disabled={!canEdit} onChange={(e) => setEdits((x) => ({ ...x, [k]: e.target.value }))} className="min-h-[110px]" placeholder={`Terms for ${DOC_META[k].label.toLowerCase()}…`} /></Field>
          </Card>
        ))}
      </div>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Unit converters                                                     */
/* ------------------------------------------------------------------ */

const CONVERTERS: Record<string, { label: string; base: string; units: Record<string, number> }> = {
  area: { label: 'Area', base: 'Square metre', units: { 'Square metre': 1, 'Square foot': 0.09290304, 'Square yard': 0.83612736, Acre: 4046.8564224, Hectare: 10000, Guntha: 101.17141056, Bigha: 2508.38 } },
  length: { label: 'Length', base: 'Metre', units: { Metre: 1, Centimetre: 0.01, Millimetre: 0.001, Kilometre: 1000, Foot: 0.3048, Inch: 0.0254, Yard: 0.9144, Mile: 1609.344 } },
  volume: { label: 'Volume', base: 'Litre', units: { Litre: 1, Millilitre: 0.001, 'Cubic metre': 1000, 'Cubic foot': 28.316847, 'Cubic inch': 0.016387064, 'Gallon (US)': 3.785411784 } },
  speed: { label: 'Speed', base: 'Metre per second', units: { 'Metre per second': 1, 'Kilometre per hour': 0.2777778, 'Miles per hour': 0.44704, Knot: 0.5144444, 'Foot per second': 0.3048 } },
  time: { label: 'Time', base: 'Second', units: { Second: 1, Minute: 60, Hour: 3600, Day: 86400, Week: 604800, Month: 2629800, Year: 31557600 } },
  mass: { label: 'Mass', base: 'Kilogram', units: { Kilogram: 1, Gram: 0.001, Milligram: 0.000001, Tonne: 1000, Quintal: 100, Pound: 0.45359237, Ounce: 0.028349523 } },
}

export function ConvertersPage() {
  const [kind, setKind] = useState<keyof typeof CONVERTERS>('area')
  const conv = CONVERTERS[kind]
  const names = Object.keys(conv.units)
  const [state, setState] = useState<Record<string, { from: string; to: string; value: number }>>({})
  const cur = state[kind] ?? { from: names[0], to: names[1], value: 1 }
  const update = (patch: Partial<typeof cur>) => setState((s) => ({ ...s, [kind]: { ...cur, ...patch } }))
  const result = (cur.value * conv.units[cur.from]) / conv.units[cur.to]
  const fmt = (n: number) => (Math.abs(n) >= 1e9 || (Math.abs(n) < 1e-4 && n !== 0) ? n.toExponential(4) : Number(n.toPrecision(10)).toLocaleString('en-IN', { maximumFractionDigits: 8 }))
  return (
    <>
      <PageHeader title="Unit Calculators" eyebrow="Master Setup" icon={<Calculator className="h-5 w-5" />} description="Convert between area, length, volume, speed, time and mass units." />
      <div className="overflow-x-auto"><SegmentedTabs value={kind} onChange={(k) => setKind(k as keyof typeof CONVERTERS)} items={Object.entries(CONVERTERS).map(([value, c]) => ({ value, label: c.label }))} /></div>
      <Card className="tab-swap" key={kind}>
        <div className="grid items-end gap-4 md:grid-cols-[1fr_auto_1fr]">
          <div className="grid gap-3">
            <Field label="From unit"><Select value={cur.from} onChange={(e) => update({ from: e.target.value })}>{names.map((n) => <option key={n}>{n}</option>)}</Select></Field>
            <Field label="Value"><Input type="number" step="any" value={cur.value} onChange={(e) => update({ value: Number(e.target.value) })} /></Field>
          </div>
          <Button variant="outline" size="icon" aria-label="Swap units" title="Swap units" className="mb-1 self-center" onClick={() => update({ from: cur.to, to: cur.from, value: Number(result.toPrecision(10)) })} icon={<ArrowLeftRight className="h-4 w-4" />} />
          <div className="grid gap-3">
            <Field label="To unit"><Select value={cur.to} onChange={(e) => update({ to: e.target.value })}>{names.map((n) => <option key={n}>{n}</option>)}</Select></Field>
            <Field label="Result"><div className="tnum flex h-[42px] items-center rounded-[11px] bg-sapphire-50 px-3 text-lg font-extrabold text-navy-900 ring-1 ring-sapphire-200">{fmt(result)}</div></Field>
          </div>
        </div>
        <p className="mt-4 text-xs text-silver-600">1 {cur.from} = {fmt(conv.units[cur.from] / conv.units[cur.to])} {cur.to}. Base unit: {conv.base}.</p>
        <div className="mt-5 overflow-x-auto rounded-xl ring-1 ring-silver-200">
          <table className="w-full min-w-[420px] text-sm"><thead className="bg-silver-50 text-left text-[11px] font-bold tracking-[0.06em] text-silver-600 uppercase"><tr><th className="px-4 py-2.5">Unit</th><th className="px-4 py-2.5 text-right">In {conv.base.toLowerCase()}</th></tr></thead>
            <tbody className="divide-y divide-silver-200">{names.map((n) => <tr key={n}><td className="px-4 py-2 font-medium text-navy-900">{n}</td><td className="tnum px-4 py-2 text-right">{fmt(conv.units[n])}</td></tr>)}</tbody></table>
        </div>
      </Card>
    </>
  )
}
