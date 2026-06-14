'use client'

import { useLiveMode } from '@sanity/react-loader'
import { VisualEditing } from 'next-sanity'
import { useEffect, useState } from 'react'

import { sanityClient } from '@citybeat/lib/sanity/client'

export default function LiveVisualEditing() {
  useLiveMode({ client: sanityClient as any })
  
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  return <VisualEditing />
}
