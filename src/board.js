import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { createFrontLegends } from './legends.js'
import { createContourMaterial, buildCapGeometry, placeFrontLegend } from './keycap.js'
import { DEFAULT_LED } from './keyboard.js'

// A reusable keyboard, built the same way as the hero one. Used by the product cards and the CTA section.
export const LINE_BASE = new THREE.Color(0x8a94a3) // colour of the contour lines
export const BOARD_TILT = 0.1 // typing angle, same as the hero keyboard
const WHITE = new THREE.Color(0xffffff)

// ---------- Layouts: k(code, width), gap(width) ----------
const k = (code, w = 1) => ({ code, w })
const gap = (w) => ({ gap: w })
const seq = (codes) => codes.map((c) => k(c))

const NUM = ['Backquote', 'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0', 'Minus', 'Equal']
const TAB = ['KeyQ', 'KeyW', 'KeyE', 'KeyR', 'KeyT', 'KeyY', 'KeyU', 'KeyI', 'KeyO', 'KeyP', 'BracketLeft', 'BracketRight']
const CAPS = ['KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG', 'KeyH', 'KeyJ', 'KeyK', 'KeyL', 'Semicolon', 'Quote']
const SHIFT = ['KeyZ', 'KeyX', 'KeyC', 'KeyV', 'KeyB', 'KeyN', 'KeyM', 'Comma', 'Period', 'Slash']

const R_FN = [k('Escape'), gap(1), ...seq(['F1', 'F2', 'F3', 'F4']), gap(0.3), ...seq(['F5', 'F6', 'F7', 'F8']), gap(0.3), ...seq(['F9', 'F10', 'F11', 'F12'])]
const R_NUM75 = [...seq(NUM), k('Backspace', 2), k('Delete')]
const R_TAB75 = [k('Tab', 1.5), ...seq(TAB), k('Backslash', 1.5), k('PageUp')]
const R_CAP75 = [k('CapsLock', 1.75), ...seq(CAPS), k('Enter', 2.25), k('PageDown')]
const R_SHF75 = [k('ShiftLeft', 2.25), ...seq(SHIFT), k('ShiftRight', 1.75), k('ArrowUp'), k('End')]
const R_BOT75 = [k('ControlLeft', 1.25), k('MetaLeft', 1.25), k('AltLeft', 1.25), k('Space', 6.25), k('Fn'), k('ControlRight'), gap(1), k('ArrowLeft'), k('ArrowDown'), k('ArrowRight')]
const R_NUM60 = [...seq(NUM), k('Backspace', 2)]
const R_TAB60 = [k('Tab', 1.5), ...seq(TAB), k('Backslash', 1.5)]
const R_CAP60 = [k('CapsLock', 1.75), ...seq(CAPS), k('Enter', 2.25)]
const R_SHF60 = [k('ShiftLeft', 2.25), ...seq(SHIFT), k('ShiftRight', 2.75)]
const R_BOT60 = [k('ControlLeft', 1.25), k('MetaLeft', 1.25), k('AltLeft', 1.25), k('Space', 6.25), k('AltRight', 1.25), k('Fn', 1.25), k('ContextMenu', 1.25), k('ControlRight', 1.25)]

const LAYOUTS = {
  full75: [R_FN, R_NUM75, R_TAB75, R_CAP75, R_SHF75, R_BOT75], // like the hero keyboard
  n65: [R_NUM75, R_TAB75, R_CAP75, R_SHF75, R_BOT75], // no function row
  n60: [R_NUM60, R_TAB60, R_CAP60, R_SHF60, R_BOT60], // no function row, no arrows
}

// Same keycap profile numbers as the hero keyboard
const ROW_H = [0.58, 0.66, 0.62, 0.58, 0.55, 0.52]
const ROW_SLOPE = [0.26, 0.24, 0.17, 0.1, 0.04, -0.02]
const GAP = 0.14
const INSET = 0.09
const CAP_BASE = 0.95
const RIM_Y = 0.45
const RIM_H = 0.4

