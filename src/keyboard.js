import * as THREE from 'three'
import gsap from 'gsap'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'

// k(code, width, isAccentKey). Width 1 = a normal key.
const k = (code, w = 1, a = false) => ({ code, w, a })

const ROWS = [
  [k('Escape', 1, true),
    ...['Digit1','Digit2','Digit3','Digit4','Digit5','Digit6','Digit7','Digit8','Digit9','Digit0','Minus','Equal'].map((c) => k(c)),
    k('Backspace', 2)],
  [k('Tab', 1.5),
    ...['KeyQ','KeyW','KeyE','KeyR','KeyT','KeyY','KeyU','KeyI','KeyO','KeyP','BracketLeft','BracketRight'].map((c) => k(c)),
    k('Backslash', 1.5)],
  [k('CapsLock', 1.75),
    ...['KeyA','KeyS','KeyD','KeyF','KeyG','KeyH','KeyJ','KeyK','KeyL','Semicolon','Quote'].map((c) => k(c)),
    k('Enter', 2.25, true)],
  [k('ShiftLeft', 2.25),
    ...['KeyZ','KeyX','KeyC','KeyV','KeyB','KeyN','KeyM','Comma','Period','Slash'].map((c) => k(c)),
    k('ShiftRight', 2.75)],
  [k('ControlLeft', 1.25), k('MetaLeft', 1.25), k('AltLeft', 1.25), k('Space', 6.25),
    k('AltRight', 1.25), k('Fn', 1.25), k('ContextMenu', 1.25), k('ControlRight', 1.25)],
]

const KB_W = 15 // keyboard width in key units
const GAP = 0.12 // space between keycaps

export function createKeyboard(world) {
  const { scene, onTick, isMobile } = world
  const seg = isMobile ? 1 : 3 // fewer polygons on phones

  // root: moved by scroll animations. float: idle motion + mouse tilt.
  const root = new THREE.Group()
  const float = new THREE.Group()
  root.add(float)
  scene.add(root)

  // ---------- Materials ----------
  const caseMat = new THREE.MeshStandardMaterial({ color: 0x1c1c1f, metalness: 0.6, roughness: 0.35 })
  const plateMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2e, metalness: 0.8, roughness: 0.4 })
  const switchMat = new THREE.MeshStandardMaterial({ color: 0x3a3a40, roughness: 0.6 })
  const capMat = new THREE.MeshStandardMaterial({ color: 0x18181a, roughness: 0.55 })
  const accentMat = new THREE.MeshStandardMaterial({ color: 0xedebe6, roughness: 0.5 })

  const accentLight = new THREE.PointLight(0xedebe6, 25, 25, 2)
  accentLight.position.set(0, 4, 3)
  root.add(accentLight)

  // ---------- 4 layers = 4 groups (scroll will pull these apart) ----------
  const layers = {
    case: new THREE.Group(),
    plate: new THREE.Group(),
    switches: new THREE.Group(),
    keycaps: new THREE.Group(),
  }
  Object.values(layers).forEach((g) => float.add(g))

  const caseMesh = new THREE.Mesh(
    new RoundedBoxGeometry(KB_W + 0.8, 0.9, ROWS.length + 0.8, seg + 1, 0.15),
    caseMat
  )
  layers.case.add(caseMesh)

  const plateMesh = new THREE.Mesh(
    new RoundedBoxGeometry(KB_W + 0.2, 0.12, ROWS.length + 0.2, 2, 0.04),
    plateMat
  )
  plateMesh.position.y = 0.55
  layers.plate.add(plateMesh)

  // ---------- Keys and switches ----------
  const keys = new Map() // code -> { cap, sw } (used later for live typing)
  const lit = [] // keycaps that can glow, with their x position
  const capGeoCache = new Map() // one geometry per key width, reused
  const switchGeo = new RoundedBoxGeometry(0.55, 0.5, 0.55, 2, 0.05)

  ROWS.forEach((row, r) => {
    let x = -KB_W / 2
    const z = r - (ROWS.length - 1) / 2
    row.forEach((key) => {
      const cx = x + key.w / 2

      const sw = new THREE.Mesh(switchGeo, switchMat)
      sw.position.set(cx, 0.86, z)
      layers.switches.add(sw)

      if (!capGeoCache.has(key.w)) {
        capGeoCache.set(key.w, new RoundedBoxGeometry(key.w - GAP, 0.5, 1 - GAP, seg, 0.08))
      }
      const mat = key.a ? accentMat : capMat.clone() // own material so each key can glow separately
      const cap = new THREE.Mesh(capGeoCache.get(key.w), mat)
      if (!key.a) lit.push({ mat, x: cx })
      cap.position.set(cx, 1.35, z)
      layers.keycaps.add(cap)

      keys.set(key.code, { cap, sw })
      x += key.w
    })
  })

  // ---------- Idle float + mouse tilt ----------
  let mx = 0
  let my = 0
  window.addEventListener('pointermove', (e) => {
    mx = (e.clientX / window.innerWidth) * 2 - 1
    my = (e.clientY / window.innerHeight) * 2 - 1
  })

  onTick((t) => {
    const targetY = mx * 0.35 + Math.sin(t * 0.4) * 0.08
    const targetX = my * 0.1
    float.rotation.y += (targetY - float.rotation.y) * 0.05 // ease toward target
    float.rotation.x += (targetX - float.rotation.x) * 0.05
    float.position.y = Math.sin(t * 0.8) * 0.08
  })

    // ---------- Mode lighting: every frame, each key gets an emissive color ----------
  let mode = 'none'
  const fx = { pulse: 0 } // short flash when the mode changes
  const tmp = new THREE.Color(0xedebe6)

  onTick((t) => {
    lit.forEach(({ mat, x }) => {
      let intensity = 0
      if (mode === 'play') {
        tmp.setHSL((x * 0.045 + t * 0.35) % 1, 1, 0.5) // hue moves along x and over time = wave
        intensity = 0.55
      } else if (mode === 'type') {
        tmp.set(0xffb020)
        intensity = 0.14 + Math.sin(t * 1.6 + x * 0.15) * 0.05
      } else if (mode === 'work') {
        tmp.set(0x3da5ff)
        intensity = 0.1
      } else if (mode === 'compact') {
        tmp.set(0x7cffb2)
        intensity = 0.14 + Math.sin(t * 2 - x * 0.4) * 0.05
      }
      mat.emissive.copy(tmp)
      mat.emissiveIntensity = intensity + fx.pulse
    })
  })

  return {
    root,
    float,
    layers,
    keys,
    width: KB_W + 0.8,
    // Fades the accent keys and light to the new mode color
    setAccent(hex) {
      const c = new THREE.Color(hex)
      gsap.to(accentMat.color, { r: c.r, g: c.g, b: c.b, duration: 0.4 })
      gsap.to(accentLight.color, { r: c.r, g: c.g, b: c.b, duration: 0.4 })
    },
        setMode(name) {
      mode = name
      gsap.fromTo(fx, { pulse: 0.9 }, { pulse: 0, duration: 0.9, ease: 'power2.out', overwrite: true })
      const compact = name === 'compact'
      gsap.to(float.scale, {
        x: compact ? 0.78 : 1,
        y: compact ? 0.55 : 1,
        z: compact ? 0.78 : 1,
        duration: 0.8,
        ease: 'power3.inOut',
      })
    },
  }
}