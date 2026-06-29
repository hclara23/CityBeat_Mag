import { ImageResponse } from 'next/og'

export const runtime = 'edge'

// Branded 1200×630 share image, driven by query params so every page can reuse it:
//   /api/og?title=...&eyebrow=...
// Used in openGraph/twitter metadata across stories, events, directory, and the
// programmatic local-SEO pages for richer link previews (more click-through).
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const title = (searchParams.get('title') || 'CityBeat Magazine').slice(0, 140)
  const eyebrow = (searchParams.get('eyebrow') || 'El Paso · Las Cruces · Borderland').slice(0, 64)
  const fontSize = title.length > 70 ? 60 : title.length > 40 ? 76 : 92

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '72px',
          background: 'linear-gradient(135deg, #0a0a0a 0%, #111827 100%)',
          color: '#ffffff',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', fontSize: 46, fontWeight: 800, letterSpacing: -1 }}>
          <span>city</span>
          <span style={{ color: '#06b6d4', fontStyle: 'italic' }}>BEat</span>
          <span style={{ marginLeft: 14, fontSize: 22, letterSpacing: 6, color: 'rgba(255,255,255,0.45)' }}>MAG</span>
        </div>

        <div style={{ display: 'flex', fontSize, fontWeight: 800, lineHeight: 1.04, letterSpacing: -2, maxWidth: 1040 }}>
          {title}
        </div>

        <div
          style={{
            display: 'flex',
            fontSize: 28,
            color: '#06b6d4',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: 3,
          }}
        >
          {eyebrow}
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  )
}
