import type { SalesIntakeKind } from './sales-products'

export type IntakeFieldType =
  | 'text'
  | 'email'
  | 'tel'
  | 'url'
  | 'textarea'
  | 'select'
  | 'date'
  | 'time'
  | 'number'
  | 'checkbox'
  | 'image'
  | 'images'

export interface IntakeField {
  id: string
  label: string
  type: IntakeFieldType
  required?: boolean
  placeholder?: string
  help?: string
  options?: Array<{ value: string; label: string }>
  maxLength?: number
}

export interface IntakeSection {
  id: string
  title: string
  eyebrow: string
  description: string
  fields: IntakeField[]
}

export interface IntakeSchema {
  title: string
  completionLabel: string
  sections: IntakeSection[]
}

const SALES_INTAKE_SCHEMAS: Record<SalesIntakeKind, IntakeSchema> = {
  directory: {
    title: 'Build your business listing',
    completionLabel: 'Send listing for review',
    sections: [
      {
        id: 'business',
        eyebrow: 'Step 1',
        title: 'Business essentials',
        description: 'The information readers use to recognize and contact you.',
        fields: [
          { id: 'business_name', label: 'Public business name', type: 'text', required: true, maxLength: 140 },
          { id: 'primary_category', label: 'Primary category', type: 'text', required: true, placeholder: 'Restaurant, salon, attorney...', maxLength: 80 },
          { id: 'short_description', label: 'What makes the business worth visiting?', type: 'textarea', required: true, placeholder: 'A concise, customer-friendly description', maxLength: 1200 },
          { id: 'phone', label: 'Public phone', type: 'tel', required: true, maxLength: 40 },
          { id: 'website', label: 'Website', type: 'url', placeholder: 'https://', maxLength: 300 },
        ],
      },
      {
        id: 'location',
        eyebrow: 'Step 2',
        title: 'Location and hours',
        description: 'Help customers know where and when to find you.',
        fields: [
          { id: 'street_address', label: 'Street address', type: 'text', required: true, maxLength: 180 },
          { id: 'city', label: 'City', type: 'text', required: true, maxLength: 80 },
          { id: 'state', label: 'State', type: 'text', required: true, placeholder: 'TX', maxLength: 40 },
          { id: 'postal_code', label: 'ZIP code', type: 'text', required: true, maxLength: 20 },
          { id: 'business_hours', label: 'Business hours', type: 'textarea', required: true, placeholder: 'Mon-Fri 9-6; Sat 10-4; Sun closed', maxLength: 600 },
          { id: 'service_area', label: 'Service area, if applicable', type: 'text', maxLength: 180 },
        ],
      },
      {
        id: 'brand',
        eyebrow: 'Step 3',
        title: 'Brand and discovery',
        description: 'Add the visuals and links that make a premium listing feel complete.',
        fields: [
          { id: 'logo_url', label: 'Logo', type: 'image', required: true },
          { id: 'cover_image_url', label: 'Cover photo', type: 'image', required: true },
          { id: 'gallery_urls', label: 'Gallery photos', type: 'images', help: 'Add up to 8 strong photos.' },
          { id: 'instagram_url', label: 'Instagram', type: 'url', maxLength: 300 },
          { id: 'facebook_url', label: 'Facebook', type: 'url', maxLength: 300 },
          { id: 'customer_notes', label: 'Anything our team should know?', type: 'textarea', maxLength: 1200 },
        ],
      },
    ],
  },
  job: {
    title: 'Create your job posting',
    completionLabel: 'Send job for review',
    sections: [
      {
        id: 'role',
        eyebrow: 'Step 1',
        title: 'The role',
        description: 'Give candidates the facts they use to decide whether the job fits.',
        fields: [
          { id: 'job_title', label: 'Job title', type: 'text', required: true, maxLength: 140 },
          { id: 'company_name', label: 'Company', type: 'text', required: true, maxLength: 140 },
          { id: 'job_category', label: 'Job category', type: 'select', required: true, options: [
            { value: 'hospitality', label: 'Hospitality and food service' },
            { value: 'healthcare', label: 'Healthcare' },
            { value: 'education', label: 'Education' },
            { value: 'retail', label: 'Retail and sales' },
            { value: 'professional', label: 'Professional services' },
            { value: 'skilled_trades', label: 'Skilled trades' },
            { value: 'technology', label: 'Technology' },
            { value: 'government', label: 'Government and nonprofit' },
            { value: 'other', label: 'Other' },
          ] },
          { id: 'employment_type', label: 'Employment type', type: 'select', required: true, options: [
            { value: 'full_time', label: 'Full time' }, { value: 'part_time', label: 'Part time' },
            { value: 'contract', label: 'Contract' }, { value: 'temporary', label: 'Temporary' },
            { value: 'internship', label: 'Internship' },
          ] },
          { id: 'workplace_type', label: 'Workplace', type: 'select', required: true, options: [
            { value: 'onsite', label: 'On site' }, { value: 'hybrid', label: 'Hybrid' }, { value: 'remote', label: 'Remote' },
          ] },
          { id: 'location', label: 'Job location', type: 'text', required: true, placeholder: 'El Paso, TX', maxLength: 180 },
        ],
      },
      {
        id: 'compensation',
        eyebrow: 'Step 2',
        title: 'Pay and benefits',
        description: 'Clear compensation improves applicant quality and trust.',
        fields: [
          { id: 'pay_min', label: 'Minimum pay', type: 'number', required: true },
          { id: 'pay_max', label: 'Maximum pay', type: 'number', required: true },
          { id: 'pay_period', label: 'Pay period', type: 'select', required: true, options: [
            { value: 'hour', label: 'Per hour' }, { value: 'year', label: 'Per year' }, { value: 'project', label: 'Per project' },
          ] },
          { id: 'benefits', label: 'Benefits and perks', type: 'textarea', placeholder: 'Health coverage, PTO, tips, schedule flexibility...', maxLength: 1200 },
          { id: 'schedule', label: 'Schedule', type: 'text', placeholder: 'Weekdays, evenings, rotating weekends...', maxLength: 300 },
        ],
      },
      {
        id: 'application',
        eyebrow: 'Step 3',
        title: 'Description and application',
        description: 'Tell candidates what they will do, what they need, and how to apply.',
        fields: [
          { id: 'summary', label: 'Job summary', type: 'textarea', required: true, maxLength: 1800 },
          { id: 'responsibilities', label: 'Responsibilities', type: 'textarea', required: true, maxLength: 2400 },
          { id: 'qualifications', label: 'Qualifications', type: 'textarea', required: true, maxLength: 2400 },
          { id: 'apply_url', label: 'Application URL', type: 'url', maxLength: 400 },
          { id: 'application_email', label: 'Application email', type: 'email', required: true, maxLength: 200 },
          { id: 'application_deadline', label: 'Application deadline', type: 'date' },
          { id: 'company_logo_url', label: 'Company logo', type: 'image' },
        ],
      },
    ],
  },
  event: {
    title: 'Create your featured event',
    completionLabel: 'Send event for review',
    sections: [
      {
        id: 'event', eyebrow: 'Step 1', title: 'Event essentials', description: 'The what, when, and format.', fields: [
          { id: 'event_title', label: 'Event title', type: 'text', required: true, maxLength: 160 },
          { id: 'event_category', label: 'Category', type: 'text', required: true, placeholder: 'Music, arts, family, food...', maxLength: 80 },
          { id: 'start_date', label: 'Start date', type: 'date', required: true },
          { id: 'start_time', label: 'Start time', type: 'time', required: true },
          { id: 'end_date', label: 'End date', type: 'date' },
          { id: 'end_time', label: 'End time', type: 'time' },
          { id: 'timezone', label: 'Timezone', type: 'select', required: true, options: [
            { value: 'America/Denver', label: 'Mountain Time' }, { value: 'America/Chicago', label: 'Central Time' },
          ] },
          { id: 'event_format', label: 'Format', type: 'select', required: true, options: [
            { value: 'in_person', label: 'In person' }, { value: 'online', label: 'Online' }, { value: 'hybrid', label: 'Hybrid' },
          ] },
        ],
      },
      {
        id: 'place', eyebrow: 'Step 2', title: 'Place and tickets', description: 'Everything guests need to arrive or join.', fields: [
          { id: 'venue_name', label: 'Venue or platform', type: 'text', required: true, maxLength: 160 },
          { id: 'venue_address', label: 'Address or online details', type: 'text', required: true, maxLength: 240 },
          { id: 'ticket_url', label: 'Ticket or registration URL', type: 'url', maxLength: 400 },
          { id: 'price_info', label: 'Price', type: 'text', required: true, placeholder: 'Free, $15, $10-$35...', maxLength: 120 },
          { id: 'age_info', label: 'Age guidance', type: 'text', maxLength: 120 },
          { id: 'accessibility_info', label: 'Accessibility information', type: 'textarea', maxLength: 800 },
        ],
      },
      {
        id: 'promotion', eyebrow: 'Step 3', title: 'Promotion details', description: 'Give CityBeat the story and artwork to promote it well.', fields: [
          { id: 'event_description', label: 'Event description', type: 'textarea', required: true, maxLength: 2400 },
          { id: 'organizer_name', label: 'Organizer', type: 'text', required: true, maxLength: 160 },
          { id: 'contact_email', label: 'Organizer email', type: 'email', required: true, maxLength: 200 },
          { id: 'event_website', label: 'Event website', type: 'url', maxLength: 400 },
          { id: 'event_image_url', label: 'Event artwork', type: 'image', required: true },
        ],
      },
    ],
  },
  newsletter_sponsorship: {
    title: 'Prepare your newsletter sponsorship', completionLabel: 'Send campaign for review', sections: [
      { id: 'campaign', eyebrow: 'Step 1', title: 'Campaign goal', description: 'Focus the placement on one clear outcome.', fields: [
        { id: 'campaign_name', label: 'Campaign name', type: 'text', required: true, maxLength: 140 },
        { id: 'campaign_objective', label: 'Primary objective', type: 'select', required: true, options: [
          { value: 'awareness', label: 'Brand awareness' }, { value: 'traffic', label: 'Website traffic' },
          { value: 'offer', label: 'Promote an offer' }, { value: 'event', label: 'Promote an event' },
        ] },
        { id: 'preferred_start_date', label: 'Preferred start date', type: 'date', required: true },
        { id: 'target_url', label: 'Destination URL', type: 'url', required: true, maxLength: 400 },
        { id: 'audience_notes', label: 'Audience or targeting notes', type: 'textarea', maxLength: 900 },
      ] },
      { id: 'creative', eyebrow: 'Step 2', title: 'Message and creative', description: 'Short, direct creative performs best in an inbox.', fields: [
        { id: 'headline', label: 'Headline', type: 'text', required: true, maxLength: 100 },
        { id: 'body_copy', label: 'Message', type: 'textarea', required: true, maxLength: 600 },
        { id: 'call_to_action', label: 'Button text', type: 'text', required: true, placeholder: 'Learn more', maxLength: 40 },
        { id: 'logo_url', label: 'Logo', type: 'image', required: true },
        { id: 'creative_url', label: 'Primary image', type: 'image', required: true },
        { id: 'brand_notes', label: 'Brand or legal notes', type: 'textarea', maxLength: 900 },
      ] },
    ],
  },
  category_banner: {
    title: 'Prepare your category banner', completionLabel: 'Send banner for review', sections: [
      { id: 'placement', eyebrow: 'Step 1', title: 'Placement', description: 'Match the banner to the most relevant readers.', fields: [
        { id: 'campaign_name', label: 'Campaign name', type: 'text', required: true, maxLength: 140 },
        { id: 'requested_category', label: 'Requested category', type: 'text', required: true, maxLength: 100 },
        { id: 'preferred_start_date', label: 'Preferred start date', type: 'date', required: true },
        { id: 'target_url', label: 'Click-through URL', type: 'url', required: true, maxLength: 400 },
      ] },
      { id: 'creative', eyebrow: 'Step 2', title: 'Banner creative', description: 'Supply a clear message and a strong visual.', fields: [
        { id: 'headline', label: 'Headline', type: 'text', required: true, maxLength: 90 },
        { id: 'description', label: 'Supporting copy', type: 'textarea', required: true, maxLength: 320 },
        { id: 'call_to_action', label: 'Call to action', type: 'text', required: true, maxLength: 40 },
        { id: 'banner_image_url', label: 'Banner artwork', type: 'image', required: true },
        { id: 'logo_url', label: 'Logo', type: 'image' },
        { id: 'alt_text', label: 'Image description for accessibility', type: 'text', required: true, maxLength: 180 },
      ] },
    ],
  },
  sponsored_story: {
    title: 'Brief your sponsored story', completionLabel: 'Send story brief', sections: [
      { id: 'story', eyebrow: 'Step 1', title: 'The story', description: 'Tell our team what readers should understand and remember.', fields: [
        { id: 'story_goal', label: 'What should this story accomplish?', type: 'textarea', required: true, maxLength: 900 },
        { id: 'headline_idea', label: 'Headline idea', type: 'text', maxLength: 160 },
        { id: 'key_message', label: 'Most important message', type: 'textarea', required: true, maxLength: 1200 },
        { id: 'company_background', label: 'Company background', type: 'textarea', required: true, maxLength: 1800 },
        { id: 'desired_publish_date', label: 'Desired publish date', type: 'date' },
      ] },
      { id: 'sources', eyebrow: 'Step 2', title: 'Sources and assets', description: 'Give the editor accurate material to work from.', fields: [
        { id: 'website', label: 'Website', type: 'url', required: true, maxLength: 400 },
        { id: 'spokesperson', label: 'Spokesperson and title', type: 'text', maxLength: 180 },
        { id: 'approved_quotes', label: 'Approved quotes or facts', type: 'textarea', maxLength: 1800 },
        { id: 'logo_url', label: 'Logo', type: 'image', required: true },
        { id: 'image_urls', label: 'Story images', type: 'images', required: true },
        { id: 'editor_notes', label: 'Anything to avoid or include?', type: 'textarea', maxLength: 1000 },
      ] },
    ],
  },
  custom: {
    title: 'Complete your custom order brief', completionLabel: 'Send custom brief', sections: [
      { id: 'brief', eyebrow: 'Step 1', title: 'What we are delivering', description: 'Confirm the approved outcome and timing.', fields: [
        { id: 'approved_deliverable', label: 'Approved deliverable', type: 'textarea', required: true, maxLength: 1800 },
        { id: 'goal', label: 'Customer goal', type: 'textarea', required: true, maxLength: 1000 },
        { id: 'preferred_start_date', label: 'Preferred start date', type: 'date' },
        { id: 'deadline', label: 'Hard deadline, if any', type: 'date' },
        { id: 'destination_url', label: 'Destination URL', type: 'url', maxLength: 400 },
      ] },
      { id: 'assets', eyebrow: 'Step 2', title: 'Copy and assets', description: 'Send everything our team needs to begin.', fields: [
        { id: 'copy_notes', label: 'Copy, message, or instructions', type: 'textarea', required: true, maxLength: 2400 },
        { id: 'logo_url', label: 'Logo', type: 'image' },
        { id: 'asset_urls', label: 'Images', type: 'images' },
        { id: 'approval_email', label: 'Final approval contact', type: 'email', required: true, maxLength: 200 },
      ] },
    ],
  },
}

