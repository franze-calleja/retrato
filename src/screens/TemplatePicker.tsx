import { useMemo } from 'react'
import { useBooth } from '../store/booth'
import { resolveDefaults } from '../templates/fields'
import { placeholderPhoto } from '../templates/placeholder'
import { templates } from '../templates/registry'
import { TiltCard } from '../ui/TiltCard'
import { StampCanvas } from './StampCanvas'

export function TemplatePicker() {
  const selectTemplate = useBooth((s) => s.selectTemplate)
  const previews = useMemo(
    () => templates.map((t) => ({ t, photo: placeholderPhoto(t), values: resolveDefaults(t) })),
    [],
  )
  return (
    <section className="screen">
      <h2>Pick a card</h2>
      <div className="picker-grid">
        {previews.map(({ t, photo, values }, i) => (
          <TiltCard key={t.id} delay={i * 0.4}>
            <button className="picker-card" onClick={() => selectTemplate(t.id)}>
              <StampCanvas template={t} photo={photo} values={values} scale={2} label={`${t.name} preview`} />
              <span className="card-label">{t.name}</span>
            </button>
          </TiltCard>
        ))}
      </div>
    </section>
  )
}
