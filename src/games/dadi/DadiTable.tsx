import { useEffect, useRef, useState } from 'react'
import './dadi.css'

// Tavolo dadi (Yahtzee, un giocatore): 5 dadi 3D, 3 tiri per turno, tocca un dado per bloccarlo.
// Il lancio è animato a mano (requestAnimationFrame) per controllare rimbalzi, rotazione e velocità.

const N = 5
const FACES = [1, 2, 3, 4, 5, 6]
const PIPS = [1, 2, 3, 4, 5, 6, 7, 8, 9]
// rotazione del cubo (X, Y in gradi) che porta la faccia N davanti allo spettatore
const ROT: Record<number, [number, number]> = { 1: [0, 0], 6: [0, 180], 3: [0, -90], 4: [0, 90], 2: [-90, 0], 5: [90, 0] }

const rr = (a: number, b: number) => a + Math.random() * (b - a)
const rnd = () => 1 + Math.floor(Math.random() * 6)
const sgn = () => (Math.random() < 0.5 ? -1 : 1)

type Arc = { p: number; t0: number; t1: number; w0: number; w1: number }
type Euler = { x: number; y: number; z: number }
type Throw = {
  i: number; tv: number; T: number; arcs: Arc[]
  tx: number; ty: number; fyaw: number; sx: number; sy: number
  A0: Euler; E: Euler; finished?: boolean
}

function loadFast() {
  try { return localStorage.getItem('dice-fast') === '1' } catch { return false }
}

