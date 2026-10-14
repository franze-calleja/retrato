import { useEffect, useState, type CSSProperties } from 'react'
import { getEdition } from '../editions/registry'
import { useBooth } from '../store/booth'
import { getTemplate } from '../templates/registry'
import { prefersReducedMotion } from '../ui/motion'
import { CardBackCanvas } from './CardBackCanvas'
import { StampCanvas } from './StampCanvas'
import { DEAL_TIMING, useDeal } from './useDeal'

const DEAL_SCALE = 2

export function PackDeal() {
  const pack = useBooth((s) => s.pack)
  const capture = useBooth((s) => s.capture)
  const { pickPackCard, goToPicker } = useBooth.getState()
  const [reducedMotion] = useState(prefersReducedMotion)
  const count = pack?.length ?? 0
  const { revealed, revealAll } = useDeal(count, reducedMotion)
  const [chosen, setChosen] = useState<number | null>(null)

  // Let the chosen card lift before switching screens.
  useEffect(() => {
    if (chosen === null) return
    const id = setTimeout(() => pickPackCard(chosen), reducedMotion ? 0 : DEAL_TIMING.choose)
    return () => clearTimeout(id)
  }, [chosen, reducedMotion, pickPackCard])

  if (!pack || !capture) return null
  const dealing = revealed < count

  return (
    <section className="screen">
      <h2>Pick one to keep</h2>
      <div className="deal">
        {pack.map((card, i) => {
          const template = getTemplate(card.templateId)
          const edition = getEdition(card.edition)
          const faceUp = i < revealed
          const state = chosen === null ? '' : chosen === i ? 'chosen' : 'dismissed'
          return (
            <button
              key={card.templateId}
              className={`deal-card ${faceUp ? 'up' : ''} ${faceUp && edition.rare ? 'glint' : ''} ${state}`}
              style={{ '--i': i } as CSSProperties}
              aria-label={faceUp ? `${template.name}, ${edition.name} edition` : 'Face-down card'}
              onClick={() => {
                if (dealing) return revealAll()
                if (chosen === null) setChosen(i)
              }}
            >
              <div className="deal-inner">
                <div className="deal-face deal-front">
                  <StampCanvas template={template} photo={capture} values={card.values} scale={DEAL_SCALE} edition={edition} />
                </div>
                <div className="deal-face deal-back">
                  <CardBackCanvas template={template} scale={DEAL_SCALE} />
                </div>
              </div>
            </button>
          )
        })}
      </div>
      <p className="deal-hint" aria-live="polite">{dealing ? 'Dealing…' : 'Tap a card to keep it'}</p>
      <button className="btn" onClick={goToPicker}>Back to shop</button>
    </section>
  )
}
