import { useEffect, useId, useMemo, useRef } from 'react'
import { editionPercents } from '../editions/odds'
import { editions } from '../editions/registry'
import { packArt } from '../packs/packArt'
import { useBooth } from '../store/booth'
import { useOperator } from '../store/operator'
import { resolveDefaults } from '../templates/fields'
import { placeholderPhoto } from '../templates/placeholder'
import { templates } from '../templates/registry'
import type { Template } from '../templates/types'
import { TiltCard } from '../ui/TiltCard'
import { StampCanvas } from './StampCanvas'

const PACK_INFO = '3 different cards from one photo, each with its own edition. Keep 1.'

function CardTile({ template, delay }: { template: Template; delay: number }) {
  const infoId = useId()
  const selectTemplate = useBooth((s) => s.selectTemplate)
  const photo = useMemo(() => placeholderPhoto(template), [template])
  const values = useMemo(() => resolveDefaults(template), [template])
  return (
    <div className="tile">
      <div className="info" role="tooltip" id={infoId}>{template.description}</div>
      <TiltCard delay={delay}>
        <button className="tile-btn" aria-label={template.name} aria-describedby={infoId} onClick={() => selectTemplate(template.id)}>
          <StampCanvas template={template} photo={photo} values={values} scale={2} />
        </button>
      </TiltCard>
      <span className="tag" aria-hidden="true">{template.name}</span>
    </div>
  )
}

function PackTile() {
  const infoId = useId()
  const selectPack = useBooth((s) => s.selectPack)
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    if (ref.current) packArt(2, ref.current)
  }, [])
  return (
    <div className="tile">
      <div className="info" role="tooltip" id={infoId}>{PACK_INFO}</div>
      <TiltCard>
        <button className="tile-btn pack-btn" aria-label="Booster Pack" aria-describedby={infoId} onClick={selectPack}>
          <canvas ref={ref} className="stamp-canvas" aria-hidden="true" />
        </button>
      </TiltCard>
      <span className="tag" aria-hidden="true">Booster Pack</span>
    </div>
  )
}

function OddsPanel() {
  const weights = useOperator((s) => s.weights)
  const pct = editionPercents(weights)
  return (
    <section className="panel-box">
      <h3>Odds</h3>
      <ul className="odds">
        {editions.map((e) => (
          <li key={e.id} className="odds-row">
            <span className={`swatch swatch-${e.id}`} aria-hidden="true" />
            <span>{e.name}</span>
            <span className="num" data-testid={`odds-${e.id}`}>{pct[e.id]}%</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

export function Shop() {
  return (
    <div className="shop">
      <div className="shop-main">
        <section className="panel-box tray" aria-labelledby="cards-title">
          <h3 id="cards-title">Cards</h3>
          <div className="felt">
            <div className="tile-grid">
              {templates.map((t, i) => (
                <CardTile key={t.id} template={t} delay={i * 0.35} />
              ))}
            </div>
          </div>
        </section>
        <section className="panel-box tray" aria-labelledby="packs-title">
          <h3 id="packs-title">Packs</h3>
          <div className="felt">
            <div className="tile-grid">
              <PackTile />
            </div>
          </div>
        </section>
      </div>
      <aside className="shop-side">
        <OddsPanel />
        <section className="panel-box">
          <h3>How it works</h3>
          <ol className="how">
            <li>Pick a card or a pack</li>
            <li>Strike a pose</li>
            <li>Keep, download or print</li>
          </ol>
        </section>
      </aside>
    </div>
  )
}
