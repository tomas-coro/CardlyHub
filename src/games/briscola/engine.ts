// Motore della Briscola a 2: funzioni pure, nessun import, nessun DOM.
// Lo stato è JSON semplice (niente Set/Map) così in Fase 2 si può salvare e sincronizzare su Supabase.
// Il mescolamento sta FUORI dal motore (shuffle riceve l'rng): il motore non decide mai a caso.

export type Suit = 'denari' | 'coppe' | 'spade' | 'bastoni'
// r: 1 = Asso, 2..7 = numeri, 8 = Fante, 9 = Cavallo, 10 = Re (come i file seme-NN.jpg)
export interface Card { id: number; s: Suit; r: number }
export interface Played { p: number; card: Card }

export interface GameState {
  deck: Card[]            // si pesca dalla FINE; la briscola scoperta è deck[0], quindi si pesca per ultima
  trump: Card
  hands: Card[][]         // una mano per giocatore (3 carte)
  piles: Card[][]         // carte prese da ciascun giocatore
  table: Played[]         // la presa in corso: 0, 1 o 2 carte; table[0] è chi ha aperto
  names: string[]
  turn: number            // chi deve giocare ora; a presa completa è chi ha aperto (si decide in 'collect')
  phase: 'playing' | 'over'
}

export type Action =
  | { type: 'play'; card: number }  // id della carta, dalla mano del giocatore di turno
  | { type: 'collect' }             // a presa completa: la assegna, pesca, passa il turno

export type Result = { state: GameState } | { error: string }

export const SUITS: Suit[] = ['denari', 'coppe', 'spade', 'bastoni']
export const NAMES: Record<number, string> = { 1: 'Asso', 2: 'Due', 3: 'Tre', 4: 'Quattro', 5: 'Cinque', 6: 'Sei', 7: 'Sette', 8: 'Fante', 9: 'Cavallo', 10: 'Re' }
export const cardName = (c: Card) => `${NAMES[c.r]} di ${c.s}`

export const HAND_SIZE = 3
export const TOTAL_POINTS = 120

// Punti: Asso 11, Tre 10, Re 4, Cavallo 3, Fante 2, tutto il resto 0.
const POINTS: Record<number, number> = { 1: 11, 3: 10, 10: 4, 9: 3, 8: 2 }
export const points = (c: Card) => POINTS[c.r] ?? 0

// Forza a parità di seme: Asso, Tre, Re, Cavallo, Fante, 7, 6, 5, 4, 2.
const STRENGTH: Record<number, number> = { 1: 10, 3: 9, 10: 8, 9: 7, 8: 6, 7: 5, 6: 4, 5: 3, 4: 2, 2: 1 }
export const strength = (c: Card) => STRENGTH[c.r]

export function buildDeck(): Card[] {
  const deck: Card[] = []
  for (const s of SUITS) for (let r = 1; r <= 10; r++) deck.push({ id: deck.length + 1, s, r })
  return deck
}

// Fisher-Yates. L'rng si passa da fuori (Math.random nell'app, uno finto nei test).
export function shuffle(cards: Card[], rng: () => number = Math.random): Card[] {
  const a = cards.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// Distribuisce 3 carte a testa (una alla volta, comincia chi apre), scopre la briscola e la mette sotto il mazzo.
export function newGame(opts: { names: string[]; first?: number }, shuffledDeck: Card[]): GameState {
  const first = opts.first ?? 0
  const deck = shuffledDeck.slice()
  const hands: Card[][] = [[], []]
  for (let i = 0; i < HAND_SIZE; i++) {
    hands[first].push(deck.pop()!)
    hands[1 - first].push(deck.pop()!)
  }
  const trump = deck.pop()!
  deck.unshift(trump)
  return { deck, trump, hands, piles: [[], []], table: [], names: opts.names, turn: first, phase: 'playing' }
}

// Chi vince la presa: chi risponde batte solo con carta più alta dello stesso seme o con una briscola su una non-briscola.
// Se non batte, vince chi ha aperto. Non c'è obbligo di rispondere al seme.
export function trickWinner(table: Played[], trumpSuit: Suit): number {
  const [a, b] = table
  if (b.card.s === a.card.s) return strength(b.card) > strength(a.card) ? b.p : a.p
  return b.card.s === trumpSuit ? b.p : a.p
}

export const score = (s: GameState, p: number) => s.piles[p].reduce((sum, c) => sum + points(c), 0)

// null finché la partita non è finita; -1 = pareggio 60 a 60
export function winner(s: GameState): number | null {
  if (s.phase !== 'over') return null
  const [a, b] = [score(s, 0), score(s, 1)]
  return a === b ? -1 : a > b ? 0 : 1
}

export function apply(s: GameState, a: Action): Result {
  if (s.phase === 'over') return { error: 'la partita è finita' }

  if (a.type === 'play') {
    if (s.table.length >= 2) return { error: 'la presa è completa, va raccolta' }
    const hand = s.hands[s.turn]
    const i = hand.findIndex((c) => c.id === a.card)
    if (i < 0) return { error: 'quella carta non è nella mano di chi gioca' }
    const card = hand[i]
    const hands = s.hands.map((h, p) => (p === s.turn ? h.filter((_, k) => k !== i) : h))
    const table = [...s.table, { p: s.turn, card }]
    // dopo la prima carta tocca all'altro; dopo la seconda il turno resta a chi ha giocato e si aspetta 'collect'
    return { state: { ...s, hands, table, turn: table.length === 1 ? 1 - s.turn : s.turn } }
  }

  if (s.table.length < 2) return { error: 'la presa non è ancora completa' }
  const w = trickWinner(s.table, s.trump.s)
  const l = 1 - w
  const piles = s.piles.map((p, k) => (k === w ? [...p, ...s.table.map((t) => t.card)] : p))
  // pesca prima chi ha preso, poi l'altro; l'ultima carta del mazzo è la briscola scoperta
  const deck = s.deck.slice()
  const hands = s.hands.map((h) => h.slice())
  for (const p of [w, l]) if (deck.length) hands[p].push(deck.pop()!)
  const over = hands[0].length === 0 && hands[1].length === 0
  return { state: { ...s, deck, hands, piles, table: [], turn: w, phase: over ? 'over' : 'playing' } }
}
