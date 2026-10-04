import gsap from 'gsap'
import * as THREE from 'three'

// For each layer: where it sits at rest (y), how far it flies when exploded (offset),
// and when (on the timeline) it starts moving.
export const LAYERS = [
  { name: 'keycaps', restY: 1.35, offset: 3.8, at: 2.0 },
  { name: 'switches', restY: 0.86, offset: 1.2, at: 2.4 },
  { name: 'plate', restY: 0.55, offset: -1.4, at: 2.8 },
  { name: 'case', restY: 0, offset: -3.6, at: 3.2 },
]

export function initHero(world, keyboard) {
  const mobile = world.isMobile
  const specs = LAYERS.map((l) => document.querySelector(`.spec[data-layer="${l.name}"]`))

  // One timeline, 10 units long. scrub ties it to scroll: scroll position = timeline progress.
  const tl = gsap.timeline({
    defaults: { ease: 'power2.inOut' },
    scrollTrigger: {
      trigger: '#stage',
      start: 'top top',
      end: 'bottom bottom',
      scrub: true, // 1 second of smoothing so it feels fluid
    },
  })

  // 1) Hero text lifts away
  tl.to('.hero-copy', { autoAlpha: 0, y: -70, duration: 1.6, ease: 'power1.in' }, 0)
  tl.to('.scroll-hint', { autoAlpha: 0, duration: 0.5 }, 0)

  // 2) Camera pulls back, looks from lower and the keyboard turns a little
  tl.to(world.view, { angle: 0.38, zoom: 0.62, lookY: 0.8, duration: 5 }, 1)
  tl.to(keyboard.root.rotation, { y: 0.45, duration: 5 }, 1)

  // 3) The explosion: each layer group moves up or down from its rest position
  LAYERS.forEach((l) => {
    tl.to(keyboard.layers[l.name].position, { y: l.offset, duration: 3 }, l.at)
  })

  // 4) Spec labels appear once their layer has separated
  LAYERS.forEach((l, i) => {
    const t = l.at + 2.4
    tl.fromTo(specs[i], { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.5, ease: 'none' }, t)
    tl.fromTo(specs[i].querySelector('.spec-body'), { x: -18 }, { x: 0, duration: 0.6, ease: 'power2.out' }, t)
    // On phones only one caption fits, so hide it when the next one arrives
    if (mobile && i < LAYERS.length - 1) {
      tl.to(specs[i], { autoAlpha: 0, duration: 0.3, ease: 'none' }, LAYERS[i + 1].at + 2.3)
    }
  })

  // 5) Everything fades before the hero ends
  tl.to(specs, { autoAlpha: 0, duration: 0.6, ease: 'none' }, 9.3)
  tl.to({}, { duration: 0.01 }, 9.99) // pads the timeline to exactly 10 units

  // ---------- Labels follow their layer in 3D (desktop) ----------
  // 3D point -> screen pixel: project() gives -1..1 coordinates, we convert to pixels.
  if (!mobile) {
    const p = new THREE.Vector3()
    world.onTick(() => {
      keyboard.root.updateMatrixWorld(true)
      LAYERS.forEach((l, i) => {
        p.set(keyboard.labelX[l.name], l.restY, keyboard.labelZ) // a point just right of the layer, at the middle of the board
        keyboard.layers[l.name].localToWorld(p) // local -> world (includes the explosion offset)
        p.project(world.camera) // world -> screen (-1..1)
        const x = (p.x * 0.5 + 0.5) * window.innerWidth
        const y = (-p.y * 0.5 + 0.5) * window.innerHeight
        specs[i].style.transform = `translate3d(${x}px, ${y}px, 0)`
      })
    })
  }
}