import * as THREE from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'

export function createScene(canvas) {
  const isMobile = window.matchMedia('(max-width: 768px)').matches

  // ---------- The 3 essentials: renderer, scene, camera ----------
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2))
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.setClearColor(0x000000, 0) // transparent, the page background shows through

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 200)

  // Soft studio reflections (built into Three.js, no image files needed)
  const pmrem = new THREE.PMREMGenerator(renderer)
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
  scene.environmentIntensity = 0.5

  const keyLight = new THREE.DirectionalLight(0xffffff, 2)
  keyLight.position.set(5, 10, 6)
  scene.add(keyLight)

  // ---------- Camera "view": scroll animations will tween these numbers ----------
  const view = { angle: 0.65, zoom: 1, lookX: 0, lookY: 2.5, lookZ: -1 }
  let fitWidth = 16 // how wide the object is, so we can always fit it on screen

    // How far the camera sits when zoom = 1. Other files use this to frame things.
  function baseDist() {
    const halfFov = THREE.MathUtils.degToRad(camera.fov / 2)
    const fitDist = fitWidth / 2 / (Math.tan(halfFov) * camera.aspect)
    return Math.max(fitDist * 1.25, 19)
  }

  function applyCamera() {
    const d = baseDist() / view.zoom
    camera.position.set(
      view.lookX,
      view.lookY + Math.sin(view.angle) * d,
      view.lookZ + Math.cos(view.angle) * d
    )
    camera.lookAt(view.lookX, view.lookY, view.lookZ)
  }

  function resize() {
    const w = window.innerWidth
    const h = window.innerHeight
    renderer.setSize(w, h, false) // false: CSS controls the canvas size
    camera.aspect = w / h
    camera.updateProjectionMatrix()
  }
  window.addEventListener('resize', resize)
  resize()

  // ---------- One render loop for the whole site ----------
  const tickers = new Set()
  const clock = new THREE.Clock()
  let running = true

  function frame() {
    if (running) {
      const t = clock.getElapsedTime()
      tickers.forEach((fn) => fn(t))
      applyCamera()
      renderer.render(scene, camera)
    }
    requestAnimationFrame(frame)
  }
  frame()

  return {
    THREE,
    scene,
    camera,
    renderer,
    view,
    baseDist,
    isMobile,
    onTick: (fn) => tickers.add(fn), // other files register their per-frame updates here
    setRunning: (v) => { running = v }, // pause rendering when the canvas is not visible
    fit: (w) => { fitWidth = w },
  }
}