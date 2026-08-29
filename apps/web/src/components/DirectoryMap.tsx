'use client'

import { useEffect, useMemo } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import Link from 'next/link'

interface Listing {
  id: string
  name: string
  category: string
  address: string | null
  image_url: string | null
  tier: 'basic' | 'premium' | 'featured'
  latitude?: number | null
  longitude?: number | null
}

const DEFAULT_CENTER: [number, number] = [31.7619, -106.485] // El Paso, TX

// Styled marker rendered as inline HTML — no external unpkg image requests and no
// leaflet default-icon path breakage. Color encodes tier (matches the cards).
function markerIcon(tier: string): L.DivIcon {
  const color = tier === 'featured' ? '#eab308' : tier === 'premium' ? '#06b6d4' : '#e5e7eb'
  return L.divIcon({
    className: 'citybeat-marker',
    html: `<span style="display:block;width:14px;height:14px;border-radius:9999px;background:${color};border:2px solid #0a0a0a;box-shadow:0 0 0 2px ${color}55"></span>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
    popupAnchor: [0, -8],
  })
}

// Frame the map to the actual markers so it opens on the real cluster of
// businesses, not a fixed downtown view.
function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap()
  useEffect(() => {
    if (points.length === 0) return
    if (points.length === 1) {
      map.setView(points[0], 14)
      return
    }
    map.fitBounds(points as [number, number][], { padding: [40, 40], maxZoom: 14 })
  }, [points, map])
  return null
}

interface DirectoryMapProps {
  listings: Listing[]
  locale: string
}

export default function DirectoryMap({ listings, locale }: DirectoryMapProps) {
  // Only businesses with real, valid coordinates are mapped (a large share of the
  // scraped inventory has none yet — those simply aren't plotted rather than
  // shown at a fake location).
  const located = useMemo(
    () =>
      listings.filter(
        (l) =>
          typeof l.latitude === 'number' &&
          typeof l.longitude === 'number' &&
          Number.isFinite(l.latitude) &&
          Number.isFinite(l.longitude) &&
          Math.abs(l.latitude as number) <= 90 &&
          Math.abs(l.longitude as number) <= 180
      ),
    [listings]
  )
  const points = useMemo(
    () => located.map((l) => [l.latitude as number, l.longitude as number] as [number, number]),
    [located]
  )

  return (
    <div className="relative z-0 h-[400px] w-full overflow-hidden rounded-2xl border border-white/10">
      {located.length === 0 && (
        <div className="pointer-events-none absolute inset-0 z-[500] flex items-center justify-center bg-brand-dark/70 p-6 text-center text-sm text-white/70">
          {locale === 'es'
            ? 'Todavía no hay ubicaciones con mapa para estos resultados.'
            : 'No mapped locations for these results yet.'}
        </div>
      )}
      <MapContainer
        center={points[0] || DEFAULT_CENTER}
        zoom={12}
        scrollWheelZoom={false}
        className="h-full w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        <FitBounds points={points} />
        {located.map((l) => (
          <Marker key={l.id} position={[l.latitude as number, l.longitude as number]} icon={markerIcon(l.tier)}>
            <Popup className="citybeat-popup">
              <div className="p-1">
                <p className="mb-1 text-sm font-bold">{l.name}</p>
                <p className="mb-2 text-xs text-gray-500">{l.category}</p>
                <Link href={`/${locale}/directory/${l.id}`} className="text-xs text-blue-500 hover:underline">
                  {locale === 'es' ? 'Ver detalles' : 'View Details'}
                </Link>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      <style jsx global>{`
        .citybeat-popup .leaflet-popup-content-wrapper {
          background: #111;
          color: white;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
        }
        .citybeat-popup .leaflet-popup-tip {
          background: #111;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }
        .leaflet-container {
          background: #1a1a1a;
          font-family: inherit;
        }
      `}</style>
    </div>
  )
}
