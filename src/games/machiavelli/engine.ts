// Motore di Machiavelli: funzioni pure, nessun import, nessun DOM.
// Lo stato è JSON semplice (niente Set/Map) così in Fase 2 si può salvare e sincronizzare su Supabase.
// Selezione, ordinamento mano e drag NON stanno qui: sono stato dell'interfaccia.

export type Suit = 'h' | 'd' | 'c' | 's' | 'j'
// r: 1 = asso ... 13 = re; il jolly ha r = 0
export interface Card { id: number; s: Suit; r: number }
export interface Group { id: number; cards: Card[] }
interface Snapshot { table: Group[]; hand: Card[] }

export interface GameState {
  deck: Card[]           // si pesca dalla fine
  table: Group[]
  hands: Card[][]        // una mano per giocatore
  names: string[]
  turn: number           // indice del giocatore di turno
  start: Snapshot        // tavolo e mano del giocatore di turno a inizio turno (per Annulla e per Pesca)
  nextGroupId: number
  passes: number         // passi consecutivi a mazzo vuoto
  phase: 'playing' | 'over'
  winner: number | null  // null a partita chiusa per stallo
}

export type Action =
  | { type: 'move'; ids: number[]; target: number | null } // target = id combinazione, null = nuova combinazione
  | { type: 'undo' }
  | { type: 'draw' }                                       // a mazzo vuoto diventa "passa"
  | { type: 'end' }

export type Result = { state: GameState } | { error: string }

const SYMBOL: Record<string, string> = { h: '♥', d: '♦', c: '♣', s: '♠' }
const RANK: Record<number, string> = { 1: 'A', 11: 'J', 12: 'Q', 13: 'K', 14: 'A' }
const rankName = (r: number) => RANK[r] ?? String(r)
export const shortName = (c: Card) => (c.s === 'j' ? 'Jolly' : rankName(c.r) + SYMBOL[c.s])

export const HAND_SIZE = 13
const SUIT_ORDER: Record<Suit, number> = { h: 0, d: 1, c: 2, s: 3, j: 4 }

// ── Validazione di una combinazione ──
export type Analysis =
  | { ok: true; kind: 'set' | 'run'; start: number; hi: boolean }
  | { ok: false; why: string }

// Tris/poker: stesso valore, semi diversi, max 4 carte.
// Scala: stesso seme, valori consecutivi, asso alto o basso, MAI circolare (K-A-2 no).
export function analyze(cards: Card[]): Analysis {
  if (cards.length < 3) return { ok: false, why: 'servono almeno 3 carte' }
  const nj = cards.filter((c) => c.s !== 'j')
  if (!nj.length) return { ok: false, why: 'ci sono solo jolly' }

  let setWhy = ''
  if (nj.every((c) => c.r === nj[0].r)) {
    if (new Set(nj.map((c) => c.s)).size !== nj.length) return { ok: false, why: 'due carte con lo stesso seme' }
    if (cards.length <= 4) return { ok: true, kind: 'set', start: nj[0].r, hi: false }
    setWhy = 'un tris o poker ha al massimo 4 carte'
    // con una sola carta vera + jolly potrebbe essere una scala: si prosegue
    if (nj.length > 1) return { ok: false, why: setWhy }
  }

  if (!nj.every((c) => c.s === nj[0].s)) return { ok: false, why: 'valori e semi diversi, non è né un tris né una scala' }
  const L = cards.length
  if (L > 13) return { ok: false, why: 'una scala ha al massimo 13 carte' }
  for (const hi of [false, true]) {
    const ranks = nj.map((c) => (c.r === 1 && hi ? 14 : c.r))
    if (new Set(ranks).size !== ranks.length) continue
    const mn = Math.min(...ranks)
    const mx = Math.max(...ranks)
    const lo = Math.max(1, mx - L + 1)
    const up = Math.min(mn, 15 - L)
    if (lo <= up) return { ok: true, kind: 'run', start: lo, hi }
  }
  return { ok: false, why: setWhy || 'i valori non sono consecutivi' }
}

// Mette le carte nell'ordine "giusto" (scala dal basso all'alto con i jolly nei buchi, tris per seme).
export function ordered(cards: Card[]): Card[] {
  const a = analyze(cards)
  if (!a.ok) return cards.slice()
  if (a.kind === 'set') return cards.slice().sort((x, y) => SUIT_ORDER[x.s] - SUIT_ORDER[y.s])
  const pos = new Map<number, Card>()
  for (const c of cards) if (c.s !== 'j') pos.set(c.r === 1 && a.hi ? 14 : c.r, c)
  const jokers = cards.filter((c) => c.s === 'j')
  return Array.from({ length: cards.length }, (_, i) => pos.get(a.start + i) ?? jokers.shift()!)
}

// Etichetta leggibile (per aria-label), es. "Tris di 7" o "Scala di cuori 4-7".
const SUIT_NAME: Record<string, string> = { h: 'cuori', d: 'quadri', c: 'fiori', s: 'picche' }
export function describe(cards: Card[]): string {
  const a = analyze(cards)
  if (!a.ok) return 'Combinazione non valida'
  if (a.kind === 'set') return (cards.length === 4 ? 'Poker' : 'Tris') + ' di ' + rankName(a.start)
  const suit = cards.find((c) => c.s !== 'j')!.s
  return `Scala di ${SUIT_NAME[suit]} ${rankName(a.start)}-${rankName(a.start + cards.length - 1)}`
}

