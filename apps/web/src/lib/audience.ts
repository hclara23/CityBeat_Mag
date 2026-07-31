// Developer-only Audience & Accounts datasets + safe CSV export. The row shape is
// a strict allow-list of customer-operational columns — the "never export" fields
// (passwords, card/bank data, stripe secrets, verification/session/unsubscribe
// tokens, raw IPs, internal security flags) are simply not projected, so they can
// never leak through an export. Pure + tested.

export const AUDIENCE_DATASETS = [
  { key: 'profiles', en: 'Registered profiles', es: 'Perfiles registrados' },
  { key: 'newsletter_active', en: 'Active newsletter subscribers', es: 'Suscriptores activos' },
  { key: 'newsletter_suppressed', en: 'Unsubscribed / suppressed', es: 'Cancelados / suprimidos' },
  { key: 'directory_owners', en: 'Claimed directory owners', es: 'Dueños del directorio' },
  { key: 'free_listings', en: 'Free directory listings', es: 'Fichas gratis' },
  { key: 'founders', en: 'Founders subscribers', es: 'Suscriptores Founders' },
  { key: 'premium', en: 'Premium subscribers', es: 'Suscriptores Premium' },
  { key: 'featured', en: 'Featured subscribers', es: 'Suscriptores Featured' },
  { key: 'sales_customers', en: 'Sales-order customers', es: 'Clientes de ventas' },
] as const

export type AudienceDatasetKey = (typeof AUDIENCE_DATASETS)[number]['key']

export function isAudienceDataset(key: unknown): key is AudienceDatasetKey {
  return AUDIENCE_DATASETS.some((d) => d.key === key)
}

// The ONLY columns any audience view or export may contain.
export type AudienceRow = {
  name: string
  email: string
  user_id: string
  customer_type: string
  business_name: string
  business_id: string
  plan: string
  payment_state: string
  newsletter_status: string
  consent_source: string
  consent_date: string
  locale: string
  created_at: string
  last_activity: string
}

export const AUDIENCE_COLUMNS: { key: keyof AudienceRow; header: string }[] = [
  { key: 'name', header: 'Name' },
  { key: 'email', header: 'Email' },
  { key: 'user_id', header: 'User/Customer ID' },
  { key: 'customer_type', header: 'Customer Type' },
  { key: 'business_name', header: 'Business Name' },
  { key: 'business_id', header: 'Business ID' },
  { key: 'plan', header: 'Plan/Product' },
  { key: 'payment_state', header: 'Payment State' },
  { key: 'newsletter_status', header: 'Newsletter Status' },
  { key: 'consent_source', header: 'Consent Source' },
  { key: 'consent_date', header: 'Consent Date' },
  { key: 'locale', header: 'Locale' },
  { key: 'created_at', header: 'Created' },
  { key: 'last_activity', header: 'Last Activity' },
]

// Excel/Sheets execute a cell starting with = + - @ (tab/CR too). Neutralize.
export function csvCell(value: unknown): string {
  let v = value == null ? '' : String(value)
  if (/^[=+\-@\t\r]/.test(v)) v = `'${v}`
  if (/[",\n\r]/.test(v)) v = `"${v.replace(/"/g, '""')}"`
  return v
}

export function emptyAudienceRow(): AudienceRow {
  return {
    name: '',
    email: '',
    user_id: '',
    customer_type: '',
    business_name: '',
    business_id: '',
    plan: '',
    payment_state: '',
    newsletter_status: '',
    consent_source: '',
    consent_date: '',
    locale: '',
    created_at: '',
    last_activity: '',
  }
}

// UTF-8 BOM for Excel + formula-injection-safe cells.
export function buildAudienceCsv(rows: AudienceRow[]): string {
  const header = AUDIENCE_COLUMNS.map((c) => csvCell(c.header)).join(',')
  const lines = rows.map((row) => AUDIENCE_COLUMNS.map((c) => csvCell(row[c.key])).join(','))
  return '﻿' + [header, ...lines].join('\r\n')
}

// Case-insensitive search across the visible text columns.
export function matchesAudienceSearch(row: AudienceRow, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return (
    row.name.toLowerCase().includes(q) ||
    row.email.toLowerCase().includes(q) ||
    row.business_name.toLowerCase().includes(q) ||
    row.user_id.toLowerCase().includes(q) ||
    row.business_id.toLowerCase().includes(q)
  )
}

export function audienceExportFilename(dataset: string, utcDate: string): string {
  const safe = dataset.replace(/[^a-z0-9_-]/gi, '')
  return `citybeat-${safe}-${utcDate}.csv`
}
