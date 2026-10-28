import type { ReactNode } from 'react'
import { Badge, StatusBadge, type BadgeTone } from '@/components/ui/Badge'
import { formatDate, formatMoney } from '@/lib/utils'

export const money = (v: number) => formatMoney(v)

export function ActiveBadge({ status }: { status: string }) {
  const tone: BadgeTone = status === 'Active' || status === 'Open' ? 'success' : status === 'Inactive' || status === 'Closed' || status === 'Disabled' ? 'neutral' : 'info'
  return <Badge tone={tone} dot>{status}</Badge>
}

export const dateCell = (iso?: string): ReactNode => <span className="tnum whitespace-nowrap">{formatDate(iso)}</span>

export const strong = (text: ReactNode): ReactNode => <span className="font-semibold text-navy-900">{text}</span>

export const sub = (text: ReactNode): ReactNode => <span className="block text-xs text-silver-600">{text}</span>

export { StatusBadge }

export const yesNo = (v: boolean) => (v ? 'Yes' : 'No')

export const GST_STATES = ['Gujarat', 'Maharashtra', 'Rajasthan', 'Madhya Pradesh', 'Karnataka', 'Tamil Nadu', 'Punjab', 'Haryana', 'Uttar Pradesh', 'Telangana']
