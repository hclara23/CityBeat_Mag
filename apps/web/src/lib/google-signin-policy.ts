export function trustedSignInOrigin(origin: string | null, appUrl: string): boolean {
  try { return Boolean(origin && origin === new URL(appUrl).origin) } catch { return false }
}

export function validGoogleIdentity(token: {
  firebase?: { sign_in_provider?: string }; email_verified?: boolean; auth_time?: number
}, nowSeconds: number): boolean {
  const age = nowSeconds - Number(token.auth_time)
  return token.firebase?.sign_in_provider === 'google.com' && token.email_verified === true &&
    Number.isFinite(age) && age >= 0 && age <= 300
}

// Google authentication verifies identity, never business ownership or staff roles.
export function newGoogleProfile(uid: string, email: string, name: string, locale: unknown) {
  return {
    id: uid, email, full_name: name.slice(0, 200) || null, locale: locale === 'es' ? 'es' : 'en',
    role: 'reader', is_advertiser: false, is_developer: false, is_editor: false,
    is_writer: false, is_sales: false, sales_dashboard_enabled: false,
    stripe_connect_onboarding_complete: false, email_notifications_enabled: true,
    sms_notifications_enabled: false, mfa_enabled: false, email_verified: true, review_points: 0,
  }
}

export function googleProfileForSignIn(existing: Record<string, any> | undefined, fresh: Record<string, any>) {
  return existing ?? fresh
}

// Keep the MFA/cookie decision testable without issuing real credentials.
export async function googleSessionOutcome(profile: Record<string, any>, actions: {
  createMfaChallenge: () => Promise<string>; createCookie: () => Promise<string>
}): Promise<{ kind: 'mfa'; token: string } | { kind: 'session'; cookie: string }> {
  if (profile.mfa_enabled) return { kind: 'mfa', token: await actions.createMfaChallenge() }
  return { kind: 'session', cookie: await actions.createCookie() }
}
