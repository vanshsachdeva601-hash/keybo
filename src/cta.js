import * as THREE from 'three'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { createBoard, fitCamera, LINE_BASE } from './board.js'
import { DEFAULT_LED, MODE_COLOR } from './keyboard.js'

const ease = (t) => 1 - Math.pow(1 - t, 3)
const clamp01 = (v) => Math.max(0, Math.min(1, v))
const REST_X = 0.75
const REST_Y = -0.35

export function initCta(mobile) {
  const host = document.querySelector('#cta-3d')
  const noop = { setAccent() {}, setMode() {}, celebrate() {} }
  if (!host) return noop
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  const renderer = new THREE.WebGLRenderer({ antialias: !mobile, alpha: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, mobile ? 1.25 : 1.75))
  host.appendChild(renderer.domElement)

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 200)
  scene.add(new THREE.AmbientLight(0xffffff, 1.1))
  const sun = new THREE.DirectionalLight(0xffffff, 2.2)
  sun.position.set(3, 8, 6)
  scene.add(sun)
  const rim = new THREE.DirectionalLight(0x9db4ff, 0.8)
  rim.position.set(-6, 4, -8)
  scene.add(rim)

  // The same 75% board as the hero. Every key is its own mesh here, because they fly in.
  const board = createBoard({ layout: 'full75', mobile, merge: false, line: { px: mobile ? 1.0 : 1.2, levels: 14, scale: 1 / 4.4 } })
  const pivot = new THREE.Group()
  pivot.rotation.set(REST_X, REST_Y, 0)
  pivot.add(board.group)
  scene.add(pivot)

  // Every key remembers where it starts in the air, and when it lands
  board.keys.forEach((k) => {
    k.delay = (k.x / 16) * 0.4 + Math.random() * 0.15 // keys on the left land first
    k.start = new THREE.Vector3(k.x + (Math.random() - 0.5) * 16, k.restY + 5 + Math.random() * 9, k.z + (Math.random() - 0.5) * 12)
    k.spin = new THREE.Vector3((Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4)
    k.e = 0 // how far this key has landed (0..1)
    k.w = 0 // brightness from the success wave
  })

  const restRot = new THREE.Euler(REST_X + board.tilt, REST_Y, 0)
  function resize() {
    const w = host.clientWidth
    const h = host.clientHeight
    if (!w || !h) return
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    fitCamera(camera, restRot, board.bounds, 1.1)
  }
  new ResizeObserver(resize).observe(host)
  resize()

  // p = how assembled the keyboard is (0 = scattered, 1 = built). Follows scroll.
  let target = reduce ? 1 : 0
  let p = target
  ScrollTrigger.create({ trigger: '#contact', start: 'top 90%', end: 'top 20%', onUpdate: (s) => { if (!reduce) target = s.progress } })

  let mode = 'none'
  const wave = { v: -1 } // success wave position, -1 = idle
  let on = false
  new IntersectionObserver(([e]) => { on = e.isIntersecting }, { rootMargin: '100px' }).observe(host)

  const rest = new THREE.Vector3()
  const tint = new THREE.Color()
  function frame(now) {
    requestAnimationFrame(frame)
    if (!on) return
    const t = now / 1000
    p += (target - p) * 0.08
    board.caseGroup.position.y = -(1 - ease(clamp01(p / 0.45))) * 6 // the case rises first
    const front = -2 + wave.v * (board.width + 4)

    board.keys.forEach((k) => {
      const e = ease(clamp01((p - k.delay) / 0.5))
      k.e = e
      rest.set(k.x, k.restY, k.z)
      k.cap.position.lerpVectors(k.start, rest, e)
      k.cap.rotation.set(k.spin.x * (1 - e), k.spin.y * (1 - e), k.spin.z * (1 - e))
      k.w = wave.v < 0 ? 0 : Math.max(0, 1 - Math.abs(front - k.x) / 2.5) // keys near the wave front light up
      k.cap.position.y += k.w * 0.35
    })

    board.light((k, out) => {
      let I
      if (mode === 'play') { out.color.setHSL((k.x * 0.045 + t * 0.35) % 1, 1, 0.5); I = 0.95 }
      else if (mode === 'type') { out.color.set(MODE_COLOR.type); I = 0.8 + Math.sin(t * 1.6 + k.x * 0.15) * 0.1 }
      else if (mode === 'work') { out.color.set(MODE_COLOR.work); I = 0.8 }
      else if (mode === 'compact') { out.color.set(MODE_COLOR.compact); I = 0.85 + Math.sin(t * 2 - k.x * 0.4) * 0.1 }
      else { out.color.set(DEFAULT_LED); I = 0.85 + Math.sin(t * 1.2 + k.x * 0.2) * 0.06 }
      out.level = I * k.e + k.w * 0.9 // the LEDs come on as the key lands
    })

    if (mode === 'play') tint.setHSL((t * 0.12) % 1, 1, 0.5)
    else tint.set(MODE_COLOR[mode] ?? DEFAULT_LED)
    board.hazeMat.color.copy(tint)
    board.lineColor.copy(LINE_BASE).lerp(tint, 0.2)

    pivot.rotation.x = REST_X
    pivot.rotation.y = REST_Y + Math.sin(t * 0.5) * 0.1
    renderer.render(scene, camera)
  }
  requestAnimationFrame(frame)

  return {
    setAccent() {}, // the colour now comes from setMode, so this is not needed any more
    setMode(name) { mode = name },
    celebrate() {
      gsap.fromTo(wave, { v: 0 }, { v: 1, duration: 1.5, ease: 'power2.inOut', overwrite: true, onComplete: () => { wave.v = -1 } })
    },
  }
}