import * as Sentry from '@sentry/nextjs'

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

export interface LogContext {
  userId?: string
  requestId?: string
  sessionId?: string
  campaignId?: string
  [key: string]: any
}

class Logger {
  private context: LogContext = {}

  setContext(context: LogContext) {
    this.context = { ...this.context, ...context }
    Sentry.setContext('application', context)
  }

  clearContext() {
    this.context = {}
    const client =
      (Sentry as any).getDefaultClient?.() ?? (Sentry as any).getCurrentHub?.().getClient?.()
    client?.clearBreadcrumbs?.()
  }

  private format(level: LogLevel, message: string, data?: any): string {
    const timestamp = new Date().toISOString()
    const contextStr = Object.keys(this.context).length
      ? ` [${Object.entries(this.context)
          .map(([k, v]) => `${k}=${v}`)
          .join(', ')}]`
      : ''

    const dataStr = data ? ` ${JSON.stringify(data)}` : ''
    return `${timestamp} [${level.toUpperCase()}]${contextStr} ${message}${dataStr}`
  }

  debug(message: string, data?: any) {
    console.debug(this.format(LogLevel.DEBUG, message, data))
    Sentry.captureMessage(message, 'debug')
  }

  info(message: string, data?: any) {
    console.log(this.format(LogLevel.INFO, message, data))
    Sentry.captureMessage(message, 'info')
  }

  warn(message: string, data?: any, error?: Error) {
    console.warn(this.format(LogLevel.WARN, message, data))
    if (error) {
      Sentry.captureException(error, { level: 'warning', extra: data })
    } else {
      Sentry.captureMessage(message, 'warning')
    }
  }

  error(message: string, error?: Error | string, data?: any) {
    console.error(this.format(LogLevel.ERROR, message, data))

    if (error instanceof Error) {
      Sentry.captureException(error, { extra: { ...this.context, ...data } })
    } else if (typeof error === 'string') {
      Sentry.captureMessage(error, 'error')
    } else {
      Sentry.captureMessage(message, 'error')
    }
  }

  captureException(error: Error, context?: LogContext) {
    if (context) {
      this.setContext(context)
    }
    Sentry.captureException(error)
  }

  captureMessage(message: string, level: LogLevel = LogLevel.INFO, context?: LogContext) {
    if (context) {
      this.setContext(context)
    }
    Sentry.captureMessage(message, level as any)
  }

  addBreadcrumb(message: string, category: string = 'user-action', data?: any) {
    Sentry.addBreadcrumb({
      message,
      category,
      level: 'info',
      data,
      timestamp: Date.now() / 1000,
    })
  }
}

export const logger = new Logger()
