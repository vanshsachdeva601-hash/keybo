import * as THREE from 'three'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { createContourMaterial, buildCapGeometry } from './keycap.js'

// =====================================================================
// SWITCHES.  Option B = TERRAIN + KEYCAPS.  Option A = TERRAIN only (set KEYCAPS to false).
// =====================================================================
const ENABLED = true // false = no hero background at all
const TERRAIN = true // the slowly moving contour map
const KEYCAPS = true // dark keycaps drifting in the empty corners

// ---------- Look (tuning) ----------
const LEVELS = 9 // number of contour lines (more = busier)
const HILLS = 2.6 // how many hills fit on the screen (more = smaller hills)
const LINE_ALPHA = 0.15 // how visible the lines are
const SPEED = 0.03 // how fast the terrain breathes
const CAP_COUNT = 6 // floating keycaps (desktop). Phones get 4.
const CAP_LIGHT = true // true = dull, faded white keycaps. false = back to the dark ones (this one line is the undo).
const CAP_COLOR = 0xe6e9ef // colour of the light keycaps
const CAP_OPACITY = 0.9 // lower = more faded
const CAP_TINT = 0.3 // how much of the mode colour the keycaps pick up. 0 = none (stay grey), 1 = fully the mode colour

const noop = { show() {}, setColor() {}, pulse() {} }

