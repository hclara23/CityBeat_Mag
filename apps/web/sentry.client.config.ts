import * as Sentry from '@sentry/nextjs'

export function initSentry() {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: process.env.NODE_ENV,
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    debug: process.env.NODE_ENV !== 'production',

    // Set sample rate for error events
    sampleRate: 1.0,

    // Ignore certain errors
    ignoreErrors: [
      // Browser extensions
      'top.GLOBALS',
      // See: http://blog.errorception.com/2012/03/tale-of-unfindable-js-error.html
      'originalCreateNotification',
      'canvas.contentDocument',
      'MyApp_RemoveAllHighlights',
      // Facebook errors
      'fb_xd_fragment',
      // Network errors
      'NetworkError',
      'Network request failed',
    ],

    // Capture breadcrumbs
    maxBreadcrumbs: 50,

    integrations: [
      new Sentry.Replay({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],

    // Capture Replay for 10% of all sessions,
    // plus 100% of sessions with an error
    replaysSessionSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    replaysOnErrorSampleRate: 1.0,

    // Attach stack traces
    attachStacktrace: true,
  })
}
