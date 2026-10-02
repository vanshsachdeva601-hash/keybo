import * as THREE from 'three'
import gsap from 'gsap'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'

// The switch lives far below the keyboard, so the two never overlap in the same scene.
export const SW_Y = -40

export function createSwitch(world) {
  const { scene, isMobile } = world

  const group = new THREE.Group()
  group.position.set(0, SW_Y, 0)
  group.rotation.x = 0.12
  scene.add(group)

  // A light that travels with the switch
  const light = new THREE.PointLight(0xffffff, 40, 40, 2)
  light.position.set(3, 5, 6)
  group.add(light)

  // ---------- Materials ----------
  const housingMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2e, metalness: 0.5, roughness: 0.4 })
  const shellMat = new THREE.MeshStandardMaterial({
    color: 0x9a9ca4, metalness: 0.1, roughness: 0.15,
    transparent: true, opacity: 0.28, depthWrite: false, // see-through top housing = cutaway look
  })
  const stemMat = new THREE.MeshStandardMaterial({ color: 0xedebe6, roughness: 0.4 }) // follows the mode accent
  const springMat = new THREE.MeshStandardMaterial({ color: 0xc8cbd2, metalness: 1, roughness: 0.3 })
  const capMat = new THREE.MeshStandardMaterial({ color: 0x18181a, roughness: 0.55 })

  // Every part is a group sitting at its "rest" height, so scroll can move it up and down
  const parts = {}
  function add(name, y, ...meshes) {
    const g = new THREE.Group()
    g.position.y = y
    g.userData.rest = y
    meshes.forEach((m) => g.add(m))
    group.add(g)
    parts[name] = g
  }

  // Bottom housing
  add('bottom', 0, new THREE.Mesh(new RoundedBoxGeometry(1.5, 0.7, 1.5, 3, 0.08), housingMat))

  // Spring: a helix drawn as a thin tube. Built from y = 0 upward, so scaling Y compresses it toward its base.
  const steps = isMobile ? 60 : 110
  const pts = []
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const a = t * 5 * Math.PI * 2 // 5 turns
    pts.push(new THREE.Vector3(Math.cos(a) * 0.3, t * 1.0, Math.sin(a) * 0.3))
  }
  const springGeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), steps * 2, 0.035, isMobile ? 5 : 8, false)
  add('spring', 0.35, new THREE.Mesh(springGeo, springMat))

  // Top housing: transparent shell plus thin edge lines
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(1.5, 0.7, 1.5)),
    new THREE.LineBasicMaterial({ color: 0x8a8a90 })
  )
  add('top', 1.35, new THREE.Mesh(new RoundedBoxGeometry(1.5, 0.7, 1.5, 3, 0.08), shellMat), edges)

  // Stem: a column with a "+" shaped top, where the keycap clips on
  const body = new THREE.Mesh(new RoundedBoxGeometry(0.5, 1.2, 0.5, 2, 0.04), stemMat)
  const crossA = new THREE.Mesh(new RoundedBoxGeometry(0.95, 0.22, 0.22, 2, 0.03), stemMat)
  const crossB = new THREE.Mesh(new RoundedBoxGeometry(0.22, 0.22, 0.95, 2, 0.03), stemMat)
  crossA.position.y = 0.7
  crossB.position.y = 0.7
  add('stem', 1.95, body, crossA, crossB)

  // Keycap
  add('keycap', 3.0, new THREE.Mesh(new RoundedBoxGeometry(1.35, 0.75, 1.35, 3, 0.1), capMat))

  return {
    group,
    parts,
    setAccent(hex) {
      const c = new THREE.Color(hex)
      gsap.to(stemMat.color, { r: c.r, g: c.g, b: c.b, duration: 0.4 })
    },
  }
}

// How far each part flies when the switch is taken apart (top to bottom)
const ORDER = [
  ['keycap', 3.8],
  ['stem', 2.4],
  ['top', 1.0],
  ['spring', -0.4],
  ['bottom', -1.6],
]

