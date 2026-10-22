import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import './burraco.css'
import { DEFAULT_RULES, actionError, apply, buildDeck, burraco, isWildCard, newGame, shortName, shuffle, tablePoints, topCard } from './engine.ts'
import type { Action, BurracoEvent, Card, End, GameState, Meld, Rules } from './engine.ts'
import type { GameResult } from '../../lib/game-result.ts'

// Tavolo di Burraco (Fase 1: locale, 2 giocatori sullo stesso schermo con schermata "copri", nessun bot).
// Le regole e i punti vivono tutti in engine.ts; qui c'è solo interfaccia: selezione, trascinamento, pannelli.
// Layout e classi vengono dal mockup approvato mockups/11-burraco-tavolo.html (classi con prefisso bu-).

const NAMES = ['Tomas', 'Lei']
const SPRITE = `${import.meta.env.BASE_URL}cards/french/svg-cards.svg`
const SUIT_ID = { h: 'heart', d: 'diamond', c: 'club', s: 'spade' } as const
const SUIT_LABEL = { h: 'cuori', d: 'quadri', c: 'fiori', s: 'picche' } as const
const FACE: Record<number, string> = { 11: 'jack', 12: 'queen', 13: 'king' }
const RANK_LABEL: Record<number, string> = { 1: 'asso', 11: 'fante', 12: 'donna', 13: 're' }
const KIND_LABEL = { reale: 'reale', super: 'super', pulito: 'pulito', semi: 'semipulito', sporco: 'sporco' } as const

// I due mazzi hanno 4 jolly: id pari = nero, dispari = rosso (solo grafica).
const faceId = (c: Card) => (c.s === 'j' ? (c.id % 2 ? 'joker_red' : 'joker_black') : `${SUIT_ID[c.s]}_${FACE[c.r] ?? c.r}`)
const cardName = (c: Card) => (c.s === 'j' ? 'Jolly' : `${RANK_LABEL[c.r] ?? c.r} di ${SUIT_LABEL[c.s]}`)

const MODES: [Rules['mode'], string][] = [['hand', 'Mano singola'], ['1005', '1005'], ['2005', '2005']]
const MODE_NOTE: Record<Rules['mode'], string> = {
  hand: 'Si gioca una sola mano e basta.',
  '1005': 'Si gioca a mani successive: vince chi per primo arriva a 1005 punti.',
  '2005': 'Si gioca a mani successive: vince chi per primo arriva a 2005 punti.',
}

function useWide() {
  const q = '(min-width: 900px)'
  const [wide, setWide] = useState(() => matchMedia(q).matches)
  useEffect(() => {
    const m = matchMedia(q)
    const on = () => setWide(m.matches)
    m.addEventListener('change', on)
    return () => m.removeEventListener('change', on)
  }, [])
  return wide
}

const newMatch = (rules: Rules) => {
  const first = Math.random() < 0.5 ? 0 : 1
  return { game: newGame({ names: NAMES, rules, first }, shuffle(buildDeck())), first }
}

const Svg = ({ id }: { id: string }) => <svg viewBox="0 0 169.075 244.64" aria-hidden="true"><use href={`${SPRITE}#${id}`} /></svg>
const Back = () => <span className="bu-pc"><Svg id="back" /></span>

// Testo dei toast a partire da cosa è successo nell'ultima mossa (gli eventi li produce il motore).
function describe(events: BurracoEvent[]): string {
  const out: string[] = []
  for (const e of events) {
    if (e.type === 'take') out.push(`${NAMES[e.p]} prende il pozzo (${e.n} ${e.n === 1 ? 'carta' : 'carte'})`)
    else if (e.type === 'meld') out.push(`${NAMES[e.p]} cala ${e.n} ${e.n === 1 ? 'gioco' : 'giochi'}`)
    else if (e.type === 'attach') out.push(`${NAMES[e.p]} attacca ${e.n} ${e.n === 1 ? 'carta' : 'carte'}`)
    else if (e.type === 'discard') out.push(`${NAMES[e.p]} scarta ${shortName(e.card)}`)
    else if (e.type === 'pot') out.push(`${NAMES[e.p]} prende il pozzetto`)
    else if (e.type === 'close') out.push(`${NAMES[e.p]} chiude la mano`)
    else if (e.type === 'stock') out.push('Tallone quasi finito')
  }
  return out.join(' · ')
}

const SUIT_ORDER = { h: 0, d: 1, c: 2, s: 3, j: 9 } as const
const sortBySuit = (h: Card[]) => h.slice().sort((a, b) => SUIT_ORDER[a.s] - SUIT_ORDER[b.s] || a.r - b.r)
const sortByValue = (h: Card[]) => h.slice().sort((a, b) => Number(a.s === 'j') - Number(b.s === 'j') || a.r - b.r || SUIT_ORDER[a.s] - SUIT_ORDER[b.s])

