export const VERTEX = `
attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`

// Our own swirl: polar twist + layered sine warps, posterized for a pixel-art feel.
export const FRAGMENT = `
precision mediump float;
uniform vec2 u_res;
uniform float u_time;
void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_res) / min(u_res.x, u_res.y);
  float r = length(uv);
  float a = atan(uv.y, uv.x) + r * 2.6 - u_time * 0.12;
  vec2 p = vec2(cos(a), sin(a)) * r * 3.0;
  for (int i = 1; i < 5; i++) {
    float fi = float(i);
    p += vec2(0.6 / fi * sin(fi * p.y + u_time * 0.30 + 0.3 * fi),
              0.6 / fi * cos(fi * p.x + u_time * 0.25 + 0.3 * fi));
  }
  float t = 0.5 + 0.5 * sin(p.x + p.y);
  vec3 red = vec3(0.86, 0.26, 0.29);
  vec3 blue = vec3(0.00, 0.50, 0.84);
  vec3 dark = vec3(0.11, 0.11, 0.17);
  vec3 col = mix(red, blue, smoothstep(0.2, 0.8, t));
  col = mix(col, dark, 0.65 * smoothstep(0.5, 1.0, 0.5 + 0.5 * sin(p.x * 1.7 - p.y * 1.3)));
  col = floor(col * 8.0) / 8.0;
  gl_FragColor = vec4(col, 1.0);
}
`

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const shader = gl.createShader(type)
  if (!shader) return null
  gl.shaderSource(shader, src)
  gl.compileShader(shader)
  return gl.getShaderParameter(shader, gl.COMPILE_STATUS) ? shader : null
}

export function createProgram(gl: WebGLRenderingContext): WebGLProgram | null {
  const vs = compile(gl, gl.VERTEX_SHADER, VERTEX)
  const fs = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT)
  const program = gl.createProgram()
  if (!vs || !fs || !program) return null
  gl.attachShader(program, vs)
  gl.attachShader(program, fs)
  gl.linkProgram(program)
  return gl.getProgramParameter(program, gl.LINK_STATUS) ? program : null
}
