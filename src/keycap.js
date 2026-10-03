import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'

// A matte black PBT keycap material with a contour map printed on EVERY face.
// How: each vertex carries its position in keyboard space (aPat). The shader turns that position into a smooth 3D "height",
// and draws a thin line wherever the height crosses a whole number. So the lines wrap over the top, the sides and the edges,
// and they run on from one key to the next.
export function createContourMaterial({ px = 1.25, levels = 28, scale = 1 / 3.0, bump = null } = {}) {
  const lineColor = new THREE.Color(0x8a94a3) // colour of the printed lines (changed every frame to pick up a hint of the LED colour)
  const mat = new THREE.MeshStandardMaterial({ color: 0x131315, roughness: 0.93, metalness: 0 })
  if (bump) { mat.bumpMap = bump; mat.bumpScale = 0.1 }

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uLineCol = { value: lineColor }
    shader.uniforms.uPx = { value: px } // line width in screen pixels
    shader.uniforms.uLevels = { value: levels } // more levels = more lines
    shader.uniforms.uScale = { value: scale } // smaller = bigger hills

    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 aPat;\nvarying vec3 vPat;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvPat = aPat;')

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform vec3 uLineCol;
        uniform float uPx;
        uniform float uLevels;
        uniform float uScale;
        varying vec3 vPat;
        float kHash(vec3 p) {
          p = fract(p * 0.3183099 + vec3(0.1));
          p *= 17.0;
          return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
        }
        float kNoise(vec3 x) {
          vec3 i = floor(x);
          vec3 f = fract(x);
          f = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
          return mix(
            mix(mix(kHash(i), kHash(i + vec3(1.0, 0.0, 0.0)), f.x), mix(kHash(i + vec3(0.0, 1.0, 0.0)), kHash(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
            mix(mix(kHash(i + vec3(0.0, 0.0, 1.0)), kHash(i + vec3(1.0, 0.0, 1.0)), f.x), mix(kHash(i + vec3(0.0, 1.0, 1.0)), kHash(i + vec3(1.0, 1.0, 1.0)), f.x), f.y),
            f.z
          );
        }
        float kField(vec3 p) {
          return kNoise(p) * 0.55 + kNoise(p * 2.0 + 7.3) * 0.27 + kNoise(p * 4.0 + 3.1) * 0.13 + kNoise(p * 8.0 + 1.7) * 0.05;
        }`
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        float lineA = 0.0;
        {
          vec3 q = vec3(vPat.x, vPat.y * 2.2, vPat.z) * uScale;
          float t = kField(q) * uLevels;
          float w = max(fwidth(t), 0.0001); // how much the height changes per pixel
          float d = abs(fract(t + 0.5) - 0.5); // distance to the nearest whole number
          lineA = clamp(uPx * 0.5 + 0.5 - d / w, 0.0, 1.0); // distance in pixels turned into a soft line
          diffuseColor.rgb = mix(diffuseColor.rgb, uLineCol, lineA * 0.72);
        }`
      )
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += uLineCol * lineA * 0.12;')
  }
  mat.customProgramCacheKey = () => 'keycap-contour'
  return { material: mat, lineColor }
}

// A keycap shape: a rounded box that is narrower at the top and whose top leans toward you.
// offset = where the key sits on the keyboard, so the contour pattern lines up from key to key.
export function buildCapGeometry({ dx, h, dz, inset, slope, seg, radius, offset, patScale = 1 }) {
  const g = new RoundedBoxGeometry(dx, h, dz, seg, radius)
  const p = g.attributes.position
  const pat = new Float32Array(p.count * 3)
  for (let i = 0; i < p.count; i++) {
    const t = (p.getY(i) + h / 2) / h // 0 at the bottom, 1 at the top
    const x = p.getX(i) * (1 - (2 * inset * t) / dx) // narrower toward the top
    const z = p.getZ(i) * (1 - (2 * inset * t) / dz)
    const y = p.getY(i) - p.getZ(i) * slope * t // the front of the top is lower
    p.setXYZ(i, x, y, z)
    pat[i * 3] = (offset.x + x) * patScale
    pat[i * 3 + 1] = (offset.y + y) * patScale
    pat[i * 3 + 2] = (offset.z + z) * patScale
  }
  p.needsUpdate = true
  g.setAttribute('aPat', new THREE.BufferAttribute(pat, 3))
  g.computeBoundingSphere()
  return g
}

// Puts a legend plane on the front face of a keycap, tilted back like the face itself
export function placeFrontLegend(legend, { d, h, inset, slope, scale = 1 }) {
  const zTop = d / 2 - inset
  const dy = h / 2 - zTop * slope + h / 2 // height of the front face
  const phi = Math.atan2(inset, dy) // how far the face leans back
  const f = 0.42 // how high up the face the legend sits
  legend.position.set(
    0,
    -h / 2 + dy * f + Math.sin(phi) * 0.006 * scale,
    d / 2 - inset * f + Math.cos(phi) * 0.006 * scale
  )
  legend.rotation.x = -phi
  legend.scale.setScalar(scale)
}