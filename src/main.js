import './style.css'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'
import { createScene } from './scene.js'
import { createKeyboard } from './keyboard.js'
import { initHero } from './hero.js'
import { initModes } from './modes.js'
import { createSwitch, initSwitch } from './switch.js'
import { initProducts } from './products.js'
import { initMotion } from './motion.js'
import { initCursor, initMagnetic } from './cursor.js'
import { audio } from './audio.js'
import { initTyping } from './typing.js'

gsap.registerPlugin(ScrollTrigger)

// ---------- Smooth scroll, synced with GSAP ----------
const lenis = new Lenis()
lenis.on('scroll', ScrollTrigger.update)
gsap.ticker.add((time) => lenis.raf(time * 1000))
gsap.ticker.lagSmoothing(0)

// Nav links glide instead of jumping
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
const keyboard = createKeyboard(world)
world.fit(keyboard.width)
initHero(world, keyboard)
initModes(world, keyboard)

const sw = createSwitch(world)
initSwitch(world, sw)
initProducts(world.isMobile)

// ---------- Motion layer ----------
initMotion()
initCursor()
initMagnetic()
window.addEventListener('load', () => ScrollTrigger.refresh()) // recalculate positions once everything has loaded

// Typing only reacts while the keyboard is on screen
let kbActive = true
initTyping(keyboard, audio, () => kbActive)
ScrollTrigger.create({
  trigger: '#stage',
  start: 'top bottom',
  endTrigger: '#modes',
  end: 'bottom 30%',
  onToggle: (self) => { kbActive = self.isActive },
})

// Render only while a 3D scene is visible (hero, modes, switch), then fade the canvas out
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
  sw.setAccent(mode.color)
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
    audio.tick() // a key click as the "success" sound
  }
})