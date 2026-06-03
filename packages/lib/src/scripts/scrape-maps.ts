import puppeteer from 'puppeteer';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from different possible locations
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.vercel.production.local') });
dotenv.config({ path: path.resolve(process.cwd(), 'apps/web/.env.local') });

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://czhttphmcgrsxvsiakha.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: Supabase URL or Service Role Key is missing in environment variables.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

interface ScrapedBusiness {
  name: string;
  category: string;
  address: string;
  phone?: string;
  website?: string;
  google_place_id: string;
  latitude?: number;
  longitude?: number;
  rating?: number;
  user_ratings_total?: number;
  hours?: Record<string, string>;
}

async function scrapeGoogleMaps(query: string, category: string, limit: number = 30): Promise<ScrapedBusiness[]> {
  console.log(`Launching Puppeteer for query: "${query}" (Category: ${category})`);
  
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 900 });
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  try {
    const searchUrl = `https://www.google.com/maps/search/${encodeURIComponent(query)}`;
    await page.goto(searchUrl, { waitUntil: 'networkidle2' });
    console.log('Navigated to Google Maps.');

    // Wait for the search results pane to load
    const resultsPaneSelector = 'div[role="feed"]';
    try {
      await page.waitForSelector(resultsPaneSelector, { timeout: 10000 });
    } catch {
      console.log('Results pane not found. Trying fallback search flow.');
    }

    // Scroll results pane to load more items
    console.log('Scrolling results pane...');
    let lastHeight = 0;
    let scrollCount = 0;
    const maxScrolls = 8;

    while (scrollCount < maxScrolls) {
      const resultsLoaded = await page.evaluate((selector) => {
        const pane = document.querySelector(selector);
        if (pane) {
          pane.scrollBy(0, 1000);
          return pane.scrollHeight;
        }
        window.scrollBy(0, 1000);
        return document.body.scrollHeight;
      }, resultsPaneSelector);

      await new Promise((r) => setTimeout(r, 1500));
      scrollCount++;
      
      if (resultsLoaded === lastHeight) {
        console.log('Reached the bottom of the list.');
        break;
      }
      lastHeight = resultsLoaded;
    }

    // Get all listing links
    const listingUrls = await page.evaluate(() => {
      const anchors = Array.from(document.querySelectorAll('a[href*="/maps/place/"]'));
      return anchors.map((a) => (a as HTMLAnchorElement).href);
    });

    console.log(`Found ${listingUrls.length} listing URLs. Scraping details for up to ${limit}...`);
    const businesses: ScrapedBusiness[] = [];

    for (let i = 0; i < Math.min(listingUrls.length, limit); i++) {
      const url = listingUrls[i];
      console.log(`[${i + 1}/${Math.min(listingUrls.length, limit)}] Scraping: ${url}`);
      
      try {
        await page.goto(url, { waitUntil: 'networkidle2' });
        await new Promise((r) => setTimeout(r, 1500)); // Let detail panel load fully

        // Extract metadata from URL (lat, lng, and placeID hash)
        const currentUrl = page.url();
        let latitude: number | undefined;
        let longitude: number | undefined;
        
        const coordsMatch = currentUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
        if (coordsMatch) {
          latitude = parseFloat(coordsMatch[1]);
          longitude = parseFloat(coordsMatch[2]);
        }

        // Generate unique place ID hash from the url path
        let placeId = '';
        const placeIdMatch = currentUrl.match(/place\/([^\/]+)/);
        if (placeIdMatch) {
          placeId = decodeURIComponent(placeIdMatch[1]).replace(/\+/g, ' ');
        } else {
          placeId = `scraped_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        }

        const details = await page.evaluate(() => {
          // Extract Name
          const nameEl = document.querySelector('h1');
          const name = nameEl ? nameEl.textContent?.trim() : '';

          // Extract Rating & Review count
          let rating: number | undefined;
          let reviewCount: number | undefined;

          // Rating element finder
          const ratingEl = document.querySelector('div.F7nice span[aria-hidden="true"]');
          if (ratingEl) {
            rating = parseFloat(ratingEl.textContent?.trim() || '0');
          }

          const reviewsEl = document.querySelector('div.F7nice span[aria-label*="reviews"]');
          if (reviewsEl) {
            const countText = reviewsEl.textContent?.replace(/[()]/g, '').trim();
            if (countText) {
              reviewCount = parseInt(countText.replace(/,/g, ''), 10);
            }
          }

          // Contact details
          let address = '';
          let phone = '';
          let website = '';

          // Search buttons with specific attribute markers
          const addressBtn = document.querySelector('button[data-item-id="address"]');
          if (addressBtn) {
            address = addressBtn.textContent?.replace('', '').trim() || '';
          }

          const phoneBtn = document.querySelector('button[data-item-id^="phone:tel:"]');
          if (phoneBtn) {
            phone = phoneBtn.getAttribute('data-item-id')?.replace('phone:tel:', '').trim() || '';
          }

          const websiteLink = document.querySelector('a[data-item-id="authority"]');
          if (websiteLink) {
            website = websiteLink.getAttribute('href') || '';
          }

          // Hours mapping
          const hours: Record<string, string> = {};
          const hoursTable = document.querySelector('table');
          if (hoursTable) {
            const rows = Array.from(hoursTable.querySelectorAll('tr'));
            rows.forEach((row) => {
              const cells = Array.from(row.querySelectorAll('td'));
              if (cells.length >= 2) {
                const day = cells[0].textContent?.trim() || '';
                const time = cells[1].textContent?.trim() || '';
                if (day && time) {
                  hours[day] = time;
                }
              }
            });
          }

          return { name, rating, reviewCount, address, phone, website, hours };
        });

        if (details.name) {
          businesses.push({
            name: details.name,
            category,
            address: details.address || 'El Paso, TX',
            phone: details.phone || undefined,
            website: details.website || undefined,
            google_place_id: placeId,
            latitude,
            longitude,
            rating: details.rating || undefined,
            user_ratings_total: details.reviewCount || undefined,
            hours: Object.keys(details.hours).length > 0 ? details.hours : undefined,
          });
        }
      } catch (err) {
        console.error(`Error scraping listing details:`, err);
      }
    }

    return businesses;
  } finally {
    await browser.close();
  }
}

async function run() {
  const queries = [
    { term: 'restaurants in El Paso, TX', cat: 'Restaurant' },
    { term: 'coffee shops in El Paso, TX', cat: 'Cafe' },
    { term: 'bars in El Paso, TX', cat: 'Bar' },
  ];

  console.log('Starting Google Maps Scraper...');
  
  for (const q of queries) {
    try {
      const results = await scrapeGoogleMaps(q.term, q.cat, 15);
      console.log(`Scraped ${results.length} items for query: "${q.term}"`);

      if (results.length > 0) {
        console.log('Inserting listings into Supabase directory_listings table...');
        
        for (const item of results) {
          const { error } = await supabase
            .from('directory_listings')
            .upsert(
              {
                name: item.name,
                category: item.category,
                address: item.address,
                phone: item.phone,
                website: item.website,
                google_place_id: item.google_place_id,
                latitude: item.latitude,
                longitude: item.longitude,
                rating: item.rating,
                user_ratings_total: item.user_ratings_total,
                hours: item.hours,
                tier: 'basic',
                claim_status: 'unclaimed',
                is_published: true,
              },
              { onConflict: 'google_place_id' }
            );

          if (error) {
            console.error(`Failed to upsert "${item.name}":`, error.message);
          } else {
            console.log(`Successfully upserted: "${item.name}"`);
          }
        }
      }
    } catch (err) {
      console.error(`Error processing query "${q.term}":`, err);
    }
  }

  console.log('Scraper script finished.');
}

run().catch(console.error);
