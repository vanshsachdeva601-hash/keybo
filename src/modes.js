import gsap from 'gsap'
import { LAYERS } from './hero.js'

// After the hero: the exploded keyboard re-assembles and settles in the lower half
// of the screen, behind the "Pick your mode" section.
export function initModes(world, keyboard) {
  const tl = gsap.timeline({
    defaults: { ease: 'power2.inOut' },
    scrollTrigger: { trigger: '#modes', start: 'top bottom', end: 'top 25%', scrub: 1 },
  })

  // fromTo with explicit start values = where the hero timeline ended
  LAYERS.forEach((l) => {
    tl.fromTo(keyboard.layers[l.name].position, { y: l.offset }, { y: 0, immediateRender: false }, 0)
  })
  tl.fromTo(world.view, { angle: 0.38, zoom: 0.62, lookY: 0.8 }, { angle: 0.7, zoom: 1, lookY: 4, immediateRender: false }, 0)
  tl.fromTo(keyboard.root.rotation, { y: 0.45 }, { y: 0, immediateRender: false }, 0)
}