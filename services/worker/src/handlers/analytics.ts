import { Env } from '../index'

export interface DailyMetrics {
  date: string
  totalImpressions: number
  totalClicks: number
  totalConversions: number
  totalSpent: number
  topCampaigns: Array<{
    campaignId: string
    impressions: number
    clicks: number
    conversions: number
  }>
}

export async function handleDailyAnalyticsReport(env: Env): Promise<void> {
  console.log('Starting daily analytics report generation...')

  try {
    // Calculate metrics from analytics table
    const metrics = await calculateDailyMetrics(env)

    // Generate report
    const report = generateAnalyticsReport(metrics)

    // Send report to stakeholders
    await sendAnalyticsReport(report, env)

    console.log('Daily analytics report generated successfully')
  } catch (error) {
    console.error('Daily analytics report failed:', error)
  }
}

async function calculateDailyMetrics(env: Env): Promise<DailyMetrics> {
  try {
    const today = new Date().toISOString().split('T')[0]

    // Query Supabase for today's metrics
    const response = await fetch(
      `${env.SUPABASE_URL}/rest/v1/rpc/get_daily_metrics?date=${today}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    )

    if (!response.ok) {
      console.warn('Failed to fetch daily metrics from Supabase')
      return {
        date: today,
        totalImpressions: 0,
        totalClicks: 0,
        totalConversions: 0,
        totalSpent: 0,
        topCampaigns: [],
      }
    }

    const data = await response.json()

    return {
      date: data?.date ?? today,
      totalImpressions: data?.totalImpressions ?? 0,
      totalClicks: data?.totalClicks ?? 0,
      totalConversions: data?.totalConversions ?? 0,
      totalSpent: data?.totalSpent ?? 0,
      topCampaigns: data?.topCampaigns ?? [],
    }
  } catch (error) {
    console.error('Error calculating daily metrics:', error)
    return {
      date: new Date().toISOString().split('T')[0],
      totalImpressions: 0,
      totalClicks: 0,
      totalConversions: 0,
      totalSpent: 0,
      topCampaigns: [],
    }
  }
}

function generateAnalyticsReport(metrics: DailyMetrics): string {
  const date = new Date(metrics.date).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const ctr =
    metrics.totalImpressions > 0
      ? ((metrics.totalClicks / metrics.totalImpressions) * 100).toFixed(2)
      : '0.00'

  const conversionRate =
    metrics.totalClicks > 0
      ? ((metrics.totalConversions / metrics.totalClicks) * 100).toFixed(2)
      : '0.00'

  let reportHtml = `
    <h2>Daily Analytics Report - ${date}</h2>

    <h3>Overview</h3>
    <ul>
      <li>Total Impressions: ${metrics.totalImpressions.toLocaleString()}</li>
      <li>Total Clicks: ${metrics.totalClicks.toLocaleString()}</li>
      <li>Click-Through Rate (CTR): ${ctr}%</li>
      <li>Total Conversions: ${metrics.totalConversions.toLocaleString()}</li>
      <li>Conversion Rate: ${conversionRate}%</li>
      <li>Total Spent: $${metrics.totalSpent.toFixed(2)}</li>
    </ul>
  `

  if (metrics.topCampaigns.length > 0) {
    reportHtml += `
      <h3>Top Performing Campaigns</h3>
      <table>
        <tr>
          <th>Campaign</th>
          <th>Impressions</th>
          <th>Clicks</th>
          <th>Conversions</th>
        </tr>
    `

    for (const campaign of metrics.topCampaigns) {
      reportHtml += `
        <tr>
          <td>${campaign.campaignId}</td>
          <td>${campaign.impressions.toLocaleString()}</td>
          <td>${campaign.clicks.toLocaleString()}</td>
          <td>${campaign.conversions.toLocaleString()}</td>
        </tr>
      `
    }

    reportHtml += `</table>`
  }

  return reportHtml
}

async function sendAnalyticsReport(
  reportHtml: string,
  env: Env
): Promise<void> {
  try {
    const emailBody = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; color: #333; }
            h2 { color: #2c3e50; }
            h3 { color: #34495e; margin-top: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
            th { background-color: #f8f9fa; }
          </style>
        </head>
        <body>
          ${reportHtml}
        </body>
      </html>
    `

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'analytics@citybeatmag.co',
        to: 'team@citybeatmag.co',
        subject: `Daily Analytics Report - ${new Date().toLocaleDateString()}`,
        html: emailBody,
      }),
    })

    if (!response.ok) {
      console.warn(`Analytics report email failed: ${response.statusText}`)
    } else {
      console.log('Analytics report email sent successfully')
    }
  } catch (error) {
    console.error('Failed to send analytics report:', error)
  }
}

export async function handleWeeklyAnalyticsReport(env: Env): Promise<void> {
  console.log('Starting weekly analytics report generation...')

  try {
    // Generate report for the past 7 days
    const endDate = new Date()
    const startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000)

    const response = await fetch(
      `${env.SUPABASE_URL}/rest/v1/rpc/get_weekly_metrics?start_date=${startDate.toISOString().split('T')[0]}&end_date=${endDate.toISOString().split('T')[0]}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    )

    if (!response.ok) {
      console.warn('Failed to fetch weekly metrics from Supabase')
      return
    }

    const metrics = await response.json()
    const report = generateWeeklyReport(metrics)
    await sendAnalyticsReport(report, env)

    console.log('Weekly analytics report generated successfully')
  } catch (error) {
    console.error('Weekly analytics report failed:', error)
  }
}

function generateWeeklyReport(metrics: any): string {
  const endDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
  const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toLocaleDateString(
    'en-US',
    {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }
  )

  return `
    <h2>Weekly Analytics Report - ${startDate} to ${endDate}</h2>
    <p>Overall performance metrics for the past week.</p>
    <ul>
      <li>Total Impressions: ${metrics.total_impressions?.toLocaleString() || 0}</li>
      <li>Total Clicks: ${metrics.total_clicks?.toLocaleString() || 0}</li>
      <li>Total Conversions: ${metrics.total_conversions?.toLocaleString() || 0}</li>
      <li>Total Revenue: $${(metrics.total_revenue || 0).toFixed(2)}</li>
    </ul>
  `
}