export function initSwitch(world, sw) {
  const { parts, group } = sw
  const mobile = world.isMobile
  const rest = (n) => parts[n].userData.rest
  const zoomFor = (dist) => () => world.baseDist() / dist // camera distance -> zoom value

  const lookX = mobile ? 0 : -2 // negative = switch appears on the right, text on the left
  const closed = { zoom: zoomFor(11), lookY: SW_Y + (mobile ? 1.2 : 1.8) }
  const open = { zoom: zoomFor(17), lookY: SW_Y + (mobile ? 1.8 : 3) }

  // ---------- 1) Travel: the camera dives from the keyboard down to the switch ----------
  gsap
    .timeline({
      scrollTrigger: { trigger: '#switch', start: 'top bottom', end: 'top top', scrub: 1, invalidateOnRefresh: true },
    })
    .fromTo(
      world.view,
      { angle: 0.7, zoom: 1, lookX: 0, lookY: 4, lookZ: -1 }, // where the Modes section left the camera
      { angle: 0.5, zoom: closed.zoom, lookX, lookY: closed.lookY, lookZ: 0, ease: 'power2.inOut', immediateRender: false }
    )

  // ---------- 2) Pinned scene: take apart, explain, put back, press ----------
  const tl = gsap.timeline({
    defaults: { ease: 'power2.inOut' },
    scrollTrigger: { trigger: '#switch', start: 'top top', end: 'bottom bottom', scrub: 1, invalidateOnRefresh: true },
  })

  // fromTo with explicit values keeps every tween correct even if you scroll fast or jump
  const moveY = (name, from, to, dur, at) =>
    tl.fromTo(parts[name].position, { y: from }, { y: to, duration: dur, immediateRender: false }, at)

  tl.fromTo('.switch-head', { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: 0.6, ease: 'power2.out' }, 0)
  tl.to('.switch-hint', { autoAlpha: 0, duration: 0.4 }, 0.8)

  // Explode, one part after another
  ORDER.forEach(([name, off], i) => moveY(name, rest(name), rest(name) + off, 2.2, 0.8 + i * 0.25))
  tl.fromTo(
    world.view,
    { zoom: closed.zoom, lookY: closed.lookY },
    { zoom: open.zoom, lookY: open.lookY, duration: 3, immediateRender: false },
    0.8
  )

  // Slow turn while the parts are explained
  tl.fromTo(group.rotation, { y: 0 }, { y: 1.3, duration: 8.6, ease: 'none', immediateRender: false }, 1)

  // Text blocks: five parts, then the final "press" block
  const items = gsap.utils.toArray('.part')
  items.forEach((el, i) => {
    const at = i < 5 ? 3.4 + i * 1.2 : 11
    tl.fromTo(el, { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 0.5, ease: 'power2.out', immediateRender: false }, at)
    if (i < 5) tl.to(el, { autoAlpha: 0, y: -24, duration: 0.4, ease: 'power2.in' }, at + 1)
  })

  // Put it back together
  ORDER.forEach(([name, off], i) => moveY(name, rest(name) + off, rest(name), 1.4, 9.6 + i * 0.1))
  tl.fromTo(
    world.view,
    { zoom: open.zoom, lookY: open.lookY },
    { zoom: closed.zoom, lookY: closed.lookY, duration: 1.6, immediateRender: false },
    9.6
  )
  tl.to(group.rotation, { y: 0.45, duration: 1.4 }, 9.8)

  // Press: keycap and stem go down 0.6, the spring squashes to 40% of its height
  moveY('keycap', rest('keycap'), rest('keycap') - 0.6, 1, 11.2)
  moveY('stem', rest('stem'), rest('stem') - 0.6, 1, 11.2)
  tl.fromTo(parts.spring.scale, { y: 1 }, { y: 0.4, duration: 1, immediateRender: false }, 11.2)

  tl.to({}, { duration: 0.01 }, 12.99) // pads the timeline to exactly 13 units
}