export function getSalesIntakeSchema(kind: unknown): IntakeSchema | null {
  if (typeof kind !== 'string') return null
  return (SALES_INTAKE_SCHEMAS as Record<string, IntakeSchema>)[kind] || null
}

export function intakeFieldMap(schema: IntakeSchema): Map<string, IntakeField> {
  return new Map(schema.sections.flatMap((section) => section.fields.map((field) => [field.id, field] as const)))
}

function safeUrl(value: string) {
  if (!value) return ''
  try {
    const parsed = new URL(value)
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return ''
    // Return the NORMALIZED href, not the raw input. `new URL()` accepts quotes
    // and angle brackets inside a URL, so returning `value` verbatim let a
    // customer-supplied string escape an HTML attribute downstream — these
    // values are interpolated unescaped into the mass newsletter. `href`
    // percent-encodes them at storage time.
    return parsed.href
  } catch {
    return ''
  }
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function safeDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return ''
  const [year, month, day] = value.split('-').map(Number)
  const parsed = new Date(Date.UTC(year, month - 1, day))
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day
    ? value
    : ''
}

function safeTime(value: string) {
  return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value) ? value : ''
}

function safeNumber(value: string) {
  if (!value) return ''
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 && number <= 100000000 ? String(number) : ''
}

export function sanitizeSalesIntakeValues(schema: IntakeSchema, input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {}
  const fields = intakeFieldMap(schema)
  const output: Record<string, unknown> = {}

  for (const [key, raw] of Object.entries(input as Record<string, unknown>)) {
    const field = fields.get(key)
    if (!field) continue
    if (field.type === 'checkbox') {
      output[key] = raw === true
      continue
    }
    if (field.type === 'images') {
      const urls = Array.isArray(raw) ? raw : []
      output[key] = urls
        .filter((value): value is string => typeof value === 'string')
        .map((value) => safeUrl(value.trim()))
        .filter(Boolean)
        .slice(0, 8)
      continue
    }
    if (typeof raw !== 'string' && typeof raw !== 'number') continue
    let value = String(raw).trim()
    if (field.type === 'select') {
      value = field.options?.some((option) => option.value === value) ? value : ''
    } else if (field.type === 'url' || field.type === 'image') {
      value = safeUrl(value)
    } else if (field.type === 'email') {
      value = EMAIL_PATTERN.test(value) ? value.toLowerCase() : ''
    } else if (field.type === 'date') {
      value = safeDate(value)
    } else if (field.type === 'time') {
      value = safeTime(value)
    } else if (field.type === 'number') {
      value = safeNumber(value)
    }
    const maxLength = field.maxLength || (field.type === 'textarea' ? 5000 : 500)
    output[key] = value.slice(0, maxLength)
  }
  return output
}

