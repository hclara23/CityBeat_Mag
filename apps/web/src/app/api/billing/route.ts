import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient, getServerUser } from '@citybeat/lib/supabase/server'

export const dynamic = 'force-dynamic'

type SubscriptionRow = {
  id: string
  stripe_subscription_id?: string | null
  stripe_customer_id?: string | null
  plan_id?: string | null
  status?: string | null
  price_per_month?: number | null
  amount_total?: number | null
  billing_cycle?: string | null
  payment_status?: string | null
  created_at: string
}

type PaymentRow = {
  id: string
  stripe_charge_id?: string | null
  amount?: number | null
  amount_total?: number | null
  status?: string | null
  payment_status?: string | null
  created_at: string
  invoice_pdf?: string | null
}

function getCookieStore() {
  const cookieStore = cookies()

  return {
    getAll: () => cookieStore.getAll(),
    setAll: () => {
      // Route handlers do not need to write refreshed cookies for these reads.
    },
  }
}

function mapSubscription(row: SubscriptionRow) {
  return {
    id: row.id,
    stripe_subscription_id: row.stripe_subscription_id ?? undefined,
    stripe_customer_id: row.stripe_customer_id ?? undefined,
    ad_type: row.plan_id ?? 'advertising',
    amount_total: Number(row.amount_total ?? row.price_per_month ?? 0),
    billing_cycle: row.billing_cycle ?? 'monthly',
    payment_status: row.payment_status ?? row.status ?? 'pending',
    created_at: row.created_at,
  }
}

function mapInvoice(row: PaymentRow) {
  return {
    id: row.stripe_charge_id ?? row.id,
    amount: Number(row.amount ?? row.amount_total ?? 0),
    date: row.created_at,
    status: row.status ?? row.payment_status ?? 'unknown',
    pdfUrl: row.invoice_pdf ?? undefined,
  }
}

export async function GET() {
  const cookieStore = getCookieStore()
  const user = await getServerUser(cookieStore)

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServerClient(cookieStore)

  const { data: subscriptions, error: subscriptionsError } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('advertiser_id', user.id)
    .order('created_at', { ascending: false })

  if (subscriptionsError) {
    return NextResponse.json(
      { error: 'Failed to load subscriptions' },
      { status: 500 }
    )
  }

  const { data: payments, error: paymentsError } = await supabase
    .from('payments')
    .select('*')
    .eq('advertiser_id', user.id)
    .order('created_at', { ascending: false })
    .limit(25)

  if (paymentsError) {
    return NextResponse.json(
      { error: 'Failed to load billing history' },
      { status: 500 }
    )
  }

  return NextResponse.json({
    subscriptions: (subscriptions ?? []).map(mapSubscription),
    invoices: (payments ?? []).map(mapInvoice),
  })
}
