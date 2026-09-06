'use client'

import { useLocale } from '@/components/TranslationProvider'
import { Navigation } from '@citybeat/ui'
import { LocaleToggle } from '@/components/citybeat/LocaleToggle'

// This policy is a factual description of the running system, not boilerplate.
// The February 2024 version said CityBeat collected only what visitors
// "voluntarily provide" and shared it only with Stripe and Firebase. By 2026
// that was false in ways a regulator reads as deceptive under FTC Act §5:
// concierge chat text goes to Anthropic and is stored for 180 days, the AI audit
// log keeps prompts and outputs, directory contact data is acquired from public
// records and by crawling business websites rather than given to us, and
// marketing email carries an open pixel.
//
// Two rules for editing this file:
//   1. Every claim here must be true of the code as deployed. If a feature
//      changes what is collected, shared, or retained, this page changes in the
//      same commit — a policy that describes an older build is the liability.
//   2. Never describe a mechanism that does not exist. There is no self-service
//      export or delete endpoint, so the copy says requests are handled by a
//      person at the published contact address, which is a promise the operator
//      can actually keep.
//
// Retention figures below are the constants in force: lib/retention.ts (chat
// 180d, analytics 400d) and lib/ai-audit-server.ts (180d).

type PolicySection = { heading: string; text?: string; list?: string[] }
type PolicyCopy = { title: string; sections: PolicySection[]; updated: string }