// Misure del tavolo (lette dal CSS e dalla zona dei giochi): servono a scegliere la grandezza delle carte calate.
type Geo = { mw: number; pk: number; tw: number; pw: number; W: number; H: number }
const GEO0: Geo = { mw: 38, pk: 22, tw: 54, pw: 190, W: 170, H: 190 }

// Sceglie la carta più grande per cui TUTTI i giochi stanno nel riquadro: simula l'andare a capo delle colonne
// (stessa regola del CSS: colonne larghe w, spazio 12px, righe alte quanto la colonna più lunga della riga).
function meldVars(list: Meld[], g: Geo): React.CSSProperties {
  const vars = (w: number, pk: number) => ({ ['--mw' as string]: `${w}px`, ['--pk' as string]: `${pk.toFixed(1)}px` })
  const n = list.length
  if (!n) return vars(g.mw, g.pk)
  const gx = 12, gy = 18, W = g.W - 2, H = g.H - 18
  const fits = (w: number, pk: number) => {
    const per = Math.max(1, Math.floor((W + gx) / (w + gx)))
    let tot = 0
    for (let i = 0; i < n; i += per) {
      const hh = Math.max(...list.slice(i, i + per).map((m) => w * 1.4469 + (m.cards.length - 1) * pk))
      tot += hh + (i ? gy : 0)
    }
    return tot <= H
  }
  for (let w = g.mw; w >= 18; w--) {
    const pkMax = (g.pk * w) / g.mw, pkMin = w * 0.3          // prima l'angolo comodo, poi si stringe fino a un minimo leggibile
    for (const f of [1, 0.8, 0.6, 0.4, 0.2, 0]) {
      const pk = pkMin + (pkMax - pkMin) * f
      if (fits(w, pk)) return vars(w, pk)
    }
  }
  return vars(18, 5.4)
}

function MeldView({ m, side, rules }: { m: Meld; side: 'mine' | 'her'; rules: Rules }) {
  const b = burraco(m, rules)
  return (
    <div className={`bu-meld${b ? ` bu-bur bu-${b.kind}` : ''}`} data-meld={m.id} data-side={side} title={b ? `Burraco ${KIND_LABEL[b.kind]}: ${b.pts} punti` : undefined}>
      {b && <span className="bu-tag">{KIND_LABEL[b.kind]}</span>}
      {m.cards.map((c, i) => (
        <span key={c.id} className={`bu-pc${m.wild === i ? ' bu-wild' : ''}`} style={{ zIndex: i + 1 }} aria-label={cardName(c)}><Svg id={faceId(c)} /></span>
      ))}
    </div>
  )
}

type Over = { meld?: HTMLElement | null; zone?: HTMLElement | null; dis?: HTMLElement | null; hand?: HTMLElement | null }
type Aim = { el?: Element | null; bad?: boolean; msg?: string; ins?: { x: number; y: number; h: number } | null }

