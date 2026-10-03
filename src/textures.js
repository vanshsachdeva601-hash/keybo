import * as THREE from 'three'

// Draws something on a canvas and turns it into a texture
function make(size, paint, repeat = false) {
  const c = document.createElement('canvas')
  c.width = c.height = size
  paint(c.getContext('2d'), size)
  const t = new THREE.CanvasTexture(c)
  t.anisotropy = 4
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping
  return t
}

// Fine speckle, like the surface of a PBT keycap
export const grainTexture = (size = 256) =>
  make(size, (g, s) => {
    const img = g.createImageData(s, s)
    for (let i = 0; i < img.data.length; i += 4) {
      const v = 150 + Math.random() * 105
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v
      img.data[i + 3] = 255
    }
    g.putImageData(img, 0, 0)
  }, true)

// Long horizontal streaks, like brushed aluminium
export const brushedTexture = (size = 512) =>
  make(size, (g, s) => {
    g.fillStyle = '#b8b8b8'
    g.fillRect(0, 0, s, s)
    for (let i = 0; i < s * 3; i++) {
      const v = 120 + Math.random() * 135
      g.fillStyle = `rgba(${v},${v},${v},0.5)`
      g.fillRect(Math.random() * s - s * 0.3, Math.random() * s, s * (0.2 + Math.random() * 0.8), 1)
    }
  })

// Woven cloth for the desk mat
export const fabricTexture = (size = 256) =>
  make(size, (g, s) => {
    g.fillStyle = '#c8c8c8'
    g.fillRect(0, 0, s, s)
    g.fillStyle = 'rgba(0,0,0,0.25)'
    for (let i = 0; i < s; i += 4) {
      g.fillRect(i, 0, 1, s)
      g.fillRect(0, i, s, 1)
    }
    for (let i = 0; i < s * 8; i++) {
      g.fillStyle = `rgba(0,0,0,${Math.random() * 0.2})`
      g.fillRect(Math.random() * s, Math.random() * s, 1, 1)
    }
  }, true)
  // Printed design for the desk mat: contour lines, stitched border, ruler ticks and the wordmark.
// Drawn in white; the material tints it with the mode colour.
export function deskDesignTexture(mobile = false) {
  const W = mobile ? 1024 : 2048
  const H = Math.round((W * 972) / 2048)
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d')
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8

  // rounded rectangle path
  function rr(x, y, w, h, r) {
    g.beginPath()
    g.moveTo(x + r, y)
    g.arcTo(x + w, y, x + w, y + h, r)
    g.arcTo(x + w, y + h, x, y + h, r)
    g.arcTo(x, y + h, x, y, r)
    g.arcTo(x, y, x + w, y, r)
    g.closePath()
  }

  function draw() {
    g.setTransform(1, 0, 0, 1, 0, 0)
    g.clearRect(0, 0, W, H)
    g.scale(W / 2048, W / 2048) // everything below is drawn on a 2048 x 972 grid
    g.strokeStyle = '#fff'
    g.fillStyle = '#fff'
    if ('letterSpacing' in g) g.letterSpacing = '0px'

    // Topographic contour lines (wobbly rings), clipped to the inside of the border
    g.save()
    rr(34, 34, 1980, 904, 48)
    g.clip()
    g.lineWidth = 2
    for (let i = 1; i <= 16; i++) {
      g.globalAlpha = 0.07 + (i % 4 === 0 ? 0.08 : 0) // every 4th line a little stronger
      g.beginPath()
      for (let s = 0; s <= 200; s++) {
        const th = (s / 200) * Math.PI * 2
        const r = 1 + 0.07 * Math.sin(3 * th + i * 0.6) + 0.045 * Math.sin(5 * th - i * 1.1) + 0.03 * Math.sin(8 * th + i * 0.4)
        const x = 1024 + Math.cos(th) * 92 * i * r
        const y = 486 + Math.sin(th) * 46 * i * r
        if (s === 0) g.moveTo(x, y)
        else g.lineTo(x, y)
      }
      g.closePath()
      g.stroke()
    }
    g.restore()

    // Outer edge and the stitched border
    g.globalAlpha = 0.18
    g.lineWidth = 2
    rr(18, 18, 2012, 936, 60)
    g.stroke()
    g.globalAlpha = 0.55
    g.lineWidth = 3
    g.setLineDash([16, 12])
    rr(34, 34, 1980, 904, 48)
    g.stroke()
    g.setLineDash([])

    // Ruler ticks along the back edge
    g.globalAlpha = 0.4
    g.lineWidth = 2
    for (let i = 0, x = 140; x <= 1908; x += 24, i++) {
      g.beginPath()
      g.moveTo(x, 64)
      g.lineTo(x, 64 + (i % 5 === 0 ? 30 : 16))
      g.stroke()
    }

    // Registration crosses in the four corners
    g.globalAlpha = 0.5
    const corners = [[96, 96], [1952, 96], [96, 876], [1952, 876]]
    corners.forEach(([x, y]) => {
      g.beginPath()
      g.moveTo(x - 12, y)
      g.lineTo(x + 12, y)
      g.moveTo(x, y - 12)
      g.lineTo(x, y + 12)
      g.stroke()
    })

    // Wordmark (outlined) on the front edge, small mono text around it
    g.textBaseline = 'alphabetic'
    g.textAlign = 'center'
    g.globalAlpha = 0.75
    g.lineWidth = 3
    g.font = '700 128px "Space Grotesk", system-ui, sans-serif'
    if ('letterSpacing' in g) g.letterSpacing = '20px'
    g.strokeText('KEYBO', 1024, 886)

    g.font = '400 22px "JetBrains Mono", ui-monospace, monospace'
    if ('letterSpacing' in g) g.letterSpacing = '5px'
    g.globalAlpha = 0.6
    g.textAlign = 'left'
    g.fillText('SERIES 01 / DESK MAT', 100, 886)
    g.textAlign = 'right'
    g.fillText('EVERY MODE. ONE BOARD.', 1948, 886)
    g.globalAlpha = 0.45
    g.textAlign = 'center'
    g.fillText('61 KEYS  /  4 MODES  /  1 BOARD', 1024, 150)

    tex.needsUpdate = true
  }

  draw()
  // Draw again once the web fonts have loaded
  if (document.fonts) {
    Promise.all([
      document.fonts.load('700 128px "Space Grotesk"'),
      document.fonts.load('400 22px "JetBrains Mono"'),
    ]).then(draw, draw)
  }
  return tex
}
// Ridges around the side of the knob (used as a bump map on a cylinder)
export function knurlTexture() {
  const c = document.createElement('canvas')
  c.width = 32
  c.height = 8
  const g = c.getContext('2d')
  const grad = g.createLinearGradient(0, 0, 32, 0)
  grad.addColorStop(0, '#000')
  grad.addColorStop(0.5, '#fff')
  grad.addColorStop(1, '#000')
  g.fillStyle = grad
  g.fillRect(0, 0, 32, 8)
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(40, 1) // 40 ridges around the knob
  return t
}
// Small seeded value-noise, used to make the contour map
function makeNoise(seed) {
  const N = 256
  const perm = new Uint8Array(N * 2)
  const vals = new Float32Array(N)
  let s = seed
  const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296
  for (let i = 0; i < N; i++) { vals[i] = rnd(); perm[i] = i }
  for (let i = N - 1; i > 0; i--) {
    const j = (rnd() * (i + 1)) | 0
    const t = perm[i]; perm[i] = perm[j]; perm[j] = t
  }
  for (let i = 0; i < N; i++) perm[i + N] = perm[i]
  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10)
  return (x, y) => {
    const xi = Math.floor(x)
    const yi = Math.floor(y)
    const xf = x - xi
    const yf = y - yi
    const X = xi & 255
    const Y = yi & 255
    const a = vals[perm[perm[X] + Y]]
    const b = vals[perm[perm[X + 1] + Y]]
    const c = vals[perm[perm[X] + Y + 1]]
    const d = vals[perm[perm[X + 1] + Y + 1]]
    const u = fade(xf)
    const v = fade(yf)
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
  }
}

