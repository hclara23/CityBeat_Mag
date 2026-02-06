export interface TrackingEvent {
  event: string
  timestamp: number
  userId?: string
  sessionId: string
  properties: Record<string, any>
}

export class EventTracker {
  private sessionId: string
  private baseUrl: string

  constructor(baseUrl: string = '') {
    this.baseUrl = baseUrl
    this.sessionId = this.generateSessionId()
  }

  private generateSessionId(): string {
    if (typeof window !== 'undefined' && window.localStorage) {
      const existing = window.localStorage.getItem('citybeat_session_id')
      if (existing) return existing
    }
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem('citybeat_session_id', sessionId)
    }
    return sessionId
  }

  track(event: string, properties: Record<string, any> = {}): void {
    const trackingEvent: TrackingEvent = {
      event,
      timestamp: Date.now(),
      sessionId: this.sessionId,
      properties,
    }

    if (typeof window !== 'undefined' && navigator.sendBeacon) {
      navigator.sendBeacon(
        `${this.baseUrl}/api/tracking`,
        JSON.stringify(trackingEvent)
      )
    }
  }

  pageView(pathname: string): void {
    this.track('page_view', { pathname })
  }

  adClick(adId: string, adType: string): void {
    this.track('ad_click', { adId, adType })
  }

  newsletterSignup(): void {
    this.track('newsletter_signup')
  }

  articleRead(articleId: string, timeSpent: number): void {
    this.track('article_read', { articleId, timeSpent })
  }

  getSessionId(): string {
    return this.sessionId
  }
}

export function createTracker(baseUrl?: string): EventTracker {
  return new EventTracker(baseUrl)
}
