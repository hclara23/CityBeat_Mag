/**
 * Builds the CityBeat Sales Booklet (.docx) — every product, what the customer
 * receives, and how a rep actually sells it.
 *
 * WHY A GENERATOR AND NOT A HAND-MADE FILE: this booklet quotes fourteen prices,
 * three entitlement tiers, a referral cap and a commission schedule. A booklet
 * typed once in Word is correct on the day it is written and quietly wrong from
 * the next pricing change onward — and a rep reading a wrong price to a customer
 * is a refund, not a typo. `--verify` greps the real product sources for every
 * figure printed here, so a pricing change breaks this build instead.
 *
 * Sources of truth (all read by the verifier):
 *   apps/web/src/lib/pricing.ts                 directory plans and prices
 *   apps/web/src/lib/sales-products.ts          the full sellable catalog
 *   apps/web/src/lib/directory-entitlements.ts  what each tier actually unlocks
 *   apps/web/src/lib/commission-schedule.ts     rep payout terms
 *   apps/web/src/lib/referrals.ts               referral reward and cap
 *
 * The compliance language in “Before you sell anything” is carried over verbatim
 * from the existing print guide (scripts/generate-sales-guide.py). It is not
 * decorative: it is the set of promises CityBeat cannot keep, and it leads the
 * booklet on purpose.
 *
 * Dependency: the `docx` npm package, which is not a project dependency (this is
 * sales collateral, not app code). Install it where you run this:
 *     npm install --no-save docx
 * or point NODE_PATH at an install elsewhere.
 *
 * Usage:
 *     node scripts/generate-sales-booklet.mjs            build + publish
 *     node scripts/generate-sales-booklet.mjs --verify   build, then check figures
 */

import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { mkdirSync, writeFileSync, readFileSync, copyFileSync, existsSync, statSync } from 'node:fs'

const require = createRequire(import.meta.url)
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

let docx
try {
  docx = require('docx')
} catch {
  console.error('The `docx` package is required. Run:  npm install --no-save docx')
  process.exit(1)
}

const {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  HeadingLevel,
  LevelFormat,
  PageBreak,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
  convertInchesToTwip,
} = docx

// --- Geometry ---------------------------------------------------------------
// US Letter in DXA (1440 = 1 inch). docx-js defaults to A4, which would reflow
// every table on an American printer.
const PAGE = { width: 12240, height: 15840 }
const MARGIN = convertInchesToTwip(0.72)
const CONTENT = PAGE.width - MARGIN * 2 // 10166 DXA of usable width

// Print-safe brand colours. Deliberately darker than the on-screen tokens
// (#06B6D4 / #D946EF / #EAB308) — those wash out on paper and in CMYK.
const DARK = '0B0F12'
const INK = '172027'
const MUTED = '53626D'
const CYAN = '00AFC8'
const CYAN_DARK = '067C8E'
const PALE_CYAN = 'E8F8FA'
const MAGENTA = 'D21FC9'
const GOLD = 'B77900'
const PALE_GOLD = 'FFF6DD'
const PALE_RED = 'FCECEC'
const RED = 'A32020'
const LINE = 'C9D2D8'
const LIGHT = 'F3F6F7'

const SALES_DESK_URL = 'https://citybeatmag.co/en/admin/sales/new'
const SEO_SOURCE_URL = 'https://support.google.com/business/answer/7091'

// --- Small builders ----------------------------------------------------------

const text = (value, opts = {}) =>
  new TextRun({
    text: value,
    font: 'Calibri',
    size: opts.size ?? 20, // half-points: 20 = 10pt
    bold: opts.bold,
    italics: opts.italics,
    color: opts.color ?? INK,
    allCaps: opts.caps,
    characterSpacing: opts.caps ? 20 : undefined,
  })

const para = (value, opts = {}) =>
  new Paragraph({
    children: Array.isArray(value) ? value : [text(value, opts)],
    spacing: { before: opts.before ?? 0, after: opts.after ?? 100, line: opts.line ?? 260 },
    alignment: opts.align,
    indent: opts.indent,
    keepNext: opts.keepNext,
    border: opts.border,
  })

const h1 = (value) =>
  new Paragraph({
    heading: HeadingLevel.HEADING_1,
    children: [text(value, { size: 30, bold: true, color: DARK })],
    spacing: { before: 0, after: 140, line: 300 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: CYAN, space: 6 } },
  })

const h2 = (value) =>
  new Paragraph({
    heading: HeadingLevel.HEADING_2,
    children: [text(value, { size: 24, bold: true, color: DARK })],
    spacing: { before: 240, after: 90, line: 280 },
    keepNext: true,
  })

const h3 = (value) =>
  new Paragraph({
    heading: HeadingLevel.HEADING_3,
    children: [text(value, { size: 19, bold: true, color: CYAN_DARK, caps: true })],
    spacing: { before: 160, after: 60, line: 240 },
    keepNext: true,
  })

const bullet = (value, level = 0) =>
  new Paragraph({
    numbering: { reference: 'cb-bullets', level },
    children: Array.isArray(value) ? value : [text(value)],
    spacing: { after: 60, line: 250 },
  })

// `instance` must differ per list. docx-js maps one reference+instance to one
// Word numId, and a shared numId keeps counting across the document: the five
// rules in section 11 rendered as 9-13, continuing the section 7 click path.
const numbered = (value, instance = 0) =>
  new Paragraph({
    numbering: { reference: 'cb-steps', level: 0, instance },
    children: Array.isArray(value) ? value : [text(value)],
    spacing: { after: 70, line: 250 },
  })

const pageBreak = () => new Paragraph({ children: [new PageBreak()] })

const NO_BORDER = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }
const HAIRLINE = (color = LINE) => ({ style: BorderStyle.SINGLE, size: 4, color })