export default function BurracoTable({ onBack, onResult }: { onBack: () => void; onResult?: (result: GameResult) => void }) {
  const wide = useWide()
  const [game, setGame] = useState<GameState>(() => newMatch(DEFAULT_RULES).game)
  const [started, setStarted] = useState(false)
  const [rulesMode, setRulesMode] = useState<'edit' | 'view' | null>('edit')
  const [draft, setDraft] = useState<Rules>(DEFAULT_RULES)
  const [viewer, setViewer] = useState(0)                   // chi sta guardando lo schermo
  const [cover, setCover] = useState<number | null>(null)   // a chi passare il telefono (null = nessuno)
  const [sel, setSel] = useState<number[]>([])
  const [open, setOpen] = useState(false)                   // mano aperta su due righe
  const [toast, setToast] = useState<{ text: string; bad: boolean; n: number } | null>(null)
  const [endHidden, setEndHidden] = useState(false)         // pannello fine mano chiuso per guardare il tavolo
  const [askExit, setAskExit] = useState(false)
  const [geo, setGeo] = useState<Geo>(GEO0)
  const [tick, setTick] = useState(0)

  const root = useRef<HTMLDivElement>(null)
  const handEl = useRef<HTMLDivElement>(null)
  const toastN = useRef(0)
  const timers = useRef<number[]>([])
  const reported = useRef(false)
  const later = (fn: () => void, ms: number) => { timers.current.push(window.setTimeout(fn, ms)) }
  useEffect(() => () => timers.current.forEach(clearTimeout), [])
  useEffect(() => {
    if (!game.matchOver) { reported.current = false; return }
    if (!reported.current) {
      reported.current = true
      const scores: [number, number] = game.rules.mode === 'hand'
        ? [game.handScores[0].total, game.handScores[1].total]
        : [game.scores[0], game.scores[1]]
      onResult?.({ winner: game.winner, scores })
    }
  }, [game, onResult])

  const me = viewer
  const op = 1 - me
  const over = game.phase === 'over'
  const hand = game.hands[me]
  const overlay = rulesMode !== null || cover !== null
  const myTurn = game.phase !== 'over' && game.turn === me && !overlay
  const say = (text: string, bad = false) => setToast({ text, bad, n: ++toastN.current })

  // Stato "vivo" per i gestori del trascinamento (che vivono fuori dal render).
  const live = useRef({ game, me, myTurn, sel })
  useLayoutEffect(() => { live.current = { game, me, myTurn, sel } })

  // I messaggi spariscono dopo un po', ma solo quando nessuna schermata copre il tavolo.
  useEffect(() => {
    if (!toast || overlay) return
    const t = window.setTimeout(() => setToast(null), 2800)
    return () => clearTimeout(t)
  }, [toast, overlay])

  // Misure: grandezza delle carte dal CSS e dello spazio dei giochi; si ricalcola a ogni disegno e al ridimensionamento.
  useLayoutEffect(() => {
    const r = root.current
    if (!r) return
    const cs = getComputedStyle(r)
    const num = (k: string, d: number) => parseFloat(cs.getPropertyValue(k)) || d
    const m = r.querySelector<HTMLElement>('.bu-melds')
    const next: Geo = { mw: num('--mw', GEO0.mw), pk: num('--pk', GEO0.pk), tw: num('--tw', GEO0.tw), pw: num('--pw', GEO0.pw), W: m?.clientWidth || geo.W, H: m?.clientHeight || geo.H }
    const diff = (Object.keys(next) as (keyof Geo)[]).some((k) => Math.abs(next[k] - geo[k]) > (k === 'W' || k === 'H' ? 4 : 0.5))
    if (diff) setGeo(next)
  }, [game, tick, wide, rulesMode, cover, geo])
  useEffect(() => {
    if (!root.current) return
    const ro = new ResizeObserver(() => setTick((t) => t + 1))
    ro.observe(root.current)
    return () => ro.disconnect()
  }, [])

  // Mano a ventaglio: se le carte non entrano si sovrappongono quanto serve (si ricalcola a ogni disegno).
  useLayoutEffect(() => {
    const hd = handEl.current
    if (!hd) return
    const cards = [...hd.querySelectorAll<HTMLElement>('.bu-pc')]
    cards.forEach((c) => { c.style.marginLeft = '' })
    if (open || cards.length < 2) return
    const w = cards[0].offsetWidth, avail = hd.clientWidth - 8
    if (!w || !avail) return
    const natural = -w * (wide ? 0.3 : 0.4)
    const need = cards.length * w + (cards.length - 1) * natural
    if (need <= avail) return
    const m = (avail - cards.length * w) / (cards.length - 1)
    cards.forEach((c, i) => { if (i) c.style.marginLeft = m + 'px' })
  }, [game, cover, rulesMode, open, wide, tick, viewer])

  // ── mosse: tutto passa da apply; qui si reagisce al risultato ──
  function act(a: Action): boolean {
    const r = apply(game, a, shuffle)
    if ('error' in r) { say(r.error, true); return false }
    const s = r.state
    setGame(s)
    setSel([])
    setEndHidden(false)
    const text = describe(s.events)
    if (text) say(text)
    if (s.phase !== 'over' && s.turn !== viewer) setCover(s.turn)  // chi deve giocare ora riceve il telefono
    return true
  }

  function startMatch(rules: Rules) {
    const d = newMatch(rules)
    setGame(d.game); setStarted(true); setRulesMode(null); setViewer(d.first); setCover(d.first)
    setSel([]); setToast(null); setOpen(false); setEndHidden(false)
  }

  function leave() {
    if (askExit || over || !started) { onBack(); return }
    setAskExit(true)
    later(() => setAskExit(false), 3000)
  }

  const setHand = (cards: Card[]) => setGame((g) => ({ ...g, hands: g.hands.map((h, p) => (p === me ? cards : h)) }))

  // ── clic ──
  const suppress = useRef(false)                         // il click che segue un trascinamento non conta
  const justDragged = () => suppress.current

  function tapCard(c: Card) {
    if (justDragged() || overlay) return
    setSel((s) => (s.includes(c.id) ? s.filter((x) => x !== c.id) : [...s, c.id]))
  }
  function tapMeld(id: number, side: string) {
    if (justDragged() || overlay || side !== 'mine' || !sel.length) return
    act({ type: 'attach', meld: id, ids: hand.filter((c) => sel.includes(c.id)).map((c) => c.id) })
  }
  function tapMeldCards() {
    const ids = hand.filter((c) => sel.includes(c.id)).map((c) => c.id)
    act({ type: 'meld', groups: [ids] })
  }

  // ── trascinamento (puntatore: vale per mouse e dito) ──
  // dalla mano: su un tuo gioco = attacca, su uno spazio libero del tuo campo = nuovo gioco (servono 3 carte selezionate),
  // sul pozzo = scarta, su un'altra posizione della mano = riordina. Dal tallone o dal pozzo verso la mano = pesca / prendi.
  const dr = useRef<{
    kind: 'hand' | 'dk' | 'dis'; el: HTMLElement; x0: number; y0: number; on: boolean
    card?: Card; cards?: Card[]; ghost?: HTMLElement; ins?: HTMLElement; w?: number
  } | null>(null)

  function over_(e: { clientX: number; clientY: number }): Over {
    const t = document.elementFromPoint(e.clientX, e.clientY)
    if (!t || !root.current?.contains(t)) return {}
    return { meld: t.closest<HTMLElement>('.bu-meld'), zone: t.closest<HTMLElement>('.bu-zone'), dis: t.closest<HTMLElement>('.bu-dis'), hand: t.closest<HTMLElement>('.bu-hand') }
  }

  // Posizione in mano: quante carte (non trascinate) stanno prima del puntatore.
  function insAt(h: HTMLElement, e: { clientX: number; clientY: number }, cs: Card[]) {
    const rest = [...h.querySelectorAll<HTMLElement>('.bu-pc')].filter((n) => !cs.some((c) => c.id === +n.dataset.id!))
    const n = rest.filter((nd) => {
      const r = nd.getBoundingClientRect(), cy = r.top + r.height / 2, cx = r.left + r.width / 2
      return cy < e.clientY - r.height / 2 || (Math.abs(cy - e.clientY) <= r.height / 2 && cx < e.clientX)
    }).length
    let box: Aim['ins'] = null
    if (rest.length) {
      const r = (rest[n] ?? rest[rest.length - 1]).getBoundingClientRect()
      box = { x: rest[n] ? r.left : r.right, y: r.top, h: r.height }
    }
    return { n, box }
  }

  // Azione di attacco: una matta sola trascinata su una scala senza matta va in cima (metà alta) o in fondo (metà bassa).
  function attachAction(el: HTMLElement, e: { clientY: number }, cs: Card[]): { a: Action; end?: End } {
    const { game: g, me: p } = live.current
    const id = +el.dataset.meld!
    const m = g.melds[p].find((x) => x.id === id)
    let end: End | undefined
    if (m && m.kind === 'run' && m.wild === null && cs.length === 1 && isWildCard(cs[0])) {
      const r = el.getBoundingClientRect()
      end = e.clientY < r.top + r.height / 2 ? 'low' : 'high'
    }
    return { a: { type: 'attach', meld: id, ids: cs.map((c) => c.id), ...(end ? { end } : {}) }, end }
  }

  // Cosa succede se lascio qui: evidenzio il bersaglio e scrivo a parole (verde = ok, rosso = non si può).
  function aim(e: { clientX: number; clientY: number }): Aim {
    const d = dr.current!, L = live.current
    const o = over_(e)
    const bad = (el: Element | null | undefined, msg: string): Aim => ({ el, bad: true, msg })
    if (d.kind === 'hand') {
      const cs = d.cards!
      if (o.dis) {
        const err = actionError(L.game, { type: 'discard', id: d.card!.id })
        return err ? bad(o.dis, err) : { el: o.dis, msg: 'Scarta: ' + cardName(d.card!) }
      }
      if (o.meld) {
        if (o.meld.dataset.side !== 'mine') return bad(o.meld, 'Non è un tuo gioco')
        const { a, end } = attachAction(o.meld, e, cs)
        const err = actionError(L.game, a)
        return err ? bad(o.meld, err) : { el: o.meld, msg: end ? (end === 'low' ? 'Attacca in cima' : 'Attacca in fondo') : 'Attacca a questo gioco' }
      }
      if (o.zone?.classList.contains('bu-mine')) {
        if (cs.length < 3) return bad(o.zone, 'Per un nuovo gioco seleziona almeno 3 carte')
        const err = actionError(L.game, { type: 'meld', groups: [cs.map((c) => c.id)] })
        return err ? bad(o.zone, err) : { el: o.zone, msg: 'Cala un nuovo gioco' }
      }
      if (o.zone) return bad(o.zone, 'Campo di ' + NAMES[1 - L.me])
      if (o.hand) { const a = insAt(o.hand, e, cs); return { el: o.hand, msg: `Metti qui (posizione ${a.n + 1})`, ins: a.box } }
      return {}
    }
    if (o.hand) return { el: o.hand, msg: d.kind === 'dk' ? 'Pesca una carta' : `Prendi il pozzo (${L.game.discard.length} carte)` }
    return {}
  }

  function onPointerDown(e: React.PointerEvent) {
    if (e.button > 0 || (e.target as HTMLElement).closest('.bu-ov') || !root.current) return
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-dnd]')
    if (!el || (el as HTMLButtonElement).disabled) return
    const kind = el.dataset.dnd as 'hand' | 'dk' | 'dis'
    const L = live.current
    let card: Card | undefined, cards: Card[] | undefined
    if (kind === 'hand') {
      card = L.game.hands[L.me].find((x) => x.id === +el.dataset.id!)
      if (!card) return
      cards = L.sel.includes(card.id) && L.sel.length > 1 ? L.game.hands[L.me].filter((x) => L.sel.includes(x.id)) : [card]
    }
    dr.current = { kind, el, x0: e.clientX, y0: e.clientY, on: false, card, cards }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', stop)
  }

  function onMove(e: PointerEvent) {
    const d = dr.current, r0 = root.current
    if (!d || !r0) return
    if (!d.on) {
      if (Math.hypot(e.clientX - d.x0, e.clientY - d.y0) < 7) return
      d.on = true
      const rect = (d.kind === 'hand' ? d.el : d.el.querySelector<HTMLElement>('.bu-pc') ?? d.el).getBoundingClientRect()
      const w = d.kind === 'dis' ? parseFloat(getComputedStyle(r0).getPropertyValue('--tw')) : rect.width
      const top = d.kind === 'dis' ? topCard(live.current.game) : d.kind === 'hand' ? d.card : null
      const g = document.createElement('div')
      g.className = 'bu-ghost bu-pc'
      g.style.width = w + 'px'
      g.innerHTML = `<svg viewBox="0 0 169.075 244.64" aria-hidden="true"><use href="${SPRITE}#${top ? faceId(top) : 'back'}"/></svg>${d.cards && d.cards.length > 1 ? `<b>${d.cards.length}</b>` : ''}<i class="bu-hint" hidden></i>`
      document.body.appendChild(g)
      d.ghost = g; d.w = w
      d.ins = document.createElement('div')
      d.ins.className = 'bu-ins'; d.ins.hidden = true
      document.body.appendChild(d.ins)
      d.cards?.forEach((c) => root.current?.querySelector(`.bu-hand .bu-pc[data-id="${c.id}"]`)?.classList.add('bu-dragging'))
    }
    e.preventDefault()
    const w = d.w!
    d.ghost!.style.transform = `translate(${e.clientX - w / 2}px,${e.clientY - w * 0.72}px) rotate(4deg)`
    r0.querySelectorAll('.bu-drop').forEach((n) => n.classList.remove('bu-drop', 'bu-bad'))
    const a = live.current.myTurn || d.kind === 'hand' ? aim(e) : {}
    const hint = d.ghost!.querySelector<HTMLElement>('.bu-hint')!
    if (a.el) { a.el.classList.add('bu-drop'); if (a.bad) a.el.classList.add('bu-bad') }
    hint.hidden = !a.msg; hint.textContent = a.msg ?? ''; hint.classList.toggle('bu-bad', !!a.bad)
    d.ins!.hidden = !a.ins
    if (a.ins) Object.assign(d.ins!.style, { left: a.ins.x - 3 + 'px', top: a.ins.y - 4 + 'px', height: a.ins.h + 8 + 'px' })
  }

  function stop() {
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    window.removeEventListener('pointercancel', stop)
    const d = dr.current
    d?.ghost?.remove(); d?.ins?.remove()
    root.current?.querySelectorAll('.bu-drop,.bu-dragging').forEach((n) => n.classList.remove('bu-drop', 'bu-bad', 'bu-dragging'))
  }

  function onUp(e: PointerEvent) {
    const d = dr.current
    const was = !!d?.on
    const o = was ? over_(e) : {}
    stop()
    dr.current = null
    if (!d || !was) return
    suppress.current = true
    window.setTimeout(() => { suppress.current = false }, 350)
    const L = live.current
    if (d.kind === 'hand') {
      const cs = d.cards!
      if (o.hand) {                                   // riordino: valido anche fuori turno
        const n = insAt(o.hand, e, cs).n
        const others = L.game.hands[L.me].filter((x) => !cs.includes(x))
        others.splice(n, 0, ...cs)
        setHand(others)
        return
      }
      if (!L.myTurn) { say('Non è il tuo turno', true); return }
      if (o.dis) { act({ type: 'discard', id: d.card!.id }); return }
      if (o.meld) {
        if (o.meld.dataset.side !== 'mine') { say('Puoi attaccare solo ai tuoi giochi', true); return }
        act(attachAction(o.meld, e, cs).a)
        return
      }
      if (o.zone?.classList.contains('bu-mine')) {
        if (cs.length < 3) { say('Per un nuovo gioco seleziona almeno 3 carte e trascinale insieme', true); return }
        act({ type: 'meld', groups: [cs.map((c) => c.id)] })
        return
      }
      if (o.zone) say(`Quello è il campo di ${NAMES[1 - L.me]}: i tuoi giochi stanno a sinistra`, true)
      return
    }
    if (o.hand && L.myTurn) act({ type: d.kind === 'dk' ? 'draw' : 'take' })
  }

  // ── dati per il disegno ──
  const nOp = game.hands[op].length
  const pile = game.discard
  const np = pile.length
  const off = np > 1 ? Math.min(geo.tw * 0.62, (geo.pw - geo.tw) / (np - 1)) : 0   // se gli scarti sono tanti si stringono, ma restano tutti visibili
  const canDraw = myTurn && game.phase === 'draw'
  const selCards = hand.filter((c) => sel.includes(c.id))
  const goal = game.rules.mode === 'hand' ? 'Mano singola' : 'A ' + game.rules.mode
  const winner = game.winner

  const ptsHead = (label: string, p: number) => {
    const t = tablePoints(game, p)
    return (
      <>
        <div className="bu-zh"><h4>{label}</h4><span className="bu-tp" title={`Punti sul tavolo: carte calate ${t.cards} + burraci ${t.burraci}`}><b>{t.total}</b> pt</span></div>
        <div className="bu-zs">carte {t.cards} + burraci {t.burraci}</div>
      </>
    )
  }

  const SWITCHES: [Exclude<keyof Rules, 'mode'>, string, React.ReactNode][] = [
    ['special', 'Burraci con bonus extra', <>Di base un burraco vale 200 se pulito (nessuna matta) e 100 se sporco. Con questa opzione alcuni valgono di più: <b>Reale</b> 300 (scala di 13 carte senza matte), <b>Super</b> 250 (8 carte dello stesso valore senza matte), <b>Semipulito</b> 150 (scala di almeno 8 carte: 7 naturali di fila più una matta in testa o in coda).</>],
    ['block', 'Pozzo bloccato dalla matta', 'Con una matta in cima non puoi prendere il pozzo'],
    ['open50', 'Apertura da 50 punti', 'Prima calata di almeno 50 punti (variante USA)'],
  ]
  const edit = rulesMode === 'edit'
  const shownRules = edit ? draft : game.rules

  return (
    <div className="bu-screen">
      <div ref={root} className={`bu-root${wide ? ' bu-wide' : ''}`} onPointerDown={onPointerDown}>
        <div className="bu-hud">
          <div className={`bu-av${me === 1 ? ' bu-lei' : ''}`}>{NAMES[me][0]}</div>
          <div className="bu-who"><b>{NAMES[me]}</b><span>{game.scores[me]} punti</span></div>
          <span className="bu-sp" />
          <span className="bu-pill bu-tgt">{goal}</span>
          <button className="bu-pill bu-btnp" onClick={() => { setDraft(game.rules); setRulesMode('view') }} aria-label="Regole della partita">Regole</button>
          <button className={`bu-pill bu-btnp${askExit ? ' bu-warn' : ''}`} onClick={leave}>{askExit ? 'Esci?' : '‹ Esci'}</button>
          <div className="bu-who" style={{ textAlign: 'right' }}><b>{NAMES[op]}</b><span>{game.scores[op]} punti</span></div>
          <div className={`bu-av${op === 1 ? ' bu-lei' : ''}`}>{NAMES[op][0]}</div>
        </div>

        <div className="bu-felt">
          <div className="bu-band">
            <div className="bu-oleft">
              <div className="bu-oh">{Array.from({ length: Math.min(nOp, 11) }, (_, i) => <Back key={i} />)}</div>
              <div className="bu-ocount"><b>{nOp}</b><small>carte</small></div>
            </div>
          </div>
          <div className="bu-tbl">
            <div className="bu-mid">
              <div className="bu-stk">
                <button className={`bu-dk${canDraw ? ' bu-pulse' : ''}`} data-dnd="dk" disabled={!canDraw} onClick={() => { if (!justDragged()) act({ type: 'draw' }) }} aria-label="Pesca dal tallone">
                  <span className="bu-cap">Tallone</span><Back /><Back /><Back />
                  <span className="bu-lbl bu-cnt"><b>{game.deck.length}</b></span>
                </button>
                <div className="bu-cross" role="img" aria-label={`${game.pots.length} pozzetti`}>
                  <span className="bu-cap">Pozzetti</span>
                  {game.pots.length > 0 && <span className="bu-pc bu-v"><Svg id="back" /></span>}
                  {game.pots.length > 1 && <span className="bu-pc bu-h"><Svg id="back" /></span>}
                </div>
              </div>
              <button className={`bu-dis${canDraw && np ? ' bu-pulse' : ''}`} style={{ ['--off' as string]: `${off.toFixed(1)}px` }} data-dnd="dis" disabled={!canDraw || !np}
                onClick={() => { if (!justDragged()) act({ type: 'take' }) }} aria-label="Prendi il pozzo">
                <span className="bu-cap">Pozzo</span>
                <span className="bu-fan">{pile.map((c) => <span key={c.id} className="bu-pc" aria-label={cardName(c)}><Svg id={faceId(c)} /></span>)}</span>
                <span className="bu-lbl bu-cnt"><b>{np}</b></span>
              </button>
            </div>
            <div className="bu-zone bu-mine">
              {ptsHead('I tuoi', me)}
              <div className="bu-melds" style={meldVars(game.melds[me], geo)}>
                {game.melds[me].length
                  ? game.melds[me].map((m) => <div key={m.id} onClick={() => tapMeld(m.id, 'mine')} style={{ display: 'contents' }}><MeldView m={m} side="mine" rules={game.rules} /></div>)
                  : <span className="bu-empty">Cala 3 carte in scala o in gruppo.</span>}
              </div>
            </div>
            <div className="bu-zone bu-her">
              {ptsHead(`Di ${NAMES[op]}`, op)}
              <div className="bu-melds" style={meldVars(game.melds[op], geo)}>
                {game.melds[op].map((m) => <MeldView key={m.id} m={m} side="her" rules={game.rules} />)}
              </div>
            </div>
          </div>
        </div>

        <div className="bu-dock">
          {toast && <div className={`bu-toast${toast.bad ? ' bu-bad' : ''}`} role="status">{toast.text}</div>}
          <p className="bu-phase">
            {over ? <b>Mano finita</b>
              : game.turn !== me ? <>Tocca a <b>{NAMES[game.turn]}</b></>
                : game.phase === 'draw' ? <><b>Tocca a te:</b> pesca dal tallone o prendi il pozzo</>
                  : <><b>Gioca:</b> cala o trascina le carte su un tuo gioco, poi scarta</>}
          </p>
          <div ref={handEl} className={`bu-hand${open ? ' bu-wrap2' : ''}`} role="group" aria-label="La tua mano">
            {cover === null && rulesMode === null && hand.map((c) => (
              <button key={c.id} data-dnd="hand" data-id={c.id} className={`bu-pc${sel.includes(c.id) ? ' bu-sel' : ''}`} aria-pressed={sel.includes(c.id)}
                aria-label={cardName(c)} onClick={() => tapCard(c)}><Svg id={faceId(c)} /></button>
            ))}
          </div>
          <div className="bu-acts">
            <button className="bu-abtn" disabled={hand.length < 2} onClick={() => { setHand(sortBySuit(hand)); say('Ordinate per seme.') }} aria-label="Ordina per seme">Seme</button>
            <button className="bu-abtn" disabled={hand.length < 2} onClick={() => { setHand(sortByValue(hand)); say('Ordinate per valore.') }} aria-label="Ordina per valore">Valore</button>
            <button className="bu-abtn bu-main" disabled={!myTurn || game.phase !== 'play' || selCards.length < 3} onClick={tapMeldCards}>Cala</button>
            <button className="bu-abtn" disabled={!myTurn || game.phase !== 'play' || selCards.length !== 1} onClick={() => act({ type: 'discard', id: selCards[0].id })}>Scarta</button>
            <button className="bu-abtn" style={{ minWidth: 44, padding: 0 }} aria-label={open ? 'Chiudi la mano' : 'Apri la mano'} aria-expanded={open} onClick={() => setOpen(!open)}>{open ? '▲' : '▼'}</button>
          </div>
        </div>

        {cover !== null && rulesMode === null && (
          <div className="bu-ov" role="dialog" aria-modal="true" aria-label="Passa il telefono">
            <div className={`bu-av bu-big${cover === 1 ? ' bu-lei' : ''}`}>{NAMES[cover][0]}</div>
            <h3>Passa il telefono a {NAMES[cover]}</h3>
            <p>Le carte restano coperte finché {NAMES[cover]} non tocca il pulsante.</p>
            <div className="bu-btns"><button className="bu-btn" onClick={() => { setViewer(cover); setCover(null); setSel([]) }}>Sono {NAMES[cover]}</button></div>
          </div>
        )}

        {rulesMode !== null && (
          <div className="bu-ov" role="dialog" aria-modal="true" aria-label="Regole della casa">
            <h3>{edit ? 'Regole della casa' : 'Regole di questa partita'}</h3>
            <p>{edit ? 'Scegli ora: una volta iniziata la partita non si potranno più cambiare. Tutto spento = Burraco federale (FITAB).' : 'Le regole si scelgono prima di cominciare: a partita iniziata non si possono cambiare.'}</p>
            <div className="bu-rules">
              <div className="bu-rl">Punti e gioco</div>
              {SWITCHES.map(([k, title, desc]) => (
                <button key={k} className={`bu-sw${edit ? '' : ' bu-fixed'}`} role="switch" aria-checked={shownRules[k]} disabled={!edit}
                  onClick={() => setDraft({ ...draft, [k]: !draft[k] })}>
                  <span className="bu-t"><b>{title}</b><small>{desc}</small></span><span className="bu-k" />
                </button>
              ))}
              <div className="bu-rl">Sempre così</div>
              <button className="bu-sw bu-fixed" role="switch" aria-checked="true" disabled>
                <span className="bu-t"><b>Chiudere con una matta</b><small>Vietato: l'ultimo scarto non può essere una matta</small></span><span className="bu-k" />
              </button>
              <div className="bu-rl">Fine partita</div>
              <div className="bu-seg">
                {MODES.map(([k, label]) => <button key={k} aria-pressed={shownRules.mode === k} disabled={!edit} onClick={() => setDraft({ ...draft, mode: k })}>{label}</button>)}
              </div>
              <p className="bu-mnote">{MODE_NOTE[shownRules.mode]}</p>
            </div>
            <div className="bu-btns">
              {edit
                ? <>
                  <button className="bu-btn" onClick={() => startMatch(draft)}>{started ? 'Ricomincia con queste regole' : 'Inizia la partita'}</button>
                  {started && <button className="bu-btn bu-alt" onClick={() => setRulesMode(null)}>Torna alla partita</button>}
                </>
                : <>
                  <button className="bu-btn bu-alt" onClick={() => setRulesMode('edit')}>Nuova partita</button>
                  <button className="bu-btn" onClick={() => setRulesMode(null)}>Chiudi</button>
                </>}
            </div>
          </div>
        )}

        {over && !overlay && !endHidden && (
          <div className="bu-ov" role="dialog" aria-modal="true" aria-label="Fine mano">
            <h3>{game.matchOver && winner !== null ? `${NAMES[winner]} vince la partita` : 'Mano finita'}</h3>
            <p>{game.closer !== null ? `${NAMES[game.closer]} ha chiuso.` : 'Il tallone è finito: nessuno ha chiuso, niente bonus di chiusura.'}</p>
            <table className="bu-score">
              <thead><tr><td></td><td>{NAMES[0]}</td><td>{NAMES[1]}</td></tr></thead>
              <tbody>
                <tr><td>Carte calate</td>{game.handScores.map((h, p) => <td key={p}>{h.melds}</td>)}</tr>
                <tr><td>Burraci</td>{game.handScores.map((h, p) => <td key={p}>{h.burraci}</td>)}</tr>
                <tr><td>Chiusura</td>{game.handScores.map((h, p) => <td key={p}>{h.close}</td>)}</tr>
                <tr><td>Carte in mano</td>{game.handScores.map((h, p) => <td key={p}>{h.hand ? -h.hand : 0}</td>)}</tr>
                <tr><td>Pozzetto non preso</td>{game.handScores.map((h, p) => <td key={p}>{h.pot}</td>)}</tr>
                <tr className="bu-tot"><td>Totale mano</td>{game.handScores.map((h, p) => <td key={p}>{h.total}</td>)}</tr>
                {game.rules.mode !== 'hand' && <tr className="bu-tot"><td>Totale partita</td>{game.scores.map((s, p) => <td key={p}>{s}</td>)}</tr>}
              </tbody>
            </table>
            <div className="bu-btns">
              {game.matchOver
                ? <><button className="bu-btn" onClick={() => startMatch(game.rules)}>Altra partita</button><button className="bu-btn bu-alt" onClick={() => { setDraft(game.rules); setRulesMode('edit') }}>Cambia regole</button></>
                : <button className="bu-btn" onClick={() => act({ type: 'nextRound' })}>Prossima mano</button>}
              <button className="bu-btn bu-alt" onClick={() => setEndHidden(true)}>Vedi il tavolo</button>
              <button className="bu-btn bu-alt" onClick={onBack}>Esci</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
