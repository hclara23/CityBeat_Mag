export type Locale = 'en' | 'es'

type LocalizedText = {
  en: string
  es: string
}

type StoryDatum = {
  title: LocalizedText
  dek: LocalizedText
  category: LocalizedText
  image: string
  href: string
}

const topStoriesData: StoryDatum[] = [
  {
    title: {
      en: "The Neon Renaissance: Downtown's New Light",
      es: 'El Renacimiento Neón: la nueva luz del centro',
    },
    dek: {
      en: 'Artists, venues, and small businesses are turning late nights into a shared civic stage.',
      es: 'Artistas, locales y pequeños negocios convierten las noches en un escenario cívico compartido.',
    },
    category: {
      en: 'Arts',
      es: 'Artes',
    },
    image: 'https://picsum.photos/seed/citybeat-neon/1600/1000',
    href: '/briefs',
  },
  {
    title: {
      en: 'Midnight Tacos, Ranked Block By Block',
      es: 'Tacos de medianoche, clasificados cuadra por cuadra',
    },
    dek: {
      en: 'A practical guide to the stands, kitchens, and counters worth leaving home for.',
      es: 'Una guía práctica de los puestos, cocinas y barras que valen la pena salir de casa.',
    },
    category: {
      en: 'Food',
      es: 'Comida',
    },
    image: 'https://picsum.photos/seed/citybeat-tacos/900/650',
    href: '/briefs',
  },
  {
    title: {
      en: 'Borderlands Sound, Two Cities Wide',
      es: 'Sonido fronterizo, de ciudad a ciudad',
    },
    dek: {
      en: 'The musicians blending Norteño roots, warehouse electronics, and desert pop.',
      es: 'Músicos que mezclan raíces norteñas, electrónica de almacén y pop desértico.',
    },
    category: {
      en: 'Culture',
      es: 'Cultura',
    },
    image: 'https://picsum.photos/seed/citybeat-music/900/650',
    href: '/briefs',
  },
]

type EventDatum = {
  title: LocalizedText
  meta: LocalizedText
  image: string
}

const eventsData: EventDatum[] = [
  {
    title: {
      en: 'Night Market: Autumn Edition',
      es: 'Mercado Nocturno: edición de otoño',
    },
    meta: {
      en: 'Central Plaza, Friday',
      es: 'Plaza Central, viernes',
    },
    image: 'https://picsum.photos/seed/citybeat-market/760/520',
  },
  {
    title: {
      en: 'Electronic Dreams Festival',
      es: 'Festival de sueños electrónicos',
    },
    meta: {
      en: 'The Warehouse, Saturday',
      es: 'El Almacén, sábado',
    },
    image: 'https://picsum.photos/seed/citybeat-rave/760/520',
  },
  {
    title: {
      en: 'Modern Gallery Opening',
      es: 'Apertura de galería moderna',
    },
    meta: {
      en: 'Gallery X, Thursday',
      es: 'Galería X, jueves',
    },
    image: 'https://picsum.photos/seed/citybeat-gallery/760/520',
  },
]

type AdProductData = {
  title: LocalizedText
  shortTitle: LocalizedText
  price: string
  cadence: LocalizedText
  dek: LocalizedText
  image: string
  features: LocalizedText[]
}

const adProductsData = {
  newsletter: {
    title: {
      en: 'Newsletter Sponsorship',
      es: 'Patrocinio de boletín',
    },
    shortTitle: {
      en: 'Newsletter',
      es: 'Boletín',
    },
    price: '$50',
    cadence: {
      en: 'monthly',
      es: 'mensual',
    },
    dek: {
      en: 'Own a premium placement inside the weekly edit locals already open.',
      es: 'Asegura un espacio premium dentro de la edición semanal que los locales ya abren.',
    },
    image: 'https://picsum.photos/seed/citybeat-newsletter/1100/760',
    features: [
      {
        en: 'Top placement in the weekly send',
        es: 'Ubicación destacada en el envío semanal',
      },
      {
        en: 'Bilingual creative review',
        es: 'Revisión creativa bilingüe',
      },
      {
        en: 'Campaign performance summary',
        es: 'Resumen de rendimiento de la campaña',
      },
    ],
  },
  sponsored: {
    title: {
      en: 'Sponsored Story',
      es: 'Historia patrocinada',
    },
    shortTitle: {
      en: 'Sponsored',
      es: 'Patrocinado',
    },
    price: '$30',
    cadence: {
      en: 'per post',
      es: 'por publicación',
    },
    dek: {
      en: 'Publish useful brand stories beside CityBeat editorial coverage.',
      es: 'Publica historias de marca útiles junto a la cobertura editorial de CityBeat.',
    },
    image: 'https://picsum.photos/seed/citybeat-sponsored/1100/760',
    features: [
      {
        en: 'Native story placement',
        es: 'Colocación nativa de historias',
      },
      {
        en: 'Editorial production guidance',
        es: 'Asesoría de producción editorial',
      },
      {
        en: 'Category and social distribution',
        es: 'Distribución por categoría y redes sociales',
      },
    ],
  },
  banners: {
    title: {
      en: 'Category Banner',
      es: 'Banner de categoría',
    },
    shortTitle: {
      en: 'Banners',
      es: 'Banners',
    },
    price: '$25',
    cadence: {
      en: 'monthly',
      es: 'mensual',
    },
    dek: {
      en: 'Put a focused offer in front of readers browsing events, culture, food, and business.',
      es: 'Coloca una oferta enfocada frente a lectores interesados en eventos, cultura, comida y negocios.',
    },
    image: 'https://picsum.photos/seed/citybeat-banners/1100/760',
    features: [
      {
        en: 'Category page placements',
        es: 'Ubicaciones en páginas de categoría',
      },
      {
        en: 'Leaderboard and rectangle formats',
        es: 'Formatos leaderboard y rectángulo',
      },
      {
        en: 'Simple monthly reporting',
        es: 'Informes mensuales simples',
      },
    ],
  },
} as const

export type AdProductKey = keyof typeof adProductsData

export type Story = {
  title: string
  dek: string
  category: string
  image: string
  href: string
}

export type Event = {
  title: string
  meta: string
  image: string
}

export type AdProduct = {
  title: string
  shortTitle: string
  price: string
  cadence: string
  dek: string
  image: string
  features: string[]
}

export function getTopStories(locale: Locale): Story[] {
  return topStoriesData.map((story) => ({
    title: story.title[locale],
    dek: story.dek[locale],
    category: story.category[locale],
    image: story.image,
    href: story.href,
  }))
}

export function getEvents(locale: Locale): Event[] {
  return eventsData.map((event) => ({
    title: event.title[locale],
    meta: event.meta[locale],
    image: event.image,
  }))
}

export function getAdProducts(locale: Locale): Record<AdProductKey, AdProduct> {
  return Object.fromEntries(
    Object.entries(adProductsData).map(([key, product]) => [
      key,
      {
        title: product.title[locale],
        shortTitle: product.shortTitle[locale],
        price: product.price,
        cadence: product.cadence[locale],
        dek: product.dek[locale],
        image: product.image,
        features: product.features.map((feature) => feature[locale]),
      },
    ])
  ) as Record<AdProductKey, AdProduct>
}

export function withLocale(locale: string, href: string) {
  if (href.startsWith('http') || href.startsWith('mailto:') || href.startsWith('tel:')) return href
  const cleanHref = href.startsWith('/') ? href : `/${href}`
  return `/${locale}${cleanHref}`
}