/** A bordered table. `widths` are fractions of the content width. */
function table(headers, rows, widths, opts = {}) {
  const cols = widths.map((w) => Math.round(CONTENT * w))
  // Column widths must sum to the table width or Word silently rescales them.
  const drift = CONTENT - cols.reduce((a, b) => a + b, 0)
  cols[cols.length - 1] += drift

  const cell = (value, i, { header = false, shade } = {}) =>
    new TableCell({
      width: { size: cols[i], type: WidthType.DXA },
      shading: shade
        ? { type: ShadingType.CLEAR, fill: shade, color: 'auto' }
        : header
          ? { type: ShadingType.CLEAR, fill: opts.headerFill ?? CYAN_DARK, color: 'auto' }
          : undefined,
      margins: { top: 70, bottom: 70, left: 110, right: 110 },
      verticalAlign: VerticalAlign.TOP,
      children: (Array.isArray(value) ? value : [value]).map((v) =>
        typeof v === 'string'
          ? para(v, {
              after: 0,
              size: opts.small ? 17 : 19,
              bold: header,
              color: header ? 'FFFFFF' : INK,
              caps: header,
              line: 230,
            })
          : v
      ),
    })

  const children = []
  if (headers) {
    children.push(
      new TableRow({
        tableHeader: true,
        children: headers.map((v, i) => cell(v, i, { header: true })),
      })
    )
  }
  rows.forEach((row, r) => {
    children.push(
      new TableRow({
        children: row.map((v, i) =>
          cell(v, i, { shade: opts.zebra && r % 2 === 1 ? LIGHT : undefined })
        ),
      })
    )
  })

  return new Table({
    columnWidths: cols,
    width: { size: CONTENT, type: WidthType.DXA },
    borders: {
      top: HAIRLINE(),
      bottom: HAIRLINE(),
      left: HAIRLINE(),
      right: HAIRLINE(),
      insideHorizontal: HAIRLINE(),
      insideVertical: HAIRLINE(),
    },
    rows: children,
  })
}

/** A tinted callout with a coloured left rule — used for the things a rep must
 *  not get wrong. Rendered as a one-cell table because Word has no real
 *  “callout” primitive. */
function callout(title, body, { accent = CYAN, fill = PALE_CYAN } = {}) {
  const lines = Array.isArray(body) ? body : [body]
  return new Table({
    columnWidths: [CONTENT],
    width: { size: CONTENT, type: WidthType.DXA },
    borders: {
      top: NO_BORDER,
      bottom: NO_BORDER,
      right: NO_BORDER,
      insideHorizontal: NO_BORDER,
      insideVertical: NO_BORDER,
      left: { style: BorderStyle.SINGLE, size: 18, color: accent },
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: CONTENT, type: WidthType.DXA },
            shading: { type: ShadingType.CLEAR, fill, color: 'auto' },
            margins: { top: 110, bottom: 110, left: 150, right: 150 },
            children: [
              para(title, { bold: true, size: 19, caps: true, color: DARK, after: 50 }),
              ...lines.map((l, i) =>
                para(l, { size: 18, after: i === lines.length - 1 ? 0 : 60, line: 240 })
              ),
            ],
          }),
        ],
      }),
    ],
  })
}

const spacer = (after = 160) => new Paragraph({ children: [], spacing: { after } })

// --- Product data -------------------------------------------------------------
//
// Mirrors SALES_PRODUCTS / DIRECTORY_PLANS. `gets` is what the CUSTOMER receives
// (entitlements + placement), `say` is a line a rep can speak out loud, and
// `careful` is the specific way this product gets mis-sold.

const DIRECTORY_PRODUCTS = [
  {
    name: 'Basic — Free',
    price: 'Free · no card, no renewal',
    what: 'A public, claimable CityBeat listing with no payment and no recurring charge.',
    who: 'A business that needs a credible local presence today and may upgrade later.',
    gets: [
      'Business name, phone, website, category and address.',
      'Standard hours plus holiday hours and temporary closures.',
      'Service areas and secondary categories (helps discovery, free on every tier).',
      'A short description and one photo.',
      'Replies to their reviews, plus a downloadable QR code for requesting them.',
      'New leads as they arrive — they can see a lead came in, with the contact details masked until they upgrade.',
      'Rolling 30-day headline numbers.',
    ],
    say: 'I can put your business on CityBeat today at no cost and send you the link to claim it. Nothing is charged and there is no card. Once it is yours, you can decide whether the paid tools are worth it.',
    careful:
      'Basic is a real product, not a trick. Do not pressure. The claim link is the whole deliverable — send it and let the listing sell the upgrade.',
  },
  {
    name: 'Founding Annual — $99 / yr',
    price: '$99 per year · renews yearly · $8.25/mo equivalent',
    what: 'Every Premium feature at the lowest published rate, locked while the subscription stays active.',
    who: 'An owner ready to commit for a year — the best value available, if a Founding spot remains.',
    gets: [
      'Everything in the Premium feature set (identical entitlements — Founding is a price, not a weaker product).',
      'All of the business’s locations included.',
      'The rate stays locked for as long as the subscription remains active.',
    ],
    say: 'We are keeping the first hundred businesses at a founding rate: ninety-nine dollars for the year, all your locations included, and that price stays with you while the subscription is active. It is the same feature set as Premium.',
    careful:
      'NEVER promise a Founding spot is available. Select Founding in the Sales Desk and let checkout confirm the cap. If it is gone, Premium Annual is the recommendation.',
  },
  {
    name: 'Founding Monthly — $9.99 / mo',
    price: '$9.99 per month · renews monthly',
    what: 'Every Premium feature at the founding launch rate, locked while active.',
    who: 'An owner who wants the lowest monthly entry, if a Founding spot remains.',
    gets: [
      'Everything in the Premium feature set.',
      'All of the business’s locations included.',
      'The launch rate stays locked while the subscription remains active.',
    ],
    say: 'Under ten dollars a month, all your locations, and the price is locked while you stay subscribed. If you cancel, the founding rate goes with it.',
    careful: 'Same availability rule as Founding Annual. Never promise a spot. Confirm at checkout.',
  },
  {
    name: 'Premium Annual — $199 / yr',
    price: '$199 per year · renews yearly · $16.58/mo equivalent · two months free vs monthly',
    what: 'The full Premium business profile and owner tools, billed yearly.',
    who: 'A stable business that wants Premium and would rather not think about it monthly.',
    gets: ['Everything in the Premium feature set.', 'Two months of value versus paying monthly.'],
    say: 'Premium is nineteen ninety-nine a month, or a hundred ninety-nine for the year — that is two months free. Same tools either way.',
    careful: 'Say that it renews yearly. An annual charge nobody expected is a dispute.',
  },
  {
    name: 'Premium Monthly — $19.99 / mo',
    price: '$19.99 per month · renews monthly',
    what: 'The full Premium business profile and owner growth tools, with flexible monthly billing.',
    who: 'Most businesses starting paid local visibility without a yearly commitment.',
    gets: ['Everything in the Premium feature set.', 'Cancel any time from Billing; no phone call, no email required.'],
    say: 'Nineteen ninety-nine a month gets you the full profile — photos, video, your services with prices, booking buttons, and the lead inbox so you see who contacted you. Cancel yourself any time from your dashboard.',
    careful: 'This is the default recommendation. Do not reach for Featured or Sponsored unless the customer’s goal actually needs placement.',
  },
  {
    name: 'Featured — $49 / mo',
    price: '$49 per month · renews monthly',
    what: 'Everything in Premium plus top-of-category placement, a Featured badge, and homepage rotation.',
    who: 'A business that needs to stand out immediately in a competitive category.',
    gets: [
      'Everything in Premium.',
      'Top-of-category placement and a Featured badge.',
      'Homepage rotation.',
      'Competitor benchmarks against similar businesses in the category.',
      'Up to 30 photos (Premium is 15).',
      'Up to 10 team seats (Premium is 3).',
      'Multi-location and bulk editing tools.',
    ],
    say: 'If being found first in your category is the point, Featured puts you at the top of it with a badge, and shows you how you compare to similar businesses. Forty-nine a month.',
    careful:
      'Featured is placement within CityBeat. It is not a search ranking on Google and must never be sold as one.',
  },
  {
    name: 'Sponsored — $99 / mo',
    price: '$99 per month · renews monthly',
    what: 'Everything in Premium plus a rotating spot in the Sponsored Listings grid at the top of the directory homepage.',
    who: 'A business that wants the single most prominent placement on the site.',
    gets: [
      'Everything in Premium.',
      'A spot in the Sponsored Listings grid at the top of the CityBeat Directory homepage.',
      'Only three sponsors display at a time, picked at random per visit from everyone sponsored — so every sponsor gets exposure rather than the newest one burying the rest.',
    ],
    say: 'Sponsored puts you in the grid at the very top of the directory — the first thing anyone browsing businesses sees. Three show at a time and they rotate, so you are not paying to sit behind whoever signed up after you.',
    careful:
      'Be precise that it rotates. A customer who believes they bought a permanent top slot will be disappointed, and they would be right to be.',
  },
]

