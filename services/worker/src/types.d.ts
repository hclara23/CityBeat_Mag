interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void
  passThroughOnException?(): void
}

interface ScheduledEvent {
  scheduledTime: number
  cron: string
}
