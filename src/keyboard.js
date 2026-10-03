import * as THREE from 'three'
import gsap from 'gsap'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { createFrontLegends } from './legends.js'
import { createContourMaterial, buildCapGeometry, placeFrontLegend } from './keycap.js'
import { grainTexture, brushedTexture, fabricTexture, deskDesignTexture } from './textures.js'

// ---------- Layout: a 75% keyboard. k(code, width). gap(width) = empty space. Width 1 = a normal key. ----------
const k = (code, w = 1) => ({ code, w })
const gap = (w) => ({ gap: w })
const seq = (codes) => codes.map((c) => k(c))

const LAYOUT = [
  [k('Escape'), gap(1), ...seq(['F1', 'F2', 'F3', 'F4']), gap(0.3), ...seq(['F5', 'F6', 'F7', 'F8']), gap(0.3), ...seq(['F9', 'F10', 'F11', 'F12'])],
  [...seq(['Backquote', 'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0', 'Minus', 'Equal']), k('Backspace', 2), k('Delete')],
  [k('Tab', 1.5), ...seq(['KeyQ', 'KeyW', 'KeyE', 'KeyR', 'KeyT', 'KeyY', 'KeyU', 'KeyI', 'KeyO', 'KeyP', 'BracketLeft', 'BracketRight']), k('Backslash', 1.5), k('PageUp')],
  [k('CapsLock', 1.75), ...seq(['KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG', 'KeyH', 'KeyJ', 'KeyK', 'KeyL', 'Semicolon', 'Quote']), k('Enter', 2.25), k('PageDown')],
  [k('ShiftLeft', 2.25), ...seq(['KeyZ', 'KeyX', 'KeyC', 'KeyV', 'KeyB', 'KeyN', 'KeyM', 'Comma', 'Period', 'Slash']), k('ShiftRight', 1.75), k('ArrowUp'), k('End')],
  [k('ControlLeft', 1.25), k('MetaLeft', 1.25), k('AltLeft', 1.25), k('Space', 6.25), k('Fn'), k('ControlRight'), gap(1), k('ArrowLeft'), k('ArrowDown'), k('ArrowRight')],
]

const ROW_Z = [0, 1.35, 2.35, 3.35, 4.35, 5.35] // the function row sits a little apart from the rest
const ROW_H = [0.58, 0.66, 0.62, 0.58, 0.55, 0.52] // keycap height per row (back rows are taller, like a real profile)
const ROW_SLOPE = [0.26, 0.24, 0.17, 0.1, 0.04, -0.02] // how much the top of the cap leans toward you
const GAP = 0.14 // space between keycaps. The LED light shows through it.
const INSET = 0.09 // the top of a keycap is smaller than its bottom by this much on every side
const CAP_BASE = 0.95 // height of the underside of every keycap. Lower = keys sit closer to the case.
const SW_Y = 0.78 // centre height of the switches (they fill the space between plate and keycap)
const TILT = 0.1 // the keyboard is raised at the back, like a real typing angle (radians)

const KEYS = []
LAYOUT.forEach((row, r) => {
  let x = 0
  row.forEach((it) => {
    if (it.gap) { x += it.gap; return }
    KEYS.push({ code: it.code, w: it.w, row: r, cx: x + it.w / 2, z: ROW_Z[r] })
    x += it.w
  })
})

// What is printed on each key. Letters and digits come straight from the key code.
const NAMES = {
  Escape: 'Esc', Backquote: '`', Minus: '-', Equal: '=', Backspace: 'Bksp', Delete: 'Del', Tab: 'Tab',
  BracketLeft: '[', BracketRight: ']', Backslash: '\\', PageUp: 'PgUp', CapsLock: 'Caps', Semicolon: ';',
  Quote: "'", Enter: 'Enter', PageDown: 'PgDn', ShiftLeft: 'Shift', ShiftRight: 'Shift', Comma: ',',
  Period: '.', Slash: '/', ArrowUp: '↑', End: 'End', ControlLeft: 'Ctrl', ControlRight: 'Ctrl',
  MetaLeft: 'Win', AltLeft: 'Alt', Space: '—', Fn: 'Fn', ArrowLeft: '←', ArrowDown: '↓', ArrowRight: '→',
}
const labelFor = (code) => NAMES[code] ?? code.replace(/^(Key|Digit)/, '')