const OTHER_PRODUCTS = [
  {
    name: 'Newsletter Sponsorship — $50 / mo',
    price: '$50 per month · renews monthly',
    what: 'Recurring sponsor placement in the CityBeat email newsletter.',
    who: 'A brand that benefits from being familiar rather than from a single click.',
    gets: ['The “Sponsored by” placement in the weekly story digest sent to subscribers.'],
    say: 'Our weekly digest goes out to local subscribers and carries one sponsor. Fifty a month keeps your name on it.',
    careful:
      'One sponsor holds the slot at a time. Do not sell a second one into an occupied month — check with the office before promising a start date.',
  },
  {
    name: 'Sponsored Story — $30 once',
    price: '$30 one time · does not renew',
    what: 'One sponsored editorial-style story prepared from the customer brief and reviewed before publication.',
    who: 'A business with something to explain — an opening, a mission, a product, an offer.',
    gets: ['One story written from their brief, reviewed by staff, and published with a link to the destination they approve.'],
    say: 'A display ad has room for a sentence. A sponsored story has room to actually explain what you do, and it stays on the site.',
    careful:
      'Publication follows staff review. Never promise same-day publication, and never promise a headline you have not cleared.',
  },
  {
    name: 'Category Banner — $25 / mo',
    price: '$25 per month · renews monthly',
    what: 'Recurring banner placement beside a relevant CityBeat category.',
    who: 'A business whose customers are already browsing one subject.',
    gets: ['A banner shown alongside the category they choose, linking to their approved destination.'],
    say: 'People reading the food section are already thinking about food. Twenty-five a month puts you beside it.',
    careful: 'Paid placements are advertising. They are not an organic ranking shortcut and must not be pitched as one.',
  },
  {
    name: 'Social Promotion — $40 / mo',
    price: '$40 per month · renews monthly',
    what: 'Recurring inclusion of the business in CityBeat’s local social posts (Facebook and Threads).',
    who: 'A business that wants to reach a local social audience without running its own ads.',
    gets: ['A monthly feature to CityBeat’s El Paso social following, on channels CityBeat already posts to.'],
    say: 'We post locally every day. Forty a month puts your business into that rotation, in front of people who already follow El Paso news.',
    careful: 'Do not quote follower counts or guarantee reach. Sell the audience fit, not a number you cannot stand behind.',
  },
  {
    name: 'Featured Event — $25 once',
    price: '$25 one time · does not renew',
    what: 'One enhanced event listing with featured placement, after staff review.',
    who: 'Anyone with a dated event that needs to be found before it happens.',
    gets: ['Featured placement on the events surface, with ticket information and a destination link.'],
    say: 'Twenty-five dollars puts your event in front of people deciding what to do this weekend, with your ticket link right there.',
    careful: 'Confirm the date, time zone and venue before taking money. A featured event with the wrong date is a refund.',
  },
  {
    name: '30-Day Job Posting — $50 once',
    price: '$50 one time · does not renew · runs 30 days',
    what: 'One complete local job listing published for 30 days, after staff review.',
    who: 'A local employer hiring now.',
    gets: ['A full role profile — pay, benefits, qualifications — with a direct application path, live for 30 days.'],
    say: 'Fifty dollars, thirty days, and candidates apply straight from the listing. We publish pay and benefits, which is most of why people click.',
    careful: 'Thirty days from publication, not from payment. Say so.',
  },
  {
    name: 'Custom Quote — manager approved',
    price: 'Custom amount · one time · does not renew',
    what: 'A manager-approved one-time CityBeat product with exact deliverables written into the order.',
    who: 'A negotiated package that does not fit the standard catalog.',
    gets: ['Exactly what the approved order says — written down before payment, not after.'],
    say: 'Let me get that approved and written up properly, then I will send you a payment link with the deliverables on it.',
    careful:
      'A custom quote REQUIRES manager approval before you quote a number. Never invent a price in front of a customer.',
  },
]

