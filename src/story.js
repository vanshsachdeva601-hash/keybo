import * as THREE from 'three'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'

export function initStory(mobile) {
  const host = document.querySelector('#story-3d')
  const noop = { setAccent() {} }
  if (!host) return noop

  const renderer = new THREE.WebGLRenderer({ antialias: !mobile, alpha: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, mobile ? 1.25 : 1.75))
  host.appendChild(renderer.domElement)

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100)
  camera.position.set(0, 0, 18)
  scene.add(new THREE.AmbientLight(0xffffff, 0.8))
  const sun = new THREE.DirectionalLight(0xffffff, 2.4)
  sun.position.set(4, 6, 8)
  scene.add(sun)

  // InstancedMesh: many copies of one keycap, drawn in a single call (fast)
  const COUNT = mobile ? 26 : 60
  const mesh = new THREE.InstancedMesh(
    new RoundedBoxGeometry(1, 0.55, 1, 2, 0.12),
    new THREE.MeshStandardMaterial({ roughness: 0.55 }),
    COUNT
  )
  mesh.frustumCulled = false
  const root = new THREE.Group()
  root.add(mesh)
  scene.add(root)

  const dark = new THREE.Color(0x1b1b1e)
  const accent = new THREE.Color(0xc7ccd6)
  const accentIdx = []
  const rnd = (a, b) => a + Math.random() * (b - a)
  const widths = [1, 1, 1.5, 2]

  const data = Array.from({ length: COUNT }, (_, i) => {
    if (i % 6 === 0) accentIdx.push(i)
    mesh.setColorAt(i, i % 6 === 0 ? accent : dark)
    return {
      x: rnd(-16, 16), y: rnd(-8, 8), z: rnd(-8, 5),
      w: widths[Math.floor(Math.random() * widths.length)],
      rx: rnd(0, 6), ry: rnd(0, 6), rz: rnd(0, 6),
      sx: rnd(-0.3, 0.3), sy: rnd(-0.3, 0.3),
      fs: rnd(0.4, 1), ph: rnd(0, 6),
    }
  })

  function resize() {
    const w = host.clientWidth
    const h = host.clientHeight
    if (!w || !h) return
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
  }
  new ResizeObserver(resize).observe(host)
  renderer.compileAsync(scene, camera).then(() => renderer.render(scene, camera)).catch(() => renderer.render(scene, camera)) // warm-up: compile and upload now, while nobody is looking
  resize()

  let prog = 0
  let sp = 0
  let mx = 0
  let my = 0
  let on = false
  ScrollTrigger.create({ trigger: '#story', start: 'top bottom', end: 'bottom top', onUpdate: (s) => { prog = s.progress } })
  window.addEventListener('pointermove', (e) => {
    mx = (e.clientX / window.innerWidth) * 2 - 1
    my = (e.clientY / window.innerHeight) * 2 - 1
  })
  new IntersectionObserver(([e]) => { on = e.isIntersecting }, { rootMargin: '100px' }).observe(host)

  const dummy = new THREE.Object3D()
  function frame(now) {
    requestAnimationFrame(frame)
    if (!on) return
    const t = now / 1000
    sp += (prog - sp) * 0.08 // smoothed scroll progress

    data.forEach((d, i) => {
      dummy.position.set(d.x, d.y + Math.sin(t * d.fs + d.ph) * 0.5, d.z)
      dummy.rotation.set(d.rx + t * d.sx, d.ry + t * d.sy, d.rz)
      dummy.scale.set(d.w, 1, 1)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    })
    mesh.instanceMatrix.needsUpdate = true

    // Scroll moves the whole cloud up and turns it; the mouse tilts it a little
    root.position.y = (sp - 0.5) * 10
    root.rotation.y = sp * 1.2 + mx * 0.15
    root.rotation.x = my * 0.1
    renderer.render(scene, camera)
  }
  requestAnimationFrame(frame)

  return {
    setAccent(hex) {
      accent.set(hex)
      accentIdx.forEach((i) => mesh.setColorAt(i, accent))
      mesh.instanceColor.needsUpdate = true
    },
  }
}