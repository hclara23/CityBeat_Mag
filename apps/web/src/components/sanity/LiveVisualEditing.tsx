'use client'

import { useLiveMode } from '@sanity/react-loader'
import { VisualEditing } from 'next-sanity'
import { useEffect, useState } from 'react'

const clientConfig = {
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || '',
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || 'production',
}

export default function LiveVisualEditing() {
  useLiveMode({ client: clientConfig })
  
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  return <VisualEditing />
}
