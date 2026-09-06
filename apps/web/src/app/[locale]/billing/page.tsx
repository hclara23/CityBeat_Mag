'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale } from '@/components/TranslationProvider'
import { Navigation, Button } from '@citybeat/ui'
import { LocaleToggle } from '@/components/citybeat/LocaleToggle'
import { AuthError } from '@citybeat/ui/auth'

interface Subscription {
  id: string
  stripe_subscription_id?: string
  stripe_customer_id?: string
  ad_type: string
  amount_total: number
  billing_cycle: string
  payment_status: string
  created_at: string
}

interface Invoice {
  id: string
  amount: number
  date: string
  status: string
  pdfUrl?: string
}

// /billing is the page the billing terms name as the cancellation path
// ("Cancel any time from Billing in your dashboard" / "Cancela cuando quieras
// desde Facturación en tu panel"), and it was English-only — so the Spanish
// half of a ~90% Spanish-speaking market was sent to an English page to cancel.
const copy = {
  en: {
    loading: 'Loading...',
    title: 'Billing & Subscriptions',
    loadFailed: 'Failed to load billing data',
    portalFailed: 'Failed to open subscription manager',
    activeTitle: 'Active Subscriptions',
    noneTitle: 'No active subscriptions',
    noneDesc: 'You currently do not have any active advertising subscriptions.',
    browsePlans: 'Browse Plans',
    active: 'Active',
    pending: 'Pending',
    manage: 'Manage',
    opening: 'Loading...',
    started: 'Started',
    per: 'per',
    paymentTitle: 'Payment Methods',
    paymentManagedDesc:
      'Your card is held by Stripe, never by CityBeat. Open the secure Stripe portal to see, update, or remove the card on your subscription, or to cancel.',
    paymentManageBtn: 'Manage payment method',
    paymentNoneDesc:
      'No card is needed until you start a subscription. Stripe saves and stores it for you at checkout.',
    historyTitle: 'Billing History',
    noInvoices: 'No invoices yet',
    noInvoicesDesc: 'Your invoices will appear here once you have an active subscription',
    invoice: 'Invoice',
    date: 'Date',
    amount: 'Amount',
    status: 'Status',
    action: 'Action',
    downloadPdf: 'Download PDF',
    helpText: 'Need help with your billing? Contact our support team at',
  },
  es: {
    loading: 'Cargando...',
    title: 'Facturación y Suscripciones',
    loadFailed: 'No se pudieron cargar los datos de facturación',
    portalFailed: 'No se pudo abrir el administrador de suscripciones',
    activeTitle: 'Suscripciones activas',
    noneTitle: 'Sin suscripciones activas',
    noneDesc: 'Por ahora no tienes ninguna suscripción de publicidad activa.',
    browsePlans: 'Ver planes',
    active: 'Activa',
    pending: 'Pendiente',
    manage: 'Administrar',
    opening: 'Abriendo...',
    started: 'Inició el',
    per: 'por',
    paymentTitle: 'Métodos de pago',
    paymentManagedDesc:
      'Tu tarjeta la guarda Stripe, nunca CityBeat. Abre el portal seguro de Stripe para ver, actualizar o quitar la tarjeta de tu suscripción, o para cancelar.',
    paymentManageBtn: 'Administrar método de pago',
    paymentNoneDesc:
      'No necesitas una tarjeta hasta que inicies una suscripción. Stripe la guarda por ti al momento de pagar.',
    historyTitle: 'Historial de facturación',
    noInvoices: 'Todavía no hay facturas',
    noInvoicesDesc: 'Tus facturas aparecerán aquí cuando tengas una suscripción activa',
    invoice: 'Factura',
    date: 'Fecha',
    amount: 'Monto',
    status: 'Estado',
    action: 'Acción',
    downloadPdf: 'Descargar PDF',
    helpText: '¿Necesitas ayuda con tu facturación? Escribe a nuestro equipo de soporte a',
  },
}

// billing_cycle comes from Firestore as whatever the checkout wrote. Translate
// the values we actually write and fall through to the raw string for anything
// else — a mis-guessed cycle on a money page is worse than an English word.
const CYCLE_ES: Record<string, string> = {
  month: 'mes',
  monthly: 'mensual',
  year: 'año',
  yearly: 'anual',
  annual: 'anual',
  week: 'semana',
  day: 'día',
  one_time: 'pago único',
}

