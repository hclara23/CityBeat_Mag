import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getServerUser, createServerClient } from '@citybeat/lib/supabase/server'
import sharp from 'sharp'

function readonlyCookieStore(store: Awaited<ReturnType<typeof cookies>>) {
  return { getAll: () => store.getAll(), setAll: () => {} }
}

export async function POST(request: NextRequest) {
  const cookieStore = readonlyCookieStore(await cookies())
  const user = await getServerUser(cookieStore)
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }

  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']
  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json({ error: 'Invalid file type.' }, { status: 400 })
  }

  try {
    const supabase = createServerClient(cookieStore)
    const arrayBuffer = await file.arrayBuffer()
    const inputBuffer = Buffer.from(arrayBuffer)

    // Optimize with sharp
    const optimizedBuffer = await sharp(inputBuffer)
      .resize(1600, null, { withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer()

    const fileName = `${user.id}/${Date.now()}-${Math.random().toString(36).substring(2)}.webp`
    const filePath = `articles/${fileName}`

    const { data, error } = await supabase.storage
      .from('media')
      .upload(filePath, optimizedBuffer, {
        contentType: 'image/webp',
        upsert: false
      })

    if (error) throw error

    const { data: { publicUrl } } = supabase.storage
      .from('media')
      .getPublicUrl(filePath)

    return NextResponse.json({
      assetId: data.path,
      url: publicUrl,
    })
  } catch (error) {
    console.error('Image upload error:', error)
    return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 })
  }
}
