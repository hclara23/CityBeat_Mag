'use client'

// Role-aware in-app user guide. Each dashboard links here; sections render
// only for roles the viewer actually has (cumulative, like the role model).
// Content mirrors docs/USER_GUIDE.md - update both together.

export type GuideRoles = {
  isOwner: boolean
  isWriter: boolean
  isSales: boolean
  isEditor: boolean
  isDeveloper: boolean
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="citybeat-panel rounded-2xl border border-white/10 p-6">
      <h2 className="mb-4 text-xl font-bold uppercase tracking-wide text-brand-neon">{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-white/70">{children}</div>
    </section>
  )
}

function Item({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="font-bold text-white">{heading}</p>
      <div>{children}</div>
    </div>
  )
}

const L = ({ href, children, download }: { href: string; children: React.ReactNode; download?: boolean }) => (
  <a href={href} download={download} className="text-brand-neon underline">
    {children}
  </a>
)

export function RoleGuide({ roles, locale }: { roles: GuideRoles; locale: string }) {
  const p = (path: string) => `/${locale}${path}`
  return (
    <div className="grid gap-6">
      <Section title="Everyone - the basics">
        <Item heading="Stories and local discovery">
          Read <L href={p('/stories')}>Stories</L>, browse the <L href={p('/directory')}>Directory</L>, or use Ask
          CityBeat for bilingual recommendations that link to local businesses, events, and deals.
        </Item>
        <Item heading="Events, deals, and jobs">
          Browse <L href={p('/events')}>Events</L>, <L href={p('/deals')}>Deals</L>, and the{' '}
          <L href={p('/jobs')}>Job Board</L>. Anyone can submit a community event at{' '}
          <L href={p('/events/submit')}>Submit an Event</L>; an editor reviews it before publication.
        </Item>
        <Item heading="Your account">
          Profile, saved stories, and two-factor security live at <L href={p('/account')}>Account</L>.
        </Item>
      </Section>

      <Section title="Business owners - your listing">
        <Item heading="Claim your business">
          Open your business in the <L href={p('/directory')}>Directory</L> and select Claim. A six-digit code goes
          to the business&apos;s on-record email. Enter it within 15 minutes to prove ownership and submit the claim.
        </Item>
        <Item heading="Plans and leads">
          Basic is free. Premium is $19.99/month or $199/year and unlocks full lead details, richer listing tools,
          deals, AI marketing assistance, and priority placement. Featured is $49/month and adds top-of-category
          and homepage visibility. Founding plans, while available, are $9.99/month or $99/year.
        </Item>
        <Item heading="Referral rewards">
          Copy the personalized referral link from <L href={p('/dashboard')}>Dashboard</L>. When a referred paid
          listing stays active for three months, the referrer earns three months at 25% off. Rewards apply
          automatically, appear in billing records, and are limited to 16 qualified referrals per calendar year.
        </Item>
        <Item heading="Deals, billing, and reports">
          Premium and Featured owners can post deals and review marketing drafts from the dashboard. Manage cards
          and subscriptions at <L href={p('/billing')}>Billing</L>. Monthly reports summarize views, leads, and
          reviews.
        </Item>
      </Section>

      {roles.isWriter && (
        <Section title="Writers - publishing">
          <Item heading="Create and manage stories">
            Create at <L href={p('/creator/new')}>New Story</L> and manage your work at{' '}
            <L href={p('/creator')}>Creator Studio</L>. Images up to 8 MB are optimized automatically. Writers edit
            their own stories; editors review before publication.
          </Item>
        </Section>
      )}

      {roles.isSales && (
        <Section title="Sales reps - New Sale">
          <Item heading="1. Start">
            Open the <L href={p('/admin/sales/me')}>Sales Desk</L> and select <strong>+ New sale</strong>. Choose the
            exact product and variation from the grouped Product menu. The displayed price and billing term are the
            final authority.
          </Item>
          <Item heading="2. Add the customer">
            Enter business name and email; phone is optional. For a Directory sale, select an existing listing or
            choose <strong>Add a new business</strong>. Enter a category manually when the correct one is not listed.
          </Item>
          <Item heading="3. Create checkout">
            Confirm the summary, then select <strong>Create secure checkout</strong>. Stripe generates one payment
            link and its matching QR code. Never type, photograph, or record a customer&apos;s card details yourself.
          </Item>
          <Item heading="4. Hand off payment">
            Use <strong>Open</strong> for an in-person card payment, show the QR, or select{' '}
            <strong>Email</strong>, <strong>Text</strong>, or <strong>Copy</strong>. Text falls back to the
            device&apos;s SMS app if automated messaging is unavailable. If details are wrong, select{' '}
            <strong>Correct details</strong> and create a fresh link.
          </Item>
          <Item heading="5. Customer completes the order">
            After payment, the same private link continues to a short product-specific brief. It asks only for
            fulfillment details such as listing data, job pay and category, event information, or ad logos, copy,
            images, and links. The brief autosaves and can be resumed.
          </Item>
          <Item heading="6. Track and fulfill">
            Recent Orders shows payment, recurring billing, brief completion, fulfillment, discounts, and
            commission. Select <strong>Start next sale</strong> when the handoff is complete. Incomplete material is
            never published automatically.
          </Item>
          <Item heading="Recurring and one-time billing">
            Directory plans, Newsletter Sponsorship, and Category Banner are subscriptions: Stripe charges now,
            securely stores the card, and renews automatically until canceled. Sponsored Story, Featured Event,
            Job Posting, and approved custom orders are one-time charges.
          </Item>
          <Item heading="Sales help">
            Download the concise <L href="/downloads/citybeat-sales-guide.pdf" download>Sales Guide</L> and{' '}
            <L href="/downloads/citybeat-sales-desk-quick-start.pdf" download>New Sale Quick Start</L> from the Sales
            Desk. Connect your bank once for automatic commission payouts. Inbound opportunities are in{' '}
            <L href={p('/admin/leads')}>Leads</L>.
          </Item>
        </Section>
      )}

      {roles.isEditor && (
        <Section title="Editors and admins - queues">
          <Item heading="Claims review">
            <L href={p('/admin/claims')}>Claims</L> shows email-verified, unverified, and rep-sale status. Confirm
            ownership before approving any unverified claim and attach the real owner to rep-created listings.
          </Item>
          <Item heading="Stories and article prospects">
            Review submitted and automatically prospected articles from the Admin Review Queue. Approve, edit, or
            reject each item before publication; missing story images use varied presentation instead of one
            repeated default image.
          </Item>
          <Item heading="Events, Directory, and leads">
            Moderate community events at <L href={p('/admin/events')}>Events</L>, listings and deals at{' '}
            <L href={p('/admin/directory')}>Directory Manager</L>, and captured inquiries at{' '}
            <L href={p('/admin/leads')}>Leads</L>.
          </Item>
        </Section>
      )}

      {roles.isDeveloper && (
        <Section title="Developers - control and finance">
          <Item heading="Fast sales access">
            Select the bright <strong>+ New Sale</strong> button in <L href={p('/developer')}>Developer Control</L>{' '}
            to go directly to the Sales Desk. Developers can also use every role-specific workflow above.
          </Item>
          <Item heading="Finance, referrals, and payouts">
            <L href={p('/admin/finance')}>Finance</L> shows gross charges, discounts, net payments, product and
            listing attribution, referral status, remaining discount balance, and payouts.{' '}
            <L href={p('/admin/payouts')}>Payouts</L> controls commission percentage and one-time or residual mode.
          </Item>
          <Item heading="Platform management">
            Manage sponsor inventory at <L href={p('/admin/banners')}>Ad Banners</L>, automated outreach at{' '}
            <L href={p('/admin/sales')}>Sales Agent</L>, and roles and platform settings from{' '}
            <L href={p('/developer')}>Developer Control</L>.
          </Item>
          <Item heading="Automation">
            Failures alert the configured operations email and log to system alerts. The Monday operations digest
            summarizes platform health, revenue, inventory, leads, and failures.
          </Item>
        </Section>
      )}
    </div>
  )
}
