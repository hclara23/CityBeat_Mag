import React from 'react'

interface HeroProps {
  title: string
  subtitle: string
  backgroundImage?: string
  cta?: {
    label: string
    onClick?: () => void
  }
}

export function Hero({ title, subtitle, backgroundImage, cta }: HeroProps) {
  return (
    <section
      className="relative bg-gradient-to-r from-red-600 to-red-700 text-white py-20"
      style={
        backgroundImage
          ? {
              backgroundImage: `linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.5)), url(${backgroundImage})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }
          : undefined
      }
    >
      <div className="max-w-7xl mx-auto px-4">
        <h1 className="text-5xl font-bold mb-4">{title}</h1>
        <p className="text-xl mb-8">{subtitle}</p>
        {cta && (
          <button
            onClick={cta.onClick}
            className="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-white text-red-600 font-semibold hover:bg-gray-100 transition-colors"
          >
            {cta.label}
          </button>
        )}
      </div>
    </section>
  )
}
