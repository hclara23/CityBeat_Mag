import type { IntakeSchema } from '@/lib/sales-intake'

// Spanish for the post-payment fulfillment wizard.
//
// The bug this closes: /api/sales/orders/[orderId]/intake deliberately mails a
// Spanish buyer an /es/fulfill/... resume link (it reads order.locale, stamped
// at checkout), and that page then rendered a wholly English multi-step form.
// A Spanish-speaking owner could not finish the brief, so intake_status never
// reached 'submitted', the paid product was never published, and the single
// resume email is stamped sent exactly once — paid, undelivered, no path back.
//
// The field copy itself lives in lib/sales-intake.ts, which takes no locale and
// is shared with the server (sanitizer, required-field check, admin views).
// Rather than fork that schema, this translates the schema the API returns, at
// render time, keyed by the English string. INVARIANT: only human-visible copy
// is translated — field ids and select option VALUES are what the server
// sanitizer matches on, so translating either would silently discard the
// customer's answers. localizeIntakeSchema never touches them, and
// intake-i18n.test.ts pins that.

export const FULFILL_COPY = {
  en: {
    loading: 'Opening your paid order...',
    accessEyebrow: 'Order access',
    accessTitle: 'We could not open this brief.',
    accessHelp: (orderId: string) => `Email support@citybeatmag.co and include order reference ${orderId}.`,
    doneEyebrow: 'Payment and brief complete',
    doneTitle: 'Your order is ready for CityBeat.',
    doneBody: (product: string, email: string) =>
      `Our team has the information and files needed to begin ${product}. We will use ${email} if anything needs clarification.`,
    orderReference: 'Order reference',
    headerEyebrow: 'Payment received / private order brief',
    autosave: (email: string) => `Your answers save automatically. A private resume link was sent to ${email}.`,
    paid: 'Paid',
    progressLabel: (percent: number) => `${percent}% complete`,
    progressText: (percent: number) => `${percent}% of required details complete`,
    saving: 'Saving...',
    saveFailed: 'Not saved - retrying',
    saved: 'Progress saved',
    stepsNav: 'Order brief steps',
    privateTitle: 'Private and secure',
    privateBody: 'This link opens your order brief. Card information remains with Stripe and is never stored here.',
    chooseOne: 'Choose one',
    yes: 'Yes',
    remove: 'Remove',
    uploading: 'Uploading...',
    replaceImage: 'Replace image',
    chooseImage: 'Choose image',
    imageHint: 'JPEG, PNG, WebP, or GIF / 10 MB max',
    uploadedAlt: 'Uploaded order asset',
    back: 'Back',
    saveAndContinue: 'Save and continue',
    errorOpen: 'Could not open this order.',
    errorSave: 'Could not save your progress.',
    errorUpload: 'Could not upload this image.',
    errorRequired: 'Complete the required fields before submitting.',
    errorSubmit: 'Could not submit your brief.',
  },
  es: {
    loading: 'Abriendo tu pedido pagado...',
    accessEyebrow: 'Acceso al pedido',
    accessTitle: 'No pudimos abrir este formulario.',
    accessHelp: (orderId: string) =>
      `Escribe a support@citybeatmag.co e incluye la referencia del pedido ${orderId}.`,
    doneEyebrow: 'Pago y formulario completos',
    doneTitle: 'Tu pedido está listo para CityBeat.',
    doneBody: (product: string, email: string) =>
      `Nuestro equipo ya tiene la información y los archivos para comenzar ${product}. Te escribiremos a ${email} si algo necesita aclararse.`,
    orderReference: 'Referencia del pedido',
    headerEyebrow: 'Pago recibido / formulario privado del pedido',
    autosave: (email: string) =>
      `Tus respuestas se guardan solas. Enviamos un enlace privado para continuar a ${email}.`,
    paid: 'Pagado',
    progressLabel: (percent: number) => `${percent}% completado`,
    progressText: (percent: number) => `${percent}% de los datos obligatorios completos`,
    saving: 'Guardando...',
    saveFailed: 'No se guardó - reintentando',
    saved: 'Progreso guardado',
    stepsNav: 'Pasos del formulario',
    privateTitle: 'Privado y seguro',
    privateBody:
      'Este enlace abre el formulario de tu pedido. Los datos de tu tarjeta se quedan en Stripe y nunca se guardan aquí.',
    chooseOne: 'Elige una opción',
    yes: 'Sí',
    remove: 'Quitar',
    uploading: 'Subiendo...',
    replaceImage: 'Reemplazar imagen',
    chooseImage: 'Elegir imagen',
    imageHint: 'JPEG, PNG, WebP o GIF / 10 MB máximo',
    uploadedAlt: 'Archivo subido del pedido',
    back: 'Atrás',
    saveAndContinue: 'Guardar y continuar',
    errorOpen: 'No pudimos abrir este pedido.',
    errorSave: 'No pudimos guardar tu progreso.',
    errorUpload: 'No pudimos subir esta imagen.',
    errorRequired: 'Completa los campos obligatorios antes de enviar.',
    errorSubmit: 'No pudimos enviar tu formulario.',
  },
} as const

