import * as THREE from 'three'
import gsap from 'gsap'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { createBoard, fitCamera, LINE_BASE } from './board.js'
import { MODE_COLOR } from './keyboard.js'

const REST_X = 0.75 // how far the board is tipped toward the camera
const REST_Y = -0.45 // and turned a little
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// One board per card: its layout, and what extras it gets
const CARDS = {
  play: { layout: 'full75' }, // gaming: 75% with the knob
  type: { layout: 'n65' }, // typing: 65%
  work: { layout: 'full75', devices: true }, // office: 75% with three paired devices behind it
  compact: { layout: 'n60', rings: true }, // travel: 60% with wireless rings
}

// The LED pattern of each product (same colours as the matching mode in the hero)
const PATTERN = {
  play: (k, t, out) => { out.color.setHSL((k.x * 0.045 + t * 0.35) % 1, 1, 0.5); out.level = 0.95 },
  type: (k, t, out) => { out.color.set(MODE_COLOR.type); out.level = 0.8 + Math.sin(t * 1.6 + k.x * 0.15) * 0.1 },
  work: (k, t, out) => { out.color.set(MODE_COLOR.work); out.level = 0.8 },
  compact: (k, t, out) => { out.color.set(MODE_COLOR.compact); out.level = 0.85 + Math.sin(t * 2 - k.x * 0.4) * 0.1 },
}

// Work: three "devices" standing behind the keyboard (the 3-device pairing idea)
function addDevices(board) {
  const mats = []
  const dw = board.width * 0.26
  ;[-0.33, 0, 0.33].forEach((f) => {
    const mat = new THREE.MeshStandardMaterial({
      color: 0x1b1b1f, roughness: 0.5, emissive: new THREE.Color(MODE_COLOR.work), emissiveIntensity: 0,
    })
    const dev = new THREE.Mesh(new RoundedBoxGeometry(dw, 2.6, 0.16, 2, 0.05), mat)
    dev.position.set(f * board.width, 2.0, -board.depth / 2 - 1.9)
    dev.rotation.x = -0.2
    board.group.add(dev)
    mats.push(mat)
  })
  return mats
}

// Compact: three flat rings that expand outward like a wireless signal
function addRings(board) {
  const rings = []
  for (let i = 0; i < 3; i++) {
    const mat = new THREE.MeshBasicMaterial({ color: MODE_COLOR.compact, transparent: true, opacity: 0 })
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.035, 6, 48), mat)
    ring.rotation.x = Math.PI / 2
    ring.position.y = 1.0
    board.group.add(ring)
    rings.push(ring)
  }
  return rings
}

// One hidden frame, so the shaders are compiled and the buffers are on the GPU before anybody scrolls here
async function warm(renderer, scene, camera) {
  try { await renderer.compileAsync(scene, camera) } catch (e) { /* not supported: the first real frame compiles instead */ }
  renderer.render(scene, camera)
}

export function initProducts(mobile) {
  const items = []

  async function setupCard(el) {
    const name = el.dataset.model
    const cfg = CARDS[name]
    if (!cfg) return
    const card = el.closest('.card')

    // Each card gets its own small renderer, scene and camera
    const renderer = new THREE.WebGLRenderer({ antialias: !mobile, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, mobile ? 1.25 : 1.5))
    el.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 200)
    scene.add(new THREE.AmbientLight(0xffffff, 1.1))
    const sun = new THREE.DirectionalLight(0xffffff, 2.2)
    sun.position.set(3, 8, 6)
    scene.add(sun)
    const rim = new THREE.DirectionalLight(0x9db4ff, 0.8) // cool edge light, like the hero
    rim.position.set(-6, 4, -8)
    scene.add(rim)

    const board = createBoard({ layout: cfg.layout, mobile, merge: true, line: { px: 1.0, levels: 12, scale: 1 / 4.5 } })
    const pivot = new THREE.Group() // the pivot is what tilts with the cursor
    pivot.rotation.set(REST_X, REST_Y, 0)
    pivot.add(board.group)
    scene.add(pivot)

    const devices = cfg.devices ? addDevices(board) : null
    const rings = cfg.rings ? addRings(board) : null

    // Fit the camera to the board (and the devices behind it), so nothing is cut off
    const bounds = cfg.devices ? { ...board.bounds, top: 3.6, back: board.bounds.back + 2.2 } : board.bounds
    const restRot = new THREE.Euler(REST_X + board.tilt, REST_Y, 0)
    function resize() {
      const w = el.clientWidth
      const h = el.clientHeight
      if (!w || !h) return
      renderer.setSize(w, h, false)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      fitCamera(camera, restRot, bounds, 1.1)
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

    // Only render while the card is on screen (it starts a little before it is visible)
    new IntersectionObserver(([entry]) => { st.on = entry.isIntersecting }, { rootMargin: '250px' }).observe(el)

    const pattern = PATTERN[name]
    const tint = new THREE.Color()
    items.push((t) => {
      if (!st.on) return

      // ease toward the targets
      st.h += (st.ht - st.h) * 0.08
      pivot.rotation.x += (REST_X + st.ty * 0.5 - pivot.rotation.x) * 0.08
      pivot.rotation.y += (REST_Y + st.tx * 0.9 + Math.sin(t * 0.5) * 0.12 - pivot.rotation.y) * 0.08
      pivot.scale.setScalar(1 + st.h * 0.05)

      // On hover, a band of light runs along the board
      const sweep = ((t * 9) % (board.width + 8)) - 4
      board.light((k, out) => {
        pattern(k, t, out)
        out.level += st.h * Math.max(0, 1 - Math.abs(k.x - sweep) / 2.4) * 0.9
      })

      // the haze and the contour lines take a little of the LED colour
      if (name === 'play') tint.setHSL((t * 0.12) % 1, 1, 0.5)
      else tint.set(MODE_COLOR[name])
      board.hazeMat.color.copy(tint)
      board.lineColor.copy(LINE_BASE).lerp(tint, 0.2)

      if (devices) {
        const active = Math.floor(t / 1.6) % 3 // one device lights up at a time
        devices.forEach((m, i) => {
          m.emissiveIntensity += ((i === active ? 0.7 : 0.05) - m.emissiveIntensity) * 0.1
        })
      }
      if (rings) {
        rings.forEach((ring, i) => {
          const phase = (t * 0.45 + i / 3) % 1 // 0 -> 1, then starts over
          ring.scale.setScalar(1 + phase * board.width * 0.5)
          ring.material.opacity = (1 - phase) * 0.7
        })
      }

      renderer.render(scene, camera)
    })

    await warm(renderer, scene, camera)
  }

  // Build the cards one at a time, so no single moment freezes the page
  ;(async () => {
    for (const el of document.querySelectorAll('.card-3d')) {
      await setupCard(el)
      await sleep(140)
    }
  })()

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