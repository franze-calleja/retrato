import { useEffect, useId, useMemo, useRef, useState, type CSSProperties } from 'react'
import { displayedOdds } from '../editions/odds'
import { editions } from '../editions/registry'
import { PACKS, type PackDef } from '../packs/catalog'
import { packArt } from '../packs/packArt'
import { nextFeatured } from '../shop/featured'
import { glintDelay } from '../shop/glint'
import { useBooth } from '../store/booth'
import { useOperator } from '../store/operator'
import { useStats } from '../store/stats'
import { resolveDefaults } from '../templates/fields'
import { placeholderPhoto } from '../templates/placeholder'
import { getTemplate, templates } from '../templates/registry'
import type { Template } from '../templates/types'
import { TiltCard } from '../ui/TiltCard'
import { StampCanvas } from './StampCanvas'

const TEMPLATE_IDS = templates.map((t) => t.id)
const BULBS_ACROSS = 12
const BULBS_DOWN = 4

function CardTile({ template, delay, slot, total, index, spin }: { template: Template; delay: number; slot: number; total: number; index: number; spin: boolean }) {
  const [glint] = useState(() => glintDelay(slot, total, performance.now()))
  const infoId = useId()
  const selectTemplate = useBooth((s) => s.selectTemplate)
  const photo = useMemo(() => placeholderPhoto(template), [template])
  const values = useMemo(() => resolveDefaults(template), [template])
  return (
    <div className="tile">
      <span className="tag" aria-hidden="true">FREE</span>
      <TiltCard delay={delay}>
        <button
          className={`tile-btn ${spin ? 'spin-in' : ''}`}
          style={{ '--glint-delay': `${glint}s`, '--i': index } as CSSProperties}
          aria-label={template.name}
          aria-describedby={infoId}
          onClick={() => selectTemplate(template.id)}
        >
          <StampCanvas template={template} photo={photo} values={values} scale={2} />
        </button>
      </TiltCard>
      <span className="nameplate" aria-hidden="true">{template.name}</span>
      <div className="info" role="tooltip" id={infoId}>{template.description}</div>
    </div>
  )
}

function PackTile({ pack, delay, slot, total }: { pack: PackDef; delay: number; slot: number; total: number }) {
  const [glint] = useState(() => glintDelay(slot, total, performance.now()))
  const infoId = useId()
  const selectPack = useBooth((s) => s.selectPack)
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    if (ref.current) packArt(pack, 2, ref.current)
  }, [pack])
  return (
    <div className="tile">
      <span className="tag" aria-hidden="true">FREE</span>
      <TiltCard delay={delay} motion="sway">
        <button
          className="tile-btn pack-btn"
          style={{ '--glint-delay': `${glint}s` } as CSSProperties}
          aria-label={pack.name}
          aria-describedby={infoId}
          onClick={() => selectPack(pack.id)}
        >
          <canvas ref={ref} className="stamp-canvas" aria-hidden="true" />
        </button>
      </TiltCard>
      <span className="nameplate" aria-hidden="true">{pack.name}</span>
      <div className="info" role="tooltip" id={infoId}>{pack.description}</div>
    </div>
  )
}

/** Light-bulb positions (percent) around the sign's frame, clockwise from the top-left. */
const BULBS = [
  ...Array.from({ length: BULBS_ACROSS }, (_, i) => ({ x: (i / (BULBS_ACROSS - 1)) * 100, y: 0 })),
  ...Array.from({ length: BULBS_DOWN }, (_, i) => ({ x: 100, y: ((i + 1) / (BULBS_DOWN + 1)) * 100 })),
  ...Array.from({ length: BULBS_ACROSS }, (_, i) => ({ x: 100 - (i / (BULBS_ACROSS - 1)) * 100, y: 100 })),
  ...Array.from({ length: BULBS_DOWN }, (_, i) => ({ x: 0, y: 100 - ((i + 1) / (BULBS_DOWN + 1)) * 100 })),
]

function Marquee() {
  return (
    <div className="marquee">
      <div className="marquee-frame" aria-hidden="true">
        {BULBS.map((b, i) => (
          <span key={i} className="bulb" style={{ left: `${b.x}%`, top: `${b.y}%`, '--i': i } as CSSProperties} />
        ))}
      </div>
      <h2 className="marquee-title">SHOP</h2>
      <p className="marquee-tag">Strike a pose!</p>
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

function DeckPile({ count }: { count: number }) {
  const layers = Math.min(6, Math.max(1, count))
  return (
    <div className="deck" role="img" aria-label={`${count} photos taken`}>
      {Array.from({ length: layers }, (_, l) => (
        <span key={l} className="deck-card" style={{ '--l': layers - 1 - l } as CSSProperties} />
      ))}
      <span className="deck-count num" aria-hidden="true">{count}</span>
    </div>
  )
}

export function Shop() {
  const selectPack = useBooth((s) => s.selectPack)
  const photos = useStats((s) => s.photos)
  const [featured, setFeatured] = useState(() => nextFeatured(TEMPLATE_IDS, [], Math.random))
  // Bumped on every reroll: remounts the featured row so the new cards spin in.
  const [rolls, setRolls] = useState(0)
  const [showAll, setShowAll] = useState(false)
  const [howOpen, setHowOpen] = useState(false)
  const howId = useId()
  const shelfId = useId()
  const shown = showAll ? templates : featured.map(getTemplate)
  const shelfItems = shown.length + PACKS.length

  return (
    <div className="shop">
      <aside className="shop-side">
        <Marquee />
        <section className="stat-box" aria-labelledby="photos-title">
          <h3 id="photos-title">Photos taken</h3>
          <span className="num" data-testid="photos">{photos}</span>
        </section>
        <OddsTiles />
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

      <div className="counter">
        <div className="counter-top">
          <div className="counter-buttons">
            <button className="btn red big" onClick={() => selectPack('classic')}>Open pack</button>
            <button className="btn green big" onClick={() => {
                setFeatured((cur) => nextFeatured(TEMPLATE_IDS, cur, Math.random))
                setRolls((n) => n + 1)
              }}
            >
              Reroll <small>FREE</small>
            </button>
          </div>
          <section className="shelf" aria-label="Cards" id={shelfId}>
            {/* Remount on reroll so the new cards spin in; with every card shown nothing changes, so no spin. */}
            <div className="shelf-row" key={showAll ? 'all' : rolls}>
              {shown.map((t, i) => (
                <CardTile key={t.id} template={t} delay={i * 0.35} slot={i} total={shelfItems} index={i} spin={!showAll && rolls > 0} />
              ))}
            </div>
          </section>
        </div>
        <button className="link-btn" aria-expanded={showAll} aria-controls={shelfId} onClick={() => setShowAll((s) => !s)}>
          {showAll ? 'Show featured' : 'See all cards'}
        </button>
        <div className="counter-bottom">
          <section className="shelf" aria-label="Packs">
            <div className="shelf-row">
              {PACKS.map((p, i) => (
                <PackTile key={p.id} pack={p} delay={i * 0.35} slot={shown.length + i} total={shelfItems} />
              ))}
            </div>
          </section>
          <DeckPile count={photos} />
        </div>
      </div>
    </div>
  )
}
