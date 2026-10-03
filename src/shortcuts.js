// Hold Option/Alt and press a letter to jump to a section
const MAP = { KeyM: '#modes', KeyI: '#switch', KeyP: '#products', KeyO: '#story', KeyC: '#contact' }

export function initShortcuts(lenis) {
  window.addEventListener('keydown', (e) => {
    if (!e.altKey || e.metaKey || e.ctrlKey) return
    const sel = MAP[e.code] // e.code is the physical key, so Option+M still works on a Mac
    if (!sel) return
    e.preventDefault()
    lenis.scrollTo(document.querySelector(sel), { offset: sel === '#switch' ? 0 : -64, duration: 1.6 })
  })
}