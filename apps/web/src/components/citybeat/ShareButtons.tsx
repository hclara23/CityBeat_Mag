'use client'

import { useState } from 'react'

type Props = {
  /** Absolute URL to share. Falls back to the current page URL at click time. */
  url?: string
  title?: string
  locale?: 'en' | 'es'
  className?: string
}

const copy = {
  en: { share: 'Share', copy: 'Copy link', copied: 'Link copied!' },
  es: { share: 'Compartir', copy: 'Copiar enlace', copied: '¡Enlace copiado!' },
}

function Icon({ name }: { name: string }) {
  const common = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'currentColor', 'aria-hidden': true } as const
  switch (name) {
    case 'x':
      return (
        <svg {...common}>
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.65l-5.214-6.817-5.96 6.817H1.69l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z" />
        </svg>
      )
    case 'facebook':
      return (
        <svg {...common}>
          <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073c0 6.026 4.388 11.02 10.125 11.927v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.235 2.686.235v2.97h-1.513c-1.49 0-1.955.93-1.955 1.886v2.265h3.328l-.532 3.49h-2.796v8.437C19.612 23.094 24 18.1 24 12.073Z" />
        </svg>
      )
    case 'linkedin':
      return (
        <svg {...common}>
          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286ZM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065Zm1.782 13.019H3.555V9h3.564v11.452ZM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003Z" />
        </svg>
      )
    case 'whatsapp':
      return (
        <svg {...common}>
          <path d="M.057 24l1.687-6.163a11.867 11.867 0 0 1-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 0 1 8.413 3.488 11.824 11.824 0 0 1 3.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 0 1-5.688-1.448L.057 24Zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 0 0 1.51 5.26l-.999 3.648 3.978-1.607Zm5.518-6.554c-.075-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414Z" />
        </svg>
      )
    case 'link':
      return (
        <svg {...common} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
        </svg>
      )
    default:
      return null
  }
}

export function ShareButtons({ url, title = '', locale = 'en', className = '' }: Props) {
  const t = copy[locale]
  const [copied, setCopied] = useState(false)

  const getUrl = () => url || (typeof window !== 'undefined' ? window.location.href : '')

  const onNativeShare = async () => {
    const shareUrl = getUrl()
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title, url: shareUrl })
      } catch {
        /* user cancelled */
      }
    }
  }

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(getUrl())
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* ignore */
    }
  }

  const enc = (s: string) => encodeURIComponent(s)
  const shareUrl = getUrl()
  const links = [
    { name: 'x', label: 'X', href: `https://twitter.com/intent/tweet?url=${enc(shareUrl)}&text=${enc(title)}` },
    { name: 'facebook', label: 'Facebook', href: `https://www.facebook.com/sharer/sharer.php?u=${enc(shareUrl)}` },
    { name: 'linkedin', label: 'LinkedIn', href: `https://www.linkedin.com/sharing/share-offsite/?url=${enc(shareUrl)}` },
    { name: 'whatsapp', label: 'WhatsApp', href: `https://wa.me/?text=${enc(`${title} ${shareUrl}`)}` },
  ]

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <span className="mr-1 text-xs font-black uppercase tracking-[0.2em] text-white/50">{t.share}</span>

      {/* Native share — handy on mobile; hidden where unsupported is fine (still renders, no-ops). */}
      <button
        type="button"
        onClick={onNativeShare}
        aria-label={t.share}
        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 text-white/70 transition hover:border-brand-neon hover:text-brand-neon sm:hidden"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
        </svg>
      </button>

      {links.map((l) => (
        <a
          key={l.name}
          href={l.href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={l.label}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 text-white/70 transition hover:border-brand-neon hover:text-brand-neon"
        >
          <Icon name={l.name} />
        </a>
      ))}

      <button
        type="button"
        onClick={onCopy}
        aria-label={t.copy}
        className="inline-flex h-9 items-center gap-2 rounded-full border border-white/15 px-3 text-xs font-bold text-white/70 transition hover:border-brand-neon hover:text-brand-neon"
      >
        <Icon name="link" />
        {copied ? t.copied : t.copy}
      </button>
    </div>
  )
}
