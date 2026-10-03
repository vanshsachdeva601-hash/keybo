import * as THREE from 'three'
import gsap from 'gsap'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { createLegends } from './legends.js'
import { grainTexture, brushedTexture, fabricTexture, deskDesignTexture } from './textures.js'

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
const GAP = 0.16 // space between keycaps. This is where the underglow shows through.

// What is printed on each key. Letters and digits come straight from the key code.
const NAMES = {
  Escape: 'Esc', Minus: '-', Equal: '=', Backspace: 'Del', BracketLeft: '[', BracketRight: ']',
  Backslash: '\\', CapsLock: 'Caps', Semicolon: ';', Quote: "'", Enter: 'Enter',
  ShiftLeft: 'Shift', ShiftRight: 'Shift', Comma: ',', Period: '.', Slash: '/',
  ControlLeft: 'Ctrl', ControlRight: 'Ctrl', MetaLeft: 'Cmd', AltLeft: 'Alt', AltRight: 'Alt',
  Space: 'KEYBO', Fn: 'Fn', ContextMenu: 'Menu',
}
const labelFor = (code) => NAMES[code] ?? code.replace(/^(Key|Digit)/, '')

const LEGEND_OFF = new THREE.Color(0xc4c2bc) // printed legend colour when the LEDs are off
const WARM_WHITE = 0xf2efe8 // the LED colour before any mode is chosen

// A soft glowing square: white in the middle, fading out at the edges. Drawn once, reused for every LED.
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

