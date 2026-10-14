import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react'
import { CAMERA_SIZE, FLASH, REAR_SCREEN, SHUTTER, cameraArt, type CameraSide } from '../camera/cameraArt'
import { screenSize } from '../camera/liveCrop'
import type { Rect, Template } from '../templates/types'
import { TiltCard } from '../ui/TiltCard'

const ART_SCALE = 4
const SCREEN_W = 240
const pct = (r: Rect) => ({
  left: `${(r.x / CAMERA_SIZE.w) * 100}%`,
  top: `${(r.y / CAMERA_SIZE.h) * 100}%`,
  width: `${(r.w / CAMERA_SIZE.w) * 100}%`,
  height: `${(r.h / CAMERA_SIZE.h) * 100}%`,
})

interface Props {
  side: CameraSide
  template: Template
  title: string
  count: number | null
  shutterEnabled: boolean
  onShutter: () => void
  /** Receives the canvas of the screen currently facing the guest. */
  screenRef: (canvas: HTMLCanvasElement | null) => void
  flashing: boolean
  /** A print is coming out: make room above the camera. */
  printing?: boolean
  children?: ReactNode
}

function Art({ side }: { side: CameraSide }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    if (ref.current) cameraArt(side, ART_SCALE, ref.current)
  }, [side])
  // Sized up front so the first paint already has the camera's shape.
  return <canvas ref={ref} width={CAMERA_SIZE.w * ART_SCALE} height={CAMERA_SIZE.h * ART_SCALE} className="camera-art" aria-hidden="true" />
}

export function CameraStage({ side, template, title, count, shutterEnabled, onShutter, screenRef, flashing, printing = false, children }: Props) {
  const size = screenSize(template, SCREEN_W)
  const countdown = count !== null && count > 0 && (
    <div key={count} className="countdown" aria-hidden="true">{count}</div>
  )
  const label = `${template.name} live preview`
  return (
    <div className={`camera-stage ${side} ${printing ? 'printing' : ''}`}>
      <div className="camera-holder">
        {children}
        <TiltCard>
          <div className="camera-flip" data-side={side}>
            <div className="camera-face camera-front" aria-hidden={side !== 'front'}>
              <Art side="front" />
              <span className={`camera-flash ${flashing ? 'on' : ''}`} style={pct(FLASH)} aria-hidden="true" />
              <button
                className="shutter-hit"
                style={pct(SHUTTER)}
                tabIndex={-1}
                aria-hidden="true"
                disabled={!shutterEnabled}
                onClick={onShutter}
              />
            </div>
            <div className="camera-face camera-back" aria-hidden={side !== 'back'}>
              <Art side="back" />
              <div className="rear-screen" style={pct(REAR_SCREEN)}>
                <canvas
                  ref={side === 'back' ? screenRef : undefined}
                  width={size.w}
                  height={size.h}
                  className="stamp-canvas"
                  role={side === 'back' ? 'img' : undefined}
                  aria-label={side === 'back' ? label : undefined}
                />
                {side === 'back' && countdown}
              </div>
            </div>
          </div>
        </TiltCard>
      </div>
      {side === 'front' && (
        <div className="side-screen" style={{ '--aspect': `${size.w} / ${size.h}` } as CSSProperties}>
          <span className="hinge" aria-hidden="true" />
          <div className="side-screen-glass">
            <canvas ref={screenRef} width={size.w} height={size.h} className="stamp-canvas" role="img" aria-label={label} />
            {countdown}
          </div>
          <span className="side-screen-name">{title}</span>
        </div>
      )}
    </div>
  )
}
