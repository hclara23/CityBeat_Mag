import type { SalesIntakeKind } from './sales-products'

export interface FulfillmentTarget {
  collection: string
  id: string
  status: 'in_review'
}

export function salesFulfillmentTarget(input: {
  orderId: string
  intakeKind: SalesIntakeKind
  listingId?: string | null
}): FulfillmentTarget {
  switch (input.intakeKind) {
    case 'directory':
      if (!input.listingId) throw new Error('Directory order is missing its listing.')
      return { collection: 'directory_listings', id: input.listingId, status: 'in_review' }
    case 'job':
      return { collection: 'jobs', id: input.orderId, status: 'in_review' }
    case 'event':
      return { collection: 'events', id: input.orderId, status: 'in_review' }
    case 'category_banner':
      return { collection: 'ad_banners', id: input.orderId, status: 'in_review' }
    case 'sponsored_story':
      return { collection: 'sponsored_stories', id: input.orderId, status: 'in_review' }
    case 'newsletter_sponsorship':
      return { collection: 'ad_campaigns', id: input.orderId, status: 'in_review' }
    case 'custom':
      return { collection: 'sales_fulfillment_briefs', id: input.orderId, status: 'in_review' }
  }
}

function text(values: Record<string, unknown>, key: string) {
  return typeof values[key] === 'string' ? values[key] : ''
}

function images(values: Record<string, unknown>, key: string) {
  return Array.isArray(values[key]) ? values[key] : []
}

