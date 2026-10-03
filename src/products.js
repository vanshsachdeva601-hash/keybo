import { createLegends } from './legends.js'
import * as THREE from 'three'
import gsap from 'gsap'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'

const CFG = {
  play: { rows: 5, cols: 14, color: 0xff2e4d },
  type: { rows: 5, cols: 12, color: 0xffb020 },
  work: { rows: 5, cols: 14, color: 0x3da5ff },
  compact: { rows: 4, cols: 10, color: 0x7cffb2 },
}

// How bright each key glows, per product. Called every frame for every key.
const GLOW = {
  play: (k, t, h) => {
    k.mat.emissive.setHSL((k.x * 0.05 + t * 0.35) % 1, 1, 0.5) // hue moves along x and over time = wave
    return 0.5 + h * 0.3
  },
  type: (k, t, h) => 0.14 + Math.sin(t * 1.6 + k.x * 0.15) * 0.05 + h * 0.2, // slow breathing
  work: (k, t, h) => 0.1 + h * 0.25, // steady
  compact: (k, t, h) => 0.14 + Math.sin(t * 2 - k.x * 0.4) * 0.05 + h * 0.2,
}

const ROW_TEXT = ['1234567890-=', 'QWERTYUIOP[]', "ASDFGHJKL;'", 'ZXCVBNM,./']
const LAST_ROW = ['Ctrl', 'Cmd', 'Alt', 'KEYBO', 'Alt', 'Fn', 'Ctrl']

// A mini keyboard: a case plus a grid of keycaps with printed letters. The last row has a long spacebar.
// Also used by the CTA keyboard in cta.js.
export function makeBoard({ rows, cols, color }, mobile) {
  const group = new THREE.Group()
  const seg = mobile ? 1 : 2
  const legends = createLegends([...ROW_TEXT.join('').split(''), ...LAST_ROW], mobile)

  const caseMat = new THREE.MeshStandardMaterial({ color: 0x141416, roughness: 0.75, metalness: 0.12 })
  group.add(new THREE.Mesh(new RoundedBoxGeometry(cols + 0.7, 0.7, rows + 0.7, seg + 1, 0.15), caseMat))

  const geoCache = new Map() // one geometry per key width, reused
  const capGeo = (w) => {
    if (!geoCache.has(w)) geoCache.set(w, new RoundedBoxGeometry(w - 0.12, 0.42, 0.88, seg, 0.07))
    return geoCache.get(w)
  }

  const keys = []
  for (let r = 0; r < rows; r++) {
    const last = r === rows - 1
    const widths = last ? [1.25, 1.25, 1.25, cols - 7.5, 1.25, 1.25, 1.25] : Array(cols).fill(1)
    const text = ROW_TEXT[r % 4]
    let x = -cols / 2
    const z = r - (rows - 1) / 2
    widths.forEach((w, c) => {
      // each key has its own material so it can glow on its own
      const mat = new THREE.MeshStandardMaterial({
        color: 0x1a1a1d,
        roughness: 0.88,
        emissive: new THREE.Color(color),
        emissiveIntensity: 0,
      })
      const mesh = new THREE.Mesh(capGeo(w), mat)
      mesh.add(legends.plane(last ? LAST_ROW[c] : text[c % text.length], false, 0.213)) // printed character
      mesh.position.set(x + w / 2, 0.58, z)
      group.add(mesh)
      keys.push({ mesh, mat, x: x + w / 2 })
      x += w
    })
  }
  return { group, keys }
}

// Work: three "devices" standing behind the keyboard (the 3-device pairing idea)
function addDevices(group, rows) {
  const mats = []
  const xs = [-4.2, 0, 4.2]
  xs.forEach((x) => {
    const mat = new THREE.MeshStandardMaterial({
      color: 0x26262a,
      roughness: 0.4,
      emissive: new THREE.Color(0x3da5ff),
      emissiveIntensity: 0,
    })
    const dev = new THREE.Mesh(new RoundedBoxGeometry(3, 2, 0.15, 2, 0.05), mat)
    dev.position.set(x, 1.3, -rows / 2 - 1.6)
    dev.rotation.x = -0.25
    group.add(dev)
    mats.push(mat)
  })
  return mats
}

// Compact: three flat rings that expand outward like a wireless signal
function addRings(group) {
  const rings = []
  for (let i = 0; i < 3; i++) {
    const mat = new THREE.MeshBasicMaterial({ color: 0x7cffb2, transparent: true, opacity: 0 })
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.035, 6, 48), mat)
    ring.rotation.x = Math.PI / 2
    ring.position.y = 1.0
    group.add(ring)
    rings.push(ring)
  }
  return rings
}

