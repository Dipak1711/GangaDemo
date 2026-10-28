import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Download, Pencil, Plus, Trash2 } from 'lucide-react'
import type { CollectionKey, Database } from '@/types'
import { useData } from '@/store/DataContext'
import { useToast } from '@/store/ToastContext'
import { useAccess } from '@/hooks/useAccess'
import { Button } from '@/components/ui/Button'
import { Checkbox, Field, Input, Select, Textarea } from '@/components/ui/Form'
import { EmptyState, PageHeader, SearchInput } from '@/components/ui/Layout'
import { ConfirmDialog, Modal, type ModalSize } from '@/components/ui/Modal'
import { Table, TableEmptyRow, TableShell, TBody, Td, Th, THead, TR } from '@/components/ui/Table'
import { StatCard, type StatCardProps } from '@/components/ui/StatCard'
import { inUse } from '@/lib/refs'
import { downloadCSV, uid } from '@/lib/utils'

export interface Option {
  value: string
  label: string
}
export type Row = Record<string, any> & { id: string }

export interface FieldDef {
  key: string
  label: string
  type?: 'text' | 'number' | 'date' | 'email' | 'tel' | 'textarea' | 'select' | 'checkbox' | 'password'
  options?: Option[] | ((db: Database, draft: Row) => Option[])
  required?: boolean
  hint?: string
  full?: boolean
  visible?: (draft: Row) => boolean
  min?: number
  step?: string
  placeholder?: string
  section?: string
  disabled?: (draft: Row, isNew: boolean) => boolean
  /** Fully custom control for this field. */
  render?: (draft: Row, set: (key: string, value: unknown) => void, error?: string) => ReactNode
}

export interface ColumnDef {
  key: string
  label: string
  render?: (row: Row, db: Database) => ReactNode
  text?: (row: Row, db: Database) => string | number
  align?: 'left' | 'right' | 'center'
  className?: string
  hideBelow?: 'md' | 'lg'
}

export interface FilterDef {
  key: string
  label: string
  options: Option[] | ((db: Database) => Option[])
  test: (row: Row, value: string, db: Database) => boolean
}

export interface CrudProps {
  collection: CollectionKey
  entity: string
  title: string
  description?: string
  icon?: ReactNode
  eyebrow?: string
  columns: ColumnDef[]
  fields: FieldDef[]
  blank: (db: Database) => Row
  /** Rows to show (e.g. only customers). */
  scope?: (row: Row) => boolean
  labelOf?: (row: Row, db: Database) => string
  filters?: FilterDef[]
  stats?: (rows: Row[], db: Database) => StatCardProps[]
  validate?: (draft: Row, db: Database, isNew: boolean) => Record<string, string | undefined>
  prepare?: (draft: Row, db: Database, isNew: boolean) => Row
  rowActions?: (row: Row, db: Database) => ReactNode
  headerActions?: ReactNode
  canDelete?: (row: Row, db: Database) => string | null
  modalSize?: ModalSize
  embedded?: boolean
  addLabel?: string
  pageSize?: number
  /** Replace the default modal body with fully custom content. */
  renderForm?: (draft: Row, set: (key: string, value: unknown) => void, errors: Record<string, string>, db: Database) => ReactNode
  searchText?: (row: Row, db: Database) => string
}

const PAGE_SIZES = [10, 25, 50]

function toOptions(def: FieldDef, db: Database, draft: Row): Option[] {
  if (!def.options) return []
  return typeof def.options === 'function' ? def.options(db, draft) : def.options
}

export function opts<T extends Record<string, any>>(list: T[], label: keyof T & string = 'name', value: keyof T & string = 'id'): Option[] {
  return list.map((entry) => ({ value: String(entry[value]), label: String(entry[label]) }))
}