// ── Mazzo e partita ──
// Gli id sono univoci su entrambi i mazzi e fissati qui, perché la Fase 2 salva lo stato.
export function buildDeck(jokers: boolean): Card[] {
  const deck: Card[] = []
  let id = 0
  for (let copy = 0; copy < 2; copy++) {
    for (const s of ['h', 'd', 'c', 's'] as const) {
      for (let r = 1; r <= 13; r++) deck.push({ id: ++id, s, r })
    }
    if (jokers) {
      deck.push({ id: ++id, s: 'j', r: 0 })
      deck.push({ id: ++id, s: 'j', r: 0 })
    }
  }
  return deck
}

// Il mescolamento sta FUORI dal motore reale (si passa il mazzo già mescolato) così i test sono deterministici.
export function shuffle(cards: Card[], rng: () => number = Math.random): Card[] {
  const a = cards.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function newGame(opts: { names: string[]; first?: number }, shuffledDeck: Card[]): GameState {
  const n = opts.names.length
  if (n < 2) throw new Error('servono almeno 2 giocatori')
  const deck = shuffledDeck.slice()
  if (deck.length < n * HAND_SIZE) throw new Error('mazzo troppo piccolo')
  const hands: Card[][] = Array.from({ length: n }, () => [])
  for (let i = 0; i < HAND_SIZE; i++) for (let p = 0; p < n; p++) hands[p].push(deck.pop()!)
  const turn = opts.first ?? 0
  return {
    deck, table: [], hands, names: opts.names.slice(), turn,
    start: { table: [], hand: hands[turn].slice() },
    nextGroupId: 1, passes: 0, phase: 'playing', winner: null,
  }
}

export const playedCount = (s: GameState) => s.start.hand.length - s.hands[s.turn].length

const nextTurn = (s: GameState): GameState => {
  const turn = (s.turn + 1) % s.hands.length
  return { ...s, turn, start: { table: s.table, hand: s.hands[turn].slice() } }
}

// Riporta tavolo e mano di chi gioca a come erano a inizio turno.
const revert = (s: GameState): GameState => {
  const hands = s.hands.slice()
  hands[s.turn] = s.start.hand.slice()
  return { ...s, table: s.start.table, hands }
}

export function apply(s: GameState, a: Action): Result {
  if (s.phase === 'over') return { error: 'La partita è finita.' }

  if (a.type === 'undo') return { state: revert(s) }

  if (a.type === 'end') {
    if (playedCount(s) === 0) return { error: 'Prima posa almeno una carta dalla mano (o pesca).' }
    return { state: nextTurn({ ...s, passes: 0 }) }
  }

  if (a.type === 'draw') {
    if (playedCount(s) > 0) return { error: 'Hai già posato: chiudi il turno.' }
    // pescare o passare azzera i riordini fatti sul tavolo: senza carte posate non contano
    const base = revert(s)
    if (base.deck.length) {
      const deck = base.deck.slice()
      const card = deck.pop()!
      const hands = base.hands.slice()
      hands[base.turn] = [...hands[base.turn], card]
      return { state: nextTurn({ ...base, deck, hands, passes: 0 }) }
    }
    // mazzo vuoto: si passa; due passi di fila chiudono la partita
    const passes = base.passes + 1
    if (passes >= 2) return { state: { ...base, passes, phase: 'over', winner: null } }
    return { state: nextTurn({ ...base, passes }) }
  }

  // ── move ──
  const ids = new Set(a.ids)
  if (!ids.size) return { error: 'Scegli almeno una carta.' }
  const hand = s.hands[s.turn]
  const moved: Card[] = []
  for (const c of hand) if (ids.has(c.id)) moved.push(c)
  for (const g of s.table) for (const c of g.cards) if (ids.has(c.id)) moved.push(c)
  if (moved.length !== ids.size) return { error: 'Carta non trovata.' }

  const target = a.target == null ? undefined : s.table.find((g) => g.id === a.target)
  if (a.target != null && !target) return { error: 'Combinazione non trovata.' }
  if (target && moved.every((c) => target.cards.some((x) => x.id === c.id))) return { error: 'Queste carte sono già lì.' }

  let nextId = s.nextGroupId
  const draft = s.table.map((g) => ({ id: g.id, cards: g.cards.filter((c) => !ids.has(c.id)) }))
  let into: { id: number; cards: Card[] }
  if (target) {
    into = draft.find((g) => g.id === target.id)!
    into.cards = into.cards.concat(moved)
  } else {
    into = { id: nextId++, cards: moved.slice() }
    draft.push(into)
  }

  // Il tavolo è SEMPRE valido: se una qualsiasi combinazione resta rotta, la mossa è bloccata.
  for (const g of draft) {
    if (!g.cards.length) continue
    const res = analyze(g.cards)
    if (res.ok) continue
    return {
      error: g === into
        ? `Non è una combinazione valida: ${res.why}.`
        : `Così ${g.cards.map(shortName).join(' ')} resterebbero in ${g.cards.length} carte.`,
    }
  }

  const hands = s.hands.slice()
  hands[s.turn] = hand.filter((c) => !ids.has(c.id))
  const table = draft.filter((g) => g.cards.length).map((g) => ({ id: g.id, cards: ordered(g.cards) }))
  const won = hands[s.turn].length === 0
  return {
    state: { ...s, table, hands, nextGroupId: nextId, phase: won ? 'over' : 'playing', winner: won ? s.turn : null },
  }
}