export function createKeyboard(world) {
  const { scene, onTick, isMobile } = world
  const seg = isMobile ? 1 : 3 // fewer polygons on phones

  // root: moved by scroll animations. float: idle motion + mouse tilt.
  const root = new THREE.Group()
  const float = new THREE.Group()
  root.add(float)
  scene.add(root)

  // ---------- Surface textures (all generated in code) ----------
  const grain = grainTexture(isMobile ? 128 : 256)
  const brushed = brushedTexture(isMobile ? 256 : 512)
  const fabric = fabricTexture(isMobile ? 128 : 256)
  fabric.repeat.set(10, 4)

  // ---------- Materials: matte, nothing here emits light ----------
  const caseMat = new THREE.MeshStandardMaterial({
    color: 0x141416, metalness: 0.12, roughness: 0.72, bumpMap: brushed, bumpScale: 0.12, // anodised matte
  })
  const plateMat = new THREE.MeshStandardMaterial({
    color: 0x1b1b1e, metalness: 0.3, roughness: 0.6, bumpMap: brushed, bumpScale: 0.12,
  })
  const switchMat = new THREE.MeshStandardMaterial({ color: 0x2c2c31, roughness: 0.7 })
  const capMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1d, roughness: 0.88, bumpMap: grain, bumpScale: 0.18 }) // matte PBT
  const accentMat = new THREE.MeshStandardMaterial({ color: 0xedebe6, roughness: 0.75, bumpMap: grain, bumpScale: 0.15 })
  const deskMat = new THREE.MeshStandardMaterial({ color: 0x151517, roughness: 0.95, bumpMap: fabric, bumpScale: 0.5 })

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

  // The desk mat lives inside the case layer, so it travels down with the case when the keyboard opens
  const mat = new THREE.Mesh(new RoundedBoxGeometry(KB_W + 5, 0.14, ROWS.length + 4.5, 2, 0.06), deskMat)
  mat.position.y = -0.58
  layers.case.add(mat)

  // The printed design on the mat (white texture, tinted with the mode colour every frame)
  const decalW = KB_W + 4.8
  const decalGeo = new THREE.PlaneGeometry(decalW, (decalW * 972) / 2048)
  decalGeo.rotateX(-Math.PI / 2) // lie flat, facing up. The top of the image is the back edge of the mat.
  const decalMat = new THREE.MeshBasicMaterial({
    map: deskDesignTexture(isMobile),
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
    color: WARM_WHITE,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  })
  const decal = new THREE.Mesh(decalGeo, decalMat)
  decal.position.y = -0.504 // just above the mat surface (-0.51)
  layers.case.add(decal)

  // Light spilling from under the keyboard onto the desk mat (additive, so it only ever adds light)
  const glowTex = glowTexture()
  const spillGeo = new THREE.PlaneGeometry(KB_W + 7, ROWS.length + 6.5)
  spillGeo.rotateX(-Math.PI / 2)
  const spillMat = new THREE.MeshBasicMaterial({
    map: glowTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false,
  })
  const spill = new THREE.Mesh(spillGeo, spillMat)
  spill.position.y = -0.5
  spill.renderOrder = 1
  layers.case.add(spill)

  const plateMesh = new THREE.Mesh(
    new RoundedBoxGeometry(KB_W + 0.2, 0.12, ROWS.length + 0.2, 2, 0.04),
    plateMat
  )
  plateMesh.position.y = 0.55
  layers.plate.add(plateMesh)

  // ---------- Keys, switches and the LED under each key ----------
  const keys = new Map() // code -> { cap, sw, glow, x, z } (used for typing and the intro)
  const lit = [] // one entry per key: its LED material, its legend material and its ripple value
  const capGeoCache = new Map() // one geometry per key width, reused
  const glowGeoCache = new Map()
  const switchGeo = new RoundedBoxGeometry(0.55, 0.5, 0.55, 2, 0.05)
  const legends = createLegends(ROWS.flat().map((key) => labelFor(key.code)), isMobile)

  ROWS.forEach((row, r) => {
    let x = -KB_W / 2
    const z = r - (ROWS.length - 1) / 2
    row.forEach((key) => {
      const cx = x + key.w / 2

      const sw = new THREE.Mesh(switchGeo, switchMat)
      sw.position.set(cx, 0.86, z)
      layers.switches.add(sw)

      // The LED: a glow plane lying on the plate, a little bigger than the key.
      // The keycap hides most of it, so the light only escapes through the gaps and around the edges.
      if (!glowGeoCache.has(key.w)) {
        const gg = new THREE.PlaneGeometry(key.w * 1.5, 1.5)
        gg.rotateX(-Math.PI / 2)
        glowGeoCache.set(key.w, gg)
      }
      const ledMat = new THREE.MeshBasicMaterial({
        map: glowTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false,
      })
      const glow = new THREE.Mesh(glowGeoCache.get(key.w), ledMat)
      glow.position.set(cx, 0.625, z)
      layers.plate.add(glow) // it travels with the plate when the keyboard opens

      if (!capGeoCache.has(key.w)) {
        capGeoCache.set(key.w, new RoundedBoxGeometry(key.w - GAP, 0.5, 1 - GAP, seg, 0.08))
      }
      // Own material per key (a shade darker for wide modifier keys)
      const keyMat = key.a ? accentMat : capMat.clone()
      if (!key.a) keyMat.color.set(key.w > 1 ? 0x121214 : 0x1a1a1d)
      const cap = new THREE.Mesh(capGeoCache.get(key.w), keyMat)

      // Printed legend. Its own material, so it can light up when the LED is on (shine-through legends)
      const legend = legends.plane(labelFor(key.code), key.a)
      if (legend.material) legend.material = legend.material.clone()
      cap.add(legend)

      cap.position.set(cx, 1.35, z)
      layers.keycaps.add(cap)

      lit.push({ led: ledMat, legend: legend.material || null, accent: key.a, x: cx, z, glow: { v: 0 } }) // glow.v = extra light from a key press ripple
      keys.set(key.code, { cap, sw, glow, x: cx, z })
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

  // ---------- Mode lighting: every frame, each LED gets a colour and a brightness ----------
  let mode = 'none'
  const fx = { pulse: 0 } // short flash when the mode changes
  const tmp = new THREE.Color(WARM_WHITE)

  onTick((t) => {
    // Spill on the desk mat, and the mat design follows the same colour
    let spillTarget = 0
    if (mode === 'play') { spillMat.color.setHSL((t * 0.12) % 1, 1, 0.5); spillTarget = 0.4 }
    else if (mode === 'type') { spillMat.color.set(0xffb020); spillTarget = 0.3 }
    else if (mode === 'work') { spillMat.color.set(0x3da5ff); spillTarget = 0.28 }
    else if (mode === 'compact') { spillMat.color.set(0x7cffb2); spillTarget = 0.3 }
    else { spillMat.color.set(WARM_WHITE); spillTarget = 0.26 } // no mode yet: soft white
    spillMat.opacity += (spillTarget - spillMat.opacity) * 0.06
    decalMat.color.lerp(spillMat.color, 0.08) // fades smoothly from one mode colour to the next

    lit.forEach((o) => {
      let I
      if (mode === 'play') {
        tmp.setHSL((o.x * 0.045 + t * 0.35) % 1, 1, 0.5) // hue moves along x and over time = wave
        I = 0.85
      } else if (mode === 'type') {
        tmp.set(0xffb020)
        I = 0.5 + Math.sin(t * 1.6 + o.x * 0.15) * 0.12
      } else if (mode === 'work') {
        tmp.set(0x3da5ff)
        I = 0.5
      } else if (mode === 'compact') {
        tmp.set(0x7cffb2)
        I = 0.55 + Math.sin(t * 2 - o.x * 0.4) * 0.12
      } else {
        tmp.set(WARM_WHITE) // before any mode: steady warm white that gently breathes
        I = 0.6 + Math.sin(t * 1.2 + o.x * 0.2) * 0.06
      }
      const level = I + o.glow.v
      o.led.color.copy(tmp)
      o.led.opacity = Math.min(1, level + fx.pulse * 0.5)
      // The printed letter picks up the LED colour. Letters on the light accent keys stay dark.
      if (o.legend && !o.accent) o.legend.color.copy(LEGEND_OFF).lerp(tmp, Math.min(1, level * 1.5))
    })
  })

  return {
    root,
    float,
    layers,
    keys,
    width: KB_W + 0.8,
    // Fades the accent keys and light to the new mode colour
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
    press(code) {
      const k = keys.get(code)
      if (!k) return
      gsap.to(k.cap.position, { y: 1.13, duration: 0.06, ease: 'power2.out', overwrite: true }) // key goes down
      // Ripple: nearby LEDs flash, farther ones flash later and weaker
      lit.forEach((o) => {
        const d = Math.hypot(o.x - k.x, (o.z - k.z) * 1.6)
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
      const k = keys.get(code)
      if (!k) return
      gsap.to(k.cap.position, { y: 1.35, duration: 0.25, ease: 'back.out(4)', overwrite: true }) // springs back up
    },
    // Intro: keys wait out of sight, then fall onto the board one by one
    hideForIntro() {
      keys.forEach(({ cap, sw, glow }) => { cap.visible = false; sw.visible = false; glow.visible = false })
    },
    dropIn(audio) {
      let i = 0
      keys.forEach(({ cap, sw, glow, x, z }) => {
        const delay = 0.1 + (x + 7.5) * 0.035 + (z + 2) * 0.06 + Math.random() * 0.12 // left to right, back to front
        cap.visible = true
        sw.visible = true
        gsap.delayedCall(delay + 0.7, () => { glow.visible = true }) // the LED turns on once the key has landed
        gsap.fromTo(cap.position, { y: 9 + Math.random() * 5 }, { y: 1.35, duration: 0.9, delay, ease: 'bounce.out' })
        gsap.fromTo(cap.rotation, { x: (Math.random() - 0.5) * 1.6, z: (Math.random() - 0.5) * 1.2 }, { x: 0, z: 0, duration: 0.9, delay, ease: 'power3.out' })
        gsap.fromTo(sw.position, { y: 6 + Math.random() * 3 }, { y: 0.86, duration: 0.7, delay, ease: 'power3.out' })
        if (i++ % 4 === 0) gsap.delayedCall(delay + 0.45, () => audio.tick()) // a click for every 4th key
      })
    },
  }
}