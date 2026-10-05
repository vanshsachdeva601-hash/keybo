import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { SplitText } from 'gsap/SplitText'
import Lenis from 'lenis'
import { createScene } from './scene.js'
import { createKeyboard } from './keyboard.js'
import { initHeroBg } from './herobg.js'
import { createDust } from './dust.js'
import { initHero } from './hero.js'
import { initModes } from './modes.js'
import { createSwitch, initSwitch } from './switch.js'
import { initProducts } from './products.js'
import { initStory } from './story.js'
import { initCta } from './cta.js'
import { initMotion } from './motion.js'
import { initCursor, initMagnetic } from './cursor.js'
import { initShortcuts } from './shortcuts.js'
import { audio } from './audio.js'
import { initTyping } from './typing.js'

gsap.registerPlugin(ScrollTrigger, SplitText)
// Lines the contour pattern up from letter to letter, so it runs on across the whole word
function alignWordmark() {
  const wm = document.querySelector('.wordmark')
  if (!wm) return
  const wr = wm.getBoundingClientRect()
  wm.querySelectorAll('.wm-char').forEach((c) => {
    const r = c.getBoundingClientRect()
    c.style.backgroundSize = `${wr.width}px 100%`
    c.style.backgroundPosition = `${wr.left - r.left}px 0px`
  })
}

// ---------- Smooth scroll, synced with GSAP ----------
const lenis = new Lenis()
lenis.on('scroll', ScrollTrigger.update)
gsap.ticker.add((time) => lenis.raf(time * 1000))
gsap.ticker.lagSmoothing(0)
lenis.stop() // no scrolling until the intro lifts
lenis.scrollTo(0, { immediate: true })

document.querySelectorAll('a[href^="#"]').forEach((a) => {
  a.addEventListener('click', (e) => {
    const target = document.querySelector(a.getAttribute('href'))
    if (!target) return
    e.preventDefault()
    lenis.scrollTo(target, { offset: -64 })
  })
})

// ---------- 3D world ----------
const world = createScene(document.querySelector('#webgl'))
const heroBg = initHeroBg({ isMobile: world.isMobile })
const keyboard = createKeyboard(world)
world.fit(keyboard.width)
const dust = createDust(world)
keyboard.hideForIntro() // keys wait out of sight until reveal()
initHero(world, keyboard)
initModes(world, keyboard)

const sw = createSwitch(world)
initSwitch(world, sw)

// Heavy 3D is built only when its section gets close to the screen
function lazy(selector, margin, build) {
  const el = document.querySelector(selector)
  let api = null
  let built = false
  const queue = [] // calls that arrive before the scene exists (e.g. a mode change) wait here
  const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) ensure() }, { rootMargin: margin })
  io.observe(el)
  function ensure() {
    if (built) return
    built = true
    io.disconnect()
    api = build()
    queue.forEach((fn) => fn(api))

  }
  return { run: (fn) => (api ? fn(api) : queue.push(fn)), ensure }
}

const products = lazy('#products', '600px', () => initProducts(world.isMobile))
const story = lazy('#story', '800px', () => initStory(world.isMobile))
const cta = lazy('#contact', '800px', () => initCta(world.isMobile))

// ---------- Motion layer ----------
initMotion()
initCursor()
initMagnetic()
initShortcuts(lenis)
window.addEventListener('load', () => ScrollTrigger.refresh())

// Typing only reacts while the keyboard is on screen and the intro is over
let introDone = false
let kbActive = true
initTyping(keyboard, audio, () => kbActive && introDone)
ScrollTrigger.create({
  trigger: '#stage',
  start: 'top bottom',
  endTrigger: '#modes',
  end: 'bottom 30%',
  onToggle: (self) => { kbActive = self.isActive },
})

// Render the main canvas only while a 3D scene is visible (hero, modes, switch), then fade it out
ScrollTrigger.create({
  trigger: '#stage',
  start: 'top bottom',
  endTrigger: '#switch',
  end: 'bottom top',
  onToggle: (self) => world.setRunning(self.isActive),
})
gsap.to('#webgl', {
  opacity: 0,
  ease: 'none',
  scrollTrigger: { trigger: '#switch', start: 'bottom 75%', end: 'bottom 35%', scrub: true },
})

