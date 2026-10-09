'use client'

import type { PointerEvent, ReactNode } from 'react'
import styles from './ImageGlare.module.css'

/** The same soft, pointer-following white glare used on Premier's editorial cards. */
export function ImageGlare({ children, tilt = false }: { children: ReactNode; tilt?: boolean }) {
  const move = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== 'mouse' || !matchMedia('(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)').matches) return
    const element = event.currentTarget
    const rect = element.getBoundingClientRect()
    if (!rect.width || !rect.height) return
    const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width))
    const y = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height))
    element.style.setProperty('--glare-x', `${x * 100}%`)
    element.style.setProperty('--glare-y', `${y * 100}%`)
    if (tilt) {
      element.style.setProperty('--image-rx', `${(.5 - y) * 3}deg`)
      element.style.setProperty('--image-ry', `${(x - .5) * 4}deg`)
    }
  }
  const reset = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.style.setProperty('--image-rx', '0deg')
    event.currentTarget.style.setProperty('--image-ry', '0deg')
  }
  return <div className={styles.frame} onPointerMove={move} onPointerLeave={reset} onPointerCancel={reset} data-image-glare="true" data-tilt={tilt ? 'true' : undefined}>
    <div className={styles.surface}>
      {children}
      <span className={styles.glare} aria-hidden="true" />
    </div>
  </div>
}
