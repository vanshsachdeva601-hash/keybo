import './style.css'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'
import { createScene } from './scene.js'
import { createKeyboard } from './keyboard.js'

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

// Pause rendering when the hero is off screen, and fade the canvas out as the hero ends
ScrollTrigger.create({
  trigger: '#stage',
  start: 'top bottom',
  end: 'bottom top',
  onToggle: (self) => world.setRunning(self.isActive),
})
gsap.to('#webgl', {
  opacity: 0,
  ease: 'none',
  scrollTrigger: { trigger: '#stage', start: 'bottom 85%', end: 'bottom 35%', scrub: true },
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
  keyboard.setAccent(mode.color) // keyboard accent keys follow the mode
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
  if (valid) form.reset()
})