const NAMES = {
  Escape: 'Esc', Backquote: '`', Minus: '-', Equal: '=', Backspace: 'Bksp', Delete: 'Del', Tab: 'Tab',
  BracketLeft: '[', BracketRight: ']', Backslash: '\\', PageUp: 'PgUp', CapsLock: 'Caps', Semicolon: ';',
  Quote: "'", Enter: 'Enter', PageDown: 'PgDn', ShiftLeft: 'Shift', ShiftRight: 'Shift', Comma: ',',
  Period: '.', Slash: '/', ArrowUp: '↑', End: 'End', ControlLeft: 'Ctrl', ControlRight: 'Ctrl',
  MetaLeft: 'Win', AltLeft: 'Alt', AltRight: 'Alt', ContextMenu: 'Menu', Space: '—', Fn: 'Fn',
  ArrowLeft: '←', ArrowDown: '↓', ArrowRight: '→',
}
const labelFor = (code) => NAMES[code] ?? code.replace(/^(Key|Digit)/, '')

// Work out where every key sits
function computeKeys(rows) {
  const hasFn = rows[0] === R_FN
  const keys = []
  let width = 0
  rows.forEach((row, i) => {
    const z = hasFn ? (i === 0 ? 0 : 1.35 + (i - 1)) : i // the function row sits a little apart
    const kind = hasFn ? i : i + 1 // which row of the profile tables this row uses
    let x = 0
    row.forEach((it) => {
      if (it.gap) { x += it.gap; return }
      keys.push({ code: it.code, w: it.w, cx: x + it.w / 2, z, kind })
      x += it.w
    })
    width = Math.max(width, x)
  })
  const zMax = keys.reduce((m, key) => Math.max(m, key.z), 0) + 0.5
  return { keys, hasFn, width, zMin: -0.5, zMax }
}

// One legend atlas shared by every board (all the labels of all the layouts)
let sharedLegends = null
function getLegends(mobile) {
  if (!sharedLegends) {
    const all = new Set()
    Object.values(LAYOUTS).forEach((rows) => rows.forEach((row) => row.forEach((it) => { if (it.code) all.add(labelFor(it.code)) })))
    sharedLegends = createFrontLegends([...all], mobile)
  }
  return sharedLegends
}

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

// The raised bezel: a rounded rectangle with the pocket cut out, extruded upward
function frameGeometry(b, pocket, curveSegments) {
  const r = 0.4
  const x0 = b.x0
  const x1 = b.x1
  const y0 = -b.zf
  const y1 = -b.zb
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
  pocket.forEach(([x, z], i) => (i ? hole.lineTo(x, -z) : hole.moveTo(x, -z)))
  hole.closePath()
  s.holes.push(hole)
  const g = new THREE.ExtrudeGeometry(s, {
    depth: RIM_H, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 2, curveSegments,
  })
  g.rotateX(-Math.PI / 2)
  return g
}

function addColorAttr(g) {
  g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 3), 3))
}

function setRange(attr, start, count, c, s) {
  for (let i = start; i < start + count; i++) attr.setXYZ(i, c.r * s, c.g * s, c.b * s)
}