export function initProducts(mobile) {
  const items = []

  document.querySelectorAll('.card-3d').forEach((el) => {
    const name = el.dataset.model
    const cfg = CFG[name]
    if (!cfg) return
    const card = el.closest('.card')

    // Each card gets its own small renderer, scene and camera
    const renderer = new THREE.WebGLRenderer({ antialias: !mobile, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, mobile ? 1.25 : 1.75))
    el.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100)
    scene.add(new THREE.AmbientLight(0xffffff, 0.5))
    const sun = new THREE.DirectionalLight(0xffffff, 2.2)
    sun.position.set(3, 6, 5)
    scene.add(sun)
    const rim = new THREE.PointLight(cfg.color, 30, 30, 2) // a colored light that matches the product
    rim.position.set(-4, 3, 4)
    scene.add(rim)

    const { group, keys } = makeBoard(cfg, mobile)
    const pivot = new THREE.Group() // the pivot is what tilts with the cursor
    pivot.add(group)
    scene.add(pivot)

    const devices = name === 'work' ? addDevices(group, cfg.rows) : null
    const rings = name === 'compact' ? addRings(group) : null

    // Same framing width for every card, so the Mini board really looks smaller
    function resize() {
      const w = el.clientWidth
      const h = el.clientHeight
      if (!w || !h) return
      renderer.setSize(w, h, false)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      const half = THREE.MathUtils.degToRad(camera.fov / 2)
      camera.position.set(0, 0, Math.max(15.5 / 2 / (Math.tan(half) * camera.aspect), 12))
    }
    new ResizeObserver(resize).observe(el)
    resize()

    // st = interaction state. tx/ty = cursor position inside the card (-0.5..0.5), h = hover amount (0..1)
    const st = { tx: 0, ty: 0, h: 0, ht: 0, on: false }
    const clamp = (v) => Math.max(-0.75, Math.min(0.75, v))
    card.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect()
      st.tx = clamp((e.clientX - r.left) / r.width - 0.5)
      st.ty = clamp((e.clientY - r.top) / r.height - 0.5)
      st.ht = 1
    })
    card.addEventListener('pointerleave', () => {
      st.tx = 0
      st.ty = 0
      st.ht = 0
    })

    // Only render while the card is on screen
    new IntersectionObserver(([entry]) => { st.on = entry.isIntersecting }, { rootMargin: '100px' }).observe(el)

    const glow = GLOW[name]
    items.push((t) => {
      if (!st.on) return

      // ease toward the targets
      st.h += (st.ht - st.h) * 0.08
      pivot.rotation.x += (0.75 + st.ty * 0.5 - pivot.rotation.x) * 0.08
      pivot.rotation.y += (-0.45 + st.tx * 0.9 + Math.sin(t * 0.5) * 0.12 - pivot.rotation.y) * 0.08
      pivot.scale.setScalar(1 + st.h * 0.06)

      keys.forEach((k) => {
        k.mat.emissiveIntensity = glow(k, t, st.h)
        // on hover a wave of keys pops up, travelling along x
        k.mesh.position.y = 0.58 + st.h * 0.2 * Math.max(0, Math.sin(k.x * 0.7 - t * 7))
      })

      if (devices) {
        const active = Math.floor(t / 1.6) % 3 // one device lights up at a time
        devices.forEach((m, i) => {
          m.emissiveIntensity += ((i === active ? 0.7 : 0.05) - m.emissiveIntensity) * 0.1
        })
      }
      if (rings) {
        rings.forEach((ring, i) => {
          const phase = (t * 0.45 + i / 3) % 1 // 0 -> 1, then starts over
          ring.scale.setScalar(1 + phase * cfg.cols * 0.55)
          ring.material.opacity = (1 - phase) * 0.7
        })
      }

      renderer.render(scene, camera)
    })
  })

  // One animation loop for all four cards
  function loop(now) {
    const t = now / 1000
    items.forEach((draw) => draw(t))
    requestAnimationFrame(loop)
  }
  requestAnimationFrame(loop)

  // Cards slide up one after another as the section scrolls in
  gsap.fromTo(
    '.card',
    { autoAlpha: 0, y: 50 },
    {
      autoAlpha: 1,
      y: 0,
      duration: 0.8,
      ease: 'power3.out',
      stagger: 0.12,
      scrollTrigger: { trigger: '.cards', start: 'top 80%' },
    }
  )
}