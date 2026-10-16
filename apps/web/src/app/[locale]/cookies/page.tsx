'use client'

import { useLocale } from '@/components/TranslationProvider'
import { Navigation } from '@citybeat/ui'
import { LocaleToggle } from '@/components/citybeat/LocaleToggle'

const copy = {
  en: {
    title: 'Cookie Notice',
    updated: 'Last updated: October 16, 2026',
    sections: [
      ['What this notice covers', 'CityBeat uses cookies and similar browser storage for sign-in, referral attribution, security, site preferences, and—when configured—analytics. This notice explains those technologies. The Privacy Policy explains our broader handling of personal information.'],
      ['Essential session cookie', 'When you sign in, CityBeat sets a secure cookie named __session so the server can recognize your account and permissions. If you select “keep me signed in,” it may last up to 14 days; otherwise it expires with the browser session or after the shorter server limit. Signing out or revoking sessions clears or invalidates it.'],
      ['Referral attribution', 'A visit through a directory referral link may set a cookie named citybeat_directory_referral for up to 30 days. It records the referral code—not your name—to credit a qualifying listing claim or purchase. Firebase Hosting may not forward that cookie in every configuration, so the site may use equivalent browser storage as a fallback.'],
      ['Analytics and measurement', 'CityBeat records privacy-minimized page-view totals on its own server without attaching an IP address to the page-view record or setting a tracking cookie for that measurement. Google Analytics 4, Cloudflare Web Analytics, and PostHog may also be enabled. The optional CityBeat Conversion Pixel for Premium business websites is cookieless and stores daily aggregate event totals without visitor profiles. Marketing-email measurement is described in the Privacy Policy.'],
      ['Local browser storage', 'The site may store interface preferences, temporary form or cart state, referral attribution, and other settings on your device. This information stays in the browser unless a feature submits it to CityBeat.'],
      ['Your choices', 'You can clear or block cookies and site data in your browser. Blocking essential storage can prevent sign-in, checkout continuity, saved preferences, referral credit, and other requested features from working. You can opt out of marketing email using the unsubscribe link in each message.'],
    ],
  },
  es: {
    title: 'Aviso de Cookies',
    updated: 'Última actualización: 16 de octubre de 2026',
    sections: [
      ['Qué cubre este aviso', 'CityBeat usa cookies y almacenamiento similar del navegador para el inicio de sesión, la atribución de referidos, la seguridad, las preferencias del sitio y, cuando está configurada, la analítica. Este aviso explica esas tecnologías. La Política de Privacidad explica el manejo más amplio de información personal.'],
      ['Cookie esencial de sesión', 'Al iniciar sesión, CityBeat instala una cookie segura llamada __session para que el servidor reconozca su cuenta y permisos. Si elige mantener la sesión, puede durar hasta 14 días; de lo contrario vence con la sesión del navegador o con el límite más corto del servidor. Cerrar sesión o revocar sesiones la elimina o invalida.'],
      ['Atribución de referidos', 'Una visita mediante un enlace de referido del directorio puede instalar una cookie llamada citybeat_directory_referral por hasta 30 días. Guarda el código de referido—no su nombre—para acreditar una reclamación o compra que califique. Firebase Hosting puede no reenviar esa cookie en todas las configuraciones, por lo que el sitio puede usar almacenamiento equivalente del navegador como respaldo.'],
      ['Analítica y medición', 'CityBeat registra totales de vistas minimizados en su propio servidor sin adjuntar la dirección IP al registro ni instalar una cookie de rastreo para esa medición. Google Analytics 4, Cloudflare Web Analytics y PostHog también pueden estar habilitados. El píxel opcional de CityBeat para sitios de negocios Premium no usa cookies y guarda totales diarios sin crear perfiles de visitantes. La medición de correos se describe en la Política de Privacidad.'],
      ['Almacenamiento local', 'El sitio puede guardar en su dispositivo preferencias de interfaz, estado temporal de formularios o carrito, atribución de referidos y otros ajustes. Esa información permanece en el navegador salvo que una función la envíe a CityBeat.'],
      ['Sus opciones', 'Puede borrar o bloquear cookies y datos del sitio desde su navegador. Bloquear el almacenamiento esencial puede impedir el inicio de sesión, la continuidad del pago, preferencias guardadas, crédito de referidos y otras funciones solicitadas. Puede cancelar correos publicitarios con el enlace incluido en cada mensaje.'],
    ],
  },
} as const

export default function CookiesPage() {
  const locale = useLocale() as 'en' | 'es'
  const text = copy[locale] ?? copy.en
  return (
    <div className="min-h-screen bg-white">
      <Navigation rightSlot={<LocaleToggle />} />
      <div className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="mb-8 text-4xl font-bold">{text.title}</h1>
        <div className="prose prose-lg max-w-none space-y-6">
          {text.sections.map(([heading, body]) => <section key={heading}><h2 className="mb-3 mt-6 text-2xl font-bold">{heading}</h2><p className="text-gray-700">{body}</p></section>)}
          <p className="mt-12 text-sm text-gray-500">{text.updated}</p>
        </div>
      </div>
    </div>
  )
}