// merge = true: all keycaps become ONE mesh (cheap, for the product cards). merge = false: every key is its own mesh (so it can move).
export function createBoard({ layout = 'full75', mobile = false, merge = true, line = {} } = {}) {
  const { keys: layoutKeys, hasFn, width, zMin, zMax } = computeKeys(LAYOUTS[layout])
  const seg = mobile ? 1 : 3

  const b = { x0: -0.4, x1: width + 0.5, zb: zMin - 0.4, zf: zMax + 0.65 }
  const caseW = b.x1 - b.x0
  const caseD = b.zf - b.zb
  const cx0 = (b.x0 + b.x1) / 2
  const cz0 = (b.zb + b.zf) / 2
  const rimTop = RIM_Y + RIM_H + 0.05
  const pocket = hasFn
    ? [[-0.1, zMin - 0.06], [width - 1.25, zMin - 0.06], [width - 1.25, 0.78], [width + 0.1, 0.78], [width + 0.1, zMax + 0.05], [-0.1, zMax + 0.05]] // notch for the knob
    : [[-0.1, zMin - 0.06], [width + 0.1, zMin - 0.06], [width + 0.1, zMax + 0.05], [-0.1, zMax + 0.05]]

  // root (returned) > tilt > body. The body is shifted so the middle of the case is at the origin.
  const root = new THREE.Group()
  const tiltG = new THREE.Group()
  const body = new THREE.Group()
  tiltG.rotation.x = BOARD_TILT
  body.position.set(-cx0, 0, -cz0)
  root.add(tiltG)
  tiltG.add(body)
  const caseGroup = new THREE.Group() // case, plate, knob and the LEDs (everything except the keycaps)
  const keysGroup = new THREE.Group()
  body.add(caseGroup)
  body.add(keysGroup)

  // ---------- Case ----------
  const caseMat = new THREE.MeshStandardMaterial({ color: 0x121214, metalness: 0.1, roughness: 0.78 })
  const plateMat = new THREE.MeshStandardMaterial({ color: 0x0d0d0f, metalness: 0.2, roughness: 0.8 })

  const base = new THREE.Mesh(new RoundedBoxGeometry(caseW, 0.9, caseD, seg + 1, 0.2), caseMat)
  base.position.set(cx0, 0, cz0)
  caseGroup.add(base)

  const rim = new THREE.Mesh(frameGeometry(b, pocket, mobile ? 4 : 10), caseMat)
  rim.position.y = RIM_Y
  caseGroup.add(rim)

  const plate = new THREE.Mesh(new RoundedBoxGeometry(width + 0.2, 0.12, zMax - zMin + 0.11, 2, 0.04), plateMat)
  plate.position.set(width / 2, 0.55, (zMin + zMax) / 2)
  caseGroup.add(plate)

  // faint haze of light over the plate
  const hazeMat = new THREE.MeshBasicMaterial({
    map: glowTexture(), transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, color: DEFAULT_LED,
  })
  const hazeGeo = new THREE.PlaneGeometry(width + 1.5, zMax - zMin + 0.95)
  hazeGeo.rotateX(-Math.PI / 2)
  const haze = new THREE.Mesh(hazeGeo, hazeMat)
  haze.position.set(width / 2, 0.63, (zMin + zMax) / 2)
  caseGroup.add(haze)

  // knob and indicator bar (only on layouts with a function row)
  let knobTurn = null
  if (hasFn) {
    const knob = new THREE.Group()
    knob.position.set(width - 0.55, rimTop - 0.02, 0)
    caseGroup.add(knob)
    knobTurn = new THREE.Group()
    knob.add(knobTurn)
    const ring = new THREE.Mesh(
      new THREE.CylinderGeometry(0.62, 0.64, 0.44, mobile ? 32 : 64),
      new THREE.MeshStandardMaterial({ color: 0xdfe2e8, metalness: 0.55, roughness: 0.35 })
    )
    ring.position.y = 0.22
    knobTurn.add(ring)
    const top = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.5, 0.03, mobile ? 32 : 64),
      new THREE.MeshStandardMaterial({ color: 0x0e0e10, metalness: 0.1, roughness: 0.7 })
    )
    top.position.y = 0.445
    knobTurn.add(top)
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.03, 0.6), new THREE.MeshBasicMaterial({ color: 0xeef4ff }))
    bar.position.set(1.5, 0.64, 0)
    caseGroup.add(bar)
  }

  // ---------- Keys ----------
  const contour = createContourMaterial({ px: line.px ?? 1.25, levels: line.levels ?? 28, scale: line.scale ?? 1 / 3 })
  const legends = getLegends(mobile)
  const ledGroup = new THREE.Group() // LED rings. They sit on the plate, so they travel with the case.
  caseGroup.add(ledGroup)

  const capGeos = []
  const legGeos = []
  const ringGeos = []
  let legVerts = 0
  let ringVerts = 0
  let legMat = null

  const keys = layoutKeys.map((lk) => {
    const h = ROW_H[lk.kind]
    const slope = ROW_SLOPE[lk.kind]
    const restY = CAP_BASE + h / 2
    const key = { code: lk.code, x: lk.cx, z: lk.z, w: lk.w, restY, cap: null, ringMat: null, legendMat: null, ringStart: 0, ringCount: 0, legStart: 0, legCount: 0 }

    const capGeo = buildCapGeometry({
      dx: lk.w - GAP, h, dz: 1 - GAP, inset: INSET, slope, seg, radius: 0.07,
      offset: new THREE.Vector3(lk.cx, restY, lk.z), // the contour pattern is built from the position on the board
    })
    const legend = legends.plane(labelFor(lk.code))
    placeFrontLegend(legend, { d: 1 - GAP, h, inset: INSET, slope })

    if (merge) {
      capGeo.translate(lk.cx, restY, lk.z) // bake the position into the geometry, then everything is merged at the end
      capGeos.push(capGeo)

      if (!legMat) { legMat = legend.material; legMat.vertexColors = true }
      legend.updateMatrix()
      const lg = legend.geometry.clone()
      lg.applyMatrix4(legend.matrix)
      lg.translate(lk.cx, restY, lk.z)
      addColorAttr(lg)
      key.legStart = legVerts
      key.legCount = lg.attributes.position.count
      legVerts += key.legCount
      legGeos.push(lg)

      const rg = ringGeometry(lk.w).clone()
      rg.translate(lk.cx, 0.625, lk.z)
      addColorAttr(rg)
      key.ringStart = ringVerts
      key.ringCount = rg.attributes.position.count
      ringVerts += key.ringCount
      ringGeos.push(rg)
    } else {
      const cap = new THREE.Mesh(capGeo, contour.material)
      cap.add(legend)
      cap.position.set(lk.cx, restY, lk.z)
      keysGroup.add(cap)
      key.cap = cap
      key.legendMat = legend.material

      key.ringMat = new THREE.MeshBasicMaterial({ color: DEFAULT_LED, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })
      const ring = new THREE.Mesh(ringGeometry(lk.w), key.ringMat)
      ring.position.set(lk.cx, 0.625, lk.z)
      ledGroup.add(ring)
    }
    return key
  })

  let ringAttr = null
  let legAttr = null
  if (merge) {
    keysGroup.add(new THREE.Mesh(mergeGeometries(capGeos), contour.material))

    const lGeo = mergeGeometries(legGeos)
    const lMesh = new THREE.Mesh(lGeo, legMat)
    lMesh.renderOrder = 2
    keysGroup.add(lMesh)
    legAttr = lGeo.attributes.color

    const rGeo = mergeGeometries(ringGeos)
    const rMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })
    ledGroup.add(new THREE.Mesh(rGeo, rMat))
    ringAttr = rGeo.attributes.color
  }

  // ---------- Light: the caller sets the colour and brightness of every key, every frame ----------
  const out = { color: new THREE.Color(), level: 0 }
  const tmp = new THREE.Color()
  function light(fn) {
    for (const key of keys) {
      fn(key, out)
      const lv = Math.max(0, out.level)
      tmp.copy(out.color).lerp(WHITE, 0.2).multiplyScalar(0.5 + 0.55 * Math.min(1.2, lv)) // the printed legend glows in the LED colour
      if (merge) {
        setRange(ringAttr, key.ringStart, key.ringCount, out.color, Math.min(1, lv))
        setRange(legAttr, key.legStart, key.legCount, tmp, 1)
      } else {
        key.ringMat.color.copy(out.color)
        key.ringMat.opacity = Math.min(1, lv)
        key.legendMat.color.copy(tmp)
      }
    }
    if (merge) { ringAttr.needsUpdate = true; legAttr.needsUpdate = true }
  }

  return {
    group: root,
    caseGroup,
    keysGroup,
    keys,
    knobTurn,
    light,
    lineColor: contour.lineColor,
    hazeMat,
    width: caseW,
    depth: caseD,
    tilt: BOARD_TILT,
    bounds: { w: caseW, bottom: -0.5, top: 1.75, back: caseD / 2, front: caseD / 2 }, // box around the board, used to fit the camera
  }
}