export function CrudPage(props: CrudProps) {
  const {
    collection, entity, title, description, icon, eyebrow, columns, fields, blank, scope, labelOf, filters, stats, validate, prepare,
    rowActions, headerActions, canDelete, modalSize = 'lg', embedded = false, addLabel, renderForm, searchText,
  } = props
  const { db, upsert, remove } = useData()
  const toast = useToast()
  const { canEdit } = useAccess()
  const location = useLocation()

  const [query, setQuery] = useState('')
  const [filterValues, setFilterValues] = useState<Record<string, string>>({})
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(props.pageSize ?? 10)
  const [draft, setDraft] = useState<Row | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [deleting, setDeleting] = useState<Row | null>(null)

  const allRows = useMemo(() => (db[collection] as unknown as Row[]).filter((r) => (scope ? scope(r) : true)), [db, collection, scope])
  const labelFor = (row: Row) => (labelOf ? labelOf(row, db) : String(row.name ?? row.no ?? row.code ?? row.id))

  const rows = useMemo(() => {
    const term = query.trim().toLowerCase()
    return allRows.filter((row) => {
      if (filters?.some((f) => filterValues[f.key] && !f.test(row, filterValues[f.key], db))) return false
      if (!term) return true
      const haystack = searchText
        ? searchText(row, db)
        : columns.map((c) => (c.text ? c.text(row, db) : typeof row[c.key] === 'object' ? '' : String(row[c.key] ?? ''))).join(' ')
      return haystack.toLowerCase().includes(term)
    })
  }, [allRows, query, filters, filterValues, db, columns, searchText])

  useEffect(() => setPage(1), [query, filterValues, pageSize])
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize))
  const safePage = Math.min(page, pageCount)
  const visible = rows.slice((safePage - 1) * pageSize, safePage * pageSize)

  // Open a record when arriving from global search.
  const openId = (location.state as { openId?: string } | null)?.openId
  useEffect(() => {
    if (!openId) return
    const found = allRows.find((r) => r.id === openId)
    if (found) {
      setDraft({ ...structuredClone(found) })
      setIsNew(false)
      setErrors({})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openId])

  const openNew = () => {
    setDraft(blank(db))
    setIsNew(true)
    setErrors({})
  }
  const openEdit = (row: Row) => {
    setDraft(structuredClone(row))
    setIsNew(false)
    setErrors({})
  }
  const set = (key: string, value: unknown) => {
    setDraft((d) => (d ? { ...d, [key]: value } : d))
    setErrors((e) => {
      if (!e[key]) return e
      const { [key]: _removed, ...rest } = e
      return rest
    })
  }

  const save = () => {
    if (!draft) return
    const found: Record<string, string> = {}
    for (const f of fields) {
      if (f.visible && !f.visible(draft)) continue
      const v = draft[f.key]
      if (f.required && (v === undefined || v === null || v === '' || (f.type === 'number' && Number.isNaN(v)))) found[f.key] = `${f.label} is required.`
      else if (f.type === 'number' && f.min !== undefined && Number(v) < f.min) found[f.key] = `${f.label} must be at least ${f.min}.`
      else if (f.type === 'email' && v && !/^\S+@\S+\.\S+$/.test(String(v))) found[f.key] = 'Enter a valid email address.'
    }
    for (const [k, v] of Object.entries(validate?.(draft, db, isNew) ?? {})) if (v) found[k] = v
    if (Object.keys(found).length > 0) {
      setErrors(found)
      toast.error('Please fix the highlighted fields.')
      return
    }
    const record = prepare ? prepare(draft, db, isNew) : draft
    upsert(collection, record as never, labelFor(record))
    toast.success(`${entity} ${isNew ? 'added' : 'updated'}.`)
    setDraft(null)
  }

  const askDelete = (row: Row) => {
    const reason = canDelete?.(row, db) ?? inUse(db, String(collection), row.id)
    if (reason) {
      toast.error(`Cannot delete “${labelFor(row)}”. ${reason}`)
      return
    }
    setDeleting(row)
  }
  const confirmDelete = () => {
    if (!deleting) return
    remove(collection, deleting.id, labelFor(deleting), entity)
    toast.success(`${entity} moved to the recycle bin.`)
    setDeleting(null)
  }

  const exportCsv = () => {
    downloadCSV(
      `${String(collection)}-${new Date().toISOString().slice(0, 10)}.csv`,
      columns.map((c) => c.label),
      rows.map((r) => columns.map((c) => (c.text ? c.text(r, db) : typeof r[c.key] === 'object' ? '' : (r[c.key] ?? '') as string | number))),
    )
  }

  const statCards = stats ? stats(allRows, db) : []
  const hideCls = (c: ColumnDef) => (c.hideBelow === 'md' ? 'hidden md:table-cell' : c.hideBelow === 'lg' ? 'hidden lg:table-cell' : '')

  return (
    <>
      {embedded ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-silver-600">{description}</p>
          <div className="flex items-center gap-2">
            {headerActions}
            {canEdit ? (
              <Button icon={<Plus className="h-4 w-4" />} onClick={openNew}>
                {addLabel ?? `Add ${entity}`}
              </Button>
            ) : null}
          </div>
        </div>
      ) : (
        <PageHeader
          title={title}
          description={description}
          icon={icon}
          eyebrow={eyebrow}
          actions={
            <>
              {headerActions}
              <Button variant="outline" icon={<Download className="h-4 w-4" />} onClick={exportCsv} disabled={rows.length === 0}>
                Export
              </Button>
              {canEdit ? (
                <Button icon={<Plus className="h-4 w-4" />} onClick={openNew}>
                  {addLabel ?? `Add ${entity}`}
                </Button>
              ) : null}
            </>
          }
        />
      )}

      {statCards.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {statCards.map((s) => (
            <StatCard key={s.label} {...s} />
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2.5">
        <SearchInput value={query} onChange={setQuery} placeholder={`Search ${title.toLowerCase()}…`} className="w-full sm:w-72" />
        {filters?.map((f) => (
          <Select
            key={f.key}
            aria-label={f.label}
            value={filterValues[f.key] ?? ''}
            onChange={(e) => setFilterValues((v) => ({ ...v, [f.key]: e.target.value }))}
            className="h-10 w-auto! min-w-40"
          >
            <option value="">{f.label}: all</option>
            {(typeof f.options === 'function' ? f.options(db) : f.options).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        ))}
        <span className="tnum ml-auto text-xs font-medium text-silver-600">
          {rows.length} {rows.length === 1 ? 'record' : 'records'}
        </span>
      </div>

      <TableShell>
        <Table>
          <THead>
            <tr>
              {columns.map((c) => (
                <Th key={c.key} align={c.align} className={hideCls(c)}>
                  {c.label}
                </Th>
              ))}
              <Th align="right">Actions</Th>
            </tr>
          </THead>
          <TBody>
            {visible.length === 0 ? (
              <TableEmptyRow colSpan={columns.length + 1}>No {title.toLowerCase()} found</TableEmptyRow>
            ) : (
              visible.map((row) => (
                <TR key={row.id}>
                  {columns.map((c) => (
                    <Td key={c.key} align={c.align} className={`${hideCls(c)} ${c.className ?? ''}`}>
                      {c.render ? c.render(row, db) : String(row[c.key] ?? '—') || '—'}
                    </Td>
                  ))}
                  <Td align="right">
                    <div className="flex items-center justify-end gap-1">
                      {rowActions?.(row, db)}
                      {canEdit ? (
                        <>
                          <Button variant="ghost" size="icon" aria-label={`Edit ${labelFor(row)}`} title="Edit" onClick={() => openEdit(row)} icon={<Pencil className="h-4 w-4" />} />
                          <Button variant="ghost" size="icon" aria-label={`Delete ${labelFor(row)}`} title="Delete" className="text-rose-600 hover:bg-rose-50 hover:text-rose-700" onClick={() => askDelete(row)} icon={<Trash2 className="h-4 w-4" />} />
                        </>
                      ) : null}
                    </div>
                  </Td>
                </TR>
              ))
            )}
          </TBody>
        </Table>
        {rows.length > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-silver-200 bg-silver-50/60 px-4 py-2.5 text-xs text-silver-600">
            <label className="flex items-center gap-2">
              Rows
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="h-8 rounded-lg border border-silver-300 bg-surface px-2 text-xs text-navy-900"
              >
                {PAGE_SIZES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <span className="tnum">
              {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, rows.length)} of {rows.length}
            </span>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" aria-label="Previous page" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)} icon={<ChevronLeft className="h-4 w-4" />} />
              <Button variant="outline" size="icon" aria-label="Next page" disabled={safePage >= pageCount} onClick={() => setPage(safePage + 1)} icon={<ChevronRight className="h-4 w-4" />} />
            </div>
          </div>
        ) : null}
      </TableShell>

      <Modal
        open={Boolean(draft)}
        onClose={() => setDraft(null)}
        size={modalSize}
        title={`${isNew ? 'Add' : 'Edit'} ${entity.toLowerCase()}`}
        subtitle={isNew ? `Create a new ${entity.toLowerCase()} record` : labelFor(draft ?? { id: '' })}
        footer={
          <>
            <Button variant="outline" onClick={() => setDraft(null)}>
              Cancel
            </Button>
            <Button onClick={save}>{isNew ? `Add ${entity.toLowerCase()}` : 'Save changes'}</Button>
          </>
        }
      >
        {draft ? (
          renderForm ? (
            renderForm(draft, set, errors, db)
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                save()
              }}
              noValidate
              className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2 lg:grid-cols-3"
            >
              {fields.map((f) => {
                if (f.visible && !f.visible(draft)) return null
                const disabled = f.disabled?.(draft, isNew)
                const error = errors[f.key]
                const span = f.full || f.render || f.type === 'textarea' ? 'sm:col-span-2 lg:col-span-3' : ''
                const value = draft[f.key]
                let control: ReactNode
                if (f.render) {
                  control = f.render(draft, set, error)
                } else if (f.type === 'select') {
                  control = (
                    <Select value={String(value ?? '')} onChange={(e) => set(f.key, e.target.value)} invalid={Boolean(error)} disabled={disabled}>
                      {!f.required ? <option value="">— None —</option> : <option value="">Select…</option>}
                      {toOptions(f, db, draft).map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </Select>
                  )
                } else if (f.type === 'textarea') {
                  control = <Textarea value={String(value ?? '')} onChange={(e) => set(f.key, e.target.value)} invalid={Boolean(error)} placeholder={f.placeholder} />
                } else if (f.type === 'checkbox') {
                  control = <Checkbox label={f.hint ?? f.label} checked={Boolean(value)} onChange={(e) => set(f.key, e.target.checked)} />
                } else if (f.type === 'number') {
                  control = (
                    <Input
                      type="number"
                      inputMode="decimal"
                      min={f.min}
                      step={f.step ?? 'any'}
                      value={value === undefined || value === null || Number.isNaN(value) ? '' : String(value)}
                      onChange={(e) => set(f.key, e.target.value === '' ? Number.NaN : Number(e.target.value))}
                      invalid={Boolean(error)}
                      disabled={disabled}
                      placeholder={f.placeholder}
                    />
                  )
                } else {
                  control = (
                    <Input
                      type={f.type ?? 'text'}
                      value={String(value ?? '')}
                      onChange={(e) => set(f.key, e.target.value)}
                      invalid={Boolean(error)}
                      disabled={disabled}
                      placeholder={f.placeholder}
                      autoComplete="off"
                    />
                  )
                }
                return (
                  <div key={f.key} className={`${span} flex flex-col`}>
                    {f.section ? (
                      <h3 className="-mb-1 mt-2 border-b border-silver-200 pb-1.5 text-[11.5px] font-bold tracking-[0.12em] text-silver-600 uppercase sm:col-span-2 lg:col-span-3">{f.section}</h3>
                    ) : null}
                    <Field label={f.type === 'checkbox' ? undefined : f.label} required={f.required} error={error} hint={f.type === 'checkbox' ? undefined : f.hint} className={f.section ? 'mt-3' : ''}>
                      {f.type === 'checkbox' ? <div className="flex h-[42px] items-center">{control}</div> : control}
                    </Field>
                  </div>
                )
              })}
              <button type="submit" className="hidden" aria-hidden="true" tabIndex={-1} />
            </form>
          )
        ) : null}
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        title={`Delete ${entity.toLowerCase()}?`}
        message={
          <>
            <strong className="text-navy-900">{deleting ? labelFor(deleting) : ''}</strong> will be moved to the recycle bin. You can restore it from Settings → Recycling.
          </>
        }
        confirmLabel="Delete"
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </>
  )
}

/** Small helper for pages that need an empty state outside a table. */
export function Blank({ title, description }: { title: string; description?: string }) {
  return <EmptyState title={title} description={description} />
}

export const newId = (prefix: string) => uid(prefix)
