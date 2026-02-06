import * as Sentry from '@sentry/nextjs'

export function initServerSentry() {
  Sentry.init({
    dsn: process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: process.env.NODE_ENV,
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    debug: process.env.NODE_ENV !== 'production',

    // Ignore certain errors
    ignoreErrors: [
      'Request timeout',
      'Connection reset',
    ],

    // Attach stack traces
    attachStacktrace: true,

    // Include local variables in stack traces
    includeLocalVariables: process.env.NODE_ENV !== 'production',
  })
}
