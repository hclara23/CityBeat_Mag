# CityBeat User Guide

A practical guide to [citybeatmag.co](https://citybeatmag.co). Pages are available in English (`/en/...`) and Spanish (`/es/...`); links below use English.

Roles are cumulative: Developer includes Editor/Admin, Writer, Sales, Business Owner, and Reader access. Developers manage roles from Developer Control. Editors can grant contributor, writer, and sales access, but not admin or developer access.

## 1. Reader or visitor

- **Stories:** Read local coverage at [/en/stories](https://citybeatmag.co/en/stories) and browse topic pages.
- **Ask CityBeat:** Use the chat bubble for bilingual recommendations. Results link to real businesses, events, and deals.
- **Directory:** Browse businesses at [/en/directory](https://citybeatmag.co/en/directory).
- **Events and deals:** Browse [/en/events](https://citybeatmag.co/en/events) and [/en/deals](https://citybeatmag.co/en/deals). Submit a community event at [/en/events/submit](https://citybeatmag.co/en/events/submit); an editor reviews it before publication.
- **Job Board:** Use the **Jobs** link in the main menu or open [/en/jobs](https://citybeatmag.co/en/jobs).
- **Account:** Sign up to leave reviews, bookmark stories, manage a profile, and enable two-factor authentication.

## 2. Business owner

### Claim a business

1. Find the business in the Directory and open its page.
2. Select **Claim**.
3. CityBeat sends a six-digit code to the business's on-record email.
4. Enter the code within 15 minutes.
5. The verified claim is activated or routed to the admin claims queue.

### Plans

Each paid plan is per business location.

| Plan | Price | Customer receives |
|---|---:|---|
| Basic | Free | Directory listing, reviews, and masked lead notifications |
| Founding Annual | $99/year | Founding Premium rate while the subscription stays active |
| Founding Monthly | $9.99/month | Founding Premium rate while the subscription stays active |
| Premium Annual | $199/year | Full lead details, richer listing, photos, hours, social links, deals, AI marketing assistant, and priority placement |
| Premium Monthly | $19.99/month | The same Premium features with monthly billing |
| Featured Monthly | $49/month | Premium features plus featured badge, top-of-category placement, and homepage rotation |

Founding plans are limited inventory. The live checkout determines whether they are still available.

### Dashboard, referrals, and billing

- **Dashboard:** Review leads, manage listings and deals, and approve AI marketing drafts.
- **Referral link:** Copy the personalized link from the dashboard. A referred paid listing must stay active for three months to qualify.
- **Referral reward:** The referrer receives three months at 25% off. Rewards apply automatically and appear in finance and billing records. Maximum: 16 qualified referrals per listing per calendar year.
- **Billing:** Manage subscription cards through Stripe at `/en/billing`. Failed renewals receive a secure recovery link.
- **Reports:** Monthly reports summarize listing views, leads, and reviews.

## 3. Contributor

Submit tips and story ideas at [/en/contribute](https://citybeatmag.co/en/contribute). Editors review every submission.

## 4. Writer or creator

- Open `/en/creator` to manage your stories.
- Select **New** or open `/en/creator/new` to create a story.
- Upload images up to 8 MB; the site optimizes them automatically.
- Writers edit their own work. Editors review stories before publication.

## 5. Sales representative

### Products and prices

| Product | Price | Billing |
|---|---:|---|
| Directory Founding Annual | $99 | Annual subscription |
| Directory Founding Monthly | $9.99 | Monthly subscription |
| Directory Premium Annual | $199 | Annual subscription |
| Directory Premium Monthly | $19.99 | Monthly subscription |
| Directory Featured Monthly | $49 | Monthly subscription |
| Newsletter Sponsorship | $50 | Monthly subscription |
| Sponsored Story | $30 | One time |
| Category Banner | $25 | Monthly subscription |
| Featured Event | $25 | One time |
| 30-Day Job Posting | $50 | One time |
| Approved Custom Product | Manager-approved amount | One time |

The Sales Desk product menu and checkout summary are the final authority for current availability, price, and billing cadence.

### Make a sale

1. Open `/en/admin/sales/me`.
2. Select **+ New sale**.
3. Select the exact product and variation from the grouped **Product** menu.
4. Enter business name and customer email. Add a phone number when available.
5. For a Directory sale, select an existing business or **Add a new business**. Enter a custom category if the correct category is not listed.
6. Check the customer, product, price, billing term, and any approved discount.
7. Select **Create secure checkout**.
8. Hand off the payment in the way that fits the sale:
   - **Open:** Let an in-person customer enter their own card information.
   - **QR:** Show the live QR code for the customer to scan.
   - **Email:** Open a prepared email with the secure link.
   - **Text:** Send automatically when configured; otherwise CityBeat copies the link and opens the device's SMS app.
   - **Copy:** Copy the same link for another approved channel.
9. Confirm payment and brief status in **Recent Orders**.
10. Select **Start next sale** when finished.

Never type, photograph, write down, or record a customer's card information. If customer or product details are wrong, select **Correct details** and generate a fresh checkout instead of sending the old link.

### What the customer does

1. The customer opens the payment link or scans the QR.
2. Stripe collects the minimum required contact and card information.
3. A subscription product charges the first payment, securely stores the card in Stripe, and renews automatically until canceled.
4. A one-time product charges once and schedules no renewal.
5. After payment, the same private session continues to a product-specific fulfillment brief.
6. Known contact and business details are prefilled. The brief autosaves and can be resumed.
7. The wizard asks only for the purchased product's requirements:
   - **Directory:** Business identity, category, description, hours, address, contacts, website, social links, logo, and photos.
   - **Job:** Title, employer, category, location or remote status, schedule, pay, description, requirements, application instructions, and closing date.
   - **Event:** Name, date and time, venue, description, ticket link and price, age limits, contact, and artwork.
   - **Advertising:** Campaign dates, goal, audience, website, call to action, copy, logo, and creative assets.
   - **Sponsored Story:** Subject, angle, facts, quote sources, links, images, approvals, and deadline.
   - **Custom:** Manager-approved deliverables, assets, contacts, and deadline.
8. Staff receives the completed order for review and fulfillment. Incomplete material is not published automatically.

### Track the order and commission

Recent Orders clearly shows payment, recurring billing, brief completion, fulfillment, discount, and commission. Connect a bank once through payout onboarding; commission transfers follow the current one-time or residual setting. Inbound quote and chat leads are at `/en/admin/leads`.

Download the short [CityBeat Sales Guide](https://citybeatmag.co/downloads/citybeat-sales-guide.pdf) and [New Sale Quick Start](https://citybeatmag.co/downloads/citybeat-sales-desk-quick-start.pdf) from the Sales Desk.

## 6. Editor or admin

Open `/en/admin` for the admin hub.

- **Review Queue:** Review submitted and automatically prospected articles. Edit, approve, publish, or reject each item.
- **Claims:** Review ownership status. Email-verified claims show verification; unverified and rep-created claims require an ownership check and correct owner assignment.
- **Events:** Approve or reject community events and manage featured event purchases.
- **Directory Manager:** Add, edit, upgrade, sponsor, verify, or remove listings; moderate deals and imported candidates.
- **Leads:** Review all captured quote, chat, and contact requests.
- **Sales fulfillment:** Use paid order and completed brief status to fulfill directory, ad, event, story, and job purchases.

Article cards without source images use varied visual presentation; editors should still add a relevant licensed image before publication when practical.

## 7. Developer

Open `/en/developer` for Developer Control.

- **+ New Sale:** The bright button opens the unified Sales Desk directly.
- **Sales Desk:** Create and track any Directory, ad, event, story, job, or approved custom checkout.
- **Finance:** Review gross charges, discounts, net payments, product and listing attribution, referral status, remaining reward balance, commission, and payouts.
- **Payouts:** Set commission percentage and choose one-time or residual commission mode; issue approved one-off payouts.
- **Ad Banners:** Manage active sponsor inventory, including the newsletter sponsor placement.
- **Sales Agent:** Monitor automated outreach and lead progress.
- **Directory Manager:** Create and manage businesses directly.
- **Roles and settings:** Grant access and manage safe platform controls. Non-developers cannot modify developer accounts.

## 8. Operator routine

- Review the Monday operations digest for revenue, funnel, inventory, leads, and failures.
- Clear claims, article, event, directory, and fulfillment queues.
- Check Finance for discounts, referrals, recurring charges, and payouts.
- Review system alerts when an automated process fails.
- Confirm the Sales Guide and Quick Start after material product, price, or interface changes.

---

Reflects the application as of July 30, 2026. See [SECURITY_AUDIT.md](SECURITY_AUDIT.md) and [CLAIM_VERIFICATION.md](CLAIM_VERIFICATION.md) for operational detail.
