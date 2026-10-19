import type { Metadata } from 'next'
import { Suspense } from 'react'
import { CityBeatShell } from '@/components/citybeat/CityBeatShell'
import FoundersFunnel from './FoundersFunnel'

export async function generateMetadata(props: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const params = await props.params;
  const es = params.locale === 'es'
  return { title: es ? 'Fundadores: Premium por $9.99/mes | CityBeat' : 'Founders: Premium for $9.99/month | CityBeat',
    description: es ? 'Busca y reclama tu negocio o crea una ficha. $9.99/mes por negocio, todas sus ubicaciones. Primeros 100 negocios; verificación requerida.' : 'Find and claim your business or create a listing. $9.99/month per business, all its locations included. First 100 businesses; ownership verification required.',
    alternates: { canonical: `https://citybeatmag.co/${es ? 'es' : 'en'}/founders` } }
}
export default async function FoundersPage(props: { params: Promise<{ locale: string }> }) {
  const params = await props.params;
  return <CityBeatShell locale={params.locale}><Suspense fallback={<p className="p-8">Loading…</p>}><FoundersFunnel /></Suspense></CityBeatShell>
}
