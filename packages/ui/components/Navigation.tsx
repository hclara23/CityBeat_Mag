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
  return (
    <nav className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
        <button
          onClick={onBrandClick}
          className="text-2xl font-bold text-red-600 hover:text-red-700 cursor-pointer"
        >
          {brand}
        </button>
        <div className="flex gap-6">
          {items.length > 0 ? (
            items.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className={`font-medium transition-colors ${
                  item.active
                    ? 'text-red-600 border-b-2 border-red-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {item.label}
              </a>
            ))
          ) : null}
        </div>
      </div>
    </nav>
  )
}
