import * as THREE from 'three'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { makeBoard } from './products.js'

const ease = (t) => 1 - Math.pow(1 - t, 3)
const clamp01 = (v) => Math.max(0, Math.min(1, v))

export function initCta(mobile) {
  const host = document.querySelector('#cta-3d')
  const noop = { setAccent() {}, celebrate() {} }
  if (!host) return noop
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  const renderer = new THREE.WebGLRenderer({ antialias: !mobile, alpha: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, mobile ? 1.25 : 1.75))
  host.appendChild(renderer.domElement)

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100)
  scene.add(new THREE.AmbientLight(0xffffff, 0.9))
  const sun = new THREE.DirectionalLight(0xffffff, 2.2)
  sun.position.set(3, 6, 5)
  scene.add(sun)

  const cols = 14
  const { group, keys } = makeBoard({ rows: 5, cols, color: 0xedebe6 }, mobile) // same builder the product cards use
  const pivot = new THREE.Group()
  pivot.add(group)
  scene.add(pivot)
  const caseMesh = group.children[0]

  // Every key remembers where it belongs (rest) and where it starts in the air (start)
  const parts = keys.map((k) => {
    const rest = k.mesh.position.clone()
    return {
      ...k,
      rest,
      start: new THREE.Vector3(rest.x + (Math.random() - 0.5) * 16, rest.y + 5 + Math.random() * 9, rest.z + (Math.random() - 0.5) * 12),
      spin: new THREE.Vector3((Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4),
      delay: ((rest.x + cols / 2) / cols) * 0.4 + Math.random() * 0.15, // keys on the left land first
    }
  })

  function resize() {
    const w = host.clientWidth
    const h = host.clientHeight
    if (!w || !h) return
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    const half = THREE.MathUtils.degToRad(camera.fov / 2)
    camera.position.set(0, 0, Math.max(16 / 2 / (Math.tan(half) * camera.aspect), 12))
  }
  new ResizeObserver(resize).observe(host)
  resize()

  // p = how assembled the keyboard is (0 = scattered, 1 = built). Follows scroll.
  let target = reduce ? 1 : 0
  let p = target
  ScrollTrigger.create({ trigger: '#contact', start: 'top 90%', end: 'top 20%', onUpdate: (s) => { if (!reduce) target = s.progress } })

  const wave = { v: -1 } // success wave position, -1 = idle
  let on = false
  new IntersectionObserver(([e]) => { on = e.isIntersecting }, { rootMargin: '100px' }).observe(host)

  function frame(now) {
    requestAnimationFrame(frame)
    if (!on) return
    const t = now / 1000
    p += (target - p) * 0.08
    caseMesh.position.y = -(1 - ease(clamp01(p / 0.45))) * 6 // the case rises first
    const front = -cols / 2 - 2 + wave.v * (cols + 4)

    parts.forEach((o) => {
      const e = ease(clamp01((p - o.delay) / 0.5))
      o.mesh.position.lerpVectors(o.start, o.rest, e)
      o.mesh.rotation.set(o.spin.x * (1 - e), o.spin.y * (1 - e), o.spin.z * (1 - e))
      const w = wave.v < 0 ? 0 : Math.max(0, 1 - Math.abs(front - o.x) / 2.5) // keys near the wave front light up
      o.mesh.position.y += w * 0.35
      o.mat.emissiveIntensity = 0.08 * e + w * 0.9
    })

    pivot.rotation.x = 0.75
    pivot.rotation.y = -0.35 + Math.sin(t * 0.5) * 0.1
    renderer.render(scene, camera)
  }
  requestAnimationFrame(frame)

  return {
    setAccent(hex) {
      parts.forEach((o) => o.mat.emissive.set(hex))
    },
    celebrate() {
      gsap.fromTo(wave, { v: 0 }, { v: 1, duration: 1.5, ease: 'power2.inOut', overwrite: true, onComplete: () => { wave.v = -1 } })
    },
  }
}