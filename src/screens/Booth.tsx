import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react'
import { drawLiveCrop } from '../camera/liveCrop'
import { useCamera, type CameraStatus } from '../camera/useCamera'
import { getPack } from '../packs/catalog'
import { capturePackPhoto } from '../packs/capture'
import { packViewfinder } from '../packs/viewfinder'
import { cropPhoto, type PhotoSource } from '../photo/crop'
import { EXPORT_SCALE } from '../render/export'
import { useBooth } from '../store/booth'
import { placeholderPhoto } from '../templates/placeholder'
import { getTemplate } from '../templates/registry'
import { prefersReducedMotion } from '../ui/motion'
import { CameraStage } from './CameraStage'
import { InstantPrint } from './InstantPrint'

const MESSAGES: Partial<Record<CameraStatus, string>> = {
  insecure: 'The camera only works over HTTPS (or on localhost). You can still upload a photo.',
  denied: 'Camera access was blocked. Allow it in your browser’s site settings, then retry — or upload a photo.',
  unavailable: 'No camera was found. Plug one in and retry, or upload a photo.',
  disconnected: 'The camera stopped. Check it’s connected, then retry — or upload a photo.',
}

export function Booth() {
  const templateId = useBooth((s) => s.templateId)
  const { setCapture, goToPicker } = useBooth.getState()
  const mode = useBooth((s) => s.mode)
  const packId = useBooth((s) => s.packId)
  const template = mode === 'pack' ? packViewfinder(getPack(packId)) : getTemplate(templateId)

  const { videoRef, status, start } = useCamera()
  const side = useBooth((s) => s.cameraSide)
  const screenCanvas = useRef<HTMLCanvasElement | null>(null)
  const setScreen = useCallback((c: HTMLCanvasElement | null) => {
    screenCanvas.current = c
  }, [])
  const [count, setCount] = useState<number | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [reducedMotion] = useState(prefersReducedMotion)
  const [printing, setPrinting] = useState<PhotoSource | null>(null)
  const [flashing, setFlashing] = useState(false)

  useEffect(() => {
    void start()
  }, [start])

  // An upload can still be decoding when the guest leaves; its result must not open the editor.
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const liveSource = useCallback((): PhotoSource | null => {
    const v = videoRef.current
    if (!v || v.videoWidth === 0) return null
    return { source: v, w: v.videoWidth, h: v.videoHeight, mirror: true }
  }, [videoRef])

  // Idle preview: placeholder until the camera is live.
  useEffect(() => {
    const c = screenCanvas.current
    if (status === 'live' || !c) return
    drawLiveCrop(c.getContext('2d')!, placeholderPhoto(template), template, c.width, c.height)
  }, [status, template, side])

  // Live preview loop.
  useEffect(() => {
    if (status !== 'live') return
    let raf = 0
    const tick = () => {
      const photo = liveSource()
      const c = screenCanvas.current
      if (photo && c) drawLiveCrop(c.getContext('2d')!, photo, template, c.width, c.height)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [status, template, liveSource])

  const keep = useCallback(
    (photo: PhotoSource) => {
      if (mode === 'pack') return setCapture(capturePackPhoto(photo))
      const r = template.photoRect
      setCapture(cropPhoto(photo, r.w * EXPORT_SCALE, r.h * EXPORT_SCALE))
    },
    [mode, template, setCapture],
  )

  // Freeze the frame now (the video keeps moving), then print it before handing off.
  const capture = useCallback(
    (photo: PhotoSource) => {
      const frozen = capturePackPhoto(photo)
      if (reducedMotion) return keep(frozen)
      setPrinting(frozen)
    },
    [keep, reducedMotion],
  )

  // A camera that drops mid-countdown cancels it rather than capturing a frozen frame.
  const [countStatus, setCountStatus] = useState(status)
  if (countStatus !== status) {
    setCountStatus(status)
    if (status !== 'live' && count !== null) setCount(null)
  }

  // Countdown 3 → 2 → 1 → capture.
  useEffect(() => {
    if (count === null) return
    const id = setTimeout(() => {
      if (count > 1) return setCount(count - 1)
      setCount(null)
      const photo = liveSource()
      if (photo) capture(photo)
    }, 1000)
    return () => clearTimeout(id)
  }, [count, liveSource, capture])

  async function onUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setUploadError(null)
    try {
      const bmp = await createImageBitmap(file)
      if (mounted.current) capture({ source: bmp, w: bmp.width, h: bmp.height })
      bmp.close()
    } catch {
      if (!mounted.current) return
      setUploadError('That file couldn’t be read as an image. Try a JPG or PNG.')
    }
  }

  const message = MESSAGES[status]

  return (
    <section className="screen">
      <h2>{template.name}</h2>
      <video ref={videoRef} className="video-feed" muted playsInline aria-hidden="true" />

      <CameraStage
        side={side}
        template={template}
        title={template.name}
        count={count}
        shutterEnabled={status === 'live' && count === null && !printing}
        onShutter={() => setCount(3)}
        screenRef={setScreen}
        flashing={flashing}
        printing={printing !== null}
      >
        {printing && (
          <InstantPrint
            photo={printing}
            mode={mode}
            packId={packId}
            reducedMotion={reducedMotion}
            onFlash={setFlashing}
            onDone={() => {
              if (mounted.current) keep(printing)
            }}
          />
        )}
      </CameraStage>
      {flashing && <div className="screen-flash" aria-hidden="true" />}
      {/* The visible number remounts for its animation; announce through one region that stays put. */}
      <div className="visually-hidden" data-testid="countdown-live" aria-live="assertive">
        {count !== null && count > 0 ? count : ''}
      </div>

      {message && (
        <div className="notice" role="alert">
          <p>{message}</p>
          {status !== 'insecure' && <button className="btn blue" onClick={() => void start()}>Retry camera</button>}
        </div>
      )}
      {status === 'requesting' && <p>Waiting for camera permission…</p>}

      <div className="row">
        <button className="btn" onClick={goToPicker}>Back</button>
        <button className="btn red" disabled={status !== 'live' || count !== null || printing !== null} onClick={() => setCount(3)}>
          Take photo
        </button>
        <label className="btn blue" aria-disabled={printing !== null}>
          Upload photo
          <input type="file" accept="image/*" className="visually-hidden" disabled={printing !== null} onChange={onUpload} />
        </label>
        <button
          className="btn"
          aria-pressed={side === 'back'}
          disabled={printing !== null}
          onClick={() => useBooth.getState().setCameraSide(side === 'front' ? 'back' : 'front')}
        >
          {side === 'front' ? 'Show back' : 'Show front'}
        </button>
      </div>
      {uploadError && <p className="error" role="alert">{uploadError}</p>}
    </section>
  )
}