// Places the camera so the (rotated) board fits the view with a margin. Works from the box, so scattered keys do not zoom it out.
export function fitCamera(camera, rotation, bounds, margin = 1.1) {
  const q = new THREE.Quaternion().setFromEuler(rotation)
  const min = new THREE.Vector3(Infinity, Infinity, Infinity)
  const max = new THREE.Vector3(-Infinity, -Infinity, -Infinity)
  const v = new THREE.Vector3()
  for (const x of [-bounds.w / 2, bounds.w / 2]) {
    for (const y of [bounds.bottom, bounds.top]) {
      for (const z of [-bounds.back, bounds.front]) {
        v.set(x, y, z).applyQuaternion(q)
        min.min(v)
        max.max(v)
      }
    }
  }
  const vHalf = THREE.MathUtils.degToRad(camera.fov / 2)
  const hHalf = Math.atan(Math.tan(vHalf) * camera.aspect)
  const dV = (((max.y - min.y) / 2) * margin) / Math.tan(vHalf)
  const dH = (((max.x - min.x) / 2) * margin) / Math.tan(hHalf)
  const cx = (min.x + max.x) / 2
  const cy = (min.y + max.y) / 2
  camera.position.set(cx, cy, max.z + Math.max(dV, dH))
  camera.lookAt(cx, cy, 0)
}