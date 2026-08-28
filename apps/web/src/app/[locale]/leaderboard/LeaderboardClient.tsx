'use client'

import { useEffect, useState } from 'react'
import { CityBeatShell } from '@/components/citybeat/CityBeatShell'
import { useLocale } from '@/components/TranslationProvider'

interface Row {
  user_id: string
  name: string
  points: number
  level: number
  badge: string
  rank: number
}

// Public contributor leaderboard — the top reviewers and photo contributors on
// CityBeat, by points earned. Rewards the community that keeps the directory
// fresh (reviews + customer photos), and gives contributors their name in
// lights (the "name in a contributor leaderboard" the community asked for).
export default function LeaderboardClient() {
  const locale = useLocale() as 'en' | 'es'
  const isEs = locale === 'es'
  const [rows, setRows] = useState<Row[] | null>(null)

  useEffect(() => {
    fetch('/api/leaderboard')
      .then((r) => (r.ok ? r.json() : { leaderboard: [] }))
      .then((d) => setRows(d.leaderboard || []))
      .catch(() => setRows([]))
  }, [])

  return (
    <CityBeatShell locale={locale}>
      <section className="container-wide max-w-2xl py-16">
        <p className="text-xs font-black uppercase tracking-[0.28em] text-brand-neon">
          {isEs ? 'Comunidad CityBeat' : 'CityBeat community'}
        </p>
        <h1 className="mt-2 font-display text-4xl font-black tracking-tight text-white">
          {isEs ? 'Tabla de colaboradores' : 'Contributor leaderboard'}
        </h1>
        <p className="mt-2 text-white/55">
          {isEs
            ? 'Gana puntos dejando reseñas y subiendo fotos de negocios de El Paso.'
            : 'Earn points by leaving reviews and uploading photos of El Paso businesses.'}
        </p>

        {rows === null ? (
          <p className="mt-10 text-white/40">{isEs ? 'Cargando…' : 'Loading…'}</p>
        ) : rows.length === 0 ? (
          <p className="mt-10 rounded-xl border border-white/10 bg-white/5 p-8 text-center text-white/50">
            {isEs ? 'Sé el primero — deja una reseña o sube una foto.' : 'Be the first — leave a review or upload a photo.'}
          </p>
        ) : (
          <ol className="mt-10 space-y-2">
            {rows.map((r) => (
              <li
                key={r.user_id}
                className={`flex items-center gap-4 rounded-lg border px-5 py-3 ${
                  r.rank <= 3 ? 'border-brand-neon/40 bg-brand-neon/[0.06]' : 'border-white/10 bg-white/[0.03]'
                }`}
              >
                <span className="w-8 text-center font-display text-xl font-black text-white/70">{r.rank}</span>
                <span className="text-2xl" aria-hidden>
                  {r.badge}
                </span>
                <span className="flex-1 truncate font-bold text-white">{r.name}</span>
                <span className="font-mono text-sm tabular-nums text-brand-neon">
                  {r.points.toLocaleString()} {isEs ? 'pts' : 'pts'}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </CityBeatShell>
  )
}
