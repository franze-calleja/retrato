import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { displayedOdds } from '../editions/odds'
import { editions } from '../editions/registry'
import { PACKS, type PackDef } from '../packs/catalog'
import { packArt } from '../packs/packArt'
import { useBooth } from '../store/booth'
import { useOperator } from '../store/operator'
import { resolveDefaults } from '../templates/fields'
import { placeholderPhoto } from '../templates/placeholder'
import { templates } from '../templates/registry'
import type { Template } from '../templates/types'
import { TiltCard } from '../ui/TiltCard'
import { StampCanvas } from './StampCanvas'

function CardTile({ template, delay }: { template: Template; delay: number }) {
  const infoId = useId()
  const selectTemplate = useBooth((s) => s.selectTemplate)
  const photo = useMemo(() => placeholderPhoto(template), [template])
  const values = useMemo(() => resolveDefaults(template), [template])
  return (
    <div className="tile">
      <span className="tag" aria-hidden="true">{template.name}</span>
      <TiltCard delay={delay}>
        <button className="tile-btn" aria-label={template.name} aria-describedby={infoId} onClick={() => selectTemplate(template.id)}>
          <StampCanvas template={template} photo={photo} values={values} scale={2} />
        </button>
      </TiltCard>
      <div className="info" role="tooltip" id={infoId}>{template.description}</div>
    </div>
  )
}

function PackTile({ pack, delay }: { pack: PackDef; delay: number }) {
  const infoId = useId()
  const selectPack = useBooth((s) => s.selectPack)
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    if (ref.current) packArt(pack, 2, ref.current)
  }, [pack])
  return (
    <div className="tile">
      <span className="tag" aria-hidden="true">{pack.name}</span>
      <TiltCard delay={delay}>
        <button className="tile-btn pack-btn" aria-label={pack.name} aria-describedby={infoId} onClick={() => selectPack(pack.id)}>
          <canvas ref={ref} className="stamp-canvas" aria-hidden="true" />
        </button>
      </TiltCard>
      <div className="info" role="tooltip" id={infoId}>{pack.description}</div>
    </div>
  )
}

function OddsTiles() {
  const weights = useOperator((s) => s.weights)
  const forced = useOperator((s) => s.forced)
  const pct = displayedOdds({ weights, forced })
  return (
    <section className="odds-box" aria-labelledby="odds-title">
      <h3 id="odds-title">Odds</h3>
      <ul className="odds-tiles">
        {editions.map((e) => (
          <li key={e.id} className={`odds-tile odds-${e.id}`}>
            <span className="num" data-testid={`odds-${e.id}`}>{pct[e.id]}%</span>
            <span className="odds-name">{e.name}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

export function Shop() {
  const selectPack = useBooth((s) => s.selectPack)
  const [howOpen, setHowOpen] = useState(false)
  const howId = useId()
  return (
    <div className="counter">
      <h2 className="shop-sign">SHOP</h2>
      <div className="counter-body">
        <aside className="counter-side">
          <OddsTiles />
          <button className="btn red big" onClick={() => selectPack('classic')}>Open pack</button>
          <button className="btn blue big" aria-expanded={howOpen} aria-controls={howId} onClick={() => setHowOpen((o) => !o)}>
            How it works
          </button>
          <ol id={howId} className="how" hidden={!howOpen}>
            {howOpen && (
              <>
                <li>Pick a card or a pack</li>
                <li>Strike a pose</li>
                <li>Keep, download or print</li>
              </>
            )}
          </ol>
        </aside>
        <div className="shelves">
          <section className="shelf" aria-label="Cards">
            <div className="shelf-row">
              {templates.map((t, i) => (
                <CardTile key={t.id} template={t} delay={i * 0.35} />
              ))}
            </div>
          </section>
          <section className="shelf" aria-label="Packs">
            <div className="shelf-row">
              {PACKS.map((p, i) => (
                <PackTile key={p.id} pack={p} delay={i * 0.35} />
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
