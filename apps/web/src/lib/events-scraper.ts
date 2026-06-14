export interface ScrapedEvent {
  title_en: string
  title_es: string
  meta_en: string
  meta_es: string
  image_url: string
  ticket_url: string
  start_date: string
}

export async function fetchMockEvents(): Promise<ScrapedEvent[]> {
  // Simulating an external API call or scraper
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve([
        {
          title_en: 'Night Market: Autumn Edition',
          title_es: 'Mercado Nocturno: edición de otoño',
          meta_en: 'Central Plaza, Friday',
          meta_es: 'Plaza Central, viernes',
          image_url: 'https://picsum.photos/seed/citybeat-market/760/520',
          ticket_url: 'https://eventbrite.com/mock-event-1',
          start_date: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
        },
        {
          title_en: 'Electronic Dreams Festival',
          title_es: 'Festival de sueños electrónicos',
          meta_en: 'The Warehouse, Saturday',
          meta_es: 'El Almacén, sábado',
          image_url: 'https://picsum.photos/seed/citybeat-rave/760/520',
          ticket_url: 'https://ticketmaster.com/mock-event-2',
          start_date: new Date(Date.now() + 86400000 * 2).toISOString(),
        },
        {
          title_en: 'Modern Gallery Opening',
          title_es: 'Apertura de galería moderna',
          meta_en: 'Gallery X, Thursday',
          meta_es: 'Galería X, jueves',
          image_url: 'https://picsum.photos/seed/citybeat-gallery/760/520',
          ticket_url: 'https://residentadvisor.net/mock-event-3',
          start_date: new Date(Date.now() + 86400000 * 3).toISOString(),
        },
      ])
    }, 500)
  })
}