export default function DadiTable({ onBack }: { onBack: () => void }) {
  const [vals, setVals] = useState<number[]>(() => Array.from({ length: N }, rnd))
  const [held, setHeld] = useState<boolean[]>(() => Array(N).fill(false))
  const [left, setLeft] = useState(3)
  const [busy, setBusy] = useState(false)
  const [skipping, setSkipping] = useState(false)
  const [fast, setFast] = useState(loadFast)

  // stato dell'animazione: sta nei ref perché cambia a ogni frame, senza ridisegnare React
  const slotEl = useRef<(HTMLDivElement | null)[]>([])
  const bodyEl = useRef<(HTMLDivElement | null)[]>([])
  const cubeEl = useRef<(HTMLDivElement | null)[]>([])
  const shadowEl = useRef<(HTMLDivElement | null)[]>([])
  const diceBox = useRef<HTMLDivElement>(null)
  const feltBox = useRef<HTMLDivElement>(null)
  const valsRef = useRef(vals)
  const pose = useRef({ jx: Array(N).fill(0) as number[], jy: Array(N).fill(0) as number[], yaw: Array(N).fill(0) as number[] })
  const active = useRef<Throw[]>([])
  const speed = useRef(1)
  const skip = useRef(false)
  const fastRef = useRef(fast)
  const last = useRef(0)
  const raf = useRef(0)

  // dado fermo: posa finale con la sua piccola imperfezione di posizione e rotazione
  const rest = (i: number) => {
    const [x, y] = ROT[valsRef.current[i]]
    const { jx, jy, yaw } = pose.current
    bodyEl.current[i]!.style.transform = `translate(${jx[i]}px,${jy[i]}px)`
    cubeEl.current[i]!.style.transform = `rotateZ(${yaw[i]}deg) rotateX(${x}deg) rotateY(${y}deg)`
    Object.assign(shadowEl.current[i]!.style, { transform: `translate(${jx[i] + 2}px,${jy[i] + 3}px)`, opacity: '.4', filter: 'blur(4px)' })
    slotEl.current[i]!.style.zIndex = ''
  }
  const jitter = (i: number) => {
    pose.current.jx[i] = rr(-5, 5); pose.current.jy[i] = rr(-4, 4); pose.current.yaw[i] = rr(-14, 14)
  }

  useEffect(() => {
    for (let i = 0; i < N; i++) { jitter(i); rest(i) }
    return () => cancelAnimationFrame(raf.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // prepara un tiro: quattro archi di rimbalzo decrescenti; avanzamento e rotazione seguono gli archi
  const makeThrow = (i: number, v: number, order: number): Throw => {
    valsRef.current[i] = v
    const [fx, fy] = ROT[v]
    const fyaw = rr(-14, 14)
    const dr = diceBox.current!.getBoundingClientRect()
    const sr = slotEl.current[i]!.getBoundingClientRect()
    const fr = feltBox.current!.getBoundingClientRect()
    const peaks = [rr(95, 125), rr(36, 48), rr(13, 19), rr(3.5, 6)]
    const dur = peaks.map(Math.sqrt)
    const sd = dur.reduce((a, b) => a + b, 0)
    const wt = [0.5, 0.27, 0.16, 0.07] // quota di strada e di rotazione per arco: il dado frena a ogni rimbalzo
    let a = 0
    let b = 0
    const arcs = peaks.map((p, k) => {
      const arc = { p, t0: b / sd, t1: (b + dur[k]) / sd, w0: a, w1: a + wt[k] }
      a += wt[k]; b += dur[k]
      return arc
    })
    return {
      i, tv: -order * 70, T: rr(1750, 2050), arcs, tx: rr(-5, 5), ty: rr(-4, 4), fyaw,
      sx: dr.left + dr.width / 2 - (sr.left + sr.width / 2) + rr(-40, 40),
      sy: fr.bottom - (sr.top + sr.height / 2) - 8 + rr(0, 16),
      A0: { x: rr(-180, 180), y: rr(-180, 180), z: rr(-90, 90) },
      E: { x: fx + 360 * Math.round(rr(2, 4)) * sgn(), y: fy + 360 * Math.round(rr(2, 4)) * sgn(), z: fyaw + 360 * Math.round(rr(0, 1)) * sgn() },
    }
  }

  const draw = (th: Throw) => {
    const i = th.i
    const u = Math.min(1, Math.max(0, th.tv / th.T))
    const arc = th.arcs.find((a) => u <= a.t1) ?? th.arcs[3]
    const s = (u - arc.t0) / (arc.t1 - arc.t0)
    const h = arc.p * 4 * s * (1 - s)
    const sl = arc === th.arcs[3] ? 1 - Math.pow(1 - s, 2) : s // l'ultimo arco si spegne dolcemente
    const k = arc.w0 + (arc.w1 - arc.w0) * sl
    const px = th.sx * (1 - k) + th.tx * k
    const py = th.sy * (1 - k) + th.ty * k
    slotEl.current[i]!.style.zIndex = String(Math.round(h) + 1)
    bodyEl.current[i]!.style.transform = `translate(${px}px,${py - h * 0.55}px) scale(${0.8 + 0.2 * k + h / 230})`
    cubeEl.current[i]!.style.transform =
      `rotateZ(${th.A0.z * (1 - k) + th.E.z * k}deg) rotateX(${th.A0.x * (1 - k) + th.E.x * k}deg) rotateY(${th.A0.y * (1 - k) + th.E.y * k}deg)`
    Object.assign(shadowEl.current[i]!.style, {
      transform: `translate(${px + h * 0.28 + 2}px,${py + h * 0.16 + 3}px) scale(${1 - h / 420})`,
      opacity: String(Math.max(0.12, 0.42 - h / 330)),
      filter: `blur(${4 + h / 14}px)`,
    })
  }

  const tick = (now: number) => {
    const dt = Math.min(50, now - last.current)
    last.current = now
    const target = skip.current ? 6 : fastRef.current ? 2.3 : 1
    speed.current += (target - speed.current) * Math.min(1, dt / 130) // rampa morbida, mai a scatto
    for (const th of active.current) {
      th.tv += dt * speed.current
      if (th.tv >= th.T) th.finished = true
      else draw(th)
    }
    for (const th of active.current.filter((t) => t.finished)) {
      pose.current.jx[th.i] = th.tx; pose.current.jy[th.i] = th.ty; pose.current.yaw[th.i] = th.fyaw
      rest(th.i)
    }
    active.current = active.current.filter((t) => !t.finished)
    if (active.current.length) raf.current = requestAnimationFrame(tick)
    else {
      skip.current = false; speed.current = 1
      setVals(valsRef.current.slice()); setSkipping(false); setBusy(false)
    }
  }

  const accelerate = () => {
    if (!busy || skip.current) return
    skip.current = true
    setSkipping(true)
  }

  const roll = () => {
    if (busy) { accelerate(); return }
    if (left === 0) return
    setLeft(left - 1)
    skip.current = false; speed.current = 1
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const todo: Throw[] = []
    let n = 0
    for (let i = 0; i < N; i++) {
      if (held[i]) continue
      const v = rnd()
      if (reduce) { valsRef.current[i] = v; jitter(i); rest(i) } else todo.push(makeThrow(i, v, n++))
    }
    if (!todo.length) { setVals(valsRef.current.slice()); return }
    active.current = todo
    last.current = performance.now()
    setBusy(true)
    raf.current = requestAnimationFrame(tick)
  }

  const newTurn = () => {
    if (busy) return
    for (let i = 0; i < N; i++) { valsRef.current[i] = rnd(); jitter(i); rest(i) }
    setVals(valsRef.current.slice()); setHeld(Array(N).fill(false)); setLeft(3)
  }

  const toggleHold = (i: number) => {
    if (busy) { accelerate(); return }
    if (left === 3 || left === 0) return
    setHeld((h) => h.map((x, k) => (k === i ? !x : x)))
  }

  const toggleFast = () => {
    const next = !fast
    setFast(next); fastRef.current = next
    try { localStorage.setItem('dice-fast', next ? '1' : '0') } catch { /* preferenza non salvata: resta valida per questa sessione */ }
  }

  const hint = busy ? 'Tocca il tavolo o Accelera per velocizzare.'
    : left === 3 ? 'Primo tiro: tutti e cinque i dadi.'
    : left === 0 ? 'Tiri finiti: ora sceglieresti una combinazione.'
    : 'Tocca i dadi da tenere, poi tira gli altri.'
  const rollLabel = busy ? (skipping ? 'Accelero…' : 'Accelera') : left === 3 ? 'Tira' : left === 0 ? 'Finito' : `Tira ancora (${left})`

  return (
    <section className="dadi-screen" aria-label="Dadi, Yahtzee">
      <button className="dadi-back" onClick={onBack}>← Indietro</button>
      <div className="dadi-table">
        <div className="dadi-hud">
          <span>Yahtzee</span>
          <span className="dadi-tries" role="img" aria-label={`Tiri rimasti: ${left}`}>
            {[0, 1, 2].map((k) => <i key={k} className={k >= left ? 'used' : ''} />)}
          </span>
        </div>
        <div className="dadi-felt" ref={feltBox} onClick={(e) => { if (busy && !(e.target as HTMLElement).closest('.die-btn')) accelerate() }}>
          <div className="dadi-dice" ref={diceBox}>
            {vals.map((v, i) => (
              <div key={i} className={`slot${held[i] ? ' held' : ''}`} ref={(el) => { slotEl.current[i] = el }}>
                <div className="ring" />
                <div className="shadow" ref={(el) => { shadowEl.current[i] = el }} />
                <div className="body" ref={(el) => { bodyEl.current[i] = el }}>
                  <div className="cube" ref={(el) => { cubeEl.current[i] = el }}>
                    {FACES.map((n) => <div key={`c${n}`} className={`c k${n}`} />)}
                    {FACES.map((n) => <div key={`f${n}`} className={`f f${n}`}>{PIPS.map((p) => <i key={p} className={`pip p${p}`} />)}</div>)}
                  </div>
                </div>
                <button className="die-btn" type="button" aria-pressed={held[i]}
                  aria-label={`Dado ${i + 1}, valore ${v}${held[i] ? ', bloccato' : ''}`} onClick={() => toggleHold(i)} />
                <span className="tag">Bloccato</span>
              </div>
            ))}
          </div>
        </div>
        <div className="dadi-actions">
          <p className="dadi-hint" aria-live="polite">{hint}</p>
          <button className={`dadi-roll${busy ? ' skip' : ''}`} type="button" disabled={!busy && left === 0} onClick={roll}>{rollLabel}</button>
          <div className="dadi-row">
            <button className="dadi-link" type="button" onClick={newTurn}>Nuovo turno</button>
            <button className="dadi-opt" type="button" aria-pressed={fast} onClick={toggleFast}>{fast ? 'Lancio veloce: sì' : 'Lancio veloce: no'}</button>
          </div>
        </div>
      </div>
    </section>
  )
}
