import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import './uno.css'
import { COLORS, DEFAULT_RULES, GOAL, MERCY_LIMIT, apply, buildDeck, canStack, isNumber, newGame, playError, shuffle, siblings, topCard } from './engine.ts'
import type { Action, Card, Color, GameState, Rules, UnoEvent } from './engine.ts'
import type { GameResult } from '../../lib/game-result.ts'
import { isRemoteChange, playerIndex, type OnlineGame } from '../../lib/online-game.ts'
import { unoTransition } from './transition.ts'
import { COL, COLOR_NAME, cardLabel } from './colors.ts'
import { UnoFace } from './UnoFace.tsx'
import backUrl from '../../assets/cards/backs/uno-back.svg'

// Tavolo di UNO (Fase 1: locale, 2 giocatori sullo stesso schermo con schermata "copri", nessun bot).
// Le regole vivono tutte in engine.ts (anche i controlli "si può giocare?"): qui c'è solo interfaccia e animazioni.

const DEFAULT_NAMES = ['Tomas', 'Lei']
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches

const MODES: [Rules['mode'], string, string][] = [
  ['single', 'Una mano', 'Si gioca una sola mano e basta.'],
  ['bo3', 'Al meglio di 3', 'Vince chi arriva a 2 mani vinte.'],
  ['bo5', 'Al meglio di 5', 'Vince chi arriva a 3 mani vinte.'],
  ['pts', '500 punti', 'Regola ufficiale: ogni mano dà punti, vince chi arriva a 500.'],
]
const SWITCHES: [Exclude<keyof Rules, 'mode'>, string, string][] = [
  ['challenge', 'Sfida del +4', 'Chi riceve un +4 può sfidare: se chi l\'ha giocato aveva il colore di prima pesca 4 lui, altrimenti pesca 6 lo sfidante.'],
  ['s22', '+2 su +2', 'Se ti arriva un +2 puoi rispondere con un altro +2: la pesca si somma.'],
  ['s44', '+4 su +4, e +2 su +4', 'Il +4 si impila sul +4. Un +2 si impila su un +4 se è del colore scelto.'],
  ['multi', 'Più carte uguali insieme', 'Giochi due o tre carte con lo stesso numero (o stesso simbolo) in un colpo.'],
  ['swap', '7 e 0', 'Il 7 scambia la mano con l\'avversario. Lo 0 fa passare le mani, in due è lo stesso scambio.'],
  ['noSpecialEnd', 'Si chiude solo con un numero', 'L\'ultima carta non può essere speciale (Salta, Inverti, +2, Jolly, +4). Se ti resta una speciale, devi pescare.'],
  ['drawUntil', 'Pesca finché giochi', 'Se non hai niente di giocabile peschi finché esce una carta che puoi giocare.'],
  ['mercy', `Pietà a ${MERCY_LIMIT} carte`, `Chi arriva a ${MERCY_LIMIT} carte in mano perde la mano.`],
]

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

const deal = (rules: Rules): { game: GameState; first: number } => {
  const first = Math.random() < 0.5 ? 0 : 1
  return { game: newGame({ names: DEFAULT_NAMES, rules, first }, shuffle(buildDeck())), first }
}

const Back = () => <span className="uk-cd"><img src={backUrl} alt="" /></span>

// Testo dei toast a partire da cosa è successo nell'ultima mossa (gli eventi li produce il motore).
function describe(events: UnoEvent[], names = DEFAULT_NAMES): string {
  const NAMES = names
  const out: string[] = []
  for (const e of events) {
    if (e.type === 'draw') {
      if (e.why === 'uno') out.push(`${NAMES[e.p]} non ha detto UNO: pesca 2`)
      else if (e.why !== 'end') out.push(`${NAMES[e.p]} pesca ${e.n}`)
    } else if (e.type === 'skip') out.push(`${NAMES[e.p]} salta il turno`)
    else if (e.type === 'pass') out.push(`${NAMES[e.p]} passa`)
    else if (e.type === 'swap') out.push('Le mani sono state scambiate')
    else if (e.type === 'challenge') out.push(e.won ? 'Sfida riuscita' : 'Sfida persa')
    else if (e.type === 'reshuffle') out.push('Scarti rimescolati nel mazzo')
    else if (e.type === 'mercy') out.push(`${NAMES[e.p]} è a ${MERCY_LIMIT} carte: perde la mano`)
  }
  return out.join(' · ')
}