// ---------- Mode switcher ----------
const MODES = {
  play: { color: '#ff2e4d', line: 'Low latency. Linear switches. Built to win.' },
  type: { color: '#ffb020', line: 'Tactile. Thocky. Built to write.' },
  work: { color: '#3da5ff', line: 'Quiet. Multi-device. Built to focus.' },
  compact: { color: '#7cffb2', line: '75%. Wireless. Built to travel.' },
}

const root = document.documentElement
const buttons = document.querySelectorAll('.mode-btn')
const modeLine = document.querySelector('#mode-line')

function setMode(name) {
  const mode = MODES[name]
  root.style.setProperty('--accent', mode.color)
  root.dataset.mode = name
  modeLine.textContent = mode.line
  keyboard.setAccent(mode.color)
  keyboard.setMode(name)
  heroBg.setColor(mode.color)
  sw.setAccent(mode.color)
  dust.setAccent(mode.color)
  story.run((s) => s.setAccent(mode.color))
  cta.run((c) => c.setAccent(mode.color))
  cta.run((c) => c.setMode(name))
  audio.unlock()
  audio.setProfile(name)
  audio.tick()
  buttons.forEach((btn) => {
    const active = btn.dataset.mode === name
    btn.classList.toggle('is-active', active)
    btn.setAttribute('aria-pressed', active)
  })
}
buttons.forEach((btn) => btn.addEventListener('click', () => setMode(btn.dataset.mode)))

// ---------- Waitlist form (front-end only) ----------
const form = document.querySelector('#waitlist')
const formMsg = document.querySelector('#form-msg')

form.addEventListener('submit', (e) => {
  e.preventDefault()
  const email = form.elements.email.value.trim()
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  formMsg.textContent = valid ? "You're on the list." : 'Enter a valid email.'
  gsap.fromTo(formMsg, { y: 10, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.5, ease: 'power3.out' })
  if (valid) {
    form.reset()
    audio.unlock()
    audio.tick()
    cta.run((c) => c.celebrate())
  }
})

// ---------- Intro reveal (called by main.js once everything above has loaded) ----------
export function reveal(intro) {
  const tl = gsap.timeline()
  tl.to('.intro-inner', { autoAlpha: 0, y: -30, duration: 0.5, ease: 'power2.in' })
    .to(intro, { yPercent: -100, duration: 1.1, ease: 'power4.inOut' }, 0.35)
    .add(() => keyboard.dropIn(audio), 0.55)
        .add(() => {
      intro.remove()
      lenis.start()
      introDone = true
      ScrollTrigger.refresh()

      // Build the heavy scenes while the page is idle, one by one, instead of in the middle of a scroll
      const idle = (fn) => ('requestIdleCallback' in window ? requestIdleCallback(fn, { timeout: 4000 }) : setTimeout(fn, 600))
      setTimeout(() => idle(() => products.ensure()), 1800)
      setTimeout(() => idle(() => story.ensure()), 3800)
      setTimeout(() => idle(() => cta.ensure()), 5800)
    }, 1.6)

    SplitText.create('.wordmark', {
    type: 'chars',
    mask: 'chars',
    charsClass: 'wm-char', // so the letters can get the contour fill from the CSS
    onSplit: (self) => {
      alignWordmark()
      return gsap.from(self.chars, { yPercent: 110, duration: 1, ease: 'power4.out', stagger: 0.06, delay: 0.9 })
    },
  })
  window.addEventListener('resize', alignWordmark)
  if (document.fonts) document.fonts.ready.then(alignWordmark)
  gsap.from('.hero-copy .label, .tagline', { y: 24, autoAlpha: 0, duration: 0.8, ease: 'power3.out', stagger: 0.15, delay: 1.4 })
  gsap.from('.nav', { yPercent: -100, duration: 0.9, ease: 'power3.out', delay: 1.2 })
  gsap.delayedCall(0.9, () => heroBg.show()) // the hero background fades in as the intro lifts
}