const copy: Record<'en' | 'es', PolicyCopy> = {
  en: {
    title: 'Privacy Policy',
    sections: [
      {
        heading: '1. Who we are and what this covers',
        text: 'CityBeat Magazine publishes citybeatmag.co — bilingual local news for El Paso County and southern New Mexico, a business directory, advertising and sponsorship, a jobs board, and email newsletters. This policy describes what we collect across all of it, who it goes to, and how long we keep it. Where it says "we", that means CityBeat Magazine.',
      },
      {
        heading: '2. Information you give us',
        list: [
          'Contact details you type into a form: name, email address, phone number, business name and address.',
          'Account information when you sign in, including your email address and, if you turn it on, two-factor authentication settings.',
          'Business listing content you submit or edit: description, hours, photos, links, deals and events.',
          'Messages you send us — contact forms, lead and quote requests, replies to our emails.',
          'Payment details are entered on Stripe’s own hosted checkout page. We never receive or store your full card number.',
        ],
      },
      {
        heading: '3. Information collected automatically when you visit',
        list: [
          'Page views: the page path and the date. We do not store your IP address with a page view, and this measurement does not set a tracking cookie.',
          'Your IP address is used in the moment — to apply rate limits that keep the site up and to exclude staff and test traffic from our numbers. Rate-limit counters that include an IP are deleted about a day after the window closes.',
          'A sign-in session cookie (named __session) when you have an account. It is required for the site to know you are logged in.',
          'Google Analytics 4 and PostHog product analytics, when they are enabled for the site. These are operated by those companies under their own privacy policies and may set their own cookies.',
        ],
      },
      {
        heading: '4. What happens to what you type into the chat assistant',
        text: 'The chat assistant on citybeatmag.co is powered by Claude, an AI service operated by Anthropic. What you type is sent to Anthropic to generate a reply. A trimmed copy of the conversation (up to 500 characters of your message and of the reply) is stored so we can follow up on sales enquiries, and a separate audit record of AI prompts and outputs is kept so we can show how an automated decision or an automatically written article was produced. Both are deleted after 180 days. Please do not type anything into the chat that you would not want stored — health details, government identifiers, passwords, or confidential business information do not belong there.',
      },
      {
        heading: '5. AI and translation',
        text: 'CityBeat uses AI beyond the chat assistant: news briefs are drafted by Claude from public local reporting and reviewed by a person before publishing, marketing drafts are generated for listing owners to approve, and English and Spanish versions of content are produced by machine translation (DeepL, with Claude as a fallback). Text submitted for these purposes is processed by those providers, and the same 180-day AI audit record described above applies.',
      },
      {
        heading: '6. Business information we collect from other sources',
        text: 'Many directory listings were not submitted by their owner. We compile business information from public and third-party sources so the directory covers the region, and a business can then claim and correct its own listing.',
        list: [
          'Public government records — for example Texas state licence registries for trades and professions. Where a licence is held by an individual in their own name, that individual’s business name and business contact details can appear as a listing.',
          'Chamber of commerce and association member directories, event listings, and other public business directories.',
          'The business’s own website: we read publicly posted contact pages and may store a published business email address.',
          'If you are named in a listing and want it corrected or removed, see section 9. You do not have to claim the listing first, and there is no charge for removal.',
        ],
      },
      {
        heading: '7. Email, tracking, and how to stop it',
        text: 'We send two kinds of email. Transactional messages — verification codes, receipts, billing notices, and reports to listing owners — relate to something you or your business bought or signed up for. Marketing messages — the newsletter, outreach about claiming or upgrading a listing, offers, and abandoned-checkout reminders — are advertising.',
        list: [
          'Marketing messages contain a 1×1 image and link redirects that record whether the message was opened and which links were clicked, so we can stop contacting people who are not interested.',
          'Every marketing message carries an unsubscribe link and our postal address.',
          'Unsubscribing adds your address to a single suppression list that every one of our marketing systems checks before sending. It stops the newsletter, sales outreach, offers, and checkout reminders together.',
          'Unsubscribing stops email only. It does not remove a public business listing — ask us for that separately (section 9).',
        ],
      },
      {
        heading: '8. Who we share information with',
        text: 'We do not sell personal information and we do not share it for anyone else’s advertising. We use these service providers to run the site, and they receive only what their job requires:',
        list: [
          'Stripe — payments, subscriptions, invoices, and payouts.',
          'Google Cloud and Firebase — hosting, sign-in, and the database where this information is stored.',
          'Anthropic (Claude) — chat replies, drafted content, and fallback translation.',
          'DeepL — English/Spanish translation.',
          'Our email providers (an SMTP host, SendGrid, or Resend) and, where enabled, Twilio for text messages.',
          'Cloudflare — edge delivery and the scheduled jobs that fetch news.',
          'Google Analytics 4 and PostHog — website analytics, when enabled.',
          'We also disclose information when the law requires it, and to protect the rights and safety of CityBeat, our customers, and the public.',
          'When we publish to social platforms (for example Facebook), we post CityBeat content only — not your personal information.',
        ],
      },
      {
        heading: '9. Your choices: access, correction, and deletion',
        text: 'Use the contact page at /contact and choose "My data" — that reaches a person directly and starts the clock immediately. You can also write to contact@citybeatmag.co with "Privacy request" in the subject line. Tell us what you want: a copy of what we hold about you, a correction, deletion of your personal information, or removal of a business listing that names you. Requests are handled by a person — there is no automated self-service portal — and we aim to respond within 30 days. We may ask you to confirm that you control the email address, phone number, or listing in question, so that we do not act on someone else’s behalf by mistake. You can also unsubscribe from any marketing email using the link in that email. Some records must be kept even after a deletion request, including the payment and tax records Stripe and the law require us to retain.',
      },
      {
        heading: '10. How long we keep information',
        list: [
          'Chat assistant conversations: 180 days.',
          'AI prompt-and-output audit records: 180 days.',
          'Page-view analytics: about 13 months.',
          'Rate-limit records that include an IP address: about one day after the limit window ends.',
          'Account, listing, subscription, and payment records: for as long as the account or listing is active, and afterwards for as long as tax, accounting, and dispute-resolution obligations require.',
          'Unsubscribe records are kept permanently — that is what makes an unsubscribe stick.',
        ],
      },
      {
        heading: '11. Security',
        text: 'Access to the administrative systems requires a verified account, and staff accounts require two-factor authentication. Payment card data is handled by Stripe and never touches our servers. No system is perfectly secure and we do not claim otherwise; if a breach affects your information we will notify you as the law requires.',
      },
      {
        heading: '12. Children',
        text: 'CityBeat is a general-audience local news service, is not directed to children under 13, and we do not knowingly collect their personal information. If you believe a child has given us information, write to contact@citybeatmag.co and we will delete it.',
      },
      {
        heading: '13. Changes to this policy',
        text: 'When what we collect or share changes, this page changes with it and the date below is updated. Material changes will be announced on the site.',
      },
      {
        heading: '14. Contact us',
        text: 'Questions about this policy, or a privacy request: contact@citybeatmag.co — CityBeat Media Group, El Paso, Texas, USA.',
      },
    ],
    updated: 'Last updated: September 2026',
  },
  es: {
    title: 'Política de Privacidad',
    sections: [
      {
        heading: '1. Quiénes somos y qué cubre esta política',
        text: 'CityBeat Magazine publica citybeatmag.co: noticias locales bilingües para el condado de El Paso y el sur de Nuevo México, un directorio de negocios, publicidad y patrocinios, una bolsa de trabajo y boletines por correo. Esta política describe qué recopilamos en todo ello, con quién se comparte y cuánto tiempo lo conservamos. Cuando decimos "nosotros", nos referimos a CityBeat Magazine.',
      },
      {
        heading: '2. Información que usted nos proporciona',
        list: [
          'Datos de contacto que escribe en un formulario: nombre, correo electrónico, teléfono, nombre y dirección del negocio.',
          'Información de su cuenta al iniciar sesión, incluido su correo electrónico y, si la activa, la configuración de verificación en dos pasos.',
          'Contenido de la ficha de su negocio que envía o edita: descripción, horarios, fotos, enlaces, ofertas y eventos.',
          'Mensajes que nos envía: formularios de contacto, solicitudes de cotización y respuestas a nuestros correos.',
          'Los datos de pago se ingresan en la página de pago alojada por Stripe. Nunca recibimos ni almacenamos el número completo de su tarjeta.',
        ],
      },
      {
        heading: '3. Información que se recopila automáticamente al visitar el sitio',
        list: [
          'Vistas de página: la ruta de la página y la fecha. No guardamos su dirección IP junto con la vista de página y esta medición no instala una cookie de seguimiento.',
          'Su dirección IP se usa en el momento: para aplicar límites de velocidad que mantienen el sitio en pie y para excluir de las cifras el tráfico del personal y de pruebas. Los contadores de límite que incluyen una IP se eliminan aproximadamente un día después de cerrarse la ventana.',
          'Una cookie de sesión (llamada __session) cuando tiene una cuenta. Es necesaria para que el sitio sepa que inició sesión.',
          'Google Analytics 4 y la analítica de producto PostHog, cuando están habilitadas para el sitio. Las operan esas empresas bajo sus propias políticas de privacidad y pueden instalar sus propias cookies.',
        ],
      },
      {
        heading: '4. Qué ocurre con lo que escribe en el asistente de chat',
        text: 'El asistente de chat de citybeatmag.co funciona con Claude, un servicio de inteligencia artificial operado por Anthropic. Lo que usted escribe se envía a Anthropic para generar una respuesta. Se guarda una copia recortada de la conversación (hasta 500 caracteres de su mensaje y de la respuesta) para poder dar seguimiento a consultas comerciales, y por separado se guarda un registro de auditoría de las instrucciones y respuestas de IA para poder demostrar cómo se produjo una decisión automatizada o un artículo escrito automáticamente. Ambos se eliminan a los 180 días. Por favor no escriba en el chat nada que no quiera que quede almacenado: datos de salud, identificaciones oficiales, contraseñas o información confidencial de su negocio no van ahí.',
      },
      {
        heading: '5. Inteligencia artificial y traducción',
        text: 'CityBeat usa IA más allá del chat: los boletines de noticias los redacta Claude a partir de reportajes locales públicos y una persona los revisa antes de publicarlos, se generan borradores de marketing para que los aprueben los dueños de las fichas, y las versiones en inglés y español se producen con traducción automática (DeepL, con Claude como respaldo). El texto enviado para estos fines es procesado por esos proveedores y se aplica el mismo registro de auditoría de IA de 180 días descrito arriba.',
      },
      {
        heading: '6. Información de negocios que obtenemos de otras fuentes',
        text: 'Muchas fichas del directorio no fueron enviadas por su dueño. Recopilamos información de negocios de fuentes públicas y de terceros para que el directorio cubra la región, y después el negocio puede reclamar y corregir su propia ficha.',
        list: [
          'Registros públicos de gobierno, por ejemplo los registros estatales de licencias de oficios y profesiones de Texas. Cuando la licencia está a nombre de una persona física, el nombre comercial y los datos de contacto profesional de esa persona pueden aparecer como una ficha.',
          'Directorios de socios de cámaras de comercio y asociaciones, listados de eventos y otros directorios públicos de negocios.',
          'El sitio web del propio negocio: leemos las páginas de contacto publicadas y podemos guardar una dirección de correo comercial publicada.',
          'Si usted aparece nombrado en una ficha y quiere corregirla o eliminarla, vea la sección 9. No necesita reclamar la ficha primero y la eliminación no tiene costo.',
        ],
      },
      {
        heading: '7. Correo, seguimiento y cómo detenerlo',
        text: 'Enviamos dos tipos de correo. Los mensajes transaccionales —códigos de verificación, recibos, avisos de facturación e informes a los dueños de fichas— se refieren a algo que usted o su negocio compró o solicitó. Los mensajes de marketing —el boletín, mensajes para reclamar o mejorar una ficha, ofertas y recordatorios de pagos no completados— son publicidad.',
        list: [
          'Los mensajes de marketing incluyen una imagen de 1×1 y redirecciones de enlaces que registran si el mensaje se abrió y en qué enlaces se hizo clic, para dejar de contactar a quien no está interesado.',
          'Todo mensaje de marketing lleva un enlace para cancelar la suscripción y nuestra dirección postal.',
          'Al cancelar la suscripción, su dirección entra en una única lista de supresión que todos nuestros sistemas de marketing consultan antes de enviar. Detiene a la vez el boletín, los mensajes de ventas, las ofertas y los recordatorios de pago.',
          'Cancelar la suscripción solo detiene el correo. No elimina una ficha pública del directorio: eso se pide por separado (sección 9).',
        ],
      },
      {
        heading: '8. Con quién compartimos la información',
        text: 'No vendemos información personal ni la compartimos para la publicidad de terceros. Usamos estos proveedores para operar el sitio y solo reciben lo que su función requiere:',
        list: [
          'Stripe: pagos, suscripciones, facturas y transferencias.',
          'Google Cloud y Firebase: alojamiento, inicio de sesión y la base de datos donde se guarda esta información.',
          'Anthropic (Claude): respuestas del chat, borradores de contenido y traducción de respaldo.',
          'DeepL: traducción inglés/español.',
          'Nuestros proveedores de correo (un servidor SMTP, SendGrid o Resend) y, cuando está habilitado, Twilio para mensajes de texto.',
          'Cloudflare: entrega en el borde y las tareas programadas que traen noticias.',
          'Google Analytics 4 y PostHog: analítica del sitio, cuando están habilitados.',
          'También divulgamos información cuando la ley lo exige y para proteger los derechos y la seguridad de CityBeat, de nuestros clientes y del público.',
          'Cuando publicamos en redes sociales (por ejemplo Facebook) publicamos contenido de CityBeat, no su información personal.',
        ],
      },
      {
        heading: '9. Sus opciones: acceso, corrección y eliminación',
        text: 'Escríbanos a contact@citybeatmag.co con "Solicitud de privacidad" en el asunto e indíquenos qué desea: una copia de lo que tenemos sobre usted, una corrección, la eliminación de su información personal o la eliminación de una ficha de negocio que lo nombra. Las solicitudes las atiende una persona —no hay un portal automático de autoservicio— y procuramos responder dentro de 30 días. Es posible que le pidamos confirmar que controla el correo, el teléfono o la ficha en cuestión, para no actuar por error en nombre de otra persona. También puede cancelar la suscripción a cualquier correo de marketing con el enlace incluido en ese correo. Algunos registros deben conservarse incluso después de una solicitud de eliminación, incluidos los registros de pago y fiscales que Stripe y la ley nos obligan a mantener.',
      },
      {
        heading: '10. Cuánto tiempo conservamos la información',
        list: [
          'Conversaciones del asistente de chat: 180 días.',
          'Registros de auditoría de instrucciones y respuestas de IA: 180 días.',
          'Analítica de vistas de página: unos 13 meses.',
          'Registros de límite de velocidad que incluyen una dirección IP: aproximadamente un día después de cerrarse la ventana.',
          'Registros de cuenta, ficha, suscripción y pagos: mientras la cuenta o la ficha esté activa y, después, mientras lo exijan las obligaciones fiscales, contables y de resolución de disputas.',
          'Los registros de cancelación de suscripción se conservan de forma permanente: es lo que hace que la cancelación se respete.',
        ],
      },
      {
        heading: '11. Seguridad',
        text: 'El acceso a los sistemas administrativos requiere una cuenta verificada, y las cuentas del personal requieren verificación en dos pasos. Los datos de tarjetas los maneja Stripe y nunca pasan por nuestros servidores. Ningún sistema es perfectamente seguro y no afirmamos lo contrario; si una brecha afecta su información, se lo notificaremos conforme lo exige la ley.',
      },
      {
        heading: '12. Menores',
        text: 'CityBeat es un servicio de noticias locales para público general, no está dirigido a menores de 13 años y no recopilamos a sabiendas su información personal. Si cree que un menor nos dio información, escriba a contact@citybeatmag.co y la eliminaremos.',
      },
      {
        heading: '13. Cambios a esta política',
        text: 'Cuando cambie lo que recopilamos o compartimos, esta página cambia con ello y se actualiza la fecha de abajo. Los cambios importantes se anunciarán en el sitio.',
      },
      {
        heading: '14. Contáctenos',
        text: 'Preguntas sobre esta política o una solicitud de privacidad: contact@citybeatmag.co — CityBeat Media Group, El Paso, Texas, EE. UU.',
      },
    ],
    updated: 'Última actualización: septiembre de 2026',
  },
}

export default function PrivacyPage() {
  const locale = useLocale() as 'en' | 'es'
  const localeCopy = copy[locale] ?? copy.en

  return (
    <div className="min-h-screen bg-white">
      <Navigation rightSlot={<LocaleToggle />} />

      <div className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-4xl font-bold mb-8">{localeCopy.title}</h1>

        <div className="prose prose-lg max-w-none space-y-6">
          {localeCopy.sections.map((section) => (
            <section key={section.heading}>
              <h2 className="text-2xl font-bold mt-6 mb-3">{section.heading}</h2>
              {section.text ? <p className="text-gray-700">{section.text}</p> : null}
              {section.list ? (
                <ul className="list-disc pl-6 text-gray-700 space-y-2">
                  {section.list.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))}
          <p className="text-sm text-gray-500 mt-12">{localeCopy.updated}</p>
        </div>
      </div>
    </div>
  )
}
