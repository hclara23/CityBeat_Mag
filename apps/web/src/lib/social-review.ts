import { parseCaption, parseReview } from './social-queue-policy'

export type Review = { approved: boolean; reason: string }
export async function independentlyReviewCaption(deps: {
  write: (feedback: string) => Promise<unknown>
  review: (caption: string) => Promise<unknown>
  record: (caption: string, reviews: Review[]) => Promise<boolean>
}) {
  let caption = ''
  let verdict: Review = { approved: false, reason: '' }
  const reviews: Review[] = []
  for (let attempt = 0; attempt < 2; attempt++) {
    caption = parseCaption(await deps.write(verdict.reason))
    verdict = parseReview(await deps.review(caption))
    reviews.push(verdict)
    if (!await deps.record(caption, [...reviews])) return { caption, verdict, cancelled: true }
    if (verdict.approved) break
  }
  return { caption, verdict, cancelled: false }
}