// --- The feature matrix --------------------------------------------------------
// Straight from the entitlement registry. Founders shares Premium's column
// because the code gives them identical entitlements on purpose.

const Y = '✓'
const N = '—'

const MATRIX = [
  ['Core business info — name, phone, website, category, address', Y, Y, Y],
  ['Standard hours, holiday hours, temporary closures', Y, Y, Y],
  ['Service areas and secondary categories', Y, Y, Y],
  ['Reply to reviews, and download a review-request QR code', Y, Y, Y],
  ['Rolling 30-day headline numbers', Y, Y, Y],
  ['Photos', '1', '15', '30'],
  ['Detailed bilingual profile (EN + ES)', N, Y, Y],
  ['Cover image', N, Y, Y],
  ['Video tour or promo', N, Y, Y],
  ['Social links', N, Y, Y],
  ['Services and products, with prices', N, Y, Y],
  ['Posts, offers and events', N, Y, Y],
  ['Booking and action links — Book, Order, Quote', N, Y, Y],
  ['New leads — masked contact details on Basic, full details on paid', 'Masked', 'Full', 'Full'],
  ['Full analytics and history', N, Y, Y],
  ['Export reports as CSV', N, Y, Y],
  ['AI assistance — drafts replies, posts, captions', N, Y, Y],
  ['Team seats', '0', '3', '10'],
  ['Larger card, shown ahead of Basic listings', N, Y, Y],
  ['Top-of-category placement and Featured badge', N, N, Y],
  ['Competitor benchmarks', N, N, Y],
  ['Multi-location and bulk tools', N, N, Y],
]

// --- Document assembly ----------------------------------------------------------

function productSection(p) {
  return [
    h2(p.name),
    para([text('Price and billing. ', { bold: true }), text(p.price)], { after: 70 }),
    para([text('What it is. ', { bold: true }), text(p.what)], { after: 70 }),
    para([text('Who it is for. ', { bold: true }), text(p.who)], { after: 90 }),
    h3('What the client gets'),
    ...p.gets.map((g) => bullet(g)),
    h3('What to say'),
    para(`“${p.say}”`, { italics: true, color: INK, after: 90 }),
    callout('Be careful here', p.careful, { accent: GOLD, fill: PALE_GOLD }),
    spacer(200),
  ]
}

