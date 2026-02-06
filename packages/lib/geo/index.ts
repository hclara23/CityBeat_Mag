export interface Coordinates {
  lat: number
  lng: number
}

export interface Area {
  name: string
  center: Coordinates
  radius: number // in km
}

export const COVERAGE_AREAS: Record<string, Area> = {
  'el-paso-county': {
    name: 'El Paso County',
    center: { lat: 31.7683, lng: -106.4425 },
    radius: 30,
  },
  horizon: {
    name: 'Horizon',
    center: { lat: 31.5845, lng: -106.5045 },
    radius: 10,
  },
  socorro: {
    name: 'Socorro',
    center: { lat: 31.6428, lng: -106.3128 },
    radius: 8,
  },
  clint: {
    name: 'Clint',
    center: { lat: 31.6753, lng: -106.5511 },
    radius: 8,
  },
  'las-cruces': {
    name: 'Las Cruces',
    center: { lat: 32.3195, lng: -106.7644 },
    radius: 20,
  },
}

export function calculateDistance(coord1: Coordinates, coord2: Coordinates): number {
  const R = 6371 // Earth's radius in km
  const dLat = (coord2.lat - coord1.lat) * (Math.PI / 180)
  const dLng = (coord2.lng - coord1.lng) * (Math.PI / 180)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(coord1.lat * (Math.PI / 180)) *
      Math.cos(coord2.lat * (Math.PI / 180)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

export function isWithinArea(coordinates: Coordinates, area: Area): boolean {
  const distance = calculateDistance(coordinates, area.center)
  return distance <= area.radius
}

export function getAreaName(coordinates: Coordinates): string | null {
  for (const [_, area] of Object.entries(COVERAGE_AREAS)) {
    if (isWithinArea(coordinates, area)) {
      return area.name
    }
  }
  return null
}

export function getAllAreas(): Area[] {
  return Object.values(COVERAGE_AREAS)
}
