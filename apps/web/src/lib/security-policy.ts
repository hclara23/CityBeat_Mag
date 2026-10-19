/** Nonces authorize Next hydration and analytics without allowing injected scripts. */
export function contentSecurityPolicy(nonce: string, development = false): string {
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'self'",
    "form-action 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${development ? " 'unsafe-eval'" : ''} https://js.stripe.com https://maps.googleapis.com https://www.googletagmanager.com https://apis.google.com https://static.cloudflareinsights.com`,
    "script-src-attr 'none'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self' https://*.googleapis.com https://*.gstatic.com https://*.firebaseio.com https://api.stripe.com https://r.stripe.com https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com https://static.cloudflareinsights.com https://cloudflareinsights.com https://*.novu.co wss://*.novu.co https://*.posthog.com",
    "frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://*.firebaseapp.com https://apis.google.com https://accounts.google.com",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
  ].join('; ')
}
