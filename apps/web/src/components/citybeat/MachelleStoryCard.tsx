import Image from 'next/image'
import Link from 'next/link'
import story from '@/lib/machelle-story.json'

export function MachelleStoryCard({ locale }: { locale: string }) {
  return <Link href={`/${locale}/stories/${story.slug}`} className="group">
    <article className="grid gap-4">
      <div className="relative aspect-[4/3] overflow-hidden rounded-md bg-brand-charcoal">
        <Image src="/print/machelle-wood-speaking.webp" alt="" fill sizes="(max-width: 768px) 100vw, 33vw" className="object-cover object-top transition duration-500 group-hover:scale-105" />
      </div>
      <div>
        <p className="text-xs font-black uppercase tracking-[0.2em] text-brand-neon">{locale === 'es' ? 'Perfil · Octubre–Noviembre' : 'Profile · October–November'}</p>
        <h2 lang="en" className="mt-2 text-2xl font-black leading-tight text-white transition group-hover:text-brand-neon">{story.title}</h2>
        <p className="mt-3 text-sm leading-6 text-white/55">{locale === 'es' ? 'Machelle Wood: del arte a la restauración y la historia pública de El Paso. Artículo en inglés.' : story.excerpt}</p>
      </div>
    </article>
  </Link>
}