export function missingSalesIntakeFields(schema: IntakeSchema, values: Record<string, unknown>): string[] {
  const missing = schema.sections.flatMap((section) =>
    section.fields
      .filter((field) => field.required)
      .filter((field) => {
        const value = values[field.id]
        if (field.type === 'checkbox') return value !== true
        if (field.type === 'images') return !Array.isArray(value) || value.length === 0
        return typeof value !== 'string' || !value.trim()
      })
      .map((field) => field.id)
  )
  const payMin = Number(values.pay_min)
  const payMax = Number(values.pay_max)
  if (
    Number.isFinite(payMin) &&
    Number.isFinite(payMax) &&
    String(values.pay_min || '') &&
    String(values.pay_max || '') &&
    payMax < payMin &&
    !missing.includes('pay_max')
  ) {
    missing.push('pay_max')
  }
  return missing
}

export function intakeCompletion(schema: IntakeSchema, values: Record<string, unknown>): number {
  const required = schema.sections.flatMap((section) => section.fields.filter((field) => field.required))
  if (!required.length) return 100
  const missing = new Set(missingSalesIntakeFields(schema, values))
  return Math.round(((required.length - missing.size) / required.length) * 100)
}

export function initialSalesIntakeValues(kind: SalesIntakeKind, order: Record<string, any>) {
  const shared = {
    business_name: order.business_name || '',
    company_name: order.business_name || '',
    primary_category: order.directory_category || '',
    phone: order.contact_phone || '',
    contact_email: order.contact_email || '',
    application_email: order.contact_email || '',
    approval_email: order.contact_email || '',
    timezone: 'America/Denver',
  }
  const schema = SALES_INTAKE_SCHEMAS[kind]
  return sanitizeSalesIntakeValues(schema, shared)
}

export function isAllowedIntakeImage(input: { type: string; size: number }): string | null {
  if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(input.type)) {
    return 'Invalid image type. Use JPEG, PNG, WebP, or GIF.'
  }
  if (input.size > 10 * 1024 * 1024) return 'Image too large. Maximum size is 10 MB.'
  return null
}
