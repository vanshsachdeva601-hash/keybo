import gsap from 'gsap'
import { SplitText } from 'gsap/SplitText'

gsap.registerPlugin(SplitText)

export function initIntro({ lenis, audio, keyboard, onDone }) {
  const el = document.querySelector('#intro')
  if (!el) { onDone(); return }
  const btn = document.querySelector('#intro-enter')
  const count = document.querySelector('#intro-count')

  lenis.stop() // no scrolling while the intro is up
  lenis.scrollTo(0, { immediate: true })
  keyboard.hideForIntro()

  // Loading counter, then the button appears
  const n = { v: 0 }
  gsap.to(n, {
    v: 100,
    duration: 1.4,
    ease: 'power2.inOut',
    onUpdate: () => { count.textContent = String(Math.round(n.v)).padStart(3, '0') },
    onComplete: () => {
      gsap.to(count, { autoAlpha: 0, duration: 0.3 })
      gsap.to(btn, { autoAlpha: 1, y: 0, duration: 0.6, ease: 'power3.out' })
    },
  })

  btn.addEventListener('click', () => {
    audio.unlock() // the click is the user gesture browsers need before allowing sound
    audio.tick()
    btn.disabled = true

    const tl = gsap.timeline()
    tl.to('.intro-inner', { autoAlpha: 0, y: -30, duration: 0.5, ease: 'power2.in' })
      .to(el, { yPercent: -100, duration: 1.1, ease: 'power4.inOut' }, 0.35)
      .add(() => keyboard.dropIn(audio), 0.55)
      .add(() => { el.remove(); lenis.start(); onDone() }, 1.6)

    // Hero text enters after the overlay lifts
    SplitText.create('.wordmark', {
      type: 'chars',
      mask: 'chars',
      onSplit: (self) => gsap.from(self.chars, { yPercent: 110, duration: 1, ease: 'power4.out', stagger: 0.06, delay: 0.9 }),
    })
    gsap.from('.hero-copy .label, .tagline', { y: 24, autoAlpha: 0, duration: 0.8, ease: 'power3.out', stagger: 0.15, delay: 1.4 })
    gsap.from('.nav', { yPercent: -100, duration: 0.9, ease: 'power3.out', delay: 1.2 })
  })
}