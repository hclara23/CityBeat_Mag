'use client'

import type { PointerEvent, ReactNode } from 'react'
import styles from './ImageGlare.module.css'

/** The same soft, pointer-following white glare used on Premier's editorial cards. */
export function ImageGlare({ children }: { children: ReactNode }) {
  const move = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== 'mouse' || !matchMedia('(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)').matches) return
    const element = event.currentTarget
    const rect = element.getBoundingClientRect()
    if (!rect.width || !rect.height) return
    const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width))
    const y = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height))
    element.style.setProperty('--glare-x', `${x * 100}%`)
    element.style.setProperty('--glare-y', `${y * 100}%`)
  }
  return <div className={styles.frame} onPointerMove={move} data-image-glare="true">
    {children}
    <span className={styles.glare} aria-hidden="true" />
  </div>
}
