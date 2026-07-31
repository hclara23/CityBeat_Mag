// Owner notification preferences — pure helpers (tested). Stored on the
// profiles doc as `notify_prefs`. Per the platform brief: email activity
// notifications and monthly reports DEFAULT ON (owners can turn them off);
// SMS is always an affirmative opt-in and defaults OFF.

export type NotifyPrefs = {
  activity_email: boolean
  monthly_report: boolean
  sms_opt_in: boolean
}

export const DEFAULT_NOTIFY_PREFS: NotifyPrefs = {
  activity_email: true,
  monthly_report: true,
  sms_opt_in: false,
}

export function getNotifyPrefs(profile: { notify_prefs?: unknown } | null | undefined): NotifyPrefs {
  const raw = (profile?.notify_prefs || {}) as Record<string, unknown>
  return {
    activity_email: raw.activity_email !== false, // default on
    monthly_report: raw.monthly_report !== false, // default on
    sms_opt_in: raw.sms_opt_in === true, // default off — explicit opt-in only
  }
}

// Sanitize a client-submitted prefs patch: only known boolean keys pass.
export function sanitizeNotifyPrefsPatch(input: unknown): Partial<NotifyPrefs> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {}
  const raw = input as Record<string, unknown>
  const out: Partial<NotifyPrefs> = {}
  if (typeof raw.activity_email === 'boolean') out.activity_email = raw.activity_email
  if (typeof raw.monthly_report === 'boolean') out.monthly_report = raw.monthly_report
  if (typeof raw.sms_opt_in === 'boolean') out.sms_opt_in = raw.sms_opt_in
  return out
}

export const NOTIFICATION_TYPES = ['review', 'lead', 'claim_approved', 'manager_added', 'report'] as const
export type NotificationType = (typeof NOTIFICATION_TYPES)[number]

export type NotificationRecord = {
  type: NotificationType
  title: string
  title_es: string
  body: string
  body_es: string
  link: string | null // locale-less path; the client prepends /en or /es
  read_at: null
  email_sent: boolean
  created_at: string
}

export function buildNotificationRecord(input: {
  type: NotificationType
  title: string
  title_es?: string
  body?: string
  body_es?: string
  link?: string | null
  now: string
}): NotificationRecord {
  return {
    type: input.type,
    title: input.title.slice(0, 200),
    title_es: (input.title_es || input.title).slice(0, 200),
    body: (input.body || '').slice(0, 500),
    body_es: (input.body_es || input.body || '').slice(0, 500),
    link: typeof input.link === 'string' && input.link.startsWith('/') ? input.link.slice(0, 300) : null,
    read_at: null,
    email_sent: false,
    created_at: input.now,
  }
}