// Dispone la mano secondo l'ordine scelto dal giocatore; le carte nuove (non nella lista) vanno in fondo
const applyOrder = (h: Card[], order: number[]) => {
  if (!order.length) return h
  const pos = new Map(order.map((id, i) => [id, i]))
  return h.slice().sort((a, b) => (pos.get(a.id) ?? 1e6) - (pos.get(b.id) ?? 1e6))
}

const sortHand = (h: Card[]) => {
  const ord: Record<string, number> = { r: 0, b: 1, y: 2, g: 3, w: 4 }
  const val = (c: Card) => (isNumber(c) ? +c.v : ({ skip: 10, rev: 11, d2: 12, w: 13, w4: 14 } as Record<string, number>)[c.v])
  return h.slice().sort((x, y) => ord[x.c] - ord[y.c] || val(x) - val(y))
}

export default function UnoTable({ onBack, onResult, online, onRematch }: { onBack: () => void; onResult?: (result: GameResult) => void; online?: OnlineGame<GameState>; onRematch?: () => void }) {
  const wide = useWide()
  const [localGame, setLocalGame] = useState<GameState>(() => newGame({ names: DEFAULT_NAMES, rules: DEFAULT_RULES, first: 0 }, shuffle(buildDeck())))
  const game = online?.state ?? localGame
  const NAMES = game.names
  const saveGame = (state: GameState) => online ? online.onState(state) : setLocalGame(state)
  const [started, setStarted] = useState(Boolean(online))   // false finché non si è premuto "Inizia la partita"
  const [rulesOpen, setRulesOpen] = useState(!online)
  const [draft, setDraft] = useState<Rules>(online?.state.rules ?? DEFAULT_RULES)
  const [viewer, setViewer] = useState(0)                   // chi sta guardando lo schermo
  const [cover, setCover] = useState<number | null>(null)   // a chi passare il telefono (null = nessuno)
  const [toast, setToast] = useState<{ text: string; n: number } | null>(null)
  const [flash, setFlash] = useState(0)
  const [fresh, setFresh] = useState<{ ids: number[]; by: number } | null>(null)
  const [multi, setMulti] = useState<{ card: Card; sibs: Card[] } | null>(null)
  const [open, setOpen] = useState(false)                   // mano aperta su due righe
  const [dragOrder, setDragOrder] = useState<number[] | null>(null)
  const [drag, setDrag] = useState<{ id: number; tx: number } | null>(null)
  const [askExit, setAskExit] = useState(false)

  const root = useRef<HTMLDivElement>(null)
  const handEl = useRef<HTMLDivElement>(null)
  const drawn = useRef<[number, number][] | null>(null)     // chi ha appena pescato e quante carte, per l'animazione
  const dragRef = useRef<{ id: number; pid: number; x0: number; grab: number; tx: number; moved: boolean } | null>(null)
  const suppressClick = useRef(false)
  const toastN = useRef(0)
  const timers = useRef<number[]>([])
  const reported = useRef(false)
  const later = (fn: () => void, ms: number) => { timers.current.push(window.setTimeout(fn, ms)) }
  useEffect(() => () => timers.current.forEach(clearTimeout), [])
  useEffect(() => {
    if (!game.matchOver) { reported.current = false; return }
    if (!reported.current) {
      reported.current = true
      // niente `scores`: in UNO i punti cambiano significato con la modalità (carte rimaste, mani vinte, 500).
      // Contano invece le mani vinte: in "al meglio di" scores = mani; in "500 punti" non sono mani, quindi nulla.
      onResult?.({ winner: game.roundWinner, hands: game.rules.mode === 'pts' ? undefined : [game.scores[0], game.scores[1]] })
    }
  }, [game, onResult])

  const me = online ? playerIndex(online) : viewer
  const op = 1 - me
  const over = game.phase === 'over'
  // Ordine della mano: solo su questo dispositivo (non va nello stato condiviso), così si può riordinare anche fuori turno
  const [order, setOrder] = useState<number[]>([])
  const hand = applyOrder(game.hands[me], order)
  const shown = dragOrder ? dragOrder.map((id) => hand.find((c) => c.id === id)!) : hand
  const myTurn = game.phase === 'play' && game.turn === me && cover === null && !rulesOpen
  const say = (text: string) => setToast({ text, n: ++toastN.current })

  // I messaggi spariscono dopo un po', ma solo quando nessuna schermata copre il tavolo.
  useEffect(() => {
    if (!toast || cover !== null || rulesOpen) return
    const t = window.setTimeout(() => setToast(null), 2600)
    return () => clearTimeout(t)
  }, [toast, cover, rulesOpen])
  useEffect(() => {
    if (!flash || cover !== null || rulesOpen) return
    const t = window.setTimeout(() => setFlash(0), 1150)
    return () => clearTimeout(t)
  }, [flash, cover, rulesOpen])

  // Mano a ventaglio: se le carte non entrano si sovrappongono quanto serve (si ricalcola a ogni disegno).
  const fitHand = () => {
    const hd = handEl.current
    if (!hd) return
    const cards = [...hd.querySelectorAll<HTMLElement>('.uk-cd')]
    cards.forEach((c) => { c.style.marginLeft = '' })
    if (open || cards.length < 2) return
    const w = cards[0].offsetWidth, avail = hd.clientWidth - 8, gap = 8
    if (!w || !avail) return
    const need = cards.length * w + (cards.length - 1) * gap
    const m = need <= avail ? gap : (avail - cards.length * w) / (cards.length - 1)
    cards.forEach((c, i) => { if (i) c.style.marginLeft = m + 'px' })
  }
  useLayoutEffect(fitHand)
  useEffect(() => {
    window.addEventListener('resize', fitHand)
    return () => window.removeEventListener('resize', fitHand)
  })

  // Mossa dell'avversario: si riproduce sul nostro schermo ciò che il suo dispositivo ha già animato
  // (carta che atterra, carte pescate, messaggio, scritta UNO). Va PRIMA dell'effetto che legge `drawn`.
  const prevGame = useRef(game)
  useLayoutEffect(() => {
    const prev = prevGame.current
    prevGame.current = game
    if (!online || !isRemoteChange(online)) return
    const t = unoTransition(prev, game)
    if (!t) return
    const text = describe(t.events, game.names)
    if (text) say(text)
    drawn.current = t.draws
    if (t.played.length) {
      setFresh({ ids: t.played, by: t.by })
      later(() => setFresh(null), 500)
      if (t.unoCall) setFlash(++toastN.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game])

  // Le carte pescate scivolano dal mazzo alla mano (solo quando nessuna schermata copri nasconde il tavolo).
  useLayoutEffect(() => {
    const list = drawn.current
    if (!list || cover !== null || rulesOpen || !root.current) return
    drawn.current = null
    if (reducedMotion()) return
    const from = root.current.querySelector<HTMLElement>('[data-dk]')?.getBoundingClientRect()
    if (!from) return
    list.forEach(([p, n]) => {
      const els = [...root.current!.querySelectorAll<HTMLElement>(p === me ? '[data-hand] .uk-cd' : '[data-oh] .uk-cd')].slice(-Math.min(n, 6))
      els.forEach((el, k) => {
        const r = el.getBoundingClientRect()
        el.animate(
          [{ transform: `translate(${from.left + from.width / 2 - r.left - r.width / 2}px,${from.top + from.height / 2 - r.top - r.height / 2}px) scale(.8)`, opacity: 0.3 }, { transform: 'none', opacity: 1 }],
          { duration: 460, delay: k * 110, easing: 'ease-out', fill: 'backwards' },
        )
      })
    })
  }, [game, cover, rulesOpen, me])

  // ── mosse: tutto passa da apply; qui si reagisce al risultato ──
  function act(a: Action) {
    const r = apply(game, a, shuffle)
    if ('error' in r) { say(r.error); return }
    const s = r.state
    saveGame(s)
    if (a.type === 'uno') return                        // dichiarare UNO non cambia turno né animazioni
    setMulti(null)
    const text = describe(s.events, game.names)
    if (text) say(text)
    drawn.current = s.events.flatMap((e) => (e.type === 'draw' ? [[e.p, e.n] as [number, number]] : []))
    if (a.type === 'play') {
      const p = game.turn
      setFresh({ ids: a.cards, by: p })
      later(() => setFresh(null), 500)
      // UNO dichiarato e giusto: appare la scritta
      if (game.uno[p] && game.hands[p].length - a.cards.length === 1 && !s.events.some((e) => e.type === 'draw' && e.why === 'uno')) setFlash(++toastN.current)
    }
    if (!online && s.phase !== 'over' && s.turn !== viewer) setCover(s.turn)  // in locale si passa il telefono
  }

  function startMatch(rules: Rules) {
    const d = deal(rules)
    drawn.current = null
    setLocalGame(d.game); setStarted(true); setRulesOpen(false); setViewer(d.first); setCover(d.first)
    setMulti(null); setFresh(null); setToast(null); setFlash(0); setOpen(false)
  }

  function openRules() {
    if (online) return
    setDraft(game.rules)
    setRulesOpen(true)
  }

  function leave() {
    if (askExit || over || !started) { onBack(); return }
    setAskExit(true)
    later(() => setAskExit(false), 3000)
  }

  function reorder(ids: number[]) { setOrder(ids) }

  function tap(c: Card, el: HTMLElement) {
    if (suppressClick.current) { suppressClick.current = false; return }
    if (rulesOpen || cover !== null) return
    if (game.phase !== 'play' || game.turn !== me) { say(over ? 'La mano è finita' : 'Non è il tuo turno'); return }
    const err = playError(game, me, c.id)
    if (err) {
      if (!reducedMotion()) el.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'translateX(-4px)' }, { transform: 'translateX(0)' }], { duration: 260 })
      say(err)
      return
    }
    const sibs = siblings(game, me, c.id)
    if (sibs.length) { setMulti({ card: c, sibs }); return }
    act({ type: 'play', cards: [c.id] })
  }

  // Riordino a mano: si trascina una carta, le altre si spostano.
  function onDown(e: React.PointerEvent) {
    const el = (e.target as HTMLElement).closest<HTMLElement>('.uk-cd')
    if (!el || e.button > 0 || !el.dataset.id) return
    suppressClick.current = false
    dragRef.current = { id: +el.dataset.id, pid: e.pointerId, x0: e.clientX, grab: e.clientX - el.getBoundingClientRect().left, tx: 0, moved: false }
    try { el.setPointerCapture(e.pointerId) } catch { /* il trascinamento resta comunque possibile */ }
  }
  function onMove(e: React.PointerEvent) {
    const d = dragRef.current
    const hd = handEl.current
    if (!d || !hd || e.pointerId !== d.pid) return
    if (!d.moved) { if (Math.abs(e.clientX - d.x0) < 8) return; d.moved = true }
    const els = [...hd.querySelectorAll<HTMLElement>('.uk-cd')]
    const el = els.find((x) => +x.dataset.id! === d.id)
    if (!el) return
    const cx = e.clientX - d.grab + el.getBoundingClientRect().width / 2
    const others = els.filter((x) => x !== el)
    const ni = others.filter((x) => { const r = x.getBoundingClientRect(); return r.left + r.width / 2 < cx }).length
    const cur = dragOrder ?? hand.map((c) => c.id)
    if (ni !== cur.indexOf(d.id)) {
      const next = cur.filter((id) => id !== d.id)
      next.splice(ni, 0, d.id)
      flushSync(() => setDragOrder(next))               // si ridisegna subito, così la misura qui sotto è esatta
    }
    const natural = el.getBoundingClientRect().left - d.tx
    d.tx = e.clientX - d.grab - natural
    setDrag({ id: d.id, tx: d.tx })
  }
  function onUp(e: React.PointerEvent) {
    const d = dragRef.current
    if (!d || e.pointerId !== d.pid) return
    dragRef.current = null
    if (!d.moved) return
    suppressClick.current = true                        // il "click" che segue il rilascio non deve giocare la carta
    if (dragOrder) reorder(dragOrder)
    setDragOrder(null); setDrag(null)
  }

  const nOp = game.hands[op].length
  const t = topCard(game)
  const prev = game.disc.slice(-4, -1)
  const [a, b] = game.scores
  const sub = over ? 'Mano finita' : game.turn === me ? 'Tocca a te' : `Tocca a ${NAMES[op]}`
  const score = game.rules.mode === 'single' ? '' : ` · ${game.scores[me]}-${game.scores[op]}`
  const w = game.roundWinner ?? 0
  const mercyEnd = game.events.some((e) => e.type === 'mercy')
  const needUno = myTurn && hand.length === 2 && !game.uno[me]

  return (
    <div className="uk-screen">
      <div ref={root} className={`uk${wide ? ' uk-wide' : ''}${open ? ' uk-hopen' : ''}`}>
        <div className="uk-hud">
          <div className={`uk-av${me === 1 ? ' uk-lei' : ''}`}>{NAMES[me][0]}</div>
          <div className="uk-who"><b>{NAMES[me]}</b><span>{sub}{score}</span></div>
          <span className="uk-sp" />
          {!online && <button className="uk-pill uk-btnp" onClick={openRules} aria-label="Regole della casa">Regole</button>}
          <button className={`uk-pill uk-btnp uk-exit${askExit ? ' warn' : ''}`} onClick={leave}>{askExit ? 'Esci dalla partita?' : '‹ Esci'}</button>
        </div>

        <div className="uk-felt">
          <div className="uk-band">
            <div className="uk-oh" data-oh>{Array.from({ length: Math.min(nOp, 9) }, (_, i) => <Back key={i} />)}</div>
            <div className="uk-ocount"><b>{nOp}</b><small>carte</small></div>
            {nOp === 1 && <span className="uk-obadge">UNO!</span>}
          </div>
          <div className="uk-mid">
            <div className="uk-row">
              <button className="uk-dk" data-dk disabled={!myTurn || game.drawn !== null} onClick={() => act({ type: 'draw' })} aria-label="Pesca dal mazzo">
                <Back /><Back /><Back /><span className="uk-cnt"><b>{game.deck.length}</b></span>
              </button>
              <div className="uk-dis">
                {prev.map((c) => <span key={c.id} className="uk-cd" style={{ transform: `rotate(${((c.id * 37) % 15) - 7}deg)` }}><UnoFace card={c} /></span>)}
                <span className="uk-ring" style={{ ['--rc' as string]: COL[game.color] }} />
                <span className={`uk-cd${fresh?.ids.includes(t.id) ? ` uk-land${fresh.by === me ? '' : ' uk-top'}` : ''}`}><UnoFace card={t} /></span>
              </div>
            </div>
            <div className="uk-info">
              <span className="uk-cpill" style={{ ['--rc' as string]: COL[game.color] }}><i />{COLOR_NAME[game.color]}</span>
              {game.pending > 0 && <span className="uk-pend">Pesca +{game.pending}</span>}
            </div>
          </div>
          {toast && <div className="uk-toast" role="status">{toast.text}</div>}
          {flash > 0 && <div className="uk-flash"><b>UNO!</b></div>}
        </div>

        <div className="uk-dock">
          <div className="uk-handwrap">
            <div className="uk-mp">
              {multi && myTurn && <>
                <span>Gioca anche le uguali?</span>
                {Array.from({ length: Math.min(multi.sibs.length, 3) + 1 }, (_, i) => (
                  <button key={i} className="uk-abtn" onClick={() => act({ type: 'play', cards: [multi.card.id, ...multi.sibs.slice(0, i).map((c) => c.id)] })}>{i + 1} {i ? 'carte' : 'carta'}</button>
                ))}
              </>}
            </div>
            <div ref={handEl} data-hand className={`uk-hand${myTurn ? ' uk-turn' : ''}${open ? ' uk-open' : ''}`} role="group" aria-label="La tua mano"
              onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
              {cover === null && (shown.length
                ? shown.map((c) => (
                  <button key={c.id} data-id={c.id} className={`uk-cd${drag?.id === c.id ? ' uk-drag' : ''}`} aria-label={cardLabel(c)}
                    style={drag?.id === c.id ? { transform: `translate(${drag.tx}px,-14px)` } : undefined}
                    onClick={(e) => tap(c, e.currentTarget)}><UnoFace card={c} /></button>
                ))
                : <div className="uk-vuota">Nessuna carta in mano</div>)}
            </div>
          </div>
          <div className="uk-acts">
            <button className={`uk-abtn uk-unob${game.uno[me] ? ' on' : ''}${needUno ? ' need' : ''}`} disabled={hand.length > 3 || hand.length < 1 || over}
              aria-pressed={game.uno[me]} onClick={() => act({ type: 'uno', player: me, on: !game.uno[me] })}>{game.uno[me] ? 'UNO ✓' : 'UNO!'}</button>
            {game.drawn !== null && myTurn && <button className="uk-abtn" onClick={() => act({ type: 'pass' })}>Passa</button>}
            <button className="uk-abtn" disabled={hand.length < 2} onClick={() => reorder(sortHand(hand).map((c) => c.id))}>Ordina</button>
            <button className="uk-abtn uk-chev" aria-expanded={open} aria-label={open ? 'Chiudi la mano' : 'Apri la mano'} onClick={() => setOpen(!open)}>
              <svg viewBox="0 0 24 24"><path d="M6 15l6-6 6 6" /></svg>
            </button>
          </div>
        </div>

        {cover !== null && !rulesOpen && (
          <div className="uk-ov" role="dialog" aria-modal="true" aria-label="Passa il telefono">
            <div className={`uk-av uk-big${cover === 1 ? ' uk-lei' : ''}`}>{NAMES[cover][0]}</div>
            <h3>Passa il telefono a {NAMES[cover]}</h3>
            <p>Le carte restano coperte finché {NAMES[cover]} non tocca il pulsante.</p>
            <button className="uk-btn" onClick={() => { setViewer(cover); setCover(null) }}>Sono {NAMES[cover]}</button>
          </div>
        )}

        {game.phase === 'pick' && game.turn === me && cover === null && !rulesOpen && (
          <div className="uk-ov" role="dialog" aria-modal="true" aria-label="Scegli il colore">
            <h3>Scegli il colore</h3>
            <div className="uk-pick">
              {COLORS.map((c: Color) => <button key={c} className={c === 'y' ? 'uk-y' : ''} style={{ background: COL[c] }} onClick={() => act({ type: 'color', color: c })}>{COLOR_NAME[c]}</button>)}
            </div>
          </div>
        )}

        {game.phase === 'challenge' && game.turn === me && game.wild && cover === null && !rulesOpen && (
          <div className="uk-ov" role="dialog" aria-modal="true" aria-label="Sfida il più quattro">
            <h3>{NAMES[game.wild.by]} gioca un +4</h3>
            <p>Ha scelto <b>{COLOR_NAME[game.color]}</b>. Se sfidi e aveva in mano una carta {COLOR_NAME[game.wild.prev]} (il colore di prima), pesca 4 {NAMES[game.wild.by]}. Se non l'aveva, peschi 6 tu.</p>
            <div className="uk-btns">
              <button className="uk-btn" onClick={() => act({ type: 'challenge' })}>Sfida</button>
              <button className="uk-btn uk-alt" onClick={() => act({ type: 'accept' })}>Pesca {game.pending}</button>
              {canStack(game, me) && <button className="uk-btn uk-alt" onClick={() => act({ type: 'stack' })}>Rispondi con un +4 o +2</button>}
            </div>
          </div>
        )}

        {rulesOpen && (
          <div className="uk-ov" role="dialog" aria-modal="true" aria-label="Regole della casa">
            <h3>Regole della casa</h3>
            <p>Tutto spento è UNO ufficiale. Le scelte valgono per tutta la partita.</p>
            <div className="uk-rules">
              {SWITCHES.map(([k, title, desc]) => (
                <button key={k} className="uk-sw" role="switch" aria-checked={draft[k]} onClick={() => setDraft({ ...draft, [k]: !draft[k] })}>
                  <span className="uk-t"><b>{title}</b><small>{desc}</small></span><span className="uk-k" />
                </button>
              ))}
              <div className="uk-rl">Si gioca fino a</div>
              <div className="uk-seg">
                {MODES.map(([k, label]) => <button key={k} aria-pressed={draft.mode === k} onClick={() => setDraft({ ...draft, mode: k })}>{label}</button>)}
              </div>
              <p className="uk-mnote">{MODES.find((m) => m[0] === draft.mode)![2]}</p>
            </div>
            {started && <p>Ricominciare azzera i punti e le carte.</p>}
            <div className="uk-btns">
              <button className="uk-btn" onClick={() => startMatch(draft)}>{started ? 'Ricomincia con queste regole' : 'Inizia la partita'}</button>
              {started && <button className="uk-btn uk-alt" onClick={() => setRulesOpen(false)}>Torna alla partita</button>}
            </div>
          </div>
        )}

        {over && !rulesOpen && (
          <div className="uk-ov" role="dialog" aria-modal="true" aria-label="Fine mano">
            <h3>{game.matchOver ? `${NAMES[w]} vince la partita` : `${NAMES[w]} vince la mano`}</h3>
            <p>
              {mercyEnd ? `${NAMES[1 - w]} è arrivato a ${MERCY_LIMIT} carte e perde la mano.`
                : game.rules.mode === 'pts' ? <>{NAMES[w]} prende <b>{game.points}</b> punti dalle carte rimaste in mano a {NAMES[1 - w]}.</>
                : game.rules.mode === 'single' ? `${NAMES[1 - w]} aveva ancora ${game.hands[1 - w].length} carte in mano.`
                : `Mani vinte: ${a} a ${b} (si arriva a ${GOAL[game.rules.mode]}).`}
            </p>
            {game.rules.mode !== 'single' && <div className="uk-res"><div>{a}<small>{NAMES[0]}</small></div><div>{b}<small>{NAMES[1]}</small></div></div>}
            <div className="uk-btns">
              {game.matchOver
                ? online ? <button className="uk-btn" onClick={onRematch}>Rivincita</button> : <><button className="uk-btn" onClick={() => startMatch(game.rules)}>Altra partita</button><button className="uk-btn uk-alt" onClick={openRules}>Cambia regole</button></>
                : (!online || me === 0) ? <button className="uk-btn" onClick={() => act({ type: 'nextRound' })}>Prossima mano</button> : <p>Attendi che {NAMES[0]} avvii la prossima mano.</p>}
              <button className="uk-btn uk-alt" onClick={onBack}>Esci</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
