import Stripe from 'stripe'

type SupabaseLike = {
  from(table: string): any
}

type ConnectAccountRow = {
  id: string
  profile_id: string
  stripe_account_id: string
  onboarding_complete: boolean
  charges_enabled: boolean
  payouts_enabled: boolean
  details_submitted: boolean
}

export function getStripe() {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY
  if (!stripeSecretKey) {
    throw new Error('Stripe configuration missing')
  }

  return new Stripe(stripeSecretKey, {
    apiVersion: '2023-08-16',
  })
}

function requirementsList(requirements: Stripe.Account.Requirements | null | undefined) {
  return {
    currently_due: requirements?.currently_due ?? [],
    past_due: requirements?.past_due ?? [],
  }
}

export async function syncConnectedAccount(
  supabase: SupabaseLike,
  profileId: string,
  account: Stripe.Account
) {
  const requirements = requirementsList(account.requirements)
  const onboardingComplete = Boolean(account.details_submitted && account.payouts_enabled)

  const payload = {
    profile_id: profileId,
    stripe_account_id: account.id,
    account_type: account.type || 'express',
    country: account.country || 'US',
    default_currency: account.default_currency || 'usd',
    charges_enabled: Boolean(account.charges_enabled),
    payouts_enabled: Boolean(account.payouts_enabled),
    details_submitted: Boolean(account.details_submitted),
    onboarding_complete: onboardingComplete,
    requirements_currently_due: requirements.currently_due,
    requirements_past_due: requirements.past_due,
    metadata: account.metadata || {},
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from('stripe_connected_accounts')
    .upsert(payload, { onConflict: 'stripe_account_id' })
    .select('*')
    .single()

  if (error) throw new Error(error.message)

  await supabase
    .from('profiles')
    .update({
      stripe_connected_account_id: account.id,
      stripe_connect_onboarding_complete: onboardingComplete,
    })
    .eq('id', profileId)

  return data as ConnectAccountRow
}

export async function getExistingConnectedAccount(
  supabase: SupabaseLike,
  profileId: string
) {
  const { data, error } = await supabase
    .from('stripe_connected_accounts')
    .select('*')
    .eq('profile_id', profileId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data as ConnectAccountRow | null
}

export async function getOrCreateConnectedAccount(params: {
  supabase: SupabaseLike
  profileId: string
  email?: string | null
}) {
  const stripe = getStripe()
  const existing = await getExistingConnectedAccount(params.supabase, params.profileId)

  if (existing?.stripe_account_id) {
    const account = await stripe.accounts.retrieve(existing.stripe_account_id)
    const row = await syncConnectedAccount(params.supabase, params.profileId, account)
    return { stripe, account, row }
  }

  const account = await stripe.accounts.create({
    type: 'express',
    country: 'US',
    email: params.email || undefined,
    capabilities: {
      transfers: { requested: true },
    },
    metadata: {
      citybeat_profile_id: params.profileId,
    },
  })

  const row = await syncConnectedAccount(params.supabase, params.profileId, account)
  return { stripe, account, row }
}
