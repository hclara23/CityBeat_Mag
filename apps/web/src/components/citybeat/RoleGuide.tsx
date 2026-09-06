'use client'

// Role-aware in-app user guide. Each dashboard links here; sections render
// only for roles the viewer actually has (cumulative, like the role model).
// Content mirrors docs/USER_GUIDE.md - update both together.
//
// It already received `locale` and ignored it, so /es/guide rendered the whole
// guide in English — including how to claim a business, what Premium costs,
// and how cancellation works. In a ~90% Spanish-speaking market, an
// English-only manual for paid features is a defect, not a rough edge.

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

const COPY = {
  en: {
    basics: 'Everyone - the basics',
    stories: 'Stories and local discovery',
    eventsDeals: 'Events, deals, and jobs',
    account: 'Your account',
    owners: 'Business owners - your listing',
    claim: 'Claim your business',
    plans: 'Plans and leads',
    referrals: 'Referral rewards',
    dealsBilling: 'Deals, billing, and reports',
    writers: 'Writers - publishing',
    createStories: 'Create and manage stories',
    sales: 'Sales reps - New Sale',
    sales1: '1. Start',
    sales2: '2. Add the customer',
    sales3: '3. Create checkout',
    sales4: '4. Hand off payment',
    sales5: '5. Customer completes the order',
    sales6: '6. Track and fulfill',
    salesBilling: 'Recurring and one-time billing',
    salesHelp: 'Sales help',
    editors: 'Editors and admins - queues',
    claimsReview: 'Claims review',
    storiesQueue: 'Stories and article prospects',
    moderation: 'Events, Directory, and leads',
    developers: 'Developers - control and finance',
    fastSales: 'Fast sales access',
    finance: 'Finance, referrals, and payouts',
    platform: 'Platform management',
    automation: 'Automation',
  },
  es: {
    basics: 'Para todos - lo básico',
    stories: 'Historias y descubrimiento local',
    eventsDeals: 'Eventos, ofertas y empleos',
    account: 'Tu cuenta',
    owners: 'Dueños de negocio - tu ficha',
    claim: 'Reclama tu negocio',
    plans: 'Planes y clientes potenciales',
    referrals: 'Recompensas por referidos',
    dealsBilling: 'Ofertas, facturación y reportes',
    writers: 'Escritores - publicación',
    createStories: 'Crear y administrar historias',
    sales: 'Representantes de ventas - Nueva venta',
    sales1: '1. Empezar',
    sales2: '2. Agregar al cliente',
    sales3: '3. Crear el cobro',
    sales4: '4. Entregar el enlace de pago',
    sales5: '5. El cliente completa el pedido',
    sales6: '6. Dar seguimiento y entregar',
    salesBilling: 'Cobros recurrentes y de una sola vez',
    salesHelp: 'Ayuda para ventas',
    editors: 'Editores y administradores - colas',
    claimsReview: 'Revisión de reclamos',
    storiesQueue: 'Historias y artículos propuestos',
    moderation: 'Eventos, Directorio y clientes potenciales',
    developers: 'Desarrolladores - control y finanzas',
    fastSales: 'Acceso rápido a ventas',
    finance: 'Finanzas, referidos y pagos',
    platform: 'Administración de la plataforma',
    automation: 'Automatización',
  },
}

