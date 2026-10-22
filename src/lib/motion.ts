// Movimenti condivisi dai tavoli: stesse curve e stessi tempi in tutti i giochi, così si sentono uguali.
import { useLayoutEffect, useRef, type RefObject } from 'react'

// Parte veloce e si posa piano: dà la sensazione di una carta che atterra, senza scatti.
export const SMOOTH = 'cubic-bezier(.22,1,.36,1)'

export const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * Carta che vola dal punto `from` (mazzo, pozzo...) fino al suo posto attuale, con un piccolo arco e una rotazione.
 * Usa le proprietà `translate`/`scale`/`rotate` (non `transform`), così non cancella le inclinazioni già messe dal CSS.
 */
export function flyIn(el: HTMLElement, from: DOMRect, opts: { delay?: number; duration?: number; lift?: number } = {}) {
  if (prefersReducedMotion()) return
  const r = el.getBoundingClientRect()
  if (!r.width) return
  const dx = from.left + from.width / 2 - (r.left + r.width / 2)
  const dy = from.top + from.height / 2 - (r.top + r.height / 2)
  const s = from.width / r.width
  const lift = opts.lift ?? 40
  el.animate([
    { translate: `${dx}px ${dy}px`, scale: String(s), rotate: '-10deg', opacity: 0.5, zIndex: 30, offset: 0 },
    { translate: `${dx * 0.45}px ${dy * 0.45 - lift}px`, scale: String(1 + (1 - Math.min(s, 1)) * 0.12 + 0.06), rotate: '4deg', opacity: 1, zIndex: 30, offset: 0.5 },
    { translate: '0 0', scale: '1', rotate: '0deg', opacity: 1, zIndex: 30, offset: 1 },
  ], { duration: opts.duration ?? 680, delay: opts.delay ?? 0, easing: SMOOTH, fill: 'backwards' })
}

/**
 * Quando l'ordine delle carte in una lista cambia (ordina per seme/valore, riordino a mano, carta pescata che
 * sposta le altre), ogni carta scivola dal vecchio al nuovo posto invece di saltare (tecnica FLIP).
 * Va chiamato DOPO gli altri layout effect che sistemano le carte (es. la sovrapposizione del ventaglio).
 * `itemSelector` sceglie le carte nel contenitore, `idAttr` è l'attributo con l'id della carta.
 */
export function useFlipList(box: RefObject<HTMLElement | null>, itemSelector: string, idAttr: string, enabled = true) {
  const prev = useRef<{ ids: string[]; rects: Map<string, DOMRect> }>({ ids: [], rects: new Map() })
  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    const items = [...el.querySelectorAll<HTMLElement>(itemSelector)]
    const ids = items.map((n) => n.getAttribute(idAttr) ?? '')
    const rects = new Map(items.map((n, i) => [ids[i], n.getBoundingClientRect()]))
    const before = prev.current
    prev.current = { ids, rects }
    // stessa sequenza = nessun riordino (selezione, resize...): niente da animare
    if (!enabled || before.ids.length === 0 || ids.length === 0) return
    if (ids.length === before.ids.length && ids.every((id, i) => id === before.ids[i])) return
    if (prefersReducedMotion()) return
    let k = 0
    items.forEach((n, i) => {
      const old = before.rects.get(ids[i]), now = rects.get(ids[i])
      if (!old || !now) return
      const dx = old.left - now.left, dy = old.top - now.top
      if (Math.abs(dx) + Math.abs(dy) < 2) return
      n.animate([
        { translate: `${dx}px ${dy}px`, zIndex: 20 },
        { translate: '0 0', zIndex: 20 },
      ], { duration: 520, delay: Math.min(k++ * 14, 180), easing: SMOOTH, fill: 'backwards' })
    })
  })
}