// ---------- Case: it reaches past the keys, most at the front ----------
const X0 = -0.4
const X1 = 16.5
const ZB = -0.9 // back edge (z grows toward the camera)
const ZF = 6.5 // front edge
const CASE_W = X1 - X0
const CASE_D = ZF - ZB
const CASE_CX = (X0 + X1) / 2
const CASE_CZ = (ZB + ZF) / 2
const RIM_Y = 0.45
const RIM_H = 0.4 // height of the bezel. Taller = keys sit lower inside the case.
const RIM_TOP = RIM_Y + RIM_H + 0.05
// The opening in the bezel (x, z). It has a notch, because the knob sits on solid case at the top right.
const POCKET = [[-0.1, -0.56], [14.75, -0.56], [14.75, 0.78], [16.1, 0.78], [16.1, 5.9], [-0.1, 5.9]]

const MAT_W = 24
const MAT_H = ((MAT_W - 0.4) * 972) / 2048 + 0.3 // the printed design has a 2048 x 972 ratio

const DEFAULT_LED = 0x3da5ff // colour before any mode is chosen: the sky blue
const MODE_COLOR = { type: 0xffb020, work: 0xc7ccd6, compact: 0x7cffb2 } // Play is a rainbow, see the tick below
const LINE_BASE = new THREE.Color(0x8a94a3) // colour of the contour lines
const WHITE = new THREE.Color(0xffffff)

// A soft glowing square, used for the faint haze over the plate
function glowTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')
  g.shadowColor = '#fff'
  g.shadowBlur = 26
  g.fillStyle = '#fff'
  g.fillRect(24, 24, 80, 80)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

// A flat ring around one key (cell size minus cap size). It lights the gaps between keys.
const ringCache = new Map()
function ringGeometry(w) {
  if (!ringCache.has(w)) {
    const o = new THREE.Shape()
    o.moveTo(-w / 2, -0.5); o.lineTo(w / 2, -0.5); o.lineTo(w / 2, 0.5); o.lineTo(-w / 2, 0.5); o.closePath()
    const iw = (w - GAP) / 2
    const ih = (1 - GAP) / 2
    const hole = new THREE.Path()
    hole.moveTo(-iw, -ih); hole.lineTo(-iw, ih); hole.lineTo(iw, ih); hole.lineTo(iw, -ih); hole.closePath()
    o.holes.push(hole)
    const g = new THREE.ShapeGeometry(o)
    g.rotateX(-Math.PI / 2)
    ringCache.set(w, g)
  }
  return ringCache.get(w)
}

// The raised bezel: a rounded rectangle with the pocket cut out, extruded upward.
// Shape y is world -z once the shape is rotated to lie flat.
function frameGeometry(curveSegments) {
  const r = 0.4
  const x0 = X0
  const x1 = X1
  const y0 = -ZF
  const y1 = -ZB
  const s = new THREE.Shape()
  s.moveTo(x0 + r, y0)
  s.lineTo(x1 - r, y0)
  s.quadraticCurveTo(x1, y0, x1, y0 + r)
  s.lineTo(x1, y1 - r)
  s.quadraticCurveTo(x1, y1, x1 - r, y1)
  s.lineTo(x0 + r, y1)
  s.quadraticCurveTo(x0, y1, x0, y1 - r)
  s.lineTo(x0, y0 + r)
  s.quadraticCurveTo(x0, y0, x0 + r, y0)
  const hole = new THREE.Path()
  POCKET.forEach(([x, z], i) => (i ? hole.lineTo(x, -z) : hole.moveTo(x, -z)))
  hole.closePath()
  s.holes.push(hole)
  const g = new THREE.ExtrudeGeometry(s, {
    depth: RIM_H, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 2, curveSegments,
  })
  g.rotateX(-Math.PI / 2)
  return g
}

