import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import './briscola.css'
import { apply, buildDeck, cardName, newGame, score, shuffle, trickWinner, winner } from './engine.ts'
import type { Card, GameState, Suit } from './engine.ts'
import napoletaneBack from '../../assets/cards/backs/napoletane-back.svg'
import trevigianeBack from '../../assets/cards/backs/trevigiane-back.svg'

// Tavolo di Briscola (Fase 1: locale, 2 giocatori sullo stesso schermo con schermata "copri").
// Le regole vivono tutte in engine.ts; qui c'è solo interfaccia e animazioni.
// I punti NON si mostrano mai durante la partita: si contano a mente. Compaiono solo a fine partita.

const NAMES = ['Tomas', 'Lei']
export type DeckStyle = 'napoletane' | 'trevigiane'
const NAPOLETANE = import.meta.glob<string>('../../assets/cards/napoletane/*.jpg', { eager: true, query: '?url', import: 'default' })
const TREVIGIANE = import.meta.glob<string>('../../assets/cards/trevigiane/*.jpg', { eager: true, query: '?url', import: 'default' })
const BACKS: Record<DeckStyle, string> = { napoletane: napoletaneBack, trevigiane: trevigianeBack }
const imgOf = (c: Card, deck: DeckStyle) => (deck === 'napoletane' ? NAPOLETANE : TREVIGIANE)[`../../assets/cards/${deck}/${c.s}-${String(c.r).padStart(2, '0')}.jpg`]

const ICON: Record<Suit, React.ReactNode> = {
  denari: <><circle cx="12" cy="12" r="9" fill="none" strokeWidth="2.4" /><circle cx="12" cy="12" r="3.6" stroke="none" /></>,
  coppe: <path stroke="none" d="M5 3.5h14c0 5.4-2.6 8.2-6 8.8V18h4.2v2.5H6.8V18H11v-5.7C7.6 11.7 5 8.9 5 3.5z" />,
  spade: <path stroke="none" d="M12 1.5l2.3 3.6V14h-4.6V5.1zM5.5 14h13v2.6h-13zM10.8 16.6h2.4v5.2h-2.4z" />,
  bastoni: <><path fill="none" strokeWidth="5.2" strokeLinecap="round" d="M6 18L18 6" /><circle cx="18.2" cy="5.8" r="2.4" stroke="none" /></>,
}

const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches

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

const deal = (): GameState => newGame({ names: NAMES, first: Math.random() < 0.5 ? 0 : 1 }, shuffle(buildDeck()))

function Face({ card, deck, cls = '' }: { card: Card; deck: DeckStyle; cls?: string }) {
  return <span className={`bk-cd ${cls}`}><img src={imgOf(card, deck)} alt={cardName(card)} /></span>
}
const Back = ({ deck }: { deck: DeckStyle }) => <span className="bk-cd"><img src={BACKS[deck]} alt="" /></span>

// Mucchietto delle carte prese: solo carte, nessuna scritta.
function Pile({ n, deck, mine = false }: { n: number; deck: DeckStyle; mine?: boolean }) {
  return (
    <div className="bk-pile" data-pile={mine ? 'mine' : 'opp'}>
      <span className="bk-stk">
        {n > 0 ? <><Back deck={deck} />{n > 1 && <Back deck={deck} />}<Back deck={deck} /></> : <span className="bk-nul" />}
      </span>
    </div>
  )
}

type OnlineGame = { userId: string; hostId: string; state: GameState; onState: (state: GameState) => void }

