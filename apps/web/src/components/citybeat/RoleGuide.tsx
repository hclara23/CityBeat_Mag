'use client'

// Role-aware in-app user guide. Each dashboard links here; sections render
// only for roles the viewer actually has (cumulative, like the role model).
// Content mirrors docs/USER_GUIDE.md — update both together.

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
      <p>{children}</p>
    </div>
  )
}

const L = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <a href={href} className="text-brand-neon underline">
    {children}
  </a>
)

export function RoleGuide({ roles, locale }: { roles: GuideRoles; locale: string }) {
  const p = (path: string) => `/${locale}${path}`
  return (
    <div className="grid gap-6">
      <Section title="Everyone — the basics">
        <Item heading="Ask CityBeat (chat bubble, any page)">
          A bilingual concierge that recommends real local businesses, events, and deals. Answers link straight to
          directory pages.
        </Item>
        <Item heading="Directory, events, deals, jobs">
          Browse at <L href={p('/directory')}>/directory</L>, <L href={p('/events')}>/events</L>,{' '}
          <L href={p('/deals')}>/deals</L>, <L href={p('/jobs')}>/jobs</L>. Anyone can submit a community event at{' '}
          <L href={p('/events/submit')}>/events/submit</L> (editors approve).
        </Item>
        <Item heading="Your account">
          Profile, saved stories, and two-factor security live at <L href={p('/account')}>/account</L>.
        </Item>
      </Section>

      <Section title="Business owners — your listing">
        <Item heading="Claim your business (free)">
          Find it at <L href={p('/directory')}>/directory</L> → Claim. A 6-digit code goes to the business&apos;s
          on-record email (15-min expiry) — that&apos;s how we prove ownership. Verified paid claims activate
          instantly.
        </Item>
        <Item heading="Customer leads">
          The Leads panel on <L href={p('/dashboard')}>/dashboard</L> shows people asking to be contacted. Premium
          ($19/mo) unlocks full contact details instantly; Basic shows masked leads.
        </Item>
        <Item heading="AI marketing assistant (Premium+)">
          Every week it drafts a deal, 3 social captions, and review replies. Nothing publishes until you click
          approve on your dashboard. You&apos;ll get an email when new drafts are ready.
        </Item>
        <Item heading="Deals, billing, reports">
          Post coupons from your dashboard (Premium+). Manage cards at <L href={p('/billing')}>/billing</L>. A
          monthly email reports your views, leads, and reviews. Failed renewals email you a pay link automatically.
        </Item>
      </Section>

      {roles.isWriter && (
        <Section title="Writers — publishing">
          <Item heading="Your articles">
            Create at <L href={p('/creator/new')}>/creator/new</L>, manage at <L href={p('/creator')}>/creator</L>.
            You can only edit your own; publishing goes through editor review. Images up to 8 MB, auto-optimized.
          </Item>
        </Section>
      )}

      {roles.isSales && (
        <Section title="Sales reps — closing & commission">
          <Item heading="Field sales wizard">
            <L href={p('/admin/sales/new')}>/admin/sales/new</L> generates a Stripe Checkout link/QR on the spot for
            any plan or custom amount. The sale is attributed to you; an admin attaches the owner after payment.
          </Item>
          <Item heading="Your pipeline & commission">
            <L href={p('/admin/sales/me')}>/admin/sales/me</L> shows deals closed, commission earned, and the
            leaderboard. Commission pays automatically to your connected bank when the customer pays — set up your
            bank once from the dashboard payout onboarding.
          </Item>
          <Item heading="Inbound leads">
            <L href={p('/admin/leads')}>/admin/leads</L> lists quote requests and chat leads to follow up.
          </Item>
        </Section>
      )}

      {roles.isEditor && (
        <Section title="Editors / admins — the queues">
          <Item heading="Claims review">
            <L href={p('/admin/claims')}>/admin/claims</L> — approve ownership claims. Badges tell you the story:
            ✓ Email verified (proved control of the business inbox), ⚠ Not verified (paid only — verify by phone or
            email-domain match before approving), Rep sale (attach the real owner).
          </Item>
          <Item heading="Content & events">
            Auto-ingested briefs wait in the review queue; community events at{' '}
            <L href={p('/admin/events')}>/admin/events</L>; directory edits and deal moderation at{' '}
            <L href={p('/admin/directory')}>/admin/directory</L>.
          </Item>
          <Item heading="Leads">
            <L href={p('/admin/leads')}>/admin/leads</L> — every captured lead across the site.
          </Item>
        </Section>
      )}

      {roles.isDeveloper && (
        <Section title="Developers — godmode">
          <Item heading="Money out">
            <L href={p('/admin/payouts')}>/admin/payouts</L> — commission percent + mode (one-time/residual),
            one-off payouts. Transfers only ever go to the payee&apos;s own connected bank.{' '}
            <L href={p('/admin/finance')}>/admin/finance</L> is the read-only revenue overview.
          </Item>
          <Item heading="Platform">
            <L href={p('/admin/banners')}>/admin/banners</L> (incl. the newsletter sponsor slot),{' '}
            <L href={p('/admin/sales')}>/admin/sales</L> (automated outreach monitor), platform settings
            (auto-approve toggle), and role management from <L href={p('/developer')}>/developer</L>.
          </Item>
          <Item heading="Automation">
            Cron schedule lives in CLAUDE.md; failures alert ALERT_EMAIL and log to system_alerts; the Monday ops
            digest is your weekly heartbeat.
          </Item>
        </Section>
      )}
    </div>
  )
}
