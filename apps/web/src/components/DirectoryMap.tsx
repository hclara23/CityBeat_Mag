'use client'

import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import Link from 'next/link'

// Fix for default marker icon in leaflet with webpack
const icon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  tooltipAnchor: [16, -28],
  shadowSize: [41, 41]
})

interface Listing {
  id: string
  name: string
  category: string
  address: string | null
  image_url: string | null
  tier: 'basic' | 'premium' | 'featured'
}

// Temporary geocoding for UI demonstration. In production, coordinates should be added to the DB.
const DEFAULT_CENTER: [number, number] = [31.7619, -106.4850] // El Paso, TX

interface DirectoryMapProps {
  listings: Listing[]
  locale: string
}

export default function DirectoryMap({ listings, locale }: DirectoryMapProps) {
  const [locations, setLocations] = useState<Array<{ listing: Listing, coords: [number, number] }>>([])

  useEffect(() => {
    // A simplistic mock geocoder for the demonstration
    // It assigns random coordinates around El Paso based on the listing ID
    const newLocations = listings.map((listing, i) => {
      // Mock coordinates slightly offset from downtown EP
      const offsetLat = (Math.random() - 0.5) * 0.1
      const offsetLng = (Math.random() - 0.5) * 0.1
      const coords: [number, number] = [DEFAULT_CENTER[0] + offsetLat, DEFAULT_CENTER[1] + offsetLng]
      return { listing, coords }
    })
    setLocations(newLocations)
  }, [listings])

  return (
    <div className="h-[400px] w-full rounded-2xl overflow-hidden border border-white/10 relative z-0">
      <MapContainer center={DEFAULT_CENTER} zoom={12} scrollWheelZoom={false} className="h-full w-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        {locations.map((loc) => (
          <Marker key={loc.listing.id} position={loc.coords} icon={icon}>
            <Popup className="citybeat-popup">
              <div className="p-1">
                <p className="font-bold text-sm mb-1">{loc.listing.name}</p>
                <p className="text-xs text-gray-500 mb-2">{loc.listing.category}</p>
                <Link href={`/${locale}/directory/${loc.listing.id}`} className="text-xs text-blue-500 hover:underline">
                  View Details
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
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 8px;
        }
        .citybeat-popup .leaflet-popup-tip {
          background: #111;
          border: 1px solid rgba(255,255,255,0.1);
        }
        .leaflet-container {
          background: #1a1a1a;
          font-family: inherit;
        }
      `}</style>
    </div>
  )
}
