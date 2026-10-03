import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { SplitText } from 'gsap/SplitText'

gsap.registerPlugin(ScrollTrigger, SplitText)

export function initMotion() {
  // Respect people who turned off motion in their system settings
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

  // ---------- 1) Headings: word by word ----------
  // SplitText wraps each word in its own element, so we can animate words one by one.
  // autoSplit re-splits automatically on resize and after fonts load.
  document.querySelectorAll('.section .h2').forEach((el) => {
    SplitText.create(el, {
      type: 'words',
      autoSplit: true,
      onSplit(self) {
        return gsap.from(self.words, {
          y: 50,
          autoAlpha: 0,
          duration: 0.9,
          ease: 'power4.out',
          stagger: 0.07,
          scrollTrigger: { trigger: el, start: 'top 85%', once: true },
        })
      },
    })
  })

  // ---------- 2) Mono labels: typewriter ----------
  document.querySelectorAll('.section > p.label:first-of-type').forEach((el) => {
    const text = el.textContent.trim()
    el.textContent = '\u00A0' // keeps the line height while empty
    const n = { v: 0 }
    gsap.to(n, {
      v: text.length,
      duration: text.length * 0.05,
      ease: 'none',
      scrollTrigger: { trigger: el, start: 'top 90%', once: true },
      onUpdate: () => {
        el.textContent = text.slice(0, Math.round(n.v)) || '\u00A0'
      },
    })
  })

  // ---------- 3) Mode buttons: slide up one after another ----------
  gsap.from('.mode-btn', {
    y: 60,
    autoAlpha: 0,
    duration: 0.9,
    ease: 'power3.out',
    stagger: 0.1,
    scrollTrigger: { trigger: '.modes', start: 'top 85%', once: true },
  })

  // ---------- 4) Simple fade-ups ----------
  gsap.utils.toArray('.mode-line, .story-text p, .cta-sub, .form').forEach((el) => {
    gsap.from(el, {
      y: 30,
      autoAlpha: 0,
      duration: 0.9,
      ease: 'power3.out',
      scrollTrigger: { trigger: el, start: 'top 90%', once: true },
    })
  })

  // ---------- 5) Spec numbers count up ----------
  // "1000 Hz POLLING" -> number 1000 + the rest of the text
  document.querySelectorAll('.specs li').forEach((li) => {
    const m = li.textContent.trim().match(/^(\d+)(.*)$/)
    if (!m) return
    const end = parseInt(m[1], 10)
    const rest = m[2]
    li.textContent = '0' + rest
    const n = { v: 0 }
    gsap.to(n, {
      v: end,
      duration: 1.6,
      ease: 'power2.out',
      scrollTrigger: { trigger: li.closest('.card'), start: 'top 80%', once: true },
      onUpdate: () => {
        li.textContent = Math.round(n.v) + rest
      },
    })
  })
}