export function RoleGuide({ roles, locale }: { roles: GuideRoles; locale: string }) {
  const p = (path: string) => `/${locale}${path}`
  const isEs = locale === 'es'
  const t = isEs ? COPY.es : COPY.en

  return (
    <div className="grid gap-6">
      <Section title={t.basics}>
        <Item heading={t.stories}>
          {isEs ? (
            <>
              Lee <L href={p('/stories')}>Historias</L>, explora el <L href={p('/directory')}>Directorio</L> o usa
              Pregunta a CityBeat para recibir recomendaciones bilingües que enlazan a negocios, eventos y ofertas
              locales.
            </>
          ) : (
            <>
              Read <L href={p('/stories')}>Stories</L>, browse the <L href={p('/directory')}>Directory</L>, or use Ask
              CityBeat for bilingual recommendations that link to local businesses, events, and deals.
            </>
          )}
        </Item>
        <Item heading={t.eventsDeals}>
          {isEs ? (
            <>
              Explora <L href={p('/events')}>Eventos</L>, <L href={p('/deals')}>Ofertas</L> y la{' '}
              <L href={p('/jobs')}>Bolsa de trabajo</L>. Cualquier persona puede enviar un evento comunitario en{' '}
              <L href={p('/events/submit')}>Enviar un evento</L>; un editor lo revisa antes de publicarlo.
            </>
          ) : (
            <>
              Browse <L href={p('/events')}>Events</L>, <L href={p('/deals')}>Deals</L>, and the{' '}
              <L href={p('/jobs')}>Job Board</L>. Anyone can submit a community event at{' '}
              <L href={p('/events/submit')}>Submit an Event</L>; an editor reviews it before publication.
            </>
          )}
        </Item>
        <Item heading={t.account}>
          {isEs ? (
            <>
              Tu perfil, tus historias guardadas y la seguridad de dos pasos están en{' '}
              <L href={p('/account')}>Cuenta</L>.
            </>
          ) : (
            <>
              Profile, saved stories, and two-factor security live at <L href={p('/account')}>Account</L>.
            </>
          )}
        </Item>
      </Section>

      <Section title={t.owners}>
        <Item heading={t.claim}>
          {isEs ? (
            <>
              Abre tu negocio en el <L href={p('/directory')}>Directorio</L> y selecciona Reclamar. Enviaremos un
              código de seis dígitos al correo registrado del negocio. Ingrésalo en 15 minutos para comprobar la
              propiedad y enviar el reclamo.
            </>
          ) : (
            <>
              Open your business in the <L href={p('/directory')}>Directory</L> and select Claim. A six-digit code goes
              to the business&apos;s on-record email. Enter it within 15 minutes to prove ownership and submit the claim.
            </>
          )}
        </Item>
        <Item heading={t.plans}>
          {isEs ? (
            <>
              El plan Básico es gratis. Premium cuesta $19.99 al mes o $199 al año e incluye los datos completos de
              cada cliente potencial, más herramientas para tu ficha, ofertas, asistencia de marketing con IA y
              ubicación prioritaria. Destacado cuesta $49 al mes y agrega el primer lugar de tu categoría y presencia
              en la portada. Mientras estén disponibles, los planes Fundador cuestan $9.99 al mes o $99 al año.
            </>
          ) : (
            <>
              Basic is free. Premium is $19.99/month or $199/year and unlocks full lead details, richer listing tools,
              deals, AI marketing assistance, and priority placement. Featured is $49/month and adds top-of-category
              and homepage visibility. Founding plans, while available, are $9.99/month or $99/year.
            </>
          )}
        </Item>
        <Item heading={t.referrals}>
          {isEs ? (
            <>
              Copia tu enlace personal de referidos desde el <L href={p('/dashboard')}>Panel</L>. Cuando una ficha
              referida de pago se mantiene activa tres meses, quien la refirió gana tres meses con 25% de descuento.
              Las recompensas se aplican solas, aparecen en tu facturación y tienen un límite de 16 referidos
              calificados por año calendario.
            </>
          ) : (
            <>
              Copy the personalized referral link from <L href={p('/dashboard')}>Dashboard</L>. When a referred paid
              listing stays active for three months, the referrer earns three months at 25% off. Rewards apply
              automatically, appear in billing records, and are limited to 16 qualified referrals per calendar year.
            </>
          )}
        </Item>
        <Item heading={t.dealsBilling}>
          {isEs ? (
            <>
              Los dueños con plan Premium o Destacado pueden publicar ofertas y revisar borradores de marketing desde
              el panel. Administra tus tarjetas y suscripciones en <L href={p('/billing')}>Facturación</L>, que también
              es donde se cancela. Cada mes recibes un reporte con vistas, clientes potenciales y reseñas.
            </>
          ) : (
            <>
              Premium and Featured owners can post deals and review marketing drafts from the dashboard. Manage cards
              and subscriptions at <L href={p('/billing')}>Billing</L>, which is also where you cancel. Monthly reports
              summarize views, leads, and reviews.
            </>
          )}
        </Item>
      </Section>

      {roles.isWriter && (
        <Section title={t.writers}>
          <Item heading={t.createStories}>
            {isEs ? (
              <>
                Crea en <L href={p('/creator/new')}>Nueva historia</L> y administra tu trabajo en{' '}
                <L href={p('/creator')}>Estudio del creador</L>. Las imágenes de hasta 8 MB se optimizan solas. Los
                escritores editan sus propias historias; los editores las revisan antes de publicarlas.
              </>
            ) : (
              <>
                Create at <L href={p('/creator/new')}>New Story</L> and manage your work at{' '}
                <L href={p('/creator')}>Creator Studio</L>. Images up to 8 MB are optimized automatically. Writers edit
                their own stories; editors review before publication.
              </>
            )}
          </Item>
        </Section>
      )}

      {roles.isSales && (
        <Section title={t.sales}>
          <Item heading={t.sales1}>
            {isEs ? (
              <>
                Abre el <L href={p('/admin/sales/me')}>Escritorio de ventas</L> y selecciona{' '}
                <strong>+ Nueva venta</strong>. Elige el producto y la variante exactos en el menú agrupado de
                Productos. Un negocio nuevo del directorio ofrece Básico gratis, Fundador $9.99 al mes o Premium
                $19.99 al mes; nunca elige un plan de pago por su cuenta.
              </>
            ) : (
              <>
                Open the <L href={p('/admin/sales/me')}>Sales Desk</L> and select <strong>+ New sale</strong>. Choose the
                exact product and variation from the grouped Product menu. A new directory business offers Basic Free,
                Founders $9.99/month, or Premium $19.99/month; it never silently defaults to a paid plan.
              </>
            )}
          </Item>
          <Item heading={t.sales2}>
            {isEs ? (
              <>
                Captura el nombre del negocio y el correo; el teléfono es opcional. Para una venta de Directorio,
                selecciona una ficha existente o elige <strong>Agregar un negocio nuevo</strong>. Escribe la categoría
                a mano cuando la correcta no aparezca en la lista.
              </>
            ) : (
              <>
                Enter business name and email; phone is optional. For a Directory sale, select an existing listing or
                choose <strong>Add a new business</strong>. Enter a category manually when the correct one is not listed.
              </>
            )}
          </Item>
          <Item heading={t.sales3}>
            {isEs ? (
              <>
                Para el plan Básico gratis, selecciona <strong>Crear ficha gratis</strong>; no hay enlace de pago ni
                tarjeta. Para un plan de pago, confirma el resumen y crea el cobro seguro de Stripe. Nunca escribas,
                fotografíes ni grabes los datos de la tarjeta de un cliente.
              </>
            ) : (
              <>
                For Basic Free, select <strong>Create free listing</strong>; no payment link or card is involved. For a
                paid plan, confirm the summary and create the secure Stripe checkout. Never type, photograph, or record a
                customer&apos;s card details yourself.
              </>
            )}
          </Item>
          <Item heading={t.sales4}>
            {isEs ? (
              <>
                Cada negocio nuevo recibe la entrega de su ficha pública con Abrir, QR, Correo, Texto y Copiar, para
                que el cliente abra la página y seleccione Reclamar. Los planes de pago reciben además una entrega
                aparte con el enlace de pago de Stripe y las mismas cinco acciones. Las fichas gratis no muestran
                enlace ni QR de pago. Reclamar comprueba la propiedad sin generar un segundo cobro. La opción de Texto
                usa la app de mensajes del dispositivo cuando el envío automático no está disponible.
              </>
            ) : (
              <>
                Every new business gets a public listing handoff with Open, QR, Email, Text, and Copy so the customer can
                open the page and select Claim. Paid plans also get a separate Stripe payment handoff with the same five
                actions. Free listings show no payment link or payment QR. Claiming verifies ownership without creating a
                second Sales Desk charge. Text falls back to the device&apos;s SMS app when automated messaging is unavailable.
              </>
            )}
          </Item>
          <Item heading={t.sales5}>
            {isEs ? (
              <>
                Después del pago, el mismo enlace privado continúa a un formulario corto según el producto. Solo pide
                los datos de entrega: información de la ficha, sueldo y categoría del empleo, datos del evento o
                logotipos, textos, imágenes y enlaces del anuncio. El formulario se guarda solo y se puede continuar
                después, y se muestra en el idioma del cliente.
              </>
            ) : (
              <>
                After payment, the same private link continues to a short product-specific brief. It asks only for
                fulfillment details such as listing data, job pay and category, event information, or ad logos, copy,
                images, and links. The brief autosaves, can be resumed, and renders in the customer&apos;s language.
              </>
            )}
          </Item>
          <Item heading={t.sales6}>
            {isEs ? (
              <>
                Pedidos recientes muestra el pago, el cobro recurrente, qué tanto se completó el formulario, la
                entrega, los descuentos y la comisión. Selecciona <strong>Iniciar la siguiente venta</strong> cuando
                termines la entrega. El material incompleto nunca se publica automáticamente.
              </>
            ) : (
              <>
                Recent Orders shows payment, recurring billing, brief completion, fulfillment, discounts, and
                commission. Select <strong>Start next sale</strong> when the handoff is complete. Incomplete material is
                never published automatically.
              </>
            )}
          </Item>
          <Item heading={t.salesBilling}>
            {isEs ? (
              <>
                Los planes del Directorio, el Patrocinio del boletín y el Banner de categoría son suscripciones:
                Stripe cobra ahora, guarda la tarjeta de forma segura y renueva automáticamente hasta que se cancele.
                La Historia patrocinada, el Evento destacado, la Oferta de empleo y los pedidos personalizados
                aprobados son cobros de una sola vez.
              </>
            ) : (
              <>
                Directory plans, Newsletter Sponsorship, and Category Banner are subscriptions: Stripe charges now,
                securely stores the card, and renews automatically until canceled. Sponsored Story, Featured Event,
                Job Posting, and approved custom orders are one-time charges.
              </>
            )}
          </Item>
          <Item heading={t.salesHelp}>
            {isEs ? (
              <>
                Descarga la <L href="/downloads/citybeat-sales-guide.pdf" download>Guía de ventas</L> y el{' '}
                <L href="/downloads/citybeat-sales-desk-quick-start.pdf" download>Inicio rápido de Nueva venta</L>{' '}
                desde el Escritorio de ventas. Conecta tu banco una vez para recibir tus comisiones automáticamente.
                Las oportunidades entrantes están en <L href={p('/admin/leads')}>Prospectos</L>.
              </>
            ) : (
              <>
                Download the concise <L href="/downloads/citybeat-sales-guide.pdf" download>Sales Guide</L> and{' '}
                <L href="/downloads/citybeat-sales-desk-quick-start.pdf" download>New Sale Quick Start</L> from the Sales
                Desk. Connect your bank once for automatic commission payouts. Inbound opportunities are in{' '}
                <L href={p('/admin/leads')}>Leads</L>.
              </>
            )}
          </Item>
        </Section>
      )}

      {roles.isEditor && (
        <Section title={t.editors}>
          <Item heading={t.claimsReview}>
            {isEs ? (
              <>
                <L href={p('/admin/claims')}>Reclamos</L> muestra el estado verificado por correo, sin verificar y de
                venta por representante. Confirma la propiedad antes de aprobar cualquier reclamo sin verificar y
                asigna al dueño real en las fichas creadas por un representante.
              </>
            ) : (
              <>
                <L href={p('/admin/claims')}>Claims</L> shows email-verified, unverified, and rep-sale status. Confirm
                ownership before approving any unverified claim and attach the real owner to rep-created listings.
              </>
            )}
          </Item>
          <Item heading={t.storiesQueue}>
            {isEs ? (
              <>
                Revisa los artículos enviados y los propuestos automáticamente desde la cola de revisión de
                administración. Aprueba, edita o rechaza cada uno antes de publicarlo; las historias sin imagen usan
                presentaciones variadas en lugar de una sola imagen repetida.
              </>
            ) : (
              <>
                Review submitted and automatically prospected articles from the Admin Review Queue. Approve, edit, or
                reject each item before publication; missing story images use varied presentation instead of one
                repeated default image.
              </>
            )}
          </Item>
          <Item heading={t.moderation}>
            {isEs ? (
              <>
                Modera los eventos comunitarios en <L href={p('/admin/events')}>Eventos</L>, las fichas y ofertas en{' '}
                <L href={p('/admin/directory')}>Administrador del directorio</L>, y las solicitudes capturadas en{' '}
                <L href={p('/admin/leads')}>Prospectos</L>.
              </>
            ) : (
              <>
                Moderate community events at <L href={p('/admin/events')}>Events</L>, listings and deals at{' '}
                <L href={p('/admin/directory')}>Directory Manager</L>, and captured inquiries at{' '}
                <L href={p('/admin/leads')}>Leads</L>.
              </>
            )}
          </Item>
        </Section>
      )}

      {roles.isDeveloper && (
        <Section title={t.developers}>
          <Item heading={t.fastSales}>
            {isEs ? (
              <>
                Selecciona el botón brillante <strong>+ Nueva venta</strong> en{' '}
                <L href={p('/developer')}>Control de desarrollo</L> para ir directo al Escritorio de ventas. Los
                desarrolladores también pueden usar todos los flujos de los demás roles.
              </>
            ) : (
              <>
                Select the bright <strong>+ New Sale</strong> button in <L href={p('/developer')}>Developer Control</L>{' '}
                to go directly to the Sales Desk. Developers can also use every role-specific workflow above.
              </>
            )}
          </Item>
          <Item heading={t.finance}>
            {isEs ? (
              <>
                <L href={p('/admin/finance')}>Finanzas</L> muestra los cobros brutos, los descuentos, los pagos netos,
                la atribución por producto y por ficha, el estado de los referidos, el saldo de descuento restante y
                los pagos. <L href={p('/admin/payouts')}>Pagos</L> controla el porcentaje de comisión y el modo de una
                sola vez o residual.
              </>
            ) : (
              <>
                <L href={p('/admin/finance')}>Finance</L> shows gross charges, discounts, net payments, product and
                listing attribution, referral status, remaining discount balance, and payouts.{' '}
                <L href={p('/admin/payouts')}>Payouts</L> controls commission percentage and one-time or residual mode.
              </>
            )}
          </Item>
          <Item heading={t.platform}>
            {isEs ? (
              <>
                Administra el inventario de patrocinadores en <L href={p('/admin/banners')}>Banners</L>, la
                prospección automatizada en <L href={p('/admin/sales')}>Agente de ventas</L>, y los roles y ajustes de
                la plataforma desde <L href={p('/developer')}>Control de desarrollo</L>.
              </>
            ) : (
              <>
                Manage sponsor inventory at <L href={p('/admin/banners')}>Ad Banners</L>, automated outreach at{' '}
                <L href={p('/admin/sales')}>Sales Agent</L>, and roles and platform settings from{' '}
                <L href={p('/developer')}>Developer Control</L>.
              </>
            )}
          </Item>
          <Item heading={t.automation}>
            {isEs ? (
              <>
                Las fallas avisan al correo de operaciones configurado y quedan registradas en las alertas del
                sistema. El resumen de operaciones de los lunes reporta la salud de la plataforma, los ingresos, el
                inventario, los prospectos y las fallas.
              </>
            ) : (
              <>
                Failures alert the configured operations email and log to system alerts. The Monday operations digest
                summarizes platform health, revenue, inventory, leads, and failures.
              </>
            )}
          </Item>
        </Section>
      )}
    </div>
  )
}