export function buildSalesFulfillmentRecord(input: {
  orderId: string
  order: Record<string, any>
  values: Record<string, unknown>
  now?: Date
}): Record<string, any> {
  const { order, values } = input
  const now = (input.now || new Date()).toISOString()
  const shared = {
    sales_order_id: input.orderId,
    product_id: order.product_id,
    payment_status: 'paid',
    fulfillment_status: 'in_review',
    sold_by_rep: order.sold_by || null,
    contact_email: order.contact_email || null,
    updated_at: now,
  }

  switch (order.intake_kind as SalesIntakeKind) {
    case 'directory':
      return {
        ...shared,
        name: text(values, 'business_name'),
        category: text(values, 'primary_category'),
        description: text(values, 'short_description'),
        address: [text(values, 'street_address'), text(values, 'city'), text(values, 'state'), text(values, 'postal_code')].filter(Boolean).join(', '),
        phone: text(values, 'phone'),
        website: text(values, 'website') || null,
        hours_text: text(values, 'business_hours'),
        service_area: text(values, 'service_area') || null,
        image_url: text(values, 'cover_image_url'),
        logo_url: text(values, 'logo_url'),
        gallery_urls: images(values, 'gallery_urls'),
        social_links: {
          instagram: text(values, 'instagram_url') || null,
          facebook: text(values, 'facebook_url') || null,
        },
        customer_notes: text(values, 'customer_notes') || null,
        claim_status: 'pending_approval',
        is_published: false,
      }
    case 'job':
      return {
        ...shared,
        title: text(values, 'job_title'),
        company_name: text(values, 'company_name'),
        category: text(values, 'job_category'),
        employment_type: text(values, 'employment_type'),
        workplace_type: text(values, 'workplace_type'),
        location: text(values, 'location'),
        pay_min: Number(text(values, 'pay_min')) || null,
        pay_max: Number(text(values, 'pay_max')) || null,
        pay_period: text(values, 'pay_period'),
        benefits: text(values, 'benefits') || null,
        schedule: text(values, 'schedule') || null,
        description: text(values, 'summary'),
        responsibilities: text(values, 'responsibilities'),
        qualifications: text(values, 'qualifications'),
        apply_url: text(values, 'apply_url') || null,
        application_email: text(values, 'application_email'),
        application_deadline: text(values, 'application_deadline') || null,
        company_logo_url: text(values, 'company_logo_url') || null,
        status: 'pending_review',
        is_paid: true,
        is_active: false,
        created_at: now,
      }
    case 'event':
      return {
        ...shared,
        title_en: text(values, 'event_title'),
        title_es: text(values, 'event_title'),
        category: text(values, 'event_category'),
        start_date: `${text(values, 'start_date')}T${text(values, 'start_time')}:00`,
        end_date: text(values, 'end_date') ? `${text(values, 'end_date')}T${text(values, 'end_time') || '23:59'}:00` : null,
        timezone: text(values, 'timezone'),
        event_format: text(values, 'event_format'),
        venue: text(values, 'venue_name'),
        venue_address: text(values, 'venue_address'),
        ticket_url: text(values, 'ticket_url') || null,
        price_info: text(values, 'price_info'),
        age_info: text(values, 'age_info') || null,
        accessibility_info: text(values, 'accessibility_info') || null,
        meta_en: text(values, 'event_description'),
        meta_es: text(values, 'event_description'),
        organizer_name: text(values, 'organizer_name'),
        submitter_email: text(values, 'contact_email'),
        event_website: text(values, 'event_website') || null,
        image_url: text(values, 'event_image_url'),
        status: 'pending',
        featured: true,
        source: 'paid_sales_order',
        created_at: now,
      }
    case 'category_banner':
      return {
        ...shared,
        sponsor_name: order.business_name,
        campaign_name: text(values, 'campaign_name'),
        title: text(values, 'headline'),
        description: text(values, 'description'),
        image_url: text(values, 'banner_image_url'),
        logo_url: text(values, 'logo_url') || null,
        link_url: text(values, 'target_url'),
        alt_text: text(values, 'alt_text'),
        placement: 'directory',
        requested_category: text(values, 'requested_category'),
        preferred_start_date: text(values, 'preferred_start_date'),
        locale: 'all',
        priority: 0,
        is_active: false,
        status: 'pending_review',
        created_at: now,
      }
    case 'newsletter_sponsorship':
      return {
        ...shared,
        name: text(values, 'campaign_name'),
        advertiser_name: order.business_name,
        objective: text(values, 'campaign_objective'),
        preferred_start_date: text(values, 'preferred_start_date'),
        target_url: text(values, 'target_url'),
        audience_notes: text(values, 'audience_notes') || null,
        headline: text(values, 'headline'),
        body_copy: text(values, 'body_copy'),
        call_to_action: text(values, 'call_to_action'),
        logo_url: text(values, 'logo_url'),
        creative_url: text(values, 'creative_url'),
        brand_notes: text(values, 'brand_notes') || null,
        stripe_subscription_id: order.stripe_subscription_id || null,
        status: 'pending_review',
        is_active: false,
        created_at: now,
      }
    case 'sponsored_story':
      return {
        ...shared,
        sponsor_name: order.business_name,
        story_goal: text(values, 'story_goal'),
        headline_idea: text(values, 'headline_idea') || null,
        key_message: text(values, 'key_message'),
        company_background: text(values, 'company_background'),
        desired_publish_date: text(values, 'desired_publish_date') || null,
        website: text(values, 'website'),
        spokesperson: text(values, 'spokesperson') || null,
        approved_quotes: text(values, 'approved_quotes') || null,
        logo_url: text(values, 'logo_url'),
        image_urls: images(values, 'image_urls'),
        editor_notes: text(values, 'editor_notes') || null,
        status: 'pending_review',
        created_at: now,
      }
    case 'custom':
      return {
        ...shared,
        customer_name: order.business_name,
        approved_description: order.custom_description || null,
        approved_deliverable: text(values, 'approved_deliverable'),
        goal: text(values, 'goal'),
        preferred_start_date: text(values, 'preferred_start_date') || null,
        deadline: text(values, 'deadline') || null,
        destination_url: text(values, 'destination_url') || null,
        copy_notes: text(values, 'copy_notes'),
        logo_url: text(values, 'logo_url') || null,
        asset_urls: images(values, 'asset_urls'),
        approval_email: text(values, 'approval_email'),
        status: 'pending_review',
        created_at: now,
      }
  }
}
