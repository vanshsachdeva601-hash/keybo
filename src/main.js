import './style.css'
import { audio } from './audio.js' // tiny, so it can load up front

history.scrollRestoration = 'manual' // always start at the top, so the intro plays from the beginning

// Only the intro lives here. The heavy 3D app (app.js) is downloaded when the button is pressed.
const intro = document.querySelector('#intro')
const btn = document.querySelector('#intro-enter')
const count = document.querySelector('#intro-count')
let started = false

btn.addEventListener('click', async () => {
  if (started) return
  started = true
  audio.unlock() // this click is the user gesture browsers need before allowing sound
  audio.tick()
  intro.classList.add('is-loading')

  // The counter eases toward 90% while the app loads, then finishes at 100%
  let shown = 0
  let target = 90
  let failed = false
  const step = () => {
    if (failed) return // stop updating, so an error message stays on screen
    shown += (target - shown) * 0.08
    count.textContent = String(Math.round(shown)).padStart(3, '0')
    if (shown < 99.5) requestAnimationFrame(step)
  }
  step()

  try {
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))) // let the loading state paint first
    const app = await import('./app.js') // downloads Three.js, GSAP and builds the world
    target = 100
    await new Promise((r) => setTimeout(r, 400))
    app.reveal(intro)
  } catch (err) {
    failed = true
    console.error(err)
    count.textContent = 'ERROR / OPEN CONSOLE'
  }
})