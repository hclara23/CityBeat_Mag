import { BetaAnalyticsDataClient } from '@google-analytics/data';
import { NextResponse } from 'next/server';

export const revalidate = 3600; // Cache for 1 hour

export async function GET() {
  const propertyId = process.env.GA4_PROPERTY_ID;
  
  if (!propertyId || !process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
    // Return empty fallback data so the dashboard doesn't break
    return NextResponse.json({
      totalViews: 0,
      topStories: [
        { t: "Setup GA4 credentials in .env", v: "0" },
        { t: "Set GA4_PROPERTY_ID", v: "0" },
        { t: "Set GOOGLE_APPLICATION_CREDENTIALS_JSON", v: "0" }
      ]
    });
  }

  try {
    const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
    
    const analyticsDataClient = new BetaAnalyticsDataClient({
      credentials: {
        client_email: credentials.client_email,
        private_key: credentials.private_key,
      }
    });

    // Run parallel queries: 1. Total views, 2. Top stories
    const [viewsResponse, storiesResponse] = await Promise.all([
      analyticsDataClient.runReport({
        property: `properties/${propertyId}`,
        dateRanges: [
          {
            startDate: 'yesterday',
            endDate: 'today',
          },
        ],
        metrics: [
          {
            name: 'screenPageViews',
          },
        ],
      }),
      analyticsDataClient.runReport({
        property: `properties/${propertyId}`,
        dateRanges: [
          {
            startDate: '30daysAgo',
            endDate: 'today',
          },
        ],
        dimensions: [
          {
            name: 'pageTitle',
          },
        ],
        metrics: [
          {
            name: 'screenPageViews',
          },
        ],
        orderBys: [
          {
            metric: {
              metricName: 'screenPageViews',
            },
            desc: true,
          },
        ],
        limit: 10,
      })
    ]);

    // Parse Total Views
    let totalViews = 0;
    if (viewsResponse[0].rows && viewsResponse[0].rows.length > 0) {
      totalViews = parseInt(viewsResponse[0].rows[0].metricValues?.[0].value || '0', 10);
    }

    // Parse Top Stories
    const topStories = [];
    if (storiesResponse[0].rows) {
      for (const row of storiesResponse[0].rows) {
        let title = row.dimensionValues?.[0].value || 'Unknown Page';
        
        // Clean up the title (e.g. remove " - CityBeat Mag" if present)
        title = title.replace(/\s*-\s*CityBeat Mag.*/, '');

        if (title !== 'Home' && title !== 'Unknown Page' && topStories.length < 3) {
          let views = parseInt(row.metricValues?.[0].value || '0', 10);
          let formattedViews = views >= 1000 ? (views / 1000).toFixed(1) + 'k' : views.toString();
          topStories.push({
            t: title,
            v: formattedViews
          });
        }
      }
    }

    // Ensure we have 3 fallbacks if GA data doesn't have them
    while (topStories.length < 3) {
      topStories.push({ t: "Awaiting more traffic...", v: "0" });
    }

    return NextResponse.json({
      totalViews,
      topStories
    });
  } catch (error) {
    console.error('Failed to fetch analytics:', error);
    return NextResponse.json({
      totalViews: 0,
      topStories: [
        { t: "Error fetching data", v: "0" },
        { t: "Check server logs", v: "0" },
        { t: "Verify GA4 permissions", v: "0" }
      ]
    });
  }
}