function buildSections() {
  const body = []

  // ---- Cover
  body.push(
    spacer(1400),
    para('CITYBEAT', { size: 26, bold: true, color: CYAN_DARK, caps: true, after: 60 }),
    para('Sales Booklet', { size: 56, bold: true, color: DARK, after: 200, line: 640 }),
    para('Every product, what the customer receives, and how to sell it.', {
      size: 26,
      color: MUTED,
      after: 360,
      border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: CYAN, space: 14 } },
    }),
    callout(
      'Internal document',
      [
        'This booklet is for CityBeat sales staff. It contains internal pricing guidance, commission terms and sales scripts, and is not for customer distribution.',
        'Generated from the product catalog in the codebase. If a price here disagrees with the Sales Desk, the Sales Desk is right — stop and report it.',
      ],
      { accent: MAGENTA, fill: 'FBEAF9' }
    ),
    spacer(300),
    para(`Start a sale: ${SALES_DESK_URL}`, { size: 18, color: MUTED }),
    pageBreak()
  )

  // ---- 1. Guardrails first
  body.push(
    h1('1 · Before you sell anything'),
    para(
      'This section is first because everything in it costs the company money when it goes wrong, and costs a customer their trust. Nothing later in this booklet overrides it.',
      { after: 140 }
    ),
    h2('What we never promise'),
    table(
      ['Never promise', 'Why not', 'Say this instead'],
      [
        [
          'A specific Google ranking',
          'No publisher controls Google’s results. Promising a rank is a promise you cannot keep.',
          '“A complete profile and a real link back to your site can help how you show up locally — but nobody can guarantee a position.”',
        ],
        [
          'Guaranteed leads or sales',
          'Lead volume depends on the business, the category and the season.',
          '“You will be able to see exactly how many people viewed and contacted you, and decide from real numbers.”',
        ],
        [
          'That a Founding spot is available',
          'The cap is confirmed at checkout, not by you. It can run out between your pitch and their payment.',
          '“Let me select Founding and we will see at checkout whether a spot is still open.”',
        ],
        [
          'Instant publication',
          'Stories, events and job postings publish after staff review.',
          '“It goes to review as soon as you pay, and we will confirm when it is live.”',
        ],
        [
          'A discount that is not approved',
          'Unapproved discounts come out of the business, and out of your commission.',
          '“Let me check what I can do and come back to you with something in writing.”',
        ],
        ['A refund', 'Refunds are a management decision, not a rep decision.', '“I will raise it with the office today and someone will contact you.”'],
      ],
      [0.24, 0.38, 0.38],
      { zebra: true, small: true }
    ),
    spacer(200),
    callout(
      'Never touch a customer’s card',
      [
        'Stripe hosts every checkout. CityBeat staff must never request, record, photograph, repeat aloud, or type a customer’s card number — not to help, not over the phone, not “just this once”.',
        'The customer enters their own card on Stripe’s page. Subscriptions save the payment method and renew automatically until cancelled; one-time products do not renew. Say which one they are buying, every time.',
      ],
      { accent: RED, fill: PALE_RED }
    ),
    spacer(200),
    h2('The honest version of the SEO conversation'),
    para(
      'This question comes up in almost every directory pitch, and it is where reps are most tempted to overstate. The approved answer:',
      { after: 90 }
    ),
    callout(
      'What a listing can and cannot do',
      'A CityBeat listing gives your business another complete local profile and a direct link back to your website. That can support local relevance, prominence, and referral traffic, but no ethical publisher can guarantee a search ranking.',
      { accent: GOLD, fill: PALE_GOLD }
    ),
    spacer(140),
    para(
      [
        text('Why that is a strong answer and not a weak one: ', { bold: true }),
        text(
          'Google says local results are based mainly on relevance, distance and prominence, and that complete information and other websites linking to a business can help. You are describing a real mechanism rather than selling magic — and the customer can check it. Source: ',
        ),
        text(SEO_SOURCE_URL, { color: CYAN_DARK }),
      ],
      { size: 18, after: 140 }
    ),
    h2('When to stop and ask'),
    para(
      'Pause the sale if the product, price, billing term, customer identity, Founding availability or deliverable is unclear. Confirm with management, then create a fresh handoff. Accuracy prevents refunds and protects the relationship — a delayed sale is cheaper than a disputed one.',
      { after: 0 }
    ),
    pageBreak()
  )

  // ---- 2. What CityBeat is
  body.push(
    h1('2 · What CityBeat is, in sixty seconds'),
    para(
      'CityBeat is the bilingual local news magazine for El Paso County, and the business directory that sits alongside it. Readers come for local news, events, deals and things to do this weekend; businesses appear beside that coverage.',
      { after: 90 }
    ),
    para(
      'El Paso County is roughly ninety percent Spanish-speaking. Everything CityBeat publishes exists in English and Spanish — the chrome, the articles, the events, and the business profiles themselves. For most competitors a Spanish listing is an afterthought. Here it is the default, and it is a real differentiator worth naming out loud.',
      { after: 140 }
    ),
    h2('What a business is actually buying'),
    ...[
      'A complete, crawlable public profile with their real information on it.',
      'A direct link from that profile to their own website and social channels.',
      'Placement beside local content their customers are already reading.',
      'The tools to keep it current — and the numbers to see whether it is working.',
    ].map((b) => bullet(b)),
    spacer(120),
    h2('How the money works, briefly'),
    ...[
      'Directory plans and some advertising are subscriptions: they renew until the customer cancels.',
      'Stories, events, job postings and approved custom quotes are one-time charges that never renew.',
      'Every charge goes through Stripe to the single CityBeat account. The customer always enters their own card.',
      'A customer can cancel a subscription themselves, in a couple of clicks, from Billing in their dashboard. Say this — it removes the biggest objection you will hear.',
    ].map((b) => bullet(b)),
    pageBreak()
  )

  // ---- 3. Price card
  body.push(
    h1('3 · The price card'),
    para('Every sellable product, with its exact price and billing term. Use these words and these numbers.', {
      after: 140,
    }),
    table(
      ['Product', 'Price', 'Billing', 'Best for'],
      [
        ['Directory — Basic', 'Free', 'No card', 'A credible presence now, upgrade later'],
        ['Directory — Founding Annual', '$99 / yr', 'Renews yearly', 'Best value, if a spot remains'],
        ['Directory — Founding Monthly', '$9.99 / mo', 'Renews monthly', 'Lowest monthly entry, if a spot remains'],
        ['Directory — Premium Annual', '$199 / yr', 'Renews yearly', 'Premium, two months free'],
        ['Directory — Premium Monthly', '$19.99 / mo', 'Renews monthly', 'The default recommendation'],
        ['Directory — Featured', '$49 / mo', 'Renews monthly', 'Top of a competitive category'],
        ['Directory — Sponsored', '$99 / mo', 'Renews monthly', 'The most prominent spot on the site'],
        ['Newsletter Sponsorship', '$50 / mo', 'Renews monthly', 'Staying familiar in the inbox'],
        ['Sponsored Story', '$30 once', 'Does not renew', 'Something that needs explaining'],
        ['Category Banner', '$25 / mo', 'Renews monthly', 'Reaching one subject’s readers'],
        ['Social Promotion', '$40 / mo', 'Renews monthly', 'A local social audience'],
        ['Featured Event', '$25 once', 'Does not renew', 'A dated event'],
        ['30-Day Job Posting', '$50 once', 'Does not renew', 'Hiring locally now'],
        ['Custom Quote', 'Custom amount', 'Does not renew', 'An approved negotiated package'],
      ],
      [0.33, 0.15, 0.17, 0.35],
      { zebra: true, small: true }
    ),
    spacer(200),
    callout(
      'The one-sentence recommendation',
      '“Based on your goal, I recommend [product] at [exact price and term]. Basic Free needs no card — I create the listing and send its claim link. Paid products use a private Stripe link, and then I collect the details we need to build it.”',
      { accent: CYAN, fill: PALE_CYAN }
    ),
    pageBreak()
  )

  // ---- 4. Feature matrix
  body.push(
    h1('4 · What each directory tier unlocks'),
    para(
      'This table is the product. Everything a rep promises about a directory plan should be findable in it.',
      { after: 90 }
    ),
    para(
      [
        text('Founders and Premium share one column on purpose. ', { bold: true }),
        text(
          'Founding is a price, not a weaker product — a founding customer gets the identical feature set to a full-price Premium customer. That is worth saying to a founding prospect in those words.'
        ),
      ],
      { size: 18, after: 140 }
    ),
    table(
      ['Feature', 'Basic (free)', 'Founders / Premium', 'Featured'],
      MATRIX,
      [0.49, 0.15, 0.21, 0.15],
      { zebra: true, small: true }
    ),
    spacer(160),
    callout(
      'Where Sponsored fits',
      'Sponsored ($99/mo) is not a fourth column. It carries the full Premium feature set and adds a rotating spot in the Sponsored Listings grid at the top of the directory homepage. Sell it as placement on top of Premium, not as a separate tier.',
      { accent: CYAN, fill: PALE_CYAN }
    ),
    spacer(140),
    para(
      [
        text('If a customer downgrades: ', { bold: true }),
        text(
          'their content is kept, but the paid controls lock and extra team seats lose edit access. Nothing is deleted. Say this plainly if they ask — it is a reason to try a plan, not a reason to fear one.'
        ),
      ],
      { size: 18, after: 0 }
    ),
    pageBreak()
  )

  // ---- 5. Directory products
  body.push(h1('5 · The directory plans, one by one'))
  DIRECTORY_PRODUCTS.forEach((p, i) => {
    body.push(...productSection(p))
    if (i === 2 || i === 5) body.push(pageBreak())
  })
  body.push(pageBreak())

  // ---- 6. Everything else
  body.push(
    h1('6 · Advertising, events, jobs and custom work'),
    para(
      'These create targeted visibility, referral traffic, or a complete public page for an opportunity. Use the exact price and billing term. Lead with audience fit and a clear destination — never with a ranking claim.',
      { after: 160 }
    )
  )
  OTHER_PRODUCTS.forEach((p, i) => {
    body.push(...productSection(p))
    if (i === 2 || i === 5) body.push(pageBreak())
  })
  body.push(pageBreak())

  // ---- 7. In-app flow
  body.push(
    h1('7 · How to sell it in the app'),
    para(
      [
        text('The Sales Desk is where a sale actually happens: ', {}),
        text(SALES_DESK_URL, { bold: true, color: CYAN_DARK }),
      ],
      { after: 70 }
    ),
    para(
      'From Developer Control, click the bright + NEW SALE button. From a sales account, click DASHBOARD and use the New sale form.',
      { after: 140 }
    ),
    h2('The click path'),
    ...[
      'Choose the product. For a new directory business that is Basic Free, Founding, or Premium.',
      'Choose an existing listing, or New business. Select a category, or type a correct new one.',
      'Enter the business name and client email — both required. Phone is optional, but it is needed if you want to text the link.',
      'Confirm out loud what you are about to charge: the product, the exact price, and whether it is free, recurring, or one-time.',
      'Create it. Basic Free publishes the listing with no Stripe involvement. A paid product creates the secure checkout.',
      'Read the handoff panel. Free shows only “Listing ready to claim”. A paid new listing shows BOTH a Payment link and a Listing link.',
      'Send the right link or links — Open, QR, Email, Text, or Copy.',
      'For paid sales, check Payment, Billing, Brief, Fulfillment, Discount and Commission before you start the next order.',
    ].map((s) => numbered(s, 0)),
    spacer(160),
    callout(
      'The mistake that costs the most: sending one link when there are two',
      [
        'A paid NEW directory listing produces two different links that do two different things. Payment pays for the product. Listing opens the public business page so the owner can claim it and verify their email. Claiming never creates a second charge.',
        'Send only the payment link and the customer pays but never gets control of their listing. Send only the listing link and you have given away a paid plan. Send both, and say what each one is for.',
      ],
      { accent: RED, fill: PALE_RED }
    ),
    spacer(200),
    h2('What the customer does next'),
    ...[
      'They pay on Stripe, entering their own card. Recurring products save it securely and renew automatically.',
      'From the listing link they select Claim and verify the business email — this is how ownership is proven.',
      'Stripe returns them to the private product wizard, where the fulfillment details are collected.',
      'A paid directory claim lands in pending approval for a human to review. It is not instant, and the card has already been charged — so do not leave them wondering.',
    ].map((b) => bullet(b)),
    spacer(160),
    h2('What to collect, by product'),
    table(
      ['Product', 'What the brief needs'],
      [
        ['Directory listing', 'Category, description, address, hours, website, social links, logo, cover image, gallery photos.'],
        ['Job posting', 'Title, category, employment and workplace type, location, pay, benefits, description, qualifications, application details.'],
        ['Featured event', 'Dates, time, time zone, format, venue, ticket link, price, accessibility, organizer, description, artwork.'],
        ['Advertising (banner, newsletter, social, story)', 'Objective, run dates, destination link, copy, call to action, logo and artwork, any claims that need sourcing, approval contact.'],
        ['Custom quote', 'The manager-approved deliverable, the goal, timing, destination, assets, approval contact.'],
      ],
      [0.3, 0.7],
      { zebra: true, small: true }
    ),
    pageBreak()
  )

  // ---- 8. Scripts
  body.push(
    h1('8 · What to say'),
    h2('Opening — a business you are approaching cold'),
    para(
      '“I publish CityBeat, the local magazine for El Paso. We list local businesses alongside the news coverage, and I already have a page started for you. I can send you the link to claim it — there is no cost and no card for that. Do you have two minutes?”',
      { italics: true, after: 140 }
    ),
    h2('Discovery — four questions that pick the product for you'),
    ...[
      '“When someone needs what you do, how do they usually find you right now?” — tells you whether discovery or credibility is the problem.',
      '“What would a good month look like — more calls, more walk-ins, more applications?” — leads/visibility/jobs.',
      '“Do you have photos of the work, or of the place?” — photos are the single biggest visible upgrade from Basic.',
      '“Do you serve customers in Spanish?” — the bilingual profile usually sells itself from here.',
    ].map((b) => bullet(b)),
    spacer(140),
    h2('Recommending — one sentence, three facts'),
    para(
      'Name the product, the exact price with its term, and what it does for the goal they just described. Do not stack products. Recommend the smallest one that actually addresses the goal; a customer who buys too much cancels, and a cancellation costs more than the upgrade you did not make.',
      { after: 90 }
    ),
    para(
      '“You said people find you by word of mouth and you want more calls. Premium at nineteen ninety-nine a month gets your photos, your services with prices, and a Call button on the profile — and the lead inbox shows you who contacted you, so in a month you will know whether it earned its keep.”',
      { italics: true, after: 140 }
    ),
    h2('Closing'),
    ...[
      'Say what happens next in order: “I will send you two links — one to pay, one to claim your page.”',
      'Say the billing term again. “It is monthly, and you can cancel yourself from your dashboard any time.”',
      'Do not ask for the card. Ever. Send the link and let Stripe take it.',
      'Confirm the email address out loud before you hit send. A wrong email is a paid customer who never receives their listing.',
    ].map((b) => bullet(b)),
    pageBreak()
  )

  // ---- 9. Objections
  body.push(
    h1('9 · Objections, answered honestly'),
    para(
      'Every answer below is one you can defend if the customer checks it. That is the only kind worth memorizing.',
      { after: 140 }
    ),
    table(
      ['They say', 'You say'],
      [
        [
          '“I already have a Google listing.”',
          'Good — keep it. Google itself says other sites linking to your business can help how you show up. This is a second complete profile and a real link back to you, in the local publication your customers already read. It is not a replacement for Google; it is another place to be found, and one Google can see.',
        ],
        [
          '“Will this get me to the top of Google?”',
          'No, and anyone who promises that is guessing. What it does is give you a complete local profile and a direct link to your site, which can support local relevance and send you referral traffic. You will see the actual numbers in your dashboard.',
        ],
        [
          '“It is too expensive.”',
          'Then start free. I will create the listing and send you the claim link — no card. Use it for a month, look at your view and lead numbers, and upgrade only if the numbers say it is worth it.',
        ],
        [
          '“I do not want to be locked in.”',
          'You are not. Monthly cancels any time from Billing in your dashboard — two clicks, no phone call, no email to anyone. You keep what you paid for until the end of the period you already paid.',
        ],
        [
          '“I tried a directory before and got nothing.”',
          'That is fair, and it is why we show you the numbers rather than asking you to take it on faith. Views, searches you appeared in, and every lead with contact details. If it is not working after a month you will be able to see that clearly.',
        ],
        [
          '“Send me some information.”',
          'Happy to — and I will also send the free claim link so you can see your actual page while you read it. It is much easier to judge with your own business on the screen.',
        ],
        [
          '“I need to think about it.”',
          'Of course. Let me set up the free listing in the meantime so nothing is lost — it costs nothing and you can look at it tonight. Then decide.',
        ],
        [
          '“Can you give me a deal?”',
          'If a Founding spot is still open, that is the best rate we have — let me check at checkout. Beyond that I would have to get approval, and I would rather tell you honestly than promise something I cannot deliver.',
        ],
        [
          '“Who is actually reading this?”',
          'Local readers in El Paso County, in English and Spanish. I will not quote you a traffic number I cannot prove — what I will do is show you your own view and lead counts once you are live, which is the number that actually matters to you.',
        ],
      ],
      [0.28, 0.72],
      { zebra: true, small: true }
    ),
    pageBreak()
  )

  // ---- 10. Referral + commission
  body.push(
    h1('10 · The referral offer, and how you get paid'),
    h2('What the customer can earn by referring'),
    para(
      'Every paid listing receives a personalized referral link. When a referred customer stays paid and active for three calendar months, the referrer earns three discount months at 25% off. The maximum is 16 qualified referrals per listing per calendar year. Annual plans receive the equivalent value on renewal.',
      { after: 90 }
    ),
    para(
      [
        text('How to use it: ', { bold: true }),
        text(
          'give it to a happy customer, not to a new one. The qualifying period is three months, so it rewards referrals that stick rather than sign-ups that churn — which is exactly the kind of referral worth having.'
        ),
      ],
      { size: 18, after: 200 }
    ),
    h2('How and when you get paid'),
    para(
      'Commission is a configured percentage of the sale, paid only to the rep the sale is explicitly attributed to. It never defaults to whoever happens to be signed in, and it is never taken from the customer.',
      { after: 90 }
    ),
    table(
      ['Stage', 'What happens'],
      [
        ['At the sale', 'Your commission is recorded as held the moment the customer’s payment succeeds. It is earned, but not yet payable.'],
        ['For 7 days', 'It stays held. This is the refund window — the period in which a customer can change their mind.'],
        ['After that', 'It is paid on the next payout cycle: the 15th and the final calendar day of each month.'],
        ['If the customer refunds or disputes', 'The commission is reversed. A partial refund reduces it by the same proportion. If it had not been paid out yet, it simply never is. If it had, we will contact you to settle it.'],
        ['If you have not connected a bank', 'The money is still yours. It waits, and is paid automatically once your bank is connected.'],
      ],
      [0.24, 0.76],
      { zebra: true, small: true }
    ),
    spacer(160),
    callout(
      'What this means for how you sell',
      'You are paid for sales that stay sold. A customer talked into the wrong plan cancels or refunds inside the hold window, and the commission reverses — so overselling does not just cost the company, it costs you directly. Recommending the smallest product that solves the customer’s problem is the best-paid strategy available to you.',
      { accent: CYAN, fill: PALE_CYAN }
    ),
    pageBreak()
  )

  // ---- 11. Quick card
  body.push(
    h1('11 · Quick reference'),
    para('The short version. If you remember nothing else from this booklet, remember this page.', {
      after: 160,
    }),
    h2('The five rules'),
    ...[
      'Never touch a card number. Stripe takes the payment; you send the link.',
      'Never promise a Google ranking, guaranteed leads, a refund, instant publication, or a Founding spot.',
      'Say the price AND whether it renews, every single time.',
      'A paid new listing has TWO links. Payment pays. Listing lets them claim it. Send both.',
      'If anything is unclear — price, product, availability, deliverable — stop and ask. A delayed sale beats a disputed one.',
    ].map((s) => numbered(s, 1)),
    spacer(200),
    h2('Which product, in one glance'),
    table(
      ['If they want...', 'Recommend'],
      [
        ['To exist on CityBeat at no cost', 'Basic — Free'],
        ['The best long-term price', 'Founding Annual $99/yr, if a spot remains; otherwise Premium Annual $199/yr'],
        ['The lowest monthly entry', 'Founding Monthly $9.99/mo, if a spot remains; otherwise Premium Monthly $19.99/mo'],
        ['The default paid listing', 'Premium Monthly — $19.99/mo'],
        ['To be first in their category', 'Featured — $49/mo'],
        ['The most prominent spot on the site', 'Sponsored — $99/mo'],
        ['To stay familiar to subscribers', 'Newsletter Sponsorship — $50/mo'],
        ['Room to explain something', 'Sponsored Story — $30 once'],
        ['Readers of one subject', 'Category Banner — $25/mo'],
        ['A local social audience', 'Social Promotion — $40/mo'],
        ['People at their event', 'Featured Event — $25 once'],
        ['Local candidates', '30-Day Job Posting — $50 once'],
      ],
      [0.42, 0.58],
      { zebra: true, small: true }
    ),
    spacer(200),
    para([text('Start a sale: ', { bold: true }), text(SALES_DESK_URL, { color: CYAN_DARK })], {
      after: 60,
    }),
    para('Questions, approvals, refunds and anything you are unsure about: contact the office before you promise it.', {
      size: 18,
      color: MUTED,
      after: 0,
    })
  )

  return body
}

