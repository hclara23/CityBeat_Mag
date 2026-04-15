'use client'

import { useLocale } from '@/components/TranslationProvider'
import { Navigation } from '@citybeat/ui'

const copy = {
  en: {
    title: 'Privacy Policy',
    sections: [
      {
        heading: '1. Information We Collect',
        text: 'CityBeat Magazine collects information you voluntarily provide when subscribing to our newsletter, creating an advertiser account, or contacting us. This includes name, email address, phone number, and payment information.',
      },
      {
        heading: '2. How We Use Your Information',
        list: [
          'Send you our newsletter and editorial content',
          'Process payments for advertising services',
          'Communicate with you about your account',
          'Improve our services and user experience',
          'Comply with legal obligations',
        ],
      },
      {
        heading: '3. Data Security',
        text: 'We implement industry-standard security measures to protect your personal information from unauthorized access, alteration, disclosure, or destruction.',
      },
      {
        heading: '4. Third-Party Services',
        text: 'We use third-party services including Stripe for payment processing, Sanity for content management, and Supabase for data storage. These services have their own privacy policies.',
      },
      {
        heading: '5. Contact Us',
        text: 'If you have questions about this privacy policy, please contact us at contact@citybeatmag.co',
      },
    ],
    updated: 'Last updated: February 2024',
  },
  es: {
    title: 'Política de Privacidad',
    sections: [
      {
        heading: '1. Información que Recopilamos',
        text: 'CityBeat Magazine recopila la información que usted proporciona voluntariamente al suscribirse a nuestro boletín, crear una cuenta de anunciante o contactarnos. Esto incluye nombre, dirección de correo electrónico, número de teléfono e información de pago.',
      },
      {
        heading: '2. Cómo Usamos su Información',
        list: [
          'Enviarle nuestro boletín y contenido editorial',
          'Procesar pagos por servicios publicitarios',
          'Comunicarnos con usted sobre su cuenta',
          'Mejorar nuestros servicios y experiencia de usuario',
          'Cumplir con obligaciones legales',
        ],
      },
      {
        heading: '3. Seguridad de Datos',
        text: 'Implementamos medidas de seguridad estándar de la industria para proteger su información personal contra el acceso no autorizado, la alteración, divulgación o destrucción.',
      },
      {
        heading: '4. Servicios de Terceros',
        text: 'Usamos servicios de terceros, incluyendo Stripe para el procesamiento de pagos, Sanity para la gestión de contenido y Supabase para el almacenamiento de datos. Estos servicios tienen sus propias políticas de privacidad.',
      },
      {
        heading: '5. Contáctenos',
        text: 'Si tiene preguntas sobre esta política de privacidad, por favor contáctenos en contact@citybeatmag.co',
      },
    ],
    updated: 'Última actualización: febrero de 2024',
  },
}

export default function PrivacyPage() {
  const locale = useLocale() as 'en' | 'es'
  const localeCopy = copy[locale]

  return (
    <div className="min-h-screen bg-white">
      <Navigation />

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
