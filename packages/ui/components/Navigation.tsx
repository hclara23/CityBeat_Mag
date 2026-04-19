import React from 'react'

interface NavItem {
  label: string
  href: string
  active?: boolean
}

interface NavigationProps {
  brand?: string
  items?: NavItem[]
  onBrandClick?: () => void
}

export function Navigation({
  brand = 'CityBeat',
  items = [],
  onBrandClick
}: NavigationProps) {
  const navItems = items.length > 0 ? items : [
    { label: 'Home', href: '/en' },
    { label: 'Stories', href: '/en/briefs' },
    { label: 'Events', href: '/en#events' },
    { label: 'Directory', href: '/en#directory' },
    { label: 'Submit', href: '/en/contribute' },
  ]

  return (
    <nav className="border-b border-white/10 bg-brand-dark/90 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
        <button
          onClick={onBrandClick}
          className="text-2xl font-black tracking-tighter text-white hover:text-brand-neon cursor-pointer"
        >
          {brand === 'CityBeat' ? (
            <>
              city<span className="italic text-brand-neon">BEat</span>
            </>
          ) : brand}
        </button>
        <div className="hidden gap-6 md:flex">
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className={`text-xs font-bold uppercase tracking-[0.22em] transition-colors ${
                item.active
                  ? 'text-brand-neon'
                  : 'text-white/65 hover:text-brand-neon'
              }`}
            >
              {item.label}
            </a>
          ))}
        </div>
      </div>
    </nav>
  )
}
