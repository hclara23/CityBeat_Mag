type AnalyticsWindow = {
  dataLayer?: unknown[]
  gtag?: (...args: any[]) => void
  __citybeatGaInitialized?: boolean
}

/** Queue the first page view even when the network loader has not arrived yet. */
export function queueGooglePageView(target: AnalyticsWindow, measurementId: string, page: {
  page_path: string; page_location: string; page_title: string
}) {
  target.dataLayer = target.dataLayer || []
  target.gtag = target.gtag || function () { target.dataLayer!.push(arguments) }
  if (!target.__citybeatGaInitialized) {
    target.gtag('js', new Date())
    target.gtag('config', measurementId, { send_page_view: false })
    target.__citybeatGaInitialized = true
  }
  target.gtag('event', 'page_view', page)
}