export default function BillingPage() {
  const router = useRouter()
  const locale = useLocale()
  const isEs = locale === 'es'
  const t = isEs ? copy.es : copy.en
  const dateLocale = isEs ? 'es-MX' : 'en-US'
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [managingPortal, setManagingPortal] = useState(false)

  useEffect(() => {
    const loadBillingData = async () => {
      try {
        setIsLoading(true)
        const response = await fetch('/api/billing')

        if (response.status === 401) {
          router.push(`/${locale}/login`)
          return
        }

        if (!response.ok) {
          throw new Error(t.loadFailed)
        }

        const data = (await response.json()) as {
          subscriptions: Subscription[]
          invoices: Invoice[]
        }

        setSubscriptions(data.subscriptions)
        setInvoices(data.invoices)
      } catch (err) {
        setError(err instanceof Error ? err.message : t.loadFailed)
      } finally {
        setIsLoading(false)
      }
    }

    loadBillingData()
  }, [locale, router, t.loadFailed])

  const handleManageSubscription = async (customerId: string) => {
    try {
      setManagingPortal(true)
      const response = await fetch('/api/customer-portal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customerId: customerId,
          returnUrl: `${window.location.origin}/${locale}/billing`,
        }),
      })

      if (!response.ok) {
        throw new Error(t.portalFailed)
      }

      const data = (await response.json()) as { url: string }
      window.location.href = data.url
    } catch (err) {
      setError(err instanceof Error ? err.message : t.portalFailed)
      setManagingPortal(false)
    }
  }

  // The one Stripe customer this account can be sent to the portal as. The
  // portal is where the card actually lives, so it is also the only truthful
  // answer this page can give about payment methods.
  const portalCustomerId = subscriptions.find((sub) => sub.stripe_customer_id)?.stripe_customer_id

  const cycleLabel = (cycle: string) => (isEs ? CYCLE_ES[cycle] || cycle : cycle)

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white">
        <Navigation rightSlot={<LocaleToggle />} />
        <div className="max-w-3xl mx-auto px-4 py-12">
          <p className="text-gray-500">{t.loading}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      <Navigation rightSlot={<LocaleToggle />} />

      <div className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-4xl font-bold mb-8">{t.title}</h1>

        {error && <AuthError message={error} />}

        {/* Active Subscriptions */}
        <div className="bg-gray-50 rounded-lg p-6 border border-gray-200 mb-8">
          <h2 className="text-2xl font-bold mb-6">{t.activeTitle}</h2>

          {subscriptions.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">{t.noneTitle}</p>
              <p className="text-sm text-gray-400 mt-2">{t.noneDesc}</p>
              <Button
                className="mt-4 bg-red-600 hover:bg-red-700"
                onClick={() => router.push(`/${locale}/ads`)}
              >
                {t.browsePlans}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {subscriptions.map((sub) => (
                <div
                  key={sub.id}
                  className="border border-gray-200 rounded-lg p-4 flex items-center justify-between"
                >
                  <div>
                    <h3 className="font-semibold text-gray-900 capitalize">
                      {sub.ad_type} - {cycleLabel(sub.billing_cycle)}
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">
                      ${(sub.amount_total / 100).toFixed(2)} {t.per} {cycleLabel(sub.billing_cycle)}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {t.started} {new Date(sub.created_at).toLocaleDateString(dateLocale)}
                    </p>
                  </div>

                  <div className="flex items-center gap-4">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                      sub.payment_status === 'completed'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {sub.payment_status === 'completed' ? t.active : t.pending}
                    </span>

                    {sub.stripe_customer_id && (
                      <Button
                        variant="secondary"
                        onClick={() => handleManageSubscription(sub.stripe_customer_id!)}
                        disabled={managingPortal}
                      >
                        {managingPortal ? t.opening : t.manage}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Payment Methods.
            This block used to be unconditional static markup telling every
            subscriber "No payment methods on file" — false, and it reads like
            the card was lost — under a Button with no onClick and no href, so
            the fix it offered did nothing. The page has no payment-method data
            to show (/api/billing returns only subscriptions and invoices), so
            it now says the one thing that is true (the card is held by Stripe)
            and hands the customer the control that actually works: the Stripe
            portal, which is also the two-click cancellation path the billing
            terms promise. */}
        <div className="bg-gray-50 rounded-lg p-6 border border-gray-200 mb-8">
          <h2 className="text-2xl font-bold mb-6">{t.paymentTitle}</h2>

          <div className="text-center py-8">
            {portalCustomerId ? (
              <>
                <p className="text-sm text-gray-600 max-w-md mx-auto">{t.paymentManagedDesc}</p>
                <Button
                  className="mt-4"
                  onClick={() => handleManageSubscription(portalCustomerId)}
                  disabled={managingPortal}
                >
                  {managingPortal ? t.opening : t.paymentManageBtn}
                </Button>
              </>
            ) : (
              <>
                <p className="text-sm text-gray-600 max-w-md mx-auto">{t.paymentNoneDesc}</p>
                <Button
                  className="mt-4 bg-red-600 hover:bg-red-700"
                  onClick={() => router.push(`/${locale}/ads`)}
                >
                  {t.browsePlans}
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Billing History */}
        <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
          <h2 className="text-2xl font-bold mb-6">{t.historyTitle}</h2>

          {invoices.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">{t.noInvoices}</p>
              <p className="text-sm text-gray-400 mt-2">{t.noInvoicesDesc}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-gray-200">
                  <tr>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">
                      {t.invoice}
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">
                      {t.date}
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">
                      {t.amount}
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">
                      {t.status}
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">
                      {t.action}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((invoice) => (
                    <tr key={invoice.id} className="border-b border-gray-200">
                      <td className="py-3 px-4 text-gray-900">{invoice.id}</td>
                      <td className="py-3 px-4 text-gray-600">
                        {new Date(invoice.date).toLocaleDateString(dateLocale)}
                      </td>
                      <td className="py-3 px-4 text-gray-900 font-semibold">
                        ${(invoice.amount / 100).toFixed(2)}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          invoice.status === 'paid'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {invoice.status}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {invoice.pdfUrl && (
                          <a
                            href={invoice.pdfUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-red-600 hover:text-red-700 font-medium text-sm"
                          >
                            {t.downloadPdf}
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Billing Info */}
        <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            {t.helpText}{' '}
            <a href="mailto:support@citybeatmag.co" className="font-semibold hover:underline">
              support@citybeatmag.co
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
