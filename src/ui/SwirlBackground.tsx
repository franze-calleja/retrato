import { useEffect, useRef } from 'react'
import { createProgram } from './swirlShader'

const PIXEL = 6 // CSS px per shader pixel; the canvas is upscaled with image-rendering: pixelated
const STILL_TIME = 20 // seconds; the frame shown when motion is reduced

export function SwirlBackground() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    const gl = canvas?.getContext('webgl', { antialias: false }) ?? null
    if (!canvas || !gl) return
    const program = createProgram(gl)
    if (!program) return

    gl.useProgram(program)
    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    const aPos = gl.getAttribLocation(program, 'a_pos')
    gl.enableVertexAttribArray(aPos)
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0)
    const uRes = gl.getUniformLocation(program, 'u_res')
    const uTime = gl.getUniformLocation(program, 'u_time')

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)')
    const t0 = performance.now()
    let raf = 0

    const draw = (seconds: number) => {
      gl.uniform2f(uRes, canvas.width, canvas.height)
      gl.uniform1f(uTime, seconds)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
    }
    const loop = (now: number) => {
      draw((now - t0) / 1000)
      raf = requestAnimationFrame(loop)
    }
    const run = () => {
      cancelAnimationFrame(raf)
      if (reduce.matches) draw(STILL_TIME)
      else if (!document.hidden) raf = requestAnimationFrame(loop)
    }
    const resize = () => {
      canvas.width = Math.ceil(window.innerWidth / PIXEL)
      canvas.height = Math.ceil(window.innerHeight / PIXEL)
      gl.viewport(0, 0, canvas.width, canvas.height)
      run()
    }

    resize()
    canvas.dataset.ready = 'true'
    window.addEventListener('resize', resize)
    document.addEventListener('visibilitychange', run)
    reduce.addEventListener('change', run)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      document.removeEventListener('visibilitychange', run)
      reduce.removeEventListener('change', run)
    }
  }, [])

  return <canvas ref={ref} className="swirl" aria-hidden="true" />
}
