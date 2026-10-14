import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { getEdition } from '../editions/registry'
import { getPack, type PackDef } from '../packs/catalog'
import type { PackCard } from '../packs/deal'
import { packArtParts } from '../packs/packArt'
import type { PhotoSource } from '../photo/crop'
import { useBooth } from '../store/booth'
import { getTemplate } from '../templates/registry'
import { prefersReducedMotion } from '../ui/motion'
import { CardBackCanvas } from './CardBackCanvas'
import { StampCanvas } from './StampCanvas'
import { DEAL_TIMING, useDeal } from './useDeal'
import { rareTint, usePackOpen, type OpenPhase } from './usePackOpen'

const DEAL_SCALE = 2
const STAGE_SCALE = 4

function PackStage({ pack, phase, tint, onPress }: { pack: PackDef; phase: OpenPhase; tint: string | null; onPress: () => void }) {
  const top = useRef<HTMLCanvasElement>(null)
  const body = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    if (top.current && body.current) packArtParts(pack, STAGE_SCALE, { top: top.current, body: body.current })
  }, [pack])
  return (
    <>
      <button
        className="pack-stage"
        data-phase={phase}
        style={tint ? ({ '--glow': tint } as CSSProperties) : undefined}
        aria-label={phase === 'sealed' ? `Open the ${pack.name}` : 'Skip to the cards'}
        onClick={onPress}
      >
        <span className="pack-shaker">
          <canvas ref={top} className="pack-top" aria-hidden="true" />
          <canvas ref={body} className="pack-body" aria-hidden="true" />
          <span className="pack-flash" aria-hidden="true" />
        </span>
      </button>
      <p className="deal-hint">{phase === 'sealed' ? 'Tap to open' : 'Opening…'}</p>
    </>
  )
}

function DealCards({ pack, capture, reducedMotion, fromPack }: { pack: PackCard[]; capture: PhotoSource; reducedMotion: boolean; fromPack: boolean }) {
  const { pickPackCard } = useBooth.getState()
  const count = pack.length
  const { revealed, pickable, revealAll } = useDeal(count, reducedMotion)
  const [chosen, setChosen] = useState<number | null>(null)

  // Let the chosen card lift before switching screens.
  useEffect(() => {
    if (chosen === null) return
    const id = setTimeout(() => pickPackCard(chosen), reducedMotion ? 0 : DEAL_TIMING.choose)
    return () => clearTimeout(id)
  }, [chosen, reducedMotion, pickPackCard])

  const dealing = revealed < count
  return (
    <>
      <div className={`deal ${fromPack ? 'from-pack' : ''}`}>
        {pack.map((card, i) => {
          const template = getTemplate(card.templateId)
          const edition = getEdition(card.edition)
          const faceUp = i < revealed
          const state = chosen === null ? '' : chosen === i ? 'chosen' : 'dismissed'
          return (
            <button
              key={i}
              className={`deal-card ${faceUp ? 'up' : ''} ${faceUp && edition.rare ? 'glint' : ''} ${state}`}
              style={{ '--i': i } as CSSProperties}
              aria-label={faceUp ? `${template.name}: ${card.values[template.fields[0]?.key] ?? ''}, ${edition.name} edition` : 'Face-down card'}
              onClick={() => {
                if (dealing) return revealAll()
                if (pickable && chosen === null) setChosen(i)
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
    </>
  )
}

export function PackDeal() {
  const pack = useBooth((s) => s.pack)
  const capture = useBooth((s) => s.capture)
  const packId = useBooth((s) => s.packId)
  const { goToPicker } = useBooth.getState()
  const [reducedMotion] = useState(prefersReducedMotion)
  const { phase, open, skip } = usePackOpen(reducedMotion)
  const opening = phase !== 'done'
  const headingRef = useRef<HTMLHeadingElement>(null)

  // On arrival and again when the stage gives way to the cards (it may have had focus).
  useEffect(() => headingRef.current?.focus(), [opening])

  if (!pack || !capture) return null

  return (
    <section className="screen">
      <h2 ref={headingRef} tabIndex={-1}>{opening ? 'Open your pack' : 'Pick one to keep'}</h2>
      {opening ? (
        <PackStage
          pack={getPack(packId)}
          phase={phase}
          tint={rareTint(pack.map((c) => c.edition))}
          onPress={phase === 'sealed' ? open : skip}
        />
      ) : (
        <DealCards pack={pack} capture={capture} reducedMotion={reducedMotion} fromPack={!reducedMotion} />
      )}
      <button className="btn" onClick={goToPicker}>Back to shop</button>
    </section>
  )
}
