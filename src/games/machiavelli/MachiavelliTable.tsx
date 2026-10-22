import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './machiavelli.css'
import { apply, buildDeck, describe, newGame, playedCount, shuffle } from './engine.ts'
import type { Action, Card, GameState } from './engine.ts'
import type { GameResult } from '../../lib/game-result.ts'
import { playerIndex, type OnlineGame } from '../../lib/online-game.ts'

// Tavolo di Machiavelli (Fase 1: locale, 2 giocatori sullo stesso schermo con schermata "copri").
// Le regole vivono tutte in engine.ts; qui c'è solo interfaccia: selezione, trascinamento, animazioni.

const SPRITE = `${import.meta.env.BASE_URL}cards/french/svg-cards.svg`
const SUIT_ID = { h: 'heart', d: 'diamond', c: 'club', s: 'spade' } as const
const FACE: Record<number, string> = { 11: 'jack', 12: 'queen', 13: 'king' }
const SUIT_LABEL = { h: 'cuori', d: 'quadri', c: 'fiori', s: 'picche' } as const
const RANK_LABEL: Record<number, string> = { 1: 'asso', 11: 'fante', 12: 'donna', 13: 're' }

const faceId = (c: Card) => (c.s === 'j' ? 'joker_red' : `${SUIT_ID[c.s]}_${FACE[c.r] ?? c.r}`)
const cardName = (c: Card) => (c.s === 'j' ? 'Jolly' : `${RANK_LABEL[c.r] ?? c.r} di ${SUIT_LABEL[c.s]}`)

type SortMode = 'manuale' | 'seme' | 'valore'
const SUIT_RANK = { s: 0, h: 1, c: 2, d: 3, j: 9 } as const

