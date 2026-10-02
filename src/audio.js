// Procedural key sounds with the Web Audio API. No audio files, so no licensing issues.
// Each key press = a short "body" tone that drops in pitch + a burst of filtered noise (the click).
const PROFILES = {
  none: { f0: 220, f1: 90, noise: 2200, gain: 0.35, dur: 0.07, click: 0.2 },
  play: { f0: 320, f1: 140, noise: 5000, gain: 0.3, dur: 0.05, click: 0.6 }, // clicky
  type: { f0: 170, f1: 70, noise: 1400, gain: 0.5, dur: 0.11, click: 0 }, // deep thock
  work: { f0: 200, f1: 100, noise: 900, gain: 0.18, dur: 0.05, click: 0 }, // quiet
  compact: { f0: 260, f1: 120, noise: 3000, gain: 0.3, dur: 0.06, click: 0.25 }, // light tap
}

let ctx = null
let master = null
let noiseBuf = null
let profile = PROFILES.none
let enabled = true

// Browsers only allow audio after a user gesture, so we create the context lazily.
function init() {
  if (ctx) return
  ctx = new (window.AudioContext || window.webkitAudioContext)()
  master = ctx.createGain()
  master.gain.value = 0.8
  master.connect(ctx.destination)

  // 0.1 seconds of random noise, reused for every click
  const len = Math.floor(ctx.sampleRate * 0.1)
  noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate)
  const data = noiseBuf.getChannelData(0)
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
}

export const audio = {
  unlock() {
    init()
    if (ctx.state === 'suspended') ctx.resume()
  },
  setProfile(name) {
    profile = PROFILES[name] || PROFILES.none
  },
  setEnabled(v) {
    enabled = v
  },
  tick() {
    if (!enabled || !ctx) return
    const p = profile
    const t = ctx.currentTime

    // Body: a sine wave whose pitch drops quickly (the "thock")
    const osc = ctx.createOscillator()
    const og = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(p.f0 * (1 + (Math.random() - 0.5) * 0.12), t) // slight random pitch so it never sounds robotic
    osc.frequency.exponentialRampToValueAtTime(p.f1, t + p.dur)
    og.gain.setValueAtTime(p.gain, t)
    og.gain.exponentialRampToValueAtTime(0.001, t + p.dur)
    osc.connect(og).connect(master)
    osc.start(t)
    osc.stop(t + p.dur + 0.02)

    // Click: a very short burst of noise through a band-pass filter
    const src = ctx.createBufferSource()
    src.buffer = noiseBuf
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = p.noise
    bp.Q.value = 0.8
    const ng = ctx.createGain()
    ng.gain.setValueAtTime(p.gain * (0.5 + p.click), t)
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.03)
    src.connect(bp).connect(ng).connect(master)
    src.start(t)
    src.stop(t + 0.04)
  },
}