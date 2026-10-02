import './style.css'

// ---------- Mode switcher ----------
// Each mode has an accent color and a one-line description.
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
  root.style.setProperty('--accent', mode.color) // every accent on the page follows this
  root.dataset.mode = name
  modeLine.textContent = mode.line
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