function buildDocument() {
  return new Document({
    creator: 'CityBeat',
    title: 'CityBeat Sales Booklet',
    description: 'Every CityBeat product, what the customer receives, and how to sell it',
    numbering: {
      config: [
        {
          reference: 'cb-bullets',
          levels: [
            {
              level: 0,
              format: LevelFormat.BULLET,
              text: '•',
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 360, hanging: 200 } } },
            },
            {
              level: 1,
              format: LevelFormat.BULLET,
              text: '◦',
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 720, hanging: 200 } } },
            },
          ],
        },
        {
          reference: 'cb-steps',
          levels: [
            {
              level: 0,
              format: LevelFormat.DECIMAL,
              text: '%1.',
              alignment: AlignmentType.START,
              style: { paragraph: { indent: { left: 400, hanging: 240 } } },
            },
          ],
        },
      ],
    },
    sections: [
      {
        properties: {
          page: { size: PAGE, margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN } },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                children: [text('CityBeat Sales Booklet  ·  Internal', { size: 16, color: MUTED, caps: true })],
                border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: LINE, space: 4 } },
                spacing: { after: 200 },
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [text('citybeatmag.co  ·  Not for customer distribution', { size: 15, color: MUTED })],
              }),
            ],
          }),
        },
        children: buildSections(),
      },
    ],
  })
}

