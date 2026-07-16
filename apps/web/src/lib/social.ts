// Social auto-poster. No-op until credentials are configured, so it can ship now
// and "turn on" the moment you add tokens. Implements Facebook Page posting
// (highest local reach) and Threads (text-first, great for event roundups);
// Instagram / X are stubbed behind their own keys.
//
// Env to enable:
//   FB_PAGE_ID, FB_PAGE_ACCESS_TOKEN        → Facebook Page feed
//   THREADS_USER_ID, THREADS_ACCESS_TOKEN   → Threads (Meta)
//   (IG_USER_ID, IG_ACCESS_TOKEN)           → Instagram (stub)
//   (X_BEARER_TOKEN)                        → X/Twitter (stub)

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://citybeatmag.co'

export type SocialResult = { network: string; status: 'posted' | 'skipped' | 'error'; id?: string; error?: string }

async function postToFacebook(message: string, link: string): Promise<SocialResult> {
  const pageId = process.env.FB_PAGE_ID
  const token = process.env.FB_PAGE_ACCESS_TOKEN
  if (!pageId || !token) return { network: 'facebook', status: 'skipped' }
  try {
    const res = await fetch(`https://graph.facebook.com/${pageId}/feed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, link, access_token: token }),
    })
    const data: any = await res.json().catch(() => ({}))
    if (!res.ok) return { network: 'facebook', status: 'error', error: data?.error?.message || `HTTP ${res.status}` }
    return { network: 'facebook', status: 'posted', id: data.id }
  } catch (e: any) {
    return { network: 'facebook', status: 'error', error: e?.message || 'fetch failed' }
  }
}

// Threads (Meta) — text-first, so it's ideal for a "things to do" roundup. The
// Graph publish is two steps: create a text media container, then publish it.
// Enable with THREADS_USER_ID + a Threads user token (threads_content_publish
// scope) in THREADS_ACCESS_TOKEN. The link is carried inline in the text; Threads
// renders the first URL as a tappable link.
async function postToThreads(text: string): Promise<SocialResult> {
  const userId = process.env.THREADS_USER_ID
  const token = process.env.THREADS_ACCESS_TOKEN
  if (!userId || !token) return { network: 'threads', status: 'skipped' }
  const BASE = 'https://graph.threads.net/v1.0'
  try {
    // 1) Create the text container (Threads caps a post at 500 chars).
    const createRes = await fetch(`${BASE}/${userId}/threads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ media_type: 'TEXT', text: text.slice(0, 500), access_token: token }),
    })
    const created: any = await createRes.json().catch(() => ({}))
    if (!createRes.ok || !created?.id) {
      return { network: 'threads', status: 'error', error: created?.error?.message || `create HTTP ${createRes.status}` }
    }
    // 2) Publish the container. Small text posts are ready immediately.
    const pubRes = await fetch(`${BASE}/${userId}/threads_publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ creation_id: created.id, access_token: token }),
    })
    const pub: any = await pubRes.json().catch(() => ({}))
    if (!pubRes.ok || !pub?.id) {
      return { network: 'threads', status: 'error', error: pub?.error?.message || `publish HTTP ${pubRes.status}` }
    }
    return { network: 'threads', status: 'posted', id: pub.id }
  } catch (e: any) {
    return { network: 'threads', status: 'error', error: e?.message || 'fetch failed' }
  }
}

// Instagram and X require media/app-review setup; stubbed until their keys exist.
async function postToInstagram(): Promise<SocialResult> {
  if (!process.env.IG_USER_ID || !process.env.IG_ACCESS_TOKEN) return { network: 'instagram', status: 'skipped' }
  return { network: 'instagram', status: 'skipped', error: 'not_implemented' }
}
async function postToX(): Promise<SocialResult> {
  if (!process.env.X_BEARER_TOKEN) return { network: 'x', status: 'skipped' }
  return { network: 'x', status: 'skipped', error: 'not_implemented' }
}

// Posts a published article across configured networks.
export async function postArticleToSocial(article: { slug: string; title: string; titleES?: string; excerpt?: string }): Promise<SocialResult[]> {
  const link = `${APP_URL}/en/stories/${article.slug}`
  const message = `${article.title}${article.excerpt ? ` — ${article.excerpt.slice(0, 160)}` : ''}\n\n${link}`
  return Promise.all([postToFacebook(message, link), postToThreads(message), postToInstagram(), postToX()])
}

// Weekly "This Weekend in El Paso" roundup post — the single highest-value
// recurring social post for a local brand (targets the #1 recurring local
// search + interest). Links to the /this-weekend traffic page.
export async function postThisWeekendToSocial(events: Array<{ title_en: string; venue?: string | null }>, label: string): Promise<SocialResult[]> {
  const link = `${APP_URL}/en/this-weekend`
  const top = events
    .slice(0, 5)
    .map((e) => `• ${e.title_en}${e.venue ? ` — ${e.venue}` : ''}`)
    .join('\n')
  const message =
    `📍 Things to do in El Paso this weekend (${label}):\n\n` +
    (top || 'A fresh lineup of local events') +
    `\n\nFull guide 👉 ${link}\n#ElPaso #ThingsToDo #CiudadJuarez #LasCruces`
  return Promise.all([postToFacebook(message, link), postToThreads(message), postToInstagram(), postToX()])
}

// True only when at least one network is actually configured.
export function socialConfigured(): boolean {
  return Boolean(
    (process.env.FB_PAGE_ID && process.env.FB_PAGE_ACCESS_TOKEN) ||
      (process.env.THREADS_USER_ID && process.env.THREADS_ACCESS_TOKEN) ||
      (process.env.IG_USER_ID && process.env.IG_ACCESS_TOKEN) ||
      process.env.X_BEARER_TOKEN,
  )
}
