import * as THREE from 'three'

// Slow floating specks around the keyboard
export function createDust(world) {
  const { scene, onTick, isMobile } = world
  const N = isMobile ? 70 : 160
  const pos = new Float32Array(N * 3)
  const speed = new Float32Array(N)
  for (let i = 0; i < N; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 34
    pos[i * 3 + 1] = Math.random() * 14 - 4
    pos[i * 3 + 2] = (Math.random() - 0.5) * 22 - 2
    speed[i] = 0.15 + Math.random() * 0.35
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  const mat = new THREE.PointsMaterial({
    color: 0xc7ccd6,
    size: 0.09,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
    sizeAttenuation: true,
  })
  const pts = new THREE.Points(geo, mat)
  pts.frustumCulled = false
  scene.add(pts)

  let last = 0
  onTick((t) => {
    const dt = Math.min(t - last, 0.05)
    last = t
    for (let i = 0; i < N; i++) {
      pos[i * 3 + 1] += speed[i] * dt // drift upward
      pos[i * 3] += Math.sin(t * 0.3 + i) * dt * 0.1 // tiny sideways wobble
      if (pos[i * 3 + 1] > 10) pos[i * 3 + 1] = -4 // loop back to the bottom
    }
    geo.attributes.position.needsUpdate = true
  })

  return { setAccent: (hex) => mat.color.set(hex) }
}