export type FulfillCopy = (typeof FULFILL_COPY)['en']

// Every human-visible string in lib/sales-intake.ts, keyed by its English text.
// Keyed by text rather than by field id on purpose: the same id carries
// different labels between products (target_url is 'Destination URL' in a
// newsletter sponsorship and 'Link to promote' in a social promotion), so an
// id-keyed map would mistranslate one of them.
export const INTAKE_ES: Record<string, string> = {
  // Shared step eyebrows
  'Step 1': 'Paso 1',
  'Step 2': 'Paso 2',
  'Step 3': 'Paso 3',

  // Directory listing
  'Build your business listing': 'Crea la ficha de tu negocio',
  'Send listing for review': 'Enviar ficha a revisión',
  'Business essentials': 'Datos básicos del negocio',
  'The information readers use to recognize and contact you.':
    'La información que los lectores usan para reconocerte y contactarte.',
  'Public business name': 'Nombre público del negocio',
  'Primary category': 'Categoría principal',
  'Restaurant, salon, attorney...': 'Restaurante, salón, abogado...',
  'What makes the business worth visiting?': '¿Por qué vale la pena visitar tu negocio?',
  'A concise, customer-friendly description': 'Una descripción breve y clara para el cliente',
  'Public phone': 'Teléfono público',
  Website: 'Sitio web',
  'https://': 'https://',
  'Location and hours': 'Ubicación y horario',
  'Help customers know where and when to find you.':
    'Ayuda a los clientes a saber dónde y cuándo encontrarte.',
  'Street address': 'Dirección',
  City: 'Ciudad',
  State: 'Estado',
  TX: 'TX',
  'ZIP code': 'Código postal',
  'Business hours': 'Horario de atención',
  'Mon-Fri 9-6; Sat 10-4; Sun closed': 'Lun-Vie 9-6; Sáb 10-4; Dom cerrado',
  'Service area, if applicable': 'Zona de servicio, si aplica',
  'Brand and discovery': 'Marca y presencia',
  'Add the visuals and links that make a premium listing feel complete.':
    'Agrega las imágenes y los enlaces que hacen que una ficha Premium se vea completa.',
  Logo: 'Logotipo',
  'Cover photo': 'Foto de portada',
  'Gallery photos': 'Fotos de la galería',
  'Add up to 8 strong photos.': 'Agrega hasta 8 fotos de buena calidad.',
  Instagram: 'Instagram',
  Facebook: 'Facebook',
  'Anything our team should know?': '¿Algo más que nuestro equipo deba saber?',

  // Job posting
  'Create your job posting': 'Crea tu oferta de empleo',
  'Send job for review': 'Enviar empleo a revisión',
  'The role': 'El puesto',
  'Give candidates the facts they use to decide whether the job fits.':
    'Dale a los candidatos los datos que usan para decidir si el puesto les conviene.',
  'Job title': 'Título del puesto',
  Company: 'Empresa',
  'Job category': 'Categoría del empleo',
  'Hospitality and food service': 'Hotelería y servicio de alimentos',
  Healthcare: 'Salud',
  Education: 'Educación',
  'Retail and sales': 'Comercio y ventas',
  'Professional services': 'Servicios profesionales',
  'Skilled trades': 'Oficios especializados',
  Technology: 'Tecnología',
  'Government and nonprofit': 'Gobierno y organizaciones sin fines de lucro',
  Other: 'Otro',
  'Employment type': 'Tipo de empleo',
  'Full time': 'Tiempo completo',
  'Part time': 'Medio tiempo',
  Contract: 'Por contrato',
  Temporary: 'Temporal',
  Internship: 'Prácticas',
  Workplace: 'Modalidad de trabajo',
  'On site': 'Presencial',
  Hybrid: 'Híbrido',
  Remote: 'Remoto',
  'Job location': 'Ubicación del empleo',
  'El Paso, TX': 'El Paso, TX',
  'Pay and benefits': 'Sueldo y prestaciones',
  'Clear compensation improves applicant quality and trust.':
    'Un sueldo claro mejora la calidad de los candidatos y la confianza.',
  'Minimum pay': 'Sueldo mínimo',
  'Maximum pay': 'Sueldo máximo',
  'Pay period': 'Periodo de pago',
  'Per hour': 'Por hora',
  'Per year': 'Por año',
  'Per project': 'Por proyecto',
  'Benefits and perks': 'Prestaciones y beneficios',
  'Health coverage, PTO, tips, schedule flexibility...':
    'Seguro médico, vacaciones pagadas, propinas, horario flexible...',
  Schedule: 'Horario',
  'Weekdays, evenings, rotating weekends...': 'Entre semana, tardes, fines de semana rotativos...',
  'Description and application': 'Descripción y postulación',
  'Tell candidates what they will do, what they need, and how to apply.':
    'Dile a los candidatos qué harán, qué necesitan y cómo postularse.',
  'Job summary': 'Resumen del puesto',
  Responsibilities: 'Responsabilidades',
  Qualifications: 'Requisitos',
  'Application URL': 'Enlace para postularse',
  'Application email': 'Correo para postulaciones',
  'Application deadline': 'Fecha límite para postularse',
  'Company logo': 'Logotipo de la empresa',

  // Featured event
  'Create your featured event': 'Crea tu evento destacado',
  'Send event for review': 'Enviar evento a revisión',
  'Event essentials': 'Datos básicos del evento',
  'The what, when, and format.': 'Qué es, cuándo es y en qué formato.',
  'Event title': 'Nombre del evento',
  Category: 'Categoría',
  'Music, arts, family, food...': 'Música, arte, familia, comida...',
  'Start date': 'Fecha de inicio',
  'Start time': 'Hora de inicio',
  'End date': 'Fecha de término',
  'End time': 'Hora de término',
  Timezone: 'Zona horaria',
  'Mountain Time': 'Hora de la Montaña',
  'Central Time': 'Hora del Centro',
  Format: 'Formato',
  'In person': 'Presencial',
  Online: 'En línea',
  'Place and tickets': 'Lugar y boletos',
  'Everything guests need to arrive or join.': 'Todo lo que los asistentes necesitan para llegar o conectarse.',
  'Venue or platform': 'Lugar o plataforma',
  'Address or online details': 'Dirección o datos de conexión',
  'Ticket or registration URL': 'Enlace de boletos o registro',
  Price: 'Precio',
  'Free, $15, $10-$35...': 'Gratis, $15, $10-$35...',
  'Age guidance': 'Restricción de edad',
  'Accessibility information': 'Información de accesibilidad',
  'Promotion details': 'Detalles de promoción',
  'Give CityBeat the story and artwork to promote it well.':
    'Dale a CityBeat la historia y las imágenes para promocionarlo bien.',
  'Event description': 'Descripción del evento',
  Organizer: 'Organizador',
  'Organizer email': 'Correo del organizador',
  'Event website': 'Sitio web del evento',
  'Event artwork': 'Imagen del evento',

  // Newsletter sponsorship
  'Prepare your newsletter sponsorship': 'Prepara tu patrocinio del boletín',
  'Send campaign for review': 'Enviar campaña a revisión',
  'Campaign goal': 'Objetivo de la campaña',
  'Focus the placement on one clear outcome.': 'Enfoca el espacio en un solo resultado claro.',
  'Campaign name': 'Nombre de la campaña',
  'Primary objective': 'Objetivo principal',
  'Brand awareness': 'Reconocimiento de marca',
  'Website traffic': 'Tráfico al sitio web',
  'Promote an offer': 'Promocionar una oferta',
  'Promote an event': 'Promocionar un evento',
  'Preferred start date': 'Fecha de inicio preferida',
  'Destination URL': 'Enlace de destino',
  'Audience or targeting notes': 'Notas sobre el público objetivo',
  'Message and creative': 'Mensaje y material creativo',
  'Short, direct creative performs best in an inbox.':
    'Un mensaje corto y directo funciona mejor en el correo.',
  Headline: 'Titular',
  Message: 'Mensaje',
  'Button text': 'Texto del botón',
  'Learn more': 'Más información',
  'Primary image': 'Imagen principal',
  'Brand or legal notes': 'Notas de marca o legales',

  // Category banner
  'Prepare your category banner': 'Prepara tu banner de categoría',
  'Send banner for review': 'Enviar banner a revisión',
  Placement: 'Ubicación',
  'Match the banner to the most relevant readers.': 'Dirige el banner a los lectores más relevantes.',
  'Requested category': 'Categoría solicitada',
  'Click-through URL': 'Enlace al que lleva el clic',
  'Banner creative': 'Diseño del banner',
  'Supply a clear message and a strong visual.': 'Aporta un mensaje claro y una imagen fuerte.',
  'Supporting copy': 'Texto de apoyo',
  'Call to action': 'Llamado a la acción',
  'Banner artwork': 'Imagen del banner',
  'Image description for accessibility': 'Descripción de la imagen para accesibilidad',

  // Social promotion
  'Prepare your social media promotion': 'Prepara tu promoción en redes sociales',
  'Send promotion for review': 'Enviar promoción a revisión',
  'What to promote': 'Qué promocionar',
  'Tell CityBeat what to feature on its social channels.':
    'Dile a CityBeat qué destacar en sus redes sociales.',
  'Business name': 'Nombre del negocio',
  'Link to promote': 'Enlace a promocionar',
  'Preferred platforms': 'Plataformas preferidas',
  'All channels (recommended)': 'Todos los canales (recomendado)',
  'Facebook only': 'Solo Facebook',
  'Threads only': 'Solo Threads',
  'Short, specific posts perform best.': 'Las publicaciones cortas y concretas funcionan mejor.',
  'Post caption': 'Texto de la publicación',
  'What should the post say?': '¿Qué debe decir la publicación?',
  Hashtags: 'Hashtags',
  '#ElPaso #ShopLocal': '#ElPaso #ShopLocal',
  Image: 'Imagen',
  'Anything to avoid or include?': '¿Algo que debamos evitar o incluir?',

  // Sponsored story
  'Brief your sponsored story': 'Describe tu historia patrocinada',
  'Send story brief': 'Enviar resumen de la historia',
  'The story': 'La historia',
  'Tell our team what readers should understand and remember.':
    'Dile a nuestro equipo qué deben entender y recordar los lectores.',
  'What should this story accomplish?': '¿Qué debe lograr esta historia?',
  'Headline idea': 'Idea de titular',
  'Most important message': 'Mensaje más importante',
  'Company background': 'Antecedentes de la empresa',
  'Desired publish date': 'Fecha de publicación deseada',
  'Sources and assets': 'Fuentes y materiales',
  'Give the editor accurate material to work from.':
    'Dale al editor material preciso con el cual trabajar.',
  'Spokesperson and title': 'Vocero y su cargo',
  'Approved quotes or facts': 'Citas o datos aprobados',
  'Story images': 'Imágenes de la historia',

  // Custom order
  'Complete your custom order brief': 'Completa el formulario de tu pedido personalizado',
  'Send custom brief': 'Enviar formulario personalizado',
  'What we are delivering': 'Qué vamos a entregar',
  'Confirm the approved outcome and timing.': 'Confirma el resultado aprobado y las fechas.',
  'Approved deliverable': 'Entregable aprobado',
  'Customer goal': 'Objetivo del cliente',
  'Hard deadline, if any': 'Fecha límite estricta, si la hay',
  'Copy and assets': 'Textos y materiales',
  'Send everything our team needs to begin.': 'Envía todo lo que nuestro equipo necesita para empezar.',
  'Copy, message, or instructions': 'Textos, mensaje o instrucciones',
  Images: 'Imágenes',
  'Final approval contact': 'Contacto para la aprobación final',
}

// Untranslated copy falls back to the English source string rather than to an
// empty label: a half-translated form is bad, an unlabelled field is unusable.
function es(value: string | undefined): string | undefined {
  if (!value) return value
  return INTAKE_ES[value] || value
}

/**
 * Return the schema with human-visible copy in `locale`. Field ids and select
 * option values are carried through unchanged — the server matches on those.
 */
export function localizeIntakeSchema(schema: IntakeSchema, locale: string): IntakeSchema {
  if (locale !== 'es') return schema
  return {
    ...schema,
    title: es(schema.title) as string,
    completionLabel: es(schema.completionLabel) as string,
    sections: schema.sections.map((section) => ({
      ...section,
      eyebrow: es(section.eyebrow) as string,
      title: es(section.title) as string,
      description: es(section.description) as string,
      fields: section.fields.map((field) => ({
        ...field,
        label: es(field.label) as string,
        placeholder: es(field.placeholder),
        help: es(field.help),
        options: field.options?.map((option) => ({ value: option.value, label: es(option.label) as string })),
      })),
    })),
  }
}
