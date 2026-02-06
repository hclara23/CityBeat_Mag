/**
 * Cloudflare Worker Cron Job Configuration
 * These crons are defined in wrangler.toml and trigger the scheduled() function in index.ts
 */

export interface CronJob {
  name: string
  schedule: string
  timezone: string
  description: string
}

export const cronJobs: CronJob[] = [
  {
    name: 'Morning Brief Fetch',
    schedule: '0 7 * * *',
    timezone: 'America/Chicago',
    description: 'Fetch news from APIs at 7 AM CST',
  },
  {
    name: 'Mid-Morning Brief Fetch',
    schedule: '0 10 * * *',
    timezone: 'America/Chicago',
    description: 'Fetch news from APIs at 10 AM CST',
  },
  {
    name: 'Noon Brief Fetch',
    schedule: '0 13 * * *',
    timezone: 'America/Chicago',
    description: 'Fetch news from APIs at 1 PM CST',
  },
  {
    name: 'Afternoon Brief Fetch',
    schedule: '0 16 * * *',
    timezone: 'America/Chicago',
    description: 'Fetch news from APIs at 4 PM CST',
  },
  {
    name: 'Evening Brief Fetch',
    schedule: '0 19 * * *',
    timezone: 'America/Chicago',
    description: 'Fetch news from APIs at 7 PM CST',
  },
]

// Additional cron jobs that could be added for maintenance/reporting
export const additionalCrons: CronJob[] = [
  {
    name: 'Daily Analytics Summary',
    schedule: '0 23 * * *',
    timezone: 'America/Chicago',
    description: 'Generate daily analytics summary at 11 PM CST',
  },
  {
    name: 'Weekly Report Generation',
    schedule: '0 8 * * 1',
    timezone: 'America/Chicago',
    description: 'Generate weekly reports every Monday at 8 AM CST',
  },
  {
    name: 'Subscription Renewal Check',
    schedule: '0 2 * * *',
    timezone: 'America/Chicago',
    description: 'Check and process subscription renewals at 2 AM CST',
  },
]