export function createKeyboard(world) {
  const { scene, onTick, isMobile } = world
  const seg = isMobile ? 1 : 3 // fewer polygons on phones

  // root: moved by scroll animations. float: idle motion + mouse tilt. tilt: typing angle.
  // body: shifts everything so the middle of the whole case is at the centre of the screen.
  const root = new THREE.Group()
  const float = new THREE.Group()
  const tilt = new THREE.Group()
  const body = new THREE.Group()
  tilt.rotation.x = TILT
  body.position.set(-CASE_CX, 0, -CASE_CZ)
  root.add(float)
  float.add(tilt)
  tilt.add(body)
  scene.add(root)

  // ---------- Surface textures (all generated in code) ----------
  const grain = grainTexture(isMobile ? 128 : 256)
  const fabric = fabricTexture(isMobile ? 128 : 256)
  fabric.repeat.set(16, 7)

  // ---------- Materials: matte black, nothing here emits light ----------
  const caseMat = new THREE.MeshStandardMaterial({ color: 0x121214, metalness: 0.1, roughness: 0.78, bumpMap: grain, bumpScale: 0.08 })
  const rimMat = new THREE.MeshStandardMaterial({ color: 0x121214, metalness: 0.1, roughness: 0.78 }) // the extruded frame has no usable UVs, so no bump
  const plateMat = new THREE.MeshStandardMaterial({ color: 0x0d0d0f, metalness: 0.2, roughness: 0.8 })
  const switchMat = new THREE.MeshStandardMaterial({ color: 0x1c1c20, roughness: 0.75 })
  const cap = createContourMaterial({ px: isMobile ? 1.0 : 1.25, bump: grain }) // one matte material with the contour print, shared by all keys
  const deskMat = new THREE.MeshStandardMaterial({ color: 0x151517, roughness: 0.95, bumpMap: fabric, bumpScale: 0.5 })

  const accentLight = new THREE.PointLight(DEFAULT_LED, 12, 22, 2)
  accentLight.position.set(0, 4, 3)
  root.add(accentLight)

  // ---------- 4 layers = 4 groups (scroll will pull these apart) ----------
  const layers = {
    case: new THREE.Group(),
    plate: new THREE.Group(),
    switches: new THREE.Group(),
    keycaps: new THREE.Group(),
  }
  Object.values(layers).forEach((g) => body.add(g))

  // Case = a base slab + the raised bezel on top of it
  const base = new THREE.Mesh(new RoundedBoxGeometry(CASE_W, 0.9, CASE_D, seg + 1, 0.2), caseMat)
  base.position.set(CASE_CX, 0, CASE_CZ)
  layers.case.add(base)

  const rim = new THREE.Mesh(frameGeometry(isMobile ? 4 : 10), rimMat)
  rim.position.y = RIM_Y
  layers.case.add(rim)

  // The desk mat sits right under the case and travels down with it when the keyboard opens
  const mat = new THREE.Mesh(new RoundedBoxGeometry(MAT_W, 0.14, MAT_H, 2, 0.06), deskMat)
  mat.position.set(CASE_CX, -0.52, CASE_CZ)
  layers.case.add(mat)

  // The printed design on the mat (white texture, tinted with the mode colour every frame)
  const decalW = MAT_W - 0.4
  const decalGeo = new THREE.PlaneGeometry(decalW, (decalW * 972) / 2048)
  decalGeo.rotateX(-Math.PI / 2)
  const decalMat = new THREE.MeshBasicMaterial({
    map: deskDesignTexture(isMobile), transparent: true, opacity: 0.5, depthWrite: false, color: DEFAULT_LED,
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
  })
  const decal = new THREE.Mesh(decalGeo, decalMat)
  decal.position.set(CASE_CX, -0.444, CASE_CZ)
  layers.case.add(decal)

  // ---------- Knob (top right): silver ring, black top ----------
  const ringMat = new THREE.MeshStandardMaterial({ color: 0xdfe2e8, metalness: 0.55, roughness: 0.35 })
  const knobTopMat = new THREE.MeshStandardMaterial({ color: 0x0e0e10, metalness: 0.1, roughness: 0.7 })
  const knob = new THREE.Group()
  knob.position.set(15.45, RIM_TOP - 0.02, 0)
  layers.case.add(knob)
  const knobTurn = new THREE.Group() // this is what rotates when you type
  knob.add(knobTurn)
  const knobRing = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.64, 0.44, isMobile ? 32 : 64), ringMat)
  knobRing.position.y = 0.22
  knobTurn.add(knobRing)
  const knobTop = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.03, isMobile ? 32 : 64), knobTopMat)
  knobTop.position.y = 0.445
  knobTurn.add(knobTop)
  const knobMark = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.01, 0.18), new THREE.MeshBasicMaterial({ color: 0x4a4a52 })) // tiny line so the turning can be seen
  knobMark.position.set(0, 0.465, -0.3)
  knobTurn.add(knobMark)

  // ---------- Indicator light bar next to Esc ----------
  const bar = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.03, 0.6), new THREE.MeshBasicMaterial({ color: 0xeef4ff }))
  bar.position.set(1.5, 0.64, 0)
  layers.plate.add(bar)

  // ---------- Plate, with a faint haze of light over it ----------
  const plateMesh = new THREE.Mesh(new RoundedBoxGeometry(16.2, 0.12, 6.46, 2, 0.04), plateMat)
  plateMesh.position.set(8, 0.55, 2.67)
  layers.plate.add(plateMesh)

  const hazeMat = new THREE.MeshBasicMaterial({
    map: glowTexture(), transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, color: DEFAULT_LED,
  })
  const hazeGeo = new THREE.PlaneGeometry(17.5, 7.3)
  hazeGeo.rotateX(-Math.PI / 2)
  const haze = new THREE.Mesh(hazeGeo, hazeMat)
  haze.position.set(8, 0.63, 2.67)
  layers.plate.add(haze)

  // ---------- Keys: switch, LED ring, keycap (contour print on every face) and a legend on its front ----------
  const keys = new Map() // code -> { cap, sw, glow, x, z, restY } (used for typing and the intro)
  const lit = [] // one entry per key: its LED ring, its legend material and its ripple value
  const switchGeo = new RoundedBoxGeometry(0.55, 0.34, 0.55, 2, 0.05)
  const legends = createFrontLegends(KEYS.map((key) => labelFor(key.code)), isMobile)

  KEYS.forEach((key) => {
    const { cx, z, w, row } = key
    const h = ROW_H[row]
    const slope = ROW_SLOPE[row]
    const restY = CAP_BASE + h / 2

    const sw = new THREE.Mesh(switchGeo, switchMat)
    sw.position.set(cx, SW_Y, z)
    layers.switches.add(sw)

    // The LED: a ring on the plate. The keycap hides all of it except what shows through the gaps.
    const ledMat = new THREE.MeshBasicMaterial({
      color: DEFAULT_LED, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false,
    })
    const ring = new THREE.Mesh(ringGeometry(w), ledMat)
    ring.position.set(cx, 0.625, z)
    layers.plate.add(ring) // it travels with the plate when the keyboard opens

    // Every key has its own geometry, because the contour pattern depends on where the key sits on the board
    const capGeo = buildCapGeometry({
      dx: w - GAP, h, dz: 1 - GAP, inset: INSET, slope, seg, radius: 0.07,
      offset: new THREE.Vector3(cx, restY, z),
    })
    const capMesh = new THREE.Mesh(capGeo, cap.material)

    // legend on the front face
    const legend = legends.plane(labelFor(key.code))
    placeFrontLegend(legend, { d: 1 - GAP, h, inset: INSET, slope })
    capMesh.add(legend)

    capMesh.position.set(cx, restY, z)
    layers.keycaps.add(capMesh)

    lit.push({ led: ledMat, legend: legend.material || null, x: cx, z, glow: { v: 0 } }) // glow.v = extra light from a key press ripple
    keys.set(key.code, { cap: capMesh, sw, glow: ring, x: cx, z, restY })
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

  // ---------- Mode lighting: every frame, each LED gets a colour and a brightness ----------
  let mode = 'none'
  const fx = { pulse: 0 } // short flash when the mode changes
  const tmp = new THREE.Color(DEFAULT_LED) // colour of the key being processed
  const target = new THREE.Color(DEFAULT_LED) // one colour for the whole board (mat design, haze, contour tint)

  onTick((t) => {
    if (mode === 'play') target.setHSL((t * 0.12) % 1, 1, 0.5)
    else target.set(MODE_COLOR[mode] ?? DEFAULT_LED)
    decalMat.color.lerp(target, 0.08) // fades smoothly from one mode colour to the next
    hazeMat.color.copy(target)
    cap.lineColor.copy(LINE_BASE).lerp(target, 0.2) // the printed lines pick up a little of the LED colour

    lit.forEach((o) => {
      let I
      if (mode === 'play') {
        tmp.setHSL((o.x * 0.045 + t * 0.35) % 1, 1, 0.5) // hue moves along x and over time = wave
        I = 0.95
      } else if (mode === 'type') {
        tmp.set(MODE_COLOR.type)
        I = 0.8 + Math.sin(t * 1.6 + o.x * 0.15) * 0.1
      } else if (mode === 'work') {
        tmp.set(MODE_COLOR.work)
        I = 0.8
      } else if (mode === 'compact') {
        tmp.set(MODE_COLOR.compact)
        I = 0.85 + Math.sin(t * 2 - o.x * 0.4) * 0.1
      } else {
        tmp.set(DEFAULT_LED) // before any mode: a steady sky blue that gently breathes
        I = 0.85 + Math.sin(t * 1.2 + o.x * 0.2) * 0.06
      }
      const level = I + o.glow.v
      o.led.color.copy(tmp)
      o.led.opacity = Math.min(1, level + fx.pulse * 0.4)
      // the printed legend glows in the LED colour
      if (o.legend) o.legend.color.copy(tmp).lerp(WHITE, 0.2).multiplyScalar(0.5 + 0.55 * Math.min(1.2, level))
    })
  })

  return {
    root,
    float,
    layers,
    keys,
    width: 17.6, // used to fit the camera
    // Where each spec label is anchored (local x just right of each layer, z at the middle of the board)
    labelX: { keycaps: 16.6, switches: 16.6, plate: 16.6, case: X1 + 0.4 },
    labelZ: CASE_CZ,
    setAccent(hex) {
      const c = new THREE.Color(hex)
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
    press(code) {
      const kk = keys.get(code)
      if (!kk) return
      gsap.to(kk.cap.position, { y: kk.restY - 0.2, duration: 0.06, ease: 'power2.out', overwrite: true }) // key goes down
      gsap.to(knobTurn.rotation, { y: '+=0.45', duration: 0.35, ease: 'power3.out' }) // the knob turns a little on every press
      // Ripple: nearby LEDs flash, farther ones flash later and weaker
      lit.forEach((o) => {
        const d = Math.hypot(o.x - kk.x, (o.z - kk.z) * 1.6)
        const a = Math.max(0, 0.9 - d * 0.16)
        if (a <= 0) return
        gsap.killTweensOf(o.glow)
        gsap
          .timeline({ delay: d * 0.025 })
          .to(o.glow, { v: a, duration: 0.05 })
          .to(o.glow, { v: 0, duration: 0.7, ease: 'power2.out' })
      })
    },
    release(code) {
      const kk = keys.get(code)
      if (!kk) return
      gsap.to(kk.cap.position, { y: kk.restY, duration: 0.25, ease: 'back.out(4)', overwrite: true }) // springs back up
    },
    // Intro: keys wait out of sight, then fall onto the board one by one
    hideForIntro() {
      keys.forEach(({ cap: c, sw, glow }) => { c.visible = false; sw.visible = false; glow.visible = false })
    },
    dropIn(audio) {
      let i = 0
      keys.forEach(({ cap: c, sw, glow, x, z, restY }) => {
        const delay = 0.1 + x * 0.035 + z * 0.05 + Math.random() * 0.12 // left to right, back to front
        c.visible = true
        sw.visible = true
        gsap.delayedCall(delay + 0.7, () => { glow.visible = true }) // the LED turns on once the key has landed
        gsap.fromTo(c.position, { y: restY + 8 + Math.random() * 5 }, { y: restY, duration: 0.9, delay, ease: 'bounce.out' })
        gsap.fromTo(c.rotation, { x: (Math.random() - 0.5) * 1.6, z: (Math.random() - 0.5) * 1.2 }, { x: 0, z: 0, duration: 0.9, delay, ease: 'power3.out' })
        gsap.fromTo(sw.position, { y: 6 + Math.random() * 3 }, { y: SW_Y, duration: 0.7, delay, ease: 'power3.out' })
        if (i++ % 4 === 0) gsap.delayedCall(delay + 0.45, () => audio.tick()) // a click for every 4th key
      })
    },
  }
}