import { useState, type FormEvent } from 'react'
import { ArrowRight, Boxes, Factory, Receipt, ShieldCheck } from 'lucide-react'
import { useAuth } from '@/store/AuthContext'
import { useData } from '@/store/DataContext'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Form'

export function LoginPage() {
  const { login } = useAuth()
  const { db } = useData()
  const [username, setUsername] = useState('admin')
  const [password, setPassword] = useState('admin123')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    window.setTimeout(() => {
      const result = login(username, password)
      if (!result.ok) setError(result.error ?? 'Could not sign in.')
      setBusy(false)
    }, 350)
  }

  const features = [
    { icon: Receipt, title: 'Quote to cash', text: 'Quotation, order, invoice, delivery and receipts in one flow.' },
    { icon: Boxes, title: 'Live inventory', text: 'Serial-tracked tractors, spares and low-stock alerts.' },
    { icon: Factory, title: 'Production & BOM', text: 'Work orders that consume raw material and build finished stock.' },
    { icon: ShieldCheck, title: 'Accounts & control', text: 'Ledgers, GST, TDS, roles and a full audit trail.' },
  ]

  return (
    <div className="app-canvas grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <section className="relative hidden overflow-hidden bg-[#5a2710] bg-linear-to-br from-[#5a2710] via-[#c4531c] to-[#d6581e] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <span className="sheen pointer-events-none absolute inset-0" aria-hidden="true" />
        <div className="relative flex items-center gap-3.5">
          <span className="grid h-12 w-12 place-items-center rounded-[14px] bg-white/20 text-[20px] font-black ring-1 ring-white/40">G</span>
          <div>
            <p className="text-xl font-extrabold tracking-[-0.02em]">{db.company.brand}</p>
            <p className="text-[11px] font-semibold tracking-[0.2em] text-gold-200 uppercase">ERP Suite</p>
          </div>
        </div>
        <div className="relative max-w-xl">
          <h1 className="text-[40px] leading-[1.08] font-extrabold tracking-[-0.03em]">Run tractors, spares and production from one place.</h1>
          <p className="mt-4 text-[15px] leading-relaxed text-white/80">{db.company.name} — a complete working demo of the Ganga ERP. Every figure you see is calculated from live records in this browser.</p>
          <ul className="mt-9 grid gap-4 sm:grid-cols-2">
            {features.map(({ icon: Icon, title, text }) => (
              <li key={title} className="rounded-2xl bg-white/10 p-4 ring-1 ring-white/20 backdrop-blur">
                <Icon className="h-5 w-5 text-gold-200" />
                <p className="mt-2 text-[14px] font-bold">{title}</p>
                <p className="mt-1 text-[12.5px] leading-snug text-white/75">{text}</p>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-white/60">Demo build · data is stored only in this browser (localStorage).</p>
      </section>

      <section className="flex items-center justify-center p-6">
        <form onSubmit={submit} className="w-full max-w-[420px] rounded-3xl bg-surface p-8 shadow-panel" noValidate>
          <div className="mb-7 flex items-center gap-3 lg:hidden">
            <span className="grid h-11 w-11 place-items-center rounded-[14px] bg-linear-to-br from-[#f58a4e] to-[#d9622a] text-lg font-black text-white">G</span>
            <p className="text-lg font-extrabold text-navy-900">{db.company.brand} ERP</p>
          </div>
          <h2 className="text-[26px] font-extrabold tracking-[-0.03em] text-navy-900">Welcome to Ganga</h2>
          <p className="mt-1.5 text-sm text-silver-600">Sign in to continue to your dashboard.</p>

          <div className="mt-7 flex flex-col gap-4">
            <Field label="Username" required>
              <Input value={username} onChange={(e) => { setUsername(e.target.value); setError('') }} autoComplete="username" autoFocus />
            </Field>
            <Field label="Password" required error={error}>
              <Input type="password" value={password} onChange={(e) => { setPassword(e.target.value); setError('') }} autoComplete="current-password" invalid={Boolean(error)} />
            </Field>
            <Button type="submit" size="lg" loading={busy} iconRight={<ArrowRight className="h-4 w-4" />} className="mt-1 w-full">
              {busy ? 'Signing in…' : 'Sign in'}
            </Button>
          </div>

          <div className="mt-6 rounded-xl bg-silver-50 p-3.5 text-xs leading-relaxed text-silver-700 ring-1 ring-silver-200">
            <p className="font-bold text-navy-800">Demo accounts</p>
            <p className="mt-1">admin / admin123 · manager / manager123 · accounts / accounts123 · store / store123</p>
          </div>
        </form>
      </section>
    </div>
  )
}