const hexToRgb = (n) => [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
const smooth = (x) => { const t = Math.max(0, Math.min(1, x)); return t * t * (3 - 2 * t) }
const seeded = (seed) => () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296 // same layout on every load

// ---------- Terrain shader: a full-screen quad, no camera involved ----------
const VERT = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }`

const FRAG = `
  uniform vec2 uRes;
  uniform float uTime;
  uniform vec3 uColor;
  uniform float uFade;
  uniform float uPulse;
  uniform float uWave;
  uniform float uPx;
  uniform float uLevels;
  uniform float uHills;
  uniform float uAlpha;
  varying vec2 vUv;

  float bgHash(vec3 p) {
    p = fract(p * 0.3183099 + vec3(0.1));
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  float bgNoise(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
    return mix(
      mix(mix(bgHash(i), bgHash(i + vec3(1.0, 0.0, 0.0)), f.x), mix(bgHash(i + vec3(0.0, 1.0, 0.0)), bgHash(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
      mix(mix(bgHash(i + vec3(0.0, 0.0, 1.0)), bgHash(i + vec3(1.0, 0.0, 1.0)), f.x), mix(bgHash(i + vec3(0.0, 1.0, 1.0)), bgHash(i + vec3(1.0, 1.0, 1.0)), f.x), f.y),
      f.z
    );
  }
  float bgField(vec2 p, float t) {
    return bgNoise(vec3(p, t)) * 0.6
         + bgNoise(vec3(p * 2.0 + 7.3, t * 1.4 + 3.0)) * 0.3
         + bgNoise(vec3(p * 4.0 + 3.1, t * 1.8 + 6.0)) * 0.1;
  }

  void main() {
    float aspect = uRes.x / uRes.y;
    vec2 p = (vUv - 0.5) * vec2(aspect, 1.0) * uHills;
    float t = bgField(p, uTime) * uLevels;

    // a thin line wherever the height crosses a whole number (same trick as the keycaps)
    float w = max(fwidth(t), 0.0001);
    float d = abs(fract(t + 0.5) - 0.5);
    float line = clamp(uPx * 0.5 + 0.5 - d / w, 0.0, 1.0);

    // strongest in the middle, fading toward the corners
    vec2 c = (vUv - vec2(0.5)) * vec2(1.0, 1.25);
    float r = length(c);
    float mask = 1.0 - smoothstep(0.3, 0.85, r);

    // a ring that runs outward when the mode changes
    float q = (r - uWave) / 0.07;
    float ring = exp(-q * q) * (1.0 - uWave);

    float a = line * mask * (uAlpha + uPulse * 0.35 + ring * 0.45);

    // a soft pool of light under the keyboard
    vec2 pc = (vUv - vec2(0.5, 0.18)) * vec2(1.0, 1.9);
    float pool = exp(-pow(length(pc) / 0.55, 2.0)) * 0.07;

    gl_FragColor = vec4(uColor, (a + pool) * uFade);
  }`

export function initHeroBg({ isMobile = false } = {}) {
  if (!ENABLED || (!TERRAIN && !KEYCAPS)) return noop
  const anchor = document.querySelector('#webgl')
  if (!anchor) return noop
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  // A separate canvas behind the hero text (the main canvas sits above it)
  const canvas = document.createElement('canvas')
  canvas.id = 'hero-bg'
  anchor.before(canvas)

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true, powerPreference: 'low-power' })
  renderer.setPixelRatio(isMobile ? 0.75 : 1) // soft background, so low resolution is fine
  renderer.setClearColor(0x000000, 0)

  const scene = new THREE.Scene()
  scene.fog = new THREE.FogExp2(0x0b0b0c, 0.028) // far keycaps sink into the dark
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 120)
  camera.position.set(0, 0, 24)

  // colour: starts as the site's current accent, then follows the mode
  const start = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#c7ccd6'
  const cur = new THREE.Color(start)
  const target = new THREE.Color(start)
  let wave = 1 // 1 = idle
  let pulseV = 0

  // ---------- Terrain ----------
  let U = null
  if (TERRAIN) {
    U = {
      uRes: { value: new THREE.Vector2(1, 1) },
      uTime: { value: 0 },
      uColor: { value: new THREE.Vector3() },
      uFade: { value: 0 },
      uPulse: { value: 0 },
      uWave: { value: 1 },
      uPx: { value: 1.2 },
      uLevels: { value: LEVELS },
      uHills: { value: HILLS },
      uAlpha: { value: LINE_ALPHA },
    }
    const quad = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({ uniforms: U, vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthTest: false, depthWrite: false })
    )
    quad.frustumCulled = false // its position ignores the camera, so culling would hide it
    quad.renderOrder = -10
    scene.add(quad)
  }

  // ---------- Floating keycaps (Option B) ----------
  const group = new THREE.Group()
  scene.add(group)
  const caps = []
  let capMat = null
  const rim = new THREE.DirectionalLight(0xffffff, 2.0) // an edge light in the mode colour
  if (KEYCAPS) {
    const ambient = new THREE.AmbientLight(0xffffff, 0.8)
    const key = new THREE.DirectionalLight(0xffffff, 1.5)
    key.position.set(4, 6, 8)
    rim.position.set(-6, 4, -6)
    scene.add(ambient, key, rim)

    capMat = createContourMaterial({ px: 1.0, levels: 14, scale: 1 / 4.0 })
    capMat.material.transparent = true // so the whole group can fade with the scroll
    if (CAP_LIGHT) { capMat.material.color.set(CAP_COLOR); capMat.material.roughness = 1 }

    const rnd = seeded(11)
    const count = isMobile ? 4 : CAP_COUNT
    const WIDTHS = [1, 1.25, 1.5, 2, 1, 2.25, 1.25, 1, 1.75]
    for (let i = 0; i < count; i++) {
      const w = WIDTHS[i % WIDTHS.length]
      const geo = buildCapGeometry({
        dx: w - 0.14, h: 0.6, dz: 0.86, inset: 0.09, slope: 0.2, seg: isMobile ? 1 : 2, radius: 0.07,
        offset: new THREE.Vector3(rnd() * 20, rnd() * 20, rnd() * 20), // each cap shows a different piece of the map
      })
      const m = new THREE.Mesh(geo, capMat.material)
      const upper = i < count * 0.6 // most sit in the empty top corners, the rest along the sides
      m.userData = {
        side: i % 2 ? 1 : -1,
        z: -16 + rnd() * 17,
        nx: upper ? 0.56 + rnd() * 0.38 : 0.8 + rnd() * 0.17, // position as a fraction of the half-screen
        ny: upper ? 0.2 + rnd() * 0.6 : -0.8 + rnd() * 0.85,
        nxP: 0.15 + rnd() * 0.75, // the same, for portrait screens (phones): top and bottom bands
        nyP: (i % 2 ? 1 : -1) * (0.62 + rnd() * 0.28),
        sc: 1.5 + rnd() * 1.8,
        rx: (rnd() - 0.5) * 0.3, ry: (rnd() - 0.5) * 0.3, rz: (rnd() - 0.5) * 0.3,
        sp: 0.25 + rnd() * 0.3, ph: rnd() * 6.28, amp: 0.25 + rnd() * 0.4,
        x0: 0, y0: 0,
      }
      m.rotation.set(rnd() * 6.28, rnd() * 6.28, rnd() * 6.28)
      group.add(m)
      caps.push(m)
    }
  }

  // Keep every cap at the same place on the SCREEN, whatever the depth or the window shape
  function place() {
    const aspect = camera.aspect
    const portrait = aspect < 1.05
    caps.forEach((m) => {
      const u = m.userData
      const hh = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * (camera.position.z - u.z)
      const hw = hh * aspect
      u.x0 = u.side * (portrait ? u.nxP : u.nx) * hw
      u.y0 = (portrait ? u.nyP : u.ny) * hh
      m.position.z = u.z
      m.scale.setScalar(u.sc * (portrait || isMobile ? 0.7 : 1))
    })
  }

  function resize() {
    const w = window.innerWidth
    const h = window.innerHeight
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    if (U) {
      renderer.getDrawingBufferSize(U.uRes.value)
      U.uPx.value = 1.2 * renderer.getPixelRatio()
    }
    place()
  }
  window.addEventListener('resize', resize)
  resize()

  // ---------- Fade: in after the intro, out as the hero ends ----------
  const S = { appear: 0, scroll: 1 }
  const fadeOut = (self) => { S.scroll = 1 - smooth(self.progress) }
  ScrollTrigger.create({
    trigger: '#modes',
    start: 'bottom 88%', // the background stays all through the hero and the Modes section...
    end: 'bottom 45%', // ...and is gone by the time Anatomy starts
    onUpdate: fadeOut,
    onRefresh: fadeOut, // also correct after a reload in the middle of the page
  })

  let mx = 0
  let my = 0
  let px = 0
  let py = 0
  window.addEventListener('pointermove', (e) => {
    mx = (e.clientX / window.innerWidth) * 2 - 1
    my = (e.clientY / window.innerHeight) * 2 - 1
  })
  const pulse = () => { pulseV = Math.min(1, pulseV + 0.4) }
  window.addEventListener('keybo:press', pulse) // typing makes the lines flash

  // ---------- Loop ----------
  let last = 0
  let time = 0
  let hidden = true
  let gridOff = false
  canvas.style.visibility = 'hidden'
  function frame(now) {
    requestAnimationFrame(frame)
    const dt = Math.min((now - last) / 1000, 0.05)
    last = now
    const total = S.appear * S.scroll

    if (total < 0.003) { // nothing to show: do no work at all
      if (!hidden) { canvas.style.visibility = 'hidden'; hidden = true }
      if (gridOff) { document.documentElement.classList.remove('hero-bg-on'); gridOff = false }
      return
    }
    if (hidden) { canvas.style.visibility = 'visible'; hidden = false }
    const wantOff = TERRAIN && total > 0.35 // the faint page grid steps aside while the terrain is on
    if (wantOff !== gridOff) { document.documentElement.classList.toggle('hero-bg-on', wantOff); gridOff = wantOff }

    if (!reduce) time += dt
    cur.lerp(target, 1 - Math.exp(-dt * 4)) // the colour glides to the new mode colour
    wave = Math.min(1, wave + dt / 1.5)
    pulseV *= Math.exp(-dt * 3.2)

    if (U) {
      U.uTime.value = time * SPEED
      U.uColor.value.fromArray(hexToRgb(cur.getHex()))
      U.uFade.value = total
      U.uPulse.value = pulseV
      U.uWave.value = wave
    }

    if (KEYCAPS) {
      px += (mx - px) * 0.04
      py += (my - py) * 0.04
      group.position.set(px * 0.6, -py * 0.35, 0) // a little parallax
      rim.color.copy(cur)
      capMat.lineColor.set(CAP_LIGHT ? 0x2c313b : 0x6c7584).lerp(cur, CAP_LIGHT ? 0.25 : 0.5) // dark lines show on light keycaps
      if (CAP_LIGHT) capMat.material.color.set(CAP_COLOR).lerp(cur, CAP_TINT) // the keycaps take a hint of the mode colour (cur glides, so the change is smooth)      group.visible = total > 0.01
      caps.forEach((m) => {
        const u = m.userData
        if (!reduce) {
          m.rotation.x += dt * u.rx
          m.rotation.y += dt * u.ry
          m.rotation.z += dt * u.rz
        }
        m.position.x = u.x0
        m.position.y = u.y0 + Math.sin(time * u.sp + u.ph) * u.amp
      })
    }
    renderer.render(scene, camera)
  }
  requestAnimationFrame(frame)

  return {
    show() { gsap.to(S, { appear: 1, duration: 1.8, ease: 'power2.out' }) },
    setColor(hex) { target.set(hex); wave = 0 }, // new colour, plus a ring that runs outward
    pulse,
  }
}