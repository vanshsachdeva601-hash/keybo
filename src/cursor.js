import gsap from 'gsap'

const fine = () => window.matchMedia('(hover: hover) and (pointer: fine)').matches // mouse or trackpad, not touch
const HOVER = 'a, button, input, .card'

// A keycap-shaped cursor. It "presses down" when you click.
export function initCursor() {
  if (!fine()) return

  const el = document.createElement('div')
  el.className = 'cursor'
  document.body.appendChild(el)
  gsap.set(el, { xPercent: -50, yPercent: -50, autoAlpha: 0 })

  // quickTo = a fast, reusable tween for values that change every frame
  const xTo = gsap.quickTo(el, 'x', { duration: 0.35, ease: 'power3' })
  const yTo = gsap.quickTo(el, 'y', { duration: 0.35, ease: 'power3' })

  let shown = false
  let hovering = false
  let down = false

  const scaleNow = () => gsap.to(el, { scale: (hovering ? 2.6 : 1) * (down ? 0.75 : 1), duration: 0.25, ease: 'power3.out' })

  window.addEventListener('pointermove', (e) => {
    if (!shown) {
      shown = true
      gsap.set(el, { x: e.clientX, y: e.clientY })
      gsap.to(el, { autoAlpha: 1, duration: 0.2 })
      document.documentElement.classList.add('has-cursor') // only now hide the native cursor
    }
    xTo(e.clientX)
    yTo(e.clientY)
    const h = !!e.target.closest(HOVER)
    if (h !== hovering) {
      hovering = h
      scaleNow()
    }
  })
  window.addEventListener('pointerdown', () => { down = true; scaleNow() })
  window.addEventListener('pointerup', () => { down = false; scaleNow() })
  document.documentElement.addEventListener('mouseleave', () => gsap.to(el, { autoAlpha: 0, duration: 0.2 }))
  document.documentElement.addEventListener('mouseenter', () => { if (shown) gsap.to(el, { autoAlpha: 1, duration: 0.2 }) })
}

// Buttons lean toward the cursor, then spring back
export function initMagnetic() {
  if (!fine()) return
  document.querySelectorAll('.form button, .nav-cta, .sound-toggle').forEach((el) => {
    const xTo = gsap.quickTo(el, 'x', { duration: 0.4, ease: 'power3' })
    const yTo = gsap.quickTo(el, 'y', { duration: 0.4, ease: 'power3' })
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect()
      xTo((e.clientX - (r.left + r.width / 2)) * 0.35)
      yTo((e.clientY - (r.top + r.height / 2)) * 0.35)
    })
    el.addEventListener('pointerleave', () => { xTo(0); yTo(0) })
  })
}