export default function BriscolaTable({ onBack, deck, onDeckChange, online }: { onBack: () => void; deck: DeckStyle; onDeckChange: (deck: DeckStyle) => void; online?: OnlineGame }) {
  const wide = useWide()
  const [localGame, setLocalGame] = useState<GameState>(deal)
  const game = online?.state ?? localGame
  const onlinePlayer = online ? (online.userId === online.hostId ? 0 : 1) : null
  const [viewer, setViewer] = useState(onlinePlayer ?? game.turn) // chi sta guardando lo schermo
  const [cover, setCover] = useState<number | null>(online ? null : game.turn) // a chi passare il telefono (null = nessuno)
  const [busy, setBusy] = useState(false)                // presa completa in attesa di essere raccolta
  const [taker, setTaker] = useState<number | null>(null)
  const [freshId, setFreshId] = useState<number | null>(null)
  const [askExit, setAskExit] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const drawn = useRef<number[] | null>(null)           // chi ha appena pescato, per l'animazione
  const timers = useRef<number[]>([])
  const later = (fn: () => void, ms: number) => { timers.current.push(window.setTimeout(fn, ms)) }
  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  const saveGame = (state: GameState) => {
    if (online) online.onState(state)
    else setLocalGame(state)
  }
  const me = onlinePlayer ?? viewer
  const op = 1 - me
  const trump = game.trump.s
  const over = game.phase === 'over'
  const canPlay = !busy && !over && cover === null && game.turn === me && game.table.length < 2

  // Le due carte della presa volano sul mucchietto di chi ha preso, poi si raccoglie.
  function fly(w: number, done: () => void) {
    const els = [...(root.current?.querySelectorAll<HTMLElement>('[data-tz] .bk-cd') ?? [])]
    const dest = root.current?.querySelector<HTMLElement>(`[data-pile="${w === me ? 'mine' : 'opp'}"] .bk-stk`)
    if (reducedMotion() || !els.length || !dest) { done(); return }
    const t = dest.getBoundingClientRect()
    for (const el of els) {
      const r = el.getBoundingClientRect()
      if (el.parentElement) el.parentElement.style.zIndex = '5'
      el.animate(
        [{ transform: 'none' }, { transform: `translate(${t.left + t.width / 2 - r.left - r.width / 2}px,${t.top + t.height / 2 - r.top - r.height / 2}px) scale(${t.width / r.width})` }],
        { duration: 480, easing: 'cubic-bezier(.5,0,.8,.4)', fill: 'forwards' },
      )
    }
    later(done, 500)
  }

  // Le carte pescate scivolano dal mazzo alla mano (solo quando nessuna schermata copri nasconde il tavolo).
  useLayoutEffect(() => {
    const list = drawn.current
    if (!list || cover !== null || !root.current) return
    drawn.current = null
    if (reducedMotion()) return
    const from = root.current.querySelector<HTMLElement>('[data-dz]')?.getBoundingClientRect()
    const hand = [...root.current.querySelectorAll<HTMLElement>('[data-hand] .bk-cd')]
    const opp = [...root.current.querySelectorAll<HTMLElement>('[data-oh] .bk-cd')]
    if (!from) return
    list.forEach((p, k) => {
      const el = p === me ? hand.at(-1) : opp.at(-1)
      if (!el) return
      const r = el.getBoundingClientRect()
      el.animate(
        [{ transform: `translate(${from.left + from.width * 0.2 - r.left}px,${from.top + from.height / 2 - r.top - r.height / 2}px) scale(.7)`, opacity: 0.3 }, { transform: 'none', opacity: 1 }],
        { duration: 480, delay: k * 220, easing: 'ease-out', fill: 'backwards' },
      )
    })
  }, [game, cover, me])

  function play(i: number) {
    if (!canPlay) return
    const card = game.hands[me][i]
    const r = apply(game, { type: 'play', card: card.id })
    if ('error' in r) { console.error('Briscola:', r.error); return }
    const s = r.state
    saveGame(s)
    setFreshId(card.id)
    later(() => setFreshId(null), 400)
    if (s.table.length === 1) { if (!online) setCover(s.turn); return } // in locale si passa il telefono
    const w = trickWinner(s.table, s.trump.s)
    setBusy(true)
    setTaker(w)
    later(() => fly(w, () => {
      const c = apply(s, { type: 'collect' })
      if ('error' in c) { console.error('Briscola:', c.error); return }
      const l = 1 - w
      drawn.current = [w, l].filter((p) => c.state.hands[p].length > s.hands[p].length) // pesca prima chi ha preso
      saveGame(c.state)
      setBusy(false)
      setTaker(null)
      if (!online && c.state.phase === 'playing' && c.state.turn !== me) setCover(c.state.turn)
    }), 1100)
  }

  function again() {
    timers.current.forEach(clearTimeout)
    const g = deal()
    drawn.current = null
    saveGame(g); setViewer(g.turn); setCover(online ? null : g.turn); setBusy(false); setTaker(null); setFreshId(null)
  }

  function leave() {
    if (askExit || over) { onBack(); return }
    setAskExit(true)
    later(() => setAskExit(false), 3000)
  }

  const n = game.deck.length
  const slotCard = (p: number) => game.table.find((t) => t.p === p)?.card
  const slot = (p: number, cls: string) => {
    const c = slotCard(p)
    const fresh = c && c.id === freshId ? ` bk-land${p === me ? '' : ' bk-top'}` : ''
    const win = busy && taker === p ? ' bk-win' : ''
    return <span className={`bk-slot bk-${cls}`}>{c && <Face card={c} deck={deck} cls={win + fresh} />}</span>
  }
  const nOp = cover !== null ? 3 : game.hands[op].length
  const sc = [score(game, 0), score(game, 1)]
  const win = winner(game)

  return (
    <div className="bk-screen">
      <div ref={root} className={`bk${wide ? ' bk-wide' : ''}`}>
        <div className="bk-hud">
          <div className={`bk-av${me === 1 ? ' bk-lei' : ''}`}>{game.names[me][0]}</div>
          <div className="bk-who"><b>{game.names[me]}</b><span>{over ? 'Partita finita' : game.turn === me ? 'Tocca a te' : `Tocca a ${game.names[op]}`}</span></div>
          <span className="bk-sp" />
          <select className="bk-pill bk-deck" aria-label="Stile del mazzo" value={deck} onChange={(event) => onDeckChange(event.target.value as DeckStyle)}>
            <option value="napoletane">Napoletane</option><option value="trevigiane">Trevigiane</option>
          </select>
          <span className="bk-pill">Mazzo {n}</span>
          <button className={`bk-pill bk-btnp bk-exit${askExit ? ' warn' : ''}`} onClick={leave}>{askExit ? 'Esci dalla partita?' : '‹ Esci'}</button>
        </div>

        <div className="bk-felt">
          <div className="bk-band">
            <div className="bk-oh" data-oh>{Array.from({ length: nOp }, (_, i) => <Back key={i} deck={deck} />)}</div>
            <Pile n={game.piles[op].length} deck={deck} />
          </div>
          <div className="bk-mid">
            <div className="bk-dcol">
              <div className="bk-dz" data-dz>
                {n > 0
                  ? <span className="bk-tr"><Face card={game.trump} deck={deck} /></span>
                  : <span className="bk-vuoto"><svg viewBox="0 0 24 24" aria-label={`Briscola: ${trump}`} fill="currentColor" stroke="currentColor">{ICON[trump]}</svg></span>}
                {n > 1 && <span className="bk-dk"><Back deck={deck} /><Back deck={deck} /><Back deck={deck} /><span className="bk-cnt"><b>{n}</b></span></span>}
              </div>
            </div>
            <div className="bk-tcol">
              <div className="bk-tz" data-tz>{slot(op, 'o')}{slot(me, 'm')}</div>
            </div>
          </div>
        </div>

        <div className="bk-dock">
          <div className="bk-hand" data-hand role="group" aria-label="La tua mano">
            {cover === null && game.hands[me].map((c, i) => (
              <button key={c.id} className={`bk-cd${canPlay ? ' bk-can' : ''}`} disabled={!canPlay} onClick={() => play(i)} aria-label={`${cardName(c)}${c.s === trump ? ' (briscola)' : ''}`}>
                <img src={imgOf(c, deck)} alt="" />
              </button>
            ))}
          </div>
          <Pile n={game.piles[me].length} deck={deck} mine />
        </div>

        {cover !== null && (
          <div className="bk-ov" role="dialog" aria-modal="true" aria-label="Passa il telefono">
            <div className={`bk-av bk-big${cover === 1 ? ' bk-lei' : ''}`}>{game.names[cover][0]}</div>
            <h3>Passa il telefono a {game.names[cover]}</h3>
            <p>Le carte restano coperte finché {game.names[cover]} non tocca il pulsante.</p>
            <button className="bk-btn" onClick={() => { setViewer(cover); setCover(null) }}>Sono {game.names[cover]}</button>
          </div>
        )}

        {over && (
          <div className="bk-ov" role="dialog" aria-modal="true" aria-label="Fine partita">
            <h3>{win === -1 ? 'Pareggio, 60 a 60' : `Vince ${game.names[win ?? 0]}`}</h3>
            <div className="bk-res"><div>{sc[0]}<small>{game.names[0]}</small></div><div>{sc[1]}<small>{game.names[1]}</small></div></div>
            <p>{win === -1 ? 'Servivano più di 60 punti su 120 per vincere.' : 'Servono più di 60 punti su 120 per vincere.'}</p>
            <button className="bk-btn" onClick={again}>Altra partita</button>
            <button className="bk-btn bk-ghost" onClick={onBack}>Esci</button>
          </div>
        )}
      </div>
    </div>
  )
}
