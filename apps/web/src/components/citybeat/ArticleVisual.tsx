import Image from 'next/image'

type ArticleVisualProps = {
  identifier: string
  title: string
  category: string
  image?: string | null
  sizes: string
  priority?: boolean
  className?: string
}

const PALETTES: Record<string, { base: string; mid: string; accent: string }> = {
  news: { base: '#071c24', mid: '#0b5162', accent: '#06b6d4' },
  business: { base: '#241c05', mid: '#705609', accent: '#eab308' },
  events: { base: '#26102c', mid: '#692270', accent: '#d946ef' },
  culture: { base: '#09251f', mid: '#176352', accent: '#2dd4bf' },
}

function hashOf(value: string): number {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

// Articles without a real image get a truthful, branded editorial card rather
// than unrelated stock photography. The slug/title hash varies the composition
// deterministically, so adjacent stories never look like duplicated placeholders.
export function ArticleVisual({
  identifier,
  title,
  category,
  image,
  sizes,
  priority = false,
  className = '',
}: ArticleVisualProps) {
  const seed = hashOf(`${identifier}:${title}`)
  const palette = PALETTES[category] || PALETTES.news
  const angle = 112 + (seed % 45)
  const x = 18 + (seed % 62)
  const y = 16 + ((seed >>> 7) % 68)
  const issue = String((seed % 97) + 1).padStart(2, '0')

  return (
    <div className={`relative overflow-hidden bg-brand-charcoal ${className}`}>
      {image ? (
        <Image
          src={image}
          alt=""
          fill
          priority={priority}
          sizes={sizes}
          className="object-cover opacity-85 transition duration-500 group-hover:scale-105 group-hover:opacity-70"
        />
      ) : (
        <div
          aria-hidden="true"
          className="absolute inset-0 transition duration-700 group-hover:scale-[1.025]"
          style={{
            backgroundImage: [
              `radial-gradient(circle at ${x}% ${y}%, ${palette.accent}55 0, transparent 24%)`,
              `linear-gradient(${angle}deg, ${palette.base} 8%, ${palette.mid} 58%, #050505 100%)`,
            ].join(','),
          }}
        >
          <div
            className="absolute inset-0 opacity-25"
            style={{
              backgroundImage:
                'linear-gradient(rgba(255,255,255,.22) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.22) 1px, transparent 1px)',
              backgroundSize: `${24 + (seed % 18)}px ${24 + (seed % 18)}px`,
              transform: `rotate(${(seed % 9) - 4}deg) scale(1.12)`,
            }}
          />
          <div
            className="absolute h-[70%] w-[42%] rounded-full border border-white/20"
            style={{ left: `${(seed % 54) - 8}%`, top: `${((seed >>> 5) % 42) - 6}%` }}
          />
          <div className="absolute inset-x-5 bottom-5 flex items-end justify-between border-t border-white/35 pt-3 sm:inset-x-7 sm:bottom-7">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.32em] text-white/65">CityBeat</p>
              <p className="mt-1 text-sm font-black uppercase tracking-[0.2em] text-white">
                {category || 'Local'}
              </p>
            </div>
            <span className="font-display text-5xl font-black leading-none text-white/20 sm:text-6xl">
              {issue}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
