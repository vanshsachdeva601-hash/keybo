// Listens to the real keyboard. Each key press animates the matching 3D key,
// plays a sound and shows the typed text on the page.
export function initTyping (keyboard, audio, isActive) {
  const out = document.querySelector('#typed')
  const toggle = document.querySelector('#sound-toggle')
  const down = new Set() // keys currently held
  let text = ''

  const isField = (el) => el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')

  window.addEventListener('keydown', (e) => {
    if (!isActive() || isField(e.target) || e.metaKey || e.ctrlKey || e.altKey) return
    audio.unlock()
    if (e.code === 'Space') e.preventDefault() // stop Space from scrolling the page
    if (e.repeat) return // ignore auto-repeat while a key is held
    down.add(e.code)
    keyboard.press(e.code)
    audio.tick()

    if (e.key.length === 1) text = (text + e.key).slice(-28)
    else if (e.key === 'Backspace') text = text.slice(0, -1)
    out.textContent = text
  })

  window.addEventListener('keyup', (e) => {
    if (down.delete(e.code)) keyboard.release(e.code)
  })

  // If the window loses focus, release every key so none stays stuck down
  window.addEventListener('blur', () => {
    down.forEach((c) => keyboard.release(c))
    down.clear()
  })

  // Sound on/off button
  let on = true
  toggle.addEventListener('click', () => {
    on = !on
    audio.setEnabled(on)
    toggle.textContent = on ? 'SOUND: ON' : 'SOUND: OFF'
    toggle.setAttribute('aria-pressed', on)
  })
}