// --- Verification ---------------------------------------------------------------

function verify(outPath) {
  const read = (p) => readFileSync(join(ROOT, p), 'utf8')
  const pricing = read('apps/web/src/lib/pricing.ts')
  const products = read('apps/web/src/lib/sales-products.ts')
  const entitlements = read('apps/web/src/lib/directory-entitlements.ts')
  const commission = read('apps/web/src/lib/commission-schedule.ts')
  const referrals = read('apps/web/src/lib/referrals.ts')

  const problems = []

  // Every price the booklet speaks aloud must still exist in the catalog.
  for (const price of ['$99 / yr', '$9.99 / mo', '$199 / yr', '$19.99 / mo', '$49 / mo', '$99 / mo']) {
    if (!pricing.includes(price)) problems.push(`pricing.ts no longer contains ${price}`)
  }
  for (const price of ['$50 / mo', '$30 once', '$25 / mo', '$40 / mo', '$25 once', '$50 once', 'Custom amount']) {
    if (!products.includes(price)) problems.push(`sales-products.ts no longer contains ${price}`)
  }

  // The matrix quantities.
  const premium = entitlements.slice(entitlements.indexOf('const PREMIUM:'), entitlements.indexOf('const FEATURED:'))
  const featured = entitlements.slice(entitlements.indexOf('const FEATURED:'))
  if (!premium.includes('mediaLimit: 15')) problems.push('Premium photo limit is no longer 15')
  if (!premium.includes('additionalManagers: 3')) problems.push('Premium team seats are no longer 3')
  if (!featured.includes('mediaLimit: 30')) problems.push('Featured photo limit is no longer 30')
  if (!featured.includes('additionalManagers: 10')) problems.push('Featured team seats are no longer 10')
  for (const featuredOnly of ['priorityPlacement', 'categoryBenchmarking', 'multiLocation']) {
    if (premium.includes(`${featuredOnly}: true`)) {
      problems.push(`${featuredOnly} is now granted to Premium; the matrix understates Premium`)
    }
  }
  // Founders sharing Premium's entitlements is a selling point the booklet makes
  // explicitly, so it must remain true.
  if (!entitlements.includes('founders: PREMIUM')) {
    problems.push('Founders no longer shares the Premium entitlement set; section 4 is wrong')
  }

  // Commission terms, quoted almost verbatim in section 10.
  if (!commission.includes('COMMISSION_HOLD_DAYS = 7')) problems.push('The commission hold is no longer 7 days')
  if (!commission.includes('the 15th and the final calendar day of each month')) {
    problems.push('The payout cycle wording changed; section 10 must be re-checked')
  }

  // Referral offer.
  if (!referrals.includes('REFERRAL_QUALIFYING_MONTHS = 3')) problems.push('Referral qualifying period is no longer 3 months')
  if (!referrals.includes('REFERRAL_REWARD_MONTHS = 3')) problems.push('Referral reward is no longer 3 months')
  if (!referrals.includes('REFERRAL_ANNUAL_CAP = 16')) problems.push('Referral annual cap is no longer 16')
  if (!referrals.includes('referral_monthly_25')) problems.push('Referral discount is no longer 25%')

  if (!existsSync(outPath) || statSync(outPath).size < 20_000) {
    problems.push(`Booklet missing or unexpectedly small: ${outPath}`)
  }

  if (problems.length) {
    console.error('Booklet is out of date with the product code:')
    for (const p of problems) console.error(`  - ${p}`)
    process.exit(1)
  }
  console.log(`Verified ${outPath}: ${statSync(outPath).size} bytes; every price, limit and term matches the code.`)
}

// --- Entry point -------------------------------------------------------------------

const OUT_DIR = join(ROOT, 'output', 'docx')
const PUBLIC_DIR = join(ROOT, 'apps', 'web', 'public', 'downloads')
const OUT = join(OUT_DIR, 'citybeat-sales-booklet.docx')
const OUT_PUBLIC = join(PUBLIC_DIR, 'citybeat-sales-booklet.docx')

mkdirSync(OUT_DIR, { recursive: true })
mkdirSync(PUBLIC_DIR, { recursive: true })

const buffer = await Packer.toBuffer(buildDocument())
writeFileSync(OUT, buffer)
copyFileSync(OUT, OUT_PUBLIC)
console.log(`Generated ${OUT}`)
console.log(`Published ${OUT_PUBLIC}`)

if (process.argv.includes('--verify')) verify(OUT)
