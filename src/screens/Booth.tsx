import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react'
import { useCamera, type CameraStatus } from '../camera/useCamera'
import { getPack } from '../packs/catalog'
import { capturePackPhoto } from '../packs/capture'
import { packViewfinder } from '../packs/viewfinder'
import { cropPhoto, type PhotoSource } from '../photo/crop'
import { composeStamp } from '../render/composeStamp'
import { EXPORT_SCALE, PREVIEW_SCALE } from '../render/export'
import { useBooth } from '../store/booth'
import { placeholderPhoto } from '../templates/placeholder'
import { getTemplate } from '../templates/registry'

const MESSAGES: Partial<Record<CameraStatus, string>> = {
  insecure: 'The camera only works over HTTPS (or on localhost). You can still upload a photo.',
  denied: 'Camera access was blocked. Allow it in your browser’s site settings, then retry — or upload a photo.',
  unavailable: 'No camera was found. Plug one in and retry, or upload a photo.',
  disconnected: 'The camera stopped. Check it’s connected, then retry — or upload a photo.',
}

export function Booth() {
  const templateId = useBooth((s) => s.templateId)
  const values = useBooth((s) => s.values)
  const { setCapture, goToPicker } = useBooth.getState()
  const mode = useBooth((s) => s.mode)
  const packId = useBooth((s) => s.packId)
  const template = mode === 'pack' ? packViewfinder(getPack(packId)) : getTemplate(templateId)

  const { videoRef, status, start } = useCamera()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [count, setCount] = useState<number | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)

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
    if (status === 'live' || !canvasRef.current) return
    composeStamp(template, placeholderPhoto(template), values, PREVIEW_SCALE, canvasRef.current)
  }, [status, template, values])

  // Live preview loop.
  useEffect(() => {
    if (status !== 'live') return
    let raf = 0
    const tick = () => {
      const photo = liveSource()
      if (photo && canvasRef.current) {
        composeStamp(template, photo, useBooth.getState().values, PREVIEW_SCALE, canvasRef.current)
      }
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

  // Countdown 3 → 2 → 1 → capture.
  useEffect(() => {
    if (count === null) return
    const id = setTimeout(() => {
      if (count > 1) return setCount(count - 1)
      setCount(null)
      const photo = liveSource()
      if (photo) keep(photo)
    }, 1000)
    return () => clearTimeout(id)
  }, [count, liveSource, keep])

  async function onUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setUploadError(null)
    try {
      const bmp = await createImageBitmap(file)
      if (mounted.current) keep({ source: bmp, w: bmp.width, h: bmp.height })
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

      <div className="preview-wrap">
        <canvas ref={canvasRef} className="stamp-canvas" role="img" aria-label={`${template.name} live preview`} />
        {count !== null && count > 0 && (
          <div key={count} className="countdown" aria-live="assertive">{count}</div>
        )}
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
        <button className="btn red" disabled={status !== 'live' || count !== null} onClick={() => setCount(3)}>
          Take photo
        </button>
        <label className="btn blue">
          Upload photo
          <input type="file" accept="image/*" className="visually-hidden" onChange={onUpload} />
        </label>
      </div>
      {uploadError && <p className="error" role="alert">{uploadError}</p>}
    </section>
  )
}