// One big topographic map. Every keycap shows its own piece of it, so the lines run on across the whole keyboard.
// How: build a smooth height field, then draw a thin line wherever the height crosses a whole number.
export function topoTexture(wUnits, dUnits, mobile = false) {
  const W = mobile ? 1024 : 1792
  const H = Math.round((W * dUnits) / wUnits)
  const noise = makeNoise(7)
  const F = new Float32Array(W * H)
  const base = 1 / 3.4 // hills are about 3.4 key units wide
  for (let y = 0; y < H; y++) {
    const v = (y / H) * dUnits * base
    for (let x = 0; x < W; x++) {
      const u = (x / W) * wUnits * base
      F[y * W + x] =
        noise(u + 11.3, v + 4.7) * 0.55 +
        noise(u * 2 + 3.1, v * 2 + 9.2) * 0.27 +
        noise(u * 4 + 7.7, v * 4 + 1.3) * 0.13 +
        noise(u * 8 + 2.2, v * 8 + 5.9) * 0.05
    }
  }

  const LEVELS = 24 // number of contour levels
  const half = mobile ? 1.0 : 1.1 // half of the line width, in pixels
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const ctx = c.getContext('2d')
  const img = ctx.createImageData(W, H)
  const data = img.data
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x
      const xl = x > 0 ? F[i - 1] : F[i]
      const xr = x < W - 1 ? F[i + 1] : F[i]
      const yu = y > 0 ? F[i - W] : F[i]
      const yd = y < H - 1 ? F[i + W] : F[i]
      const gx = (xr - xl) * 0.5 * LEVELS
      const gy = (yd - yu) * 0.5 * LEVELS
      const gm = Math.sqrt(gx * gx + gy * gy) // how fast the level changes per pixel
      const t = F[i] * LEVELS
      const dist = Math.abs(t - Math.round(t)) // distance to the nearest contour, in levels
      const a = Math.max(0, Math.min(1, half + 0.5 - dist / Math.max(gm, 1e-4))) // converted to pixels = constant line width
      const o = i * 4
      data[o] = data[o + 1] = data[o + 2] = 255
      data[o + 3] = Math.round(a * 255)
    }
  }
  ctx.putImageData(img, 0, 0)

  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  return tex
}