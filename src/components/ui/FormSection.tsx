import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * A titled group of fields. The heading spans the full width and the fields sit
 * in one aligned grid beneath it, so every row lines up top and bottom.
 */
export function FormSection({
  title,
  description,
  icon,
  children,
  cols = 3,
  className,
}: {
  title?: string
  description?: string
  icon?: ReactNode
  children: ReactNode
  cols?: 2 | 3 | 4
  className?: string
}) {
  const grid = cn(
    'grid grid-cols-1 items-start gap-x-4 gap-y-4 sm:grid-cols-2',
    cols === 3 && 'lg:grid-cols-3',
    cols === 4 && 'lg:grid-cols-4',
  )
  if (!title) return <div className={cn(grid, className)}>{children}</div>
  return (
    <section className={cn('overflow-hidden rounded-2xl bg-surface ring-1 ring-silver-200', className)}>
      <header className="flex items-center gap-2.5 border-b border-silver-200 bg-silver-50/80 px-4 py-2.5">
        {icon ? <span className="grid h-6 w-6 place-items-center rounded-md bg-sapphire-50 text-sapphire-700">{icon}</span> : <span className="h-4 w-1 rounded-full bg-linear-to-b from-[#f28c4c] to-[#c4531c]" aria-hidden="true" />}
        <div className="min-w-0">
          <h3 className="text-[12.5px] font-bold tracking-[0.08em] text-navy-800 uppercase">{title}</h3>
          {description ? <p className="text-xs text-silver-600">{description}</p> : null}
        </div>
      </header>
      <div className={cn(grid, 'p-4')}>{children}</div>
    </section>
  )
}
