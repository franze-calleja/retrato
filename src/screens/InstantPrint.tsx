import { useEffect, useRef } from 'react'
import { getPack } from '../packs/catalog'
import { packArt } from '../packs/packArt'
import { cropPhoto, type PhotoSource } from '../photo/crop'
import { usePrintSequence } from './usePrintSequence'

const PRINT_PHOTO = { w: 276, h: 368 } // 3:4, instant-film picture proportions

interface Props {
  photo: PhotoSource
  mode: 'single' | 'pack'
  packId: string
  reducedMotion: boolean
  onDone: () => void
  onFlash: (on: boolean) => void
}

export function InstantPrint({ photo, mode, packId, reducedMotion, onDone, onFlash }: Props) {
  const { phase, skip } = usePrintSequence(reducedMotion)
  const photoRef = useRef<HTMLCanvasElement>(null)
  const packRef = useRef<HTMLCanvasElement>(null)
  const done = useRef(false)
  const finish = useRef(onDone)
  useEffect(() => {
    finish.current = onDone
  })

  useEffect(() => {
    const c = photoRef.current
    if (!c) return
    const crop = cropPhoto(photo, PRINT_PHOTO.w, PRINT_PHOTO.h)
    c.getContext('2d')!.drawImage(crop.source, 0, 0)
  }, [photo])

  useEffect(() => {
    if (mode === 'pack' && packRef.current) packArt(getPack(packId), 3, packRef.current)
  }, [mode, packId])

  useEffect(() => onFlash(phase === 'flash'), [phase, onFlash])

  // Hand off exactly once.
  useEffect(() => {
    if (phase !== 'done' || done.current) return
    done.current = true
    finish.current()
  }, [phase])

  return (
    <button
      className="instant-print"
      data-phase={phase}
      data-mode={mode}
      aria-label={mode === 'pack' ? 'Skip to your pack' : 'Skip to your card'}
      onClick={skip}
    >
      <span className="print-paper">
        <canvas ref={photoRef} width={PRINT_PHOTO.w} height={PRINT_PHOTO.h} className="print-photo stamp-canvas" aria-hidden="true" />
      </span>
      {mode === 'pack' && <canvas ref={packRef} className="print-pack" aria-hidden="true" />}
    </button>
  )
}
