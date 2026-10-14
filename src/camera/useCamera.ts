import { useCallback, useEffect, useRef, useState } from 'react'

export type CameraStatus = 'idle' | 'requesting' | 'live' | 'denied' | 'unavailable' | 'insecure' | 'disconnected'

const stopStream = (s: MediaStream | null) => s?.getTracks().forEach((t) => t.stop())

export function useCamera() {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  // Bumped by stop/unmount so a getUserMedia call that resolves later knows it is stale.
  const generation = useRef(0)
  const [status, setStatus] = useState<CameraStatus>('idle')

  const release = useCallback(() => {
    generation.current++
    stopStream(streamRef.current)
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
  }, [])

  const stop = useCallback(() => {
    release()
    setStatus('idle')
  }, [release])

  const start = useCallback(async () => {
    if (!window.isSecureContext) return setStatus('insecure')
    if (!navigator.mediaDevices?.getUserMedia) return setStatus('unavailable')
    release()
    const mine = generation.current
    setStatus('requesting')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      })
      if (mine !== generation.current) {
        stopStream(stream)
        return
      }
      streamRef.current = stream
      // An unplugged or suspended camera ends its track; say so instead of showing a frozen "live" feed.
      for (const t of stream.getTracks())
        t.addEventListener?.('ended', () => {
          if (mine === generation.current) setStatus('disconnected')
        })
      const video = videoRef.current
      if (video) {
        video.srcObject = stream
        video.play().catch(() => {})
      }
      setStatus('live')
    } catch (err) {
      if (mine !== generation.current) return
      const name = err instanceof DOMException ? err.name : ''
      setStatus(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'unavailable')
    }
  }, [release])

  useEffect(() => release, [release])

  return { videoRef, status, start, stop }
}
