import { useRef, type CSSProperties, type ReactNode } from 'react'
import type { Edition } from '../editions/types'
import type { Template } from '../templates/types'
import { glareClip, glareVariant } from './glare'

const SPARKLES = 6

/** Display-only glare that follows the pointer and skips the photo window; shadow follows TiltCard's tilt. */
export function CardGlare({ template, edition, children }: { template: Template; edition: Edition; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const variant = glareVariant(edition.id)
  return (
    <div
      ref={ref}
      className="card-glare"
      data-glare={variant}
      onPointerMove={(e) => {
        const el = ref.current
        if (!el) return
        const r = el.getBoundingClientRect()
        if (r.width <= 0 || r.height <= 0) return
        el.style.setProperty('--gx', `${Math.round(((e.clientX - r.left) / r.width) * 100)}%`)
        el.style.setProperty('--gy', `${Math.round(((e.clientY - r.top) / r.height) * 100)}%`)
        el.setAttribute('data-active', '')
      }}
      onPointerLeave={() => ref.current?.removeAttribute('data-active')}
    >
      {children}
      <div className="glare" aria-hidden="true" style={{ clipPath: glareClip(template) }}>
        {variant === 'poly' &&
          Array.from({ length: SPARKLES }, (_, i) => (
            <span key={i} className="sparkle-dot" style={{ '--s': i } as CSSProperties} />
          ))}
      </div>
    </div>
  )
}
