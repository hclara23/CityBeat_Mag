'use client'

import { useLocale } from '@/components/TranslationProvider'
import { Navigation } from '@citybeat/ui'

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
        heading: '7. Modifications',
        text: 'CityBeat Magazine may revise these terms of service for its website at any time without notice. By using this website, you are agreeing to be bound by the then current version of these terms of service.',
      },
      {
        heading: '8. Governing Law',
        text: 'These terms and conditions are governed by and construed in accordance with the laws of Texas, and you irrevocably submit to the exclusive jurisdiction of the courts in that location.',
      },
    ],
    updated: 'Last updated: February 2024',
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
        heading: '7. Modificaciones',
        text: 'CityBeat Magazine puede revisar estos términos de servicio para su sitio web en cualquier momento sin previo aviso. Al usar este sitio web, usted acepta regirse por la versión vigente de estos términos de servicio.',
      },
      {
        heading: '8. Ley Aplicable',
        text: 'Estos términos y condiciones se rigen e interpretan de acuerdo con las leyes de Texas, y usted se somete irrevocablemente a la jurisdicción exclusiva de los tribunales en esa ubicación.',
      },
    ],
    updated: 'Última actualización: febrero de 2024',
  },
}

export default function TermsPage() {
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