function sortHand(hand: Card[], mode: SortMode, order: number[]): Card[] {
  const h = hand.slice()
  if (mode === 'seme') return h.sort((a, b) => SUIT_RANK[a.s] - SUIT_RANK[b.s] || a.r - b.r)
  if (mode === 'valore') return h.sort((a, b) => Number(a.s === 'j') - Number(b.s === 'j') || a.r - b.r || SUIT_RANK[a.s] - SUIT_RANK[b.s])
  // manuale: l'ordine scelto col trascinamento; le carte nuove (appena pescate) vanno in coda
  const pos = new Map(order.map((id, i) => [id, i]))
  return h.sort((a, b) => (pos.get(a.id) ?? 1e6) - (pos.get(b.id) ?? 1e6))
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

const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches

function loadNames(): [string, string] {
  try {
    const raw = JSON.parse(localStorage.getItem('machiavelli-names') ?? 'null')
    if (Array.isArray(raw) && typeof raw[0] === 'string' && typeof raw[1] === 'string') return [raw[0], raw[1]]
  } catch { /* nomi non salvati: si usano quelli di default */ }
  return ['Tomas', 'Lei']
}

function CardFace({ card, cls = '', selected = false, flash = false, onlyView = false }: {
  card: Card; cls?: string; selected?: boolean; flash?: boolean; onlyView?: boolean
}) {
  const svg = (
    <svg className="face" viewBox="0 0 169.075 244.64" aria-hidden="true"><use href={`${SPRITE}#${faceId(card)}`} /></svg>
  )
  if (onlyView) return <span className={`pc ${cls}`} aria-label={cardName(card)}>{svg}</span>
  return (
    <button className={`pc ${cls}${selected ? ' sel' : ''}${flash ? ' flash' : ''}`} data-card={card.id} aria-pressed={selected} aria-label={cardName(card)}>
      {svg}
    </button>
  )
}

function Pile({ count, ready, label, onClick }: { count: number; ready: boolean; label: string; onClick: () => void }) {
  const back = <svg viewBox="0 0 169.075 244.64" aria-hidden="true"><use href={`${SPRITE}#back`} /></svg>
  return (
    <button className={`pile${ready ? ' ready' : ' off'}`} data-pile onClick={onClick} aria-label={label}>
      <span className="stack"><span className="pb">{back}</span><span className="pb">{back}</span><span className="pb top">{back}</span></span>
      <span className="cnt">{count}</span>
    </button>
  )
}

type Drop = { kind: 'group'; id: number } | { kind: 'new' } | { kind: 'hand'; before: number | null } | { kind: 'bad' } | null
const dropKey = (d: Drop) => (d ? JSON.stringify(d) : '')

export default function MachiavelliTable({ onBack, onResult, online, onRematch }: { onBack: () => void; onResult?: (result: GameResult) => void; online?: OnlineGame<GameState>; onRematch?: () => void }) {
  const wide = useWide()
  const [names, setNames] = useState<[string, string]>(() => online ? [online.state.names[0], online.state.names[1]] : loadNames())
  const [jokers, setJokers] = useState(true)
  const [localGame, setLocalGame] = useState<GameState | null>(null)
  const game = online?.state ?? localGame
  const saveGame = useCallback((state: GameState) => online ? online.onState(state) : setLocalGame(state), [online])
  const me = online ? playerIndex(online) : game?.turn ?? 0
  const [cover, setCover] = useState(false)
  const [sel, setSel] = useState<number[]>([])
  const [flash, setFlash] = useState<number[]>([])
  const [sort, setSort] = useState<SortMode>('manuale')
  const [order, setOrder] = useState<number[]>([])
  const [open, setOpen] = useState(false)
  const [toast, setToast] = useState<{ msg: string; kind: 'bad' | 'ok'; n: number } | null>(null)
  const [shake, setShake] = useState(0)
  const [busy, setBusy] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [drag, setDrag] = useState<{ ids: number[]; fromHand: boolean } | null>(null)
  const [drop, setDrop] = useState<Drop>(null)

  const rootRef = useRef<HTMLDivElement>(null)
  const handRef = useRef<HTMLDivElement>(null)
  const pileRef = useRef<HTMLDivElement>(null)
  const ghostRef = useRef<HTMLDivElement>(null)
  const toastTimer = useRef<number>(0)
  const flashTimer = useRef<number>(0)
  const noClick = useRef(false)
  const reported = useRef(false)

  useEffect(() => {
    if (game?.phase !== 'over') { reported.current = false; return }
    if (!reported.current) { reported.current = true; onResult?.({ winner: game.winner }) }
  }, [game, onResult])

  const hand = useMemo(() => (game ? sortHand(game.hands[me], sort, order) : []), [game, me, sort, order])
  // sempre l'ultima versione, per i listener della finestra (che non si ricreano a ogni render)
  const latest = useRef({ game, sel, hand, busy })
  useEffect(() => { latest.current = { game, sel, hand, busy } })

  const say = useCallback((msg: string, kind: 'bad' | 'ok' = 'bad') => {
    setToast((t) => ({ msg, kind, n: (t?.n ?? 0) + 1 }))
    window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), 3600)
  }, [])
  useEffect(() => () => { window.clearTimeout(toastTimer.current); window.clearTimeout(flashTimer.current) }, [])

  // Applica un'azione del motore. Se è bloccata mostra il motivo, lo stato non cambia.
  const act = useCallback((a: Action): GameState | null => {
    const g = latest.current.game
    if (!g) return null
    if (online && g.turn !== me) { say('Non è il tuo turno'); return null }
    const r = apply(g, a)
    if ('error' in r) {
      say(r.error)
      if (a.type === 'move') setShake((n) => n + 1)
      return null
    }
    saveGame(r.state)
    return r.state
  }, [me, online, saveGame, say])

  const doMove = useCallback((ids: number[], target: number | null) => {
    const next = act({ type: 'move', ids, target })
    if (!next) return
    setSel([])
    setFlash(ids)
    window.clearTimeout(flashTimer.current)
    flashTimer.current = window.setTimeout(() => setFlash([]), 700)
  }, [act])

  function start() {
    const clean: [string, string] = [names[0].trim() || 'Tomas', names[1].trim() || 'Lei']
    try { localStorage.setItem('machiavelli-names', JSON.stringify(clean)) } catch { /* se non si salva, pazienza */ }
    setNames(clean)
    const first = Math.random() < 0.5 ? 0 : 1
    setLocalGame(newGame({ names: clean, first }, shuffle(buildDeck(jokers))))
    setSel([]); setOrder([]); setSort('manuale'); setOpen(false); setCover(true); setToast(null)
  }

  function endTurn() {
    if (act({ type: 'end' })) { setSel([]); if (!online) setCover(true); setOpen(false) }
  }

  // Pesca: la carta vola dal mazzo alla mano e si gira, poi il turno passa e scende la schermata "copri".
  async function draw() {
    if (!game || busy || (online && game.turn !== me)) return
    const r = apply(game, { type: 'draw' })
    if ('error' in r) { say(r.error); return }
    const card = game.deck.length ? game.deck[game.deck.length - 1] : null
    const handEl = handRef.current
    const pileEl = pileRef.current?.querySelector('.top')
    if (card && handEl && pileEl && !reducedMotion()) {
      setBusy(true)
      await flyCard(card, pileEl.getBoundingClientRect(), handEl)
      setBusy(false)
    }
    saveGame(r.state); setSel([]); if (!online) setCover(true); setOpen(false)
    if (!card) say(r.state.phase === 'over' ? 'Mazzo finito e nessuno può più muovere.' : 'Mazzo finito: hai passato il turno.', 'ok')
  }

  // ── trascinamento col mouse (con il tocco si seleziona e si usano i pulsanti) ──
  useEffect(() => {
    let pending: { id: number; x: number; y: number; fromHand: boolean } | null = null
    let started: { ids: number[]; fromHand: boolean; dx: number; dy: number } | null = null
    let lastDrop: Drop = null

    const down = (e: PointerEvent) => {
      if (e.pointerType === 'touch' || e.button !== 0 || latest.current.busy) return
      const card = (e.target as HTMLElement).closest<HTMLElement>('[data-card]')
      if (!card || !rootRef.current?.contains(card)) return
      pending = { id: Number(card.dataset.card), x: e.clientX, y: e.clientY, fromHand: !!card.closest('[data-hand]') }
    }
    const begin = () => {
      const p = pending!
      const ids = latest.current.sel.includes(p.id) ? latest.current.sel.slice() : [p.id]
      const el = rootRef.current!.querySelector<HTMLElement>(`[data-card="${p.id}"]`)!.getBoundingClientRect()
      started = { ids, fromHand: p.fromHand, dx: el.width / 2, dy: el.height / 2 }
      setDrag({ ids, fromHand: p.fromHand })
    }
    const hit = (e: PointerEvent): Drop => {
      const els = document.elementsFromPoint(e.clientX, e.clientY)
      const inRoot = (n: Element) => rootRef.current?.contains(n)
      if (els.some((n) => inRoot(n) && n.matches('[data-hand],.handrow'))) {
        if (!started!.fromHand) return { kind: 'bad' }
        const cards = [...(handRef.current?.querySelectorAll<HTMLElement>('.pc') ?? [])].filter((n) => !started!.ids.includes(Number(n.dataset.card)))
        const next = cards.find((n) => e.clientX < n.getBoundingClientRect().left + n.getBoundingClientRect().width / 2)
        return { kind: 'hand', before: next ? Number(next.dataset.card) : null }
      }
      const grp = els.find((n) => inRoot(n) && n.matches('[data-group]')) as HTMLElement | undefined
      if (grp) return { kind: 'group', id: Number(grp.dataset.group) }
      if (els.some((n) => inRoot(n) && n.matches('[data-felt]'))) return { kind: 'new' }
      return null
    }
    const move = (e: PointerEvent) => {
      if (!pending) return
      if (!started) {
        if (Math.hypot(e.clientX - pending.x, e.clientY - pending.y) < 6) return
        begin()
      }
      const g = ghostRef.current
      if (g) g.style.transform = `translate(${e.clientX - started!.dx}px, ${e.clientY - started!.dy}px) rotate(-3deg)`
      const d = hit(e)
      if (dropKey(d) !== dropKey(lastDrop)) { lastDrop = d; setDrop(d) }
    }
    const up = () => {
      const s = started, d = lastDrop
      pending = null; started = null; lastDrop = null
      if (!s) return
      setDrag(null); setDrop(null)
      noClick.current = true
      setTimeout(() => { noClick.current = false }, 0)
      if (!d) return
      if (d.kind === 'bad') { say('Dal tavolo le carte non tornano in mano.'); return }
      if (d.kind === 'hand') {
        const rest = latest.current.hand.filter((c) => !s.ids.includes(c.id))
        const moving = latest.current.hand.filter((c) => s.ids.includes(c.id))
        const at = d.before == null ? rest.length : rest.findIndex((c) => c.id === d.before)
        rest.splice(at, 0, ...moving)
        setOrder(rest.map((c) => c.id)); setSort('manuale'); setSel([])
        return
      }
      doMove(s.ids, d.kind === 'group' ? d.id : null)
    }
    const cancel = () => { pending = null; started = null; lastDrop = null; setDrag(null); setDrop(null) }

    window.addEventListener('pointerdown', down)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', cancel)
    return () => {
      window.removeEventListener('pointerdown', down)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', cancel)
    }
  }, [doMove, say])

  const toggleSel = (id: number) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
  const onRootClick = (e: React.MouseEvent) => {
    if (noClick.current || busy) return
    const card = (e.target as HTMLElement).closest<HTMLElement>('[data-card]')
    if (card) toggleSel(Number(card.dataset.card))
  }

  // ───────── schermate ─────────
  if (!game) {
    return (
      <div className="mk-screen">
        <div className="mk mk-setup">
          <button className="mk-leave" onClick={onBack}>‹ Indietro</button>
          <form className="setup-card" onSubmit={(e) => { e.preventDefault(); start() }}>
            <h1>Machiavelli</h1>
            <p className="setup-sub">Due giocatori sullo stesso schermo: a fine turno la mano si nasconde.</p>
            <label>Primo giocatore<input value={names[0]} maxLength={16} onChange={(e) => setNames([e.target.value, names[1]])} /></label>
            <label>Secondo giocatore<input value={names[1]} maxLength={16} onChange={(e) => setNames([names[0], e.target.value])} /></label>
            <label className="switch">
              <input type="checkbox" checked={jokers} onChange={(e) => setJokers(e.target.checked)} />
              <span>Con i jolly <small>{jokers ? '108 carte' : '104 carte'}</small></span>
            </label>
            <button className="btn main" type="submit">Inizia la partita</button>
          </form>
        </div>
      </div>
    )
  }

  const other = (me + 1) % game.hands.length
  const played = playedCount(game)
  const over = game.phase === 'over'
  const changed = played > 0 || game.table !== game.start.table
  const deckEmpty = game.deck.length === 0
  const pileLabel = deckEmpty
    ? 'Mazzo finito: tocca per passare il turno'
    : `Mazzo, ${game.deck.length} carte${played === 0 ? ': tocca per pescare e passare il turno' : ''}`
  const pile = <div ref={pileRef} className="pilewrap"><Pile count={game.deck.length} ready={played === 0 && !over} label={pileLabel} onClick={draw} /></div>
  const dragCards = drag ? drag.ids.map((id) => hand.find((c) => c.id === id) ?? game.table.flatMap((g) => g.cards).find((c) => c.id === id)).filter((c): c is Card => !!c) : []

  const rootCls = ['mk', wide ? 'mk-wide' : '', drag ? 'dragging' : '', shake ? 'shaking' : ''].filter(Boolean).join(' ')

  return (
    <div className="mk-screen">
      <div ref={rootRef} className={rootCls} onClick={onRootClick} onAnimationEnd={(e) => { if (e.animationName === 'mk-shake') setShake(0) }}>
        <header className="hud">
          {leaving
            ? <button className="mk-leave warn" onClick={onBack}>Esci dalla partita?</button>
            : <button className="mk-leave" onClick={() => { setLeaving(true); window.setTimeout(() => setLeaving(false), 3000) }} aria-label="Esci">‹ Esci</button>}
          <div className="av" aria-hidden="true">{game.names[other][0]?.toUpperCase()}</div>
          <div className="who"><b>{game.names[other]}</b><span>{game.hands[other].length} carte</span></div>
          <div className="sp" />
          {!wide && pile}
          <span className="pill turn">Tocca a {game.names[me]}</span>
        </header>

        <div className={`felt${drop?.kind === 'new' ? ' dropnew' : ''}`} data-felt>
          {game.table.length === 0 && <p className="felt-empty">Il tavolo è vuoto: forma la prima combinazione.</p>}
          {game.table.map((g) => (
            <section key={g.id} className={`grp${drop?.kind === 'group' && drop.id === g.id ? ' drop' : ''}`} data-group={g.id} role="group" aria-label={describe(g.cards)}>
              {sel.length > 0 && (
                <button className="gadd" onClick={() => doMove(sel, g.id)} aria-label={`Aggiungi qui: ${describe(g.cards)}`}>+</button>
              )}
              <div className="strip">
                {g.cards.map((c) => <CardFace key={c.id} card={c} selected={sel.includes(c.id)} flash={flash.includes(c.id)} cls={drag?.ids.includes(c.id) ? 'dragsrc' : ''} />)}
              </div>
            </section>
          ))}
        </div>

        <div className="dock">
          {toast && <div key={toast.n} className={`toast ${toast.kind}`} role="status" aria-live="polite">{toast.msg}</div>}
          <div className="sortbar" role="group" aria-label="Ordina la mano">
            {(['manuale', 'seme', 'valore'] as const).map((m) => (
              <button key={m} aria-pressed={sort === m} onClick={() => { if (m === 'manuale') setOrder(hand.map((c) => c.id)); setSort(m) }}>{m === 'manuale' ? 'Manuale' : m === 'seme' ? 'Seme' : 'Valore'}</button>
            ))}
          </div>
          <div className="handrow">
            <div ref={handRef} className={`hand${open ? ' open' : ''}${drop?.kind === 'hand' ? ' dropin' : ''}${drop?.kind === 'bad' ? ' dropbad' : ''}`} data-hand role="group" aria-label="La tua mano">
              {hand.map((c) => (
                <CardFace key={c.id} card={c} selected={sel.includes(c.id)} flash={flash.includes(c.id)}
                  cls={`${drag?.ids.includes(c.id) ? 'dragsrc ' : ''}${drop?.kind === 'hand' && drop.before === c.id ? 'ins-b ' : ''}`} />
              ))}
              {drop?.kind === 'hand' && drop.before === null && <i className="ins-end" aria-hidden="true" />}
            </div>
            {!wide && hand.length > 5 && (
              <button className="chev" aria-expanded={open} aria-label={open ? 'Chiudi la mano' : 'Mostra tutta la mano'} onClick={() => setOpen(!open)}>
                <svg viewBox="0 0 24 24"><path d="M6 15l6-6 6 6" /></svg>
              </button>
            )}
          </div>
          {wide && pile}
          <div className="act">
            <button className="btn ghost" disabled={!changed} onClick={() => { act({ type: 'undo' }); setSel([]) }} aria-label="Annulla turno">
              <svg viewBox="0 0 24 24"><path d="M9 6L4 11l5 5M4 11h10a6 6 0 0 1 0 12" /></svg><span>Annulla</span>
            </button>
            <button className="btn main" disabled={sel.length === 0} onClick={() => doMove(sel, null)}>Forma{sel.length ? ` (${sel.length})` : ''}</button>
            {played > 0 && (
              <button className="btn go" onClick={endTurn}>
                <svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>Fine turno
              </button>
            )}
          </div>
        </div>

        {drag && (
          <div ref={ghostRef} className="dragghost" style={{ transform: 'translate(-999px,-999px)' }}>
            {dragCards.slice(0, 4).map((c, i) => (
              <div key={c.id} className="gc" style={{ transform: `translate(${i * 10}px, ${i * -6}px)` }}>
                <svg viewBox="0 0 169.075 244.64"><use href={`${SPRITE}#${faceId(c)}`} /></svg>
              </div>
            ))}
            {drag.ids.length > 1 && <span className="gn">{drag.ids.length}</span>}
          </div>
        )}

        {cover && !over && (
          <div className="cover" role="dialog" aria-label="Cambio turno">
            <p className="cover-eyebrow">Cambio turno</p>
            <h2>Passa a {game.names[me]}</h2>
            <p>{game.hands[other].length} carte per {game.names[other]}. Mostra la tua mano solo quando sei davanti allo schermo.</p>
            <button className="btn main" onClick={() => setCover(false)} autoFocus>Sono {game.names[me]}, mostra la mano</button>
          </div>
        )}

        {over && (
          <div className="cover over" role="dialog" aria-label="Fine partita">
            <p className="cover-eyebrow">Fine partita</p>
            <h2>{game.winner == null ? 'Partita chiusa: pareggio' : `${game.names[game.winner]} ha vinto!`}</h2>
            <p>{game.winner == null ? 'Mazzo finito e nessuno può più muovere.' : 'Ha finito tutte le carte. Queste restano agli altri:'}</p>
            <div className="left-hands">
              {game.hands.map((h, i) => (h.length > 0 && (
                <div key={i} className="left-hand"><b>{game.names[i]}</b>
                  <div className="strip">{h.map((c) => <CardFace key={c.id} card={c} onlyView />)}</div>
                </div>
              )))}
            </div>
            <div className="over-actions">
              <button className="btn main" onClick={online ? onRematch : start}>Rivincita</button>
              {!online && <button className="btn ghost wide" onClick={() => setLocalGame(null)}>Cambia nomi</button>}
              <button className="btn ghost wide" onClick={onBack}>Esci</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// Carta in volo dal mazzo alla mano con giro (rotateY). Torna quando l'animazione finisce.
function flyCard(card: Card, from: DOMRect, handEl: HTMLElement): Promise<void> {
  const cards = handEl.querySelectorAll<HTMLElement>('.pc')
  const last = cards[cards.length - 1]?.getBoundingClientRect()
  const prev = cards[cards.length - 2]?.getBoundingClientRect()
  const to = last
    ? { left: last.left + (prev ? last.left - prev.left : last.width * 0.6), top: last.top, width: last.width }
    : { left: handEl.getBoundingClientRect().left, top: handEl.getBoundingClientRect().top, width: from.width }
  const fly = document.createElement('div')
  fly.className = 'fly'
  fly.style.cssText = `left:${from.left}px;top:${from.top}px;width:${from.width}px;height:${from.height}px`
  const svg = (id: string) => `<svg viewBox="0 0 169.075 244.64"><use href="${SPRITE}#${id}"/></svg>`
  fly.innerHTML = `<div class="fi"><div class="ff fb">${svg('back')}</div><div class="ff fr">${svg(faceId(card))}</div></div>`
  document.body.appendChild(fly)
  const dx = to.left - from.left
  const dy = to.top - from.top
  const sc = to.width / from.width
  fly.animate([
    { transform: 'translate(0,0) scale(1)' },
    { transform: `translate(${dx * 0.55}px,${dy * 0.55 - 60}px) scale(${1 + (sc - 1) * 0.5 + 0.18})`, offset: 0.55 },
    { transform: `translate(${dx}px,${dy}px) scale(${sc})` },
  ], { duration: 760, easing: 'cubic-bezier(.45,.05,.3,1)', fill: 'forwards' })
  const flip = (fly.firstChild as HTMLElement).animate(
    [{ transform: 'rotateY(0deg)' }, { transform: 'rotateY(180deg)' }],
    { duration: 760, easing: 'ease-in-out', fill: 'forwards' },
  )
  // la carta resta un attimo ferma a faccia in su, così si vede cosa è stato pescato
  return new Promise((resolve) => {
    flip.onfinish = () => window.setTimeout(() => { fly.remove(); resolve() }, 550)
  })
}
