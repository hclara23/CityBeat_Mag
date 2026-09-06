'use client'

import { useLocale } from '@/components/TranslationProvider'
import { Navigation } from '@citybeat/ui'
import { LocaleToggle } from '@/components/citybeat/LocaleToggle'

const copy = {
  en: {
    title: 'Terms of Service',
    sections: [
      {
        heading: '1. Acceptance of Terms',
        text: 'By accessing and using CityBeat Magazine, you accept and agree to be bound by the terms and provisions of this agreement. If you do not agree to abide by the above, please do not use this service.',
      },
      {
        heading: '2. Use License',
        text: 'Permission is granted to temporarily download one copy of the materials (information or software) on CityBeat Magazine for personal, non-commercial transitory viewing only. This is the grant of a license, not a transfer of title, and under this license you may not:',
        list: [
          'Modify or copy the materials',
          'Use the materials for any commercial purpose or for any public display',
          'Attempt to reverse compile, reverse engineer, disassemble, or otherwise reverse engineer any software',
          'Remove any copyright or proprietary notation from the materials',
          'Transfer the materials to another person or "mirror" the materials on any other server',
        ],
      },
      {
        heading: '3. Disclaimer',
        text: 'The materials on CityBeat Magazine\'s website are provided on an "as is" basis. CityBeat Magazine makes no warranties, expressed or implied, and hereby disclaims and negates all other warranties including, without limitation, implied warranties or conditions of merchantability, fitness for a particular purpose, or non-infringement of intellectual property or other violation of rights.',
      },
      {
        heading: '4. Limitations',
        text: 'In no event shall CityBeat Magazine or its suppliers be liable for any damages (including, without limitation, damages for loss of data or profit, or due to business interruption) arising out of the use or inability to use the materials on CityBeat Magazine, even if CityBeat Magazine or an authorized representative has been notified orally or in writing of the possibility of such damage.',
      },
      {
        heading: '5. Accuracy of Materials',
        text: 'The materials appearing on CityBeat Magazine could include technical, typographical, or photographic errors. CityBeat Magazine does not warrant that any of the materials on its website are accurate, complete, or current. CityBeat Magazine may make changes to the materials contained on its website at any time without notice.',
      },
      {
        heading: '6. Links',
        text: 'CityBeat Magazine has not reviewed all of the sites linked to its website and is not responsible for the contents of any such linked site. The inclusion of any link does not imply endorsement by CityBeat Magazine of the site. Use of any such linked website is at the user\'s own risk.',
      },
      {
        heading: '7. Paid Services and Subscriptions',
        text: 'CityBeat sells directory listing plans, advertising, sponsored content, job postings, and related services. Prices are shown before you pay and are charged through Stripe; we never see or store your card details. Directory listing plans and some advertising products are SUBSCRIPTIONS: unless the checkout page says otherwise, the amount shown is charged every billing period (monthly or yearly, as selected) and RENEWS AUTOMATICALLY at the same price until you cancel. Where a listing covers multiple locations, the price shown is per location and the total is calculated at checkout.',
      },
      {
        heading: '8. Cancellation',
        text: 'You can cancel a subscription at any time from Billing in your dashboard, which opens the Stripe customer portal. No email or phone call is required. Cancelling stops future charges. You keep what you paid for until the end of the period you have already paid for; after that, a directory listing returns to the free Basic tier and any paid placements (including Sponsored positioning) end. We do not delete your listing when you cancel.',
      },
      {
        heading: '9. Refunds',
        text: 'Refund requests are reviewed by a person — email hello@citybeatmag.co and tell us what happened. A refund reverses what it paid for: a refunded directory subscription returns the listing to the Basic tier, and a refunded advertising placement is taken down. If you believe a charge is wrong, please contact us before disputing it with your bank; we can usually resolve it faster than a dispute can.',
      },
      {
        heading: '10. Directory Listings and Claims',
        text: 'Claiming a business listing requires us to verify that you represent that business. We may decline a claim we cannot verify. If we decline a claim you paid for, we cancel the subscription so you are not billed again and will contact you about the payment already made. Listing content you provide must be accurate and yours to publish; we may edit or remove content that is not.',
      },
      {
        heading: '11. Modifications',
        text: 'CityBeat Magazine may revise these terms of service for its website at any time without notice. By using this website, you are agreeing to be bound by the then current version of these terms of service.',
      },
      {
        heading: '12. Governing Law',
        text: 'These terms and conditions are governed by and construed in accordance with the laws of Texas, and you irrevocably submit to the exclusive jurisdiction of the courts in that location.',
      },
    ],
    updated: 'Last updated: September 2026',
  },
  es: {
    title: 'Términos de Servicio',
    sections: [
      {
        heading: '1. Aceptación de los Términos',
        text: 'Al acceder y usar CityBeat Magazine, usted acepta y acuerda regirse por los términos y disposiciones de este acuerdo. Si no está de acuerdo con los términos anteriores, por favor no utilice este servicio.',
      },
      {
        heading: '2. Licencia de Uso',
        text: 'Se concede permiso para descargar temporalmente una copia de los materiales (información o software) en CityBeat Magazine para visualización personal, no comercial y transitoria. Esto es la concesión de una licencia, no una transferencia de título, y bajo esta licencia no puede:',
        list: [
          'Modificar o copiar los materiales',
          'Usar los materiales para cualquier propósito comercial o para cualquier exhibición pública',
          'Intentar descompilar, ingeniería inversa, desensamblar o de otra forma aplicar ingeniería inversa a cualquier software',
          'Eliminar cualquier notación de copyright o propiedad de los materiales',
          'Transferir los materiales a otra persona o "reflejar" los materiales en cualquier otro servidor',
        ],
      },
      {
        heading: '3. Descargo de Responsabilidad',
        text: 'Los materiales en el sitio web de CityBeat Magazine se proporcionan "tal cual". CityBeat Magazine no ofrece ninguna garantía, expresa o implícita, y por la presente renuncia y niega todas las demás garantías, incluyendo, sin limitación, garantías implícitas o condiciones de comerciabilidad, idoneidad para un propósito particular, o no infracción de propiedad intelectual u otra violación de derechos.',
      },
      {
        heading: '4. Limitaciones',
        text: 'En ningún caso CityBeat Magazine o sus proveedores serán responsables de ningún daño (incluyendo, sin limitación, daños por pérdida de datos o ganancias, o interrupción del negocio) que surja del uso o la incapacidad de usar los materiales en CityBeat Magazine, incluso si CityBeat Magazine o un representante autorizado ha sido notificado oralmente o por escrito de la posibilidad de dicho daño.',
      },
      {
        heading: '5. Precisión de los Materiales',
        text: 'Los materiales que aparecen en CityBeat Magazine podrían incluir errores técnicos, tipográficos o fotográficos. CityBeat Magazine no garantiza que ninguno de los materiales en su sitio web sea preciso, completo o actual. CityBeat Magazine puede realizar cambios en los materiales contenidos en su sitio web en cualquier momento sin previo aviso.',
      },
      {
        heading: '6. Enlaces',
        text: 'CityBeat Magazine no ha revisado todos los sitios vinculados a su sitio web y no es responsable del contenido de dichos sitios vinculados. La inclusión de cualquier enlace no implica respaldo por parte de CityBeat Magazine del sitio. El uso de cualquier sitio web vinculado es bajo su propio riesgo.',
      },
      {
        heading: '7. Servicios de Pago y Suscripciones',
        text: 'CityBeat vende planes de ficha en el directorio, publicidad, contenido patrocinado, ofertas de empleo y servicios relacionados. Los precios se muestran antes de pagar y se cobran a través de Stripe; nunca vemos ni guardamos los datos de su tarjeta. Los planes del directorio y algunos productos publicitarios son SUSCRIPCIONES: salvo que la página de pago indique lo contrario, el importe mostrado se cobra cada periodo de facturación (mensual o anual, según lo elegido) y SE RENUEVA AUTOMÁTICAMENTE al mismo precio hasta que usted la cancele. Cuando una ficha cubre varias ubicaciones, el precio mostrado es por ubicación y el total se calcula al pagar.',
      },
      {
        heading: '8. Cancelación',
        text: 'Puede cancelar una suscripción cuando quiera desde Facturación en su panel, que abre el portal de clientes de Stripe. No hace falta enviar un correo ni llamar. Al cancelar dejamos de cobrarle. Conserva lo que pagó hasta que termine el periodo ya pagado; después, la ficha vuelve al plan Básico gratuito y terminan las colocaciones pagadas (incluida la posición Patrocinada). No borramos su ficha al cancelar.',
      },
      {
        heading: '9. Reembolsos',
        text: 'Las solicitudes de reembolso las revisa una persona: escriba a hello@citybeatmag.co y cuéntenos qué pasó. Un reembolso revierte lo que pagó: una suscripción del directorio reembolsada devuelve la ficha al plan Básico, y una colocación publicitaria reembolsada se retira. Si cree que un cargo es incorrecto, contáctenos antes de disputarlo con su banco; normalmente podemos resolverlo más rápido que una disputa.',
      },
      {
        heading: '10. Fichas del Directorio y Reclamaciones',
        text: 'Reclamar la ficha de un negocio requiere que verifiquemos que usted representa a ese negocio. Podemos rechazar una reclamación que no podamos verificar. Si rechazamos una reclamación que usted pagó, cancelamos la suscripción para que no se le vuelva a cobrar y le contactaremos sobre el pago ya realizado. El contenido que aporte debe ser exacto y suyo para publicarlo; podemos editar o retirar contenido que no lo sea.',
      },
      {
        heading: '11. Modificaciones',
        text: 'CityBeat Magazine puede revisar estos términos de servicio para su sitio web en cualquier momento sin previo aviso. Al usar este sitio web, usted acepta regirse por la versión vigente de estos términos de servicio.',
      },
      {
        heading: '12. Ley Aplicable',
        text: 'Estos términos y condiciones se rigen e interpretan de acuerdo con las leyes de Texas, y usted se somete irrevocablemente a la jurisdicción exclusiva de los tribunales en esa ubicación.',
      },
    ],
    updated: 'Última actualización: septiembre de 2026',
  },
}

export default function TermsPage() {
  const locale = useLocale() as 'en' | 'es'
  const localeCopy = copy[locale]

  return (
    <div className="min-h-screen bg-white">
      <Navigation rightSlot={<LocaleToggle />} />

      <div className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-4xl font-bold mb-8">{localeCopy.title}</h1>

        <div className="prose prose-lg max-w-none space-y-6">
          {localeCopy.sections.map((section) => (
            <section key={section.heading}>
              <h2 className="text-2xl font-bold mt-6 mb-3">{section.heading}</h2>
              {section.text ? (
                <p className="text-gray-700">{section.text}</p>
              ) : null}
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
