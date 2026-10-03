import * as THREE from 'three'

const COLS = 8 // atlas columns
const S = 0.7 // legend size in key units

// labels: every text that will be printed on a key. One atlas texture holds them all.
export function createLegends(labels, mobile = false) {
  const CELL = mobile ? 64 : 128
  const uniq = [...new Set(labels.filter(Boolean))]
  const index = new Map(uniq.map((l, i) => [l, i]))
  const rows = Math.ceil(uniq.length / COLS)

  const canvas = document.createElement('canvas')
  canvas.width = CELL * COLS
  canvas.height = CELL * rows
  const ctx = canvas.getContext('2d')
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = '#ffffff' // the colour is applied later by the material
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    uniq.forEach((label, i) => {
      const cx = (i % COLS) * CELL + CELL / 2
      const cy = Math.floor(i / COLS) * CELL + CELL / 2
      const n = label.length
            const size = CELL * (n === 1 ? 0.4 : n <= 3 ? 0.26 : 0.19) // smaller, long words smaller still
      ctx.font = `500 ${size}px Inter, "Helvetica Neue", Arial, sans-serif`
      ctx.fillText(label, cx, cy + CELL * 0.02)
    })
    tex.needsUpdate = true
  }
  draw()
  if (document.fonts) document.fonts.load('500 40px Inter').then(draw, draw) // redraw once the font has loaded

  const light = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    depthWrite: false,
    color: 0xd9d7d1,
    polygonOffset: true, // pulls the legend slightly forward so it never flickers against the keycap
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  })
  const dark = light.clone() // dark text for the light accent keys
  dark.color.set(0x0e0e10)

  // One small plane geometry per label, with UVs pointing at its cell in the atlas
  const geos = new Map()
  function geoFor(label) {
    if (!geos.has(label)) {
      const i = index.get(label)
      const col = i % COLS
      const row = Math.floor(i / COLS)
      const g = new THREE.PlaneGeometry(S, S)
      g.rotateX(-Math.PI / 2) // lie flat, facing up
      const uv = g.attributes.uv
      for (let j = 0; j < uv.count; j++) {
        uv.setXY(j, (col + uv.getX(j)) / COLS, 1 - (row + 1) / rows + uv.getY(j) / rows)
      }
      geos.set(label, g)
    }
    return geos.get(label)
  }

  return {
    // y = height of the keycap top, so the legend sits right on it
    plane(label, onAccent = false, y = 0.253) {
      if (!index.has(label)) return new THREE.Object3D()
      const m = new THREE.Mesh(geoFor(label), onAccent ? dark : light)
      m.position.y = y
      m.renderOrder = 1
      return m
    },
  }
}