// Social auto-poster. No-op until credentials are configured, so it can ship now
// and "turn on" the moment you add tokens. Currently implements Facebook Page
// posting (highest local reach); Instagram / X are stubbed behind their own keys.
//
// Env to enable:
//   FB_PAGE_ID, FB_PAGE_ACCESS_TOKEN        → Facebook Page feed
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
  return Promise.all([postToFacebook(message, link), postToInstagram(), postToX()])
}

// True only when at least one network is actually configured.
export function socialConfigured(): boolean {
  return Boolean((process.env.FB_PAGE_ID && process.env.FB_PAGE_ACCESS_TOKEN) || (process.env.IG_USER_ID && process.env.IG_ACCESS_TOKEN) || process.env.X_BEARER_TOKEN)
}
