// Motore del Burraco a 2: funzioni pure, nessun import, nessun DOM.
// Lo stato è JSON semplice (niente Set/Map) così in Fase 2 si può salvare e sincronizzare su Supabase.
// Il caso sta FUORI dal motore: newGame riceve il mazzo già mescolato e apply riceve la funzione `shuffle`
// (serve solo a nextRound). Il motore non decide mai a caso.
// Il motore non muta mai lo stato che riceve: apply lavora su una copia e la restituisce.
// Selezione, ordinamento della mano e drag NON stanno qui: sono stato dell'interfaccia.
//
// Regole: Burraco italiano FITAB (Codice di gara 2017), 108 carte, 2 giocatori. Vedi la memoria di progetto
// "cardlyhub-burraco-piano" per le decisioni (blocchi 1-3 di grill-me).

export type Suit = 'h' | 'd' | 'c' | 's' | 'j'
// r: 1 = asso ... 13 = re; il jolly ha s = 'j' e r = 0. I due (r = 2) sono le "pinelle": matte, ma anche carte naturali.
export interface Card { id: number; s: Suit; r: number }

export type Mode = 'hand' | '1005' | '2005'
// Regole della casa: tutte spente = Burraco FITAB. Fisse per tutta la partita.
export interface Rules {
  special: boolean  // burraci con bonus extra: reale 300, super 250, semipulito 150 (di base: pulito 200, sporco 100)
  block: boolean    // pozzo bloccato: con una matta in cima non si può prendere
  open50: boolean   // prima calata di almeno 50 punti (variante USA)
  mode: Mode        // una mano, a 1005, a 2005
}

// Una combinazione calata. Scala: `suit` e `rank` = valore della prima carta (1..14, 14 = asso alto), `cards` in ordine.
// Gruppo: `suit` = null, `rank` = valore comune. `wild` = indice della matta dentro `cards`, null se non ce n'è.
// Il due naturale al suo posto in una scala NON è una matta (wild = null).
export interface Meld { id: number; kind: 'run' | 'set'; suit: Suit | null; rank: number; cards: Card[]; wild: number | null }

export interface HandScore { melds: number; burraci: number; close: number; hand: number; pot: number; total: number }

export type BurracoEvent =
  | { type: 'draw'; p: number }
  | { type: 'take'; p: number; n: number }       // n = carte del pozzo prese
  | { type: 'meld'; p: number; n: number }       // n = combinazioni nuove
  | { type: 'attach'; p: number; meld: number; n: number }
  | { type: 'discard'; p: number; card: Card }
  | { type: 'pot'; p: number }                   // p ha preso il pozzetto
  | { type: 'close'; p: number }                 // p ha chiuso
  | { type: 'stock' }                            // tallone finito: la mano finisce

export interface GameState {
  deck: Card[]             // tallone, si pesca dalla FINE
  discard: Card[]          // pozzo (scarti); l'ultima è la carta in cima
  pots: Card[][]           // pozzetti ancora da prendere (di nessuno: il primo che finisce prende il primo)
  hands: Card[][]
  melds: Meld[][]          // combinazioni calate, per giocatore
  potTaken: boolean[]
  turn: number
  phase: 'draw' | 'play' | 'over'
  takenCard: number | null // id della carta se hai preso un pozzo da UNA sola carta: quel turno non puoi riscartarla
  finalTurn: boolean       // chi ha pescato il terzultimo del tallone sta giocando l'ultimo turno: dopo il suo scarto la mano finisce, senza +100
  nextMeldId: number
  rules: Rules
  names: string[]
  scores: number[]         // totale partita
  starter: number          // chi ha aperto questa mano; nella successiva apre l'altro
  closer: number | null    // chi ha chiuso (null: la mano è finita per tallone esaurito)
  handScores: HandScore[]  // conteggio dell'ULTIMA mano finita
  matchOver: boolean
  winner: number | null    // a partita finita
  events: BurracoEvent[]   // cosa è successo nell'ULTIMA apply: serve alla grafica
}

export type Action =
  | { type: 'draw' }                                                          // pesca dal tallone (a tallone vuoto la mano finisce)
  | { type: 'take' }                                                          // prendi tutto il pozzo
  | { type: 'meld'; groups: number[][]; end?: End }                           // una o più combinazioni nuove dalla mano
  | { type: 'attach'; meld: number; ids: number[]; end?: End }                // attacca carte a una tua combinazione
  | { type: 'discard'; id: number }
  | { type: 'nextRound' }                                                     // nuova mano, a mano finita e partita non finita

// Dove mettere una matta (o una carta che può stare in testa o in coda) quando la scala lo permette: default 'high'.
export type End = 'high' | 'low'

export type Result = { state: GameState } | { error: string }
export type Shuffle = (cards: Card[]) => Card[]

export const HAND_SIZE = 11
export const POT_SIZE = 11
export const MAX_RUN = 14          // posizioni da 1 (asso basso) a 14 (asso alto)
export const OPEN_MIN = 50
export const DEFAULT_RULES: Rules = { special: false, block: false, open50: false, mode: '1005' }
export const TARGET: Record<Mode, number | null> = { hand: null, '1005': 1005, '2005': 2005 }

const SYMBOL: Record<string, string> = { h: '♥', d: '♦', c: '♣', s: '♠' }
const RANK_NAME: Record<number, string> = { 1: 'A', 11: 'J', 12: 'Q', 13: 'K', 14: 'A' }
export const shortName = (c: Card) => (c.s === 'j' ? 'Jolly' : (RANK_NAME[c.r] ?? String(c.r)) + SYMBOL[c.s])

export const isJoker = (c: Card) => c.s === 'j'
// Matta = jolly o due. Dentro una combinazione dipende dal posto: vedi Meld.wild.
export const isWildCard = (c: Card) => c.s === 'j' || c.r === 2
// Punti di una carta: jolly 30, due 20, asso 15, 8-K 10, 3-7 5.
export const cardPoints = (c: Card) => (c.s === 'j' ? 30 : c.r === 2 ? 20 : c.r === 1 ? 15 : c.r >= 8 ? 10 : 5)
export const sumPoints = (cs: Card[]) => cs.reduce((t, c) => t + cardPoints(c), 0)
export const topCard = (s: GameState) => s.discard[s.discard.length - 1]

// 2 mazzi francesi da 52 + 4 jolly = 108 carte, id 1..108.
export function buildDeck(): Card[] {
  const d: Card[] = []
  for (let k = 0; k < 2; k++) {
    for (const s of ['h', 'd', 'c', 's'] as const) for (let r = 1; r <= 13; r++) d.push({ id: d.length + 1, s, r })
    d.push({ id: d.length + 1, s: 'j', r: 0 })
    d.push({ id: d.length + 1, s: 'j', r: 0 })
  }
  return d
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

// 11 carte a testa, 2 pozzetti da 11, una carta scoperta apre il pozzo, il resto è il tallone.
function deal(base: Pick<GameState, 'rules' | 'names' | 'scores'>, shuffledDeck: Card[], first: number): GameState {
  const deck = shuffledDeck.slice()
  const hands: Card[][] = [[], []]
  for (let i = 0; i < HAND_SIZE; i++) {
    hands[first].push(deck.pop()!)
    hands[1 - first].push(deck.pop()!)
  }
  const pots = [deck.splice(deck.length - POT_SIZE, POT_SIZE), deck.splice(deck.length - POT_SIZE, POT_SIZE)]
  const open = deck.pop()
  if (!open) throw new Error('il mazzo è troppo piccolo')
  return {
    deck, discard: [open], pots, hands, melds: [[], []], potTaken: [false, false], turn: first, phase: 'draw',
    takenCard: null, finalTurn: false, nextMeldId: 1, rules: base.rules, names: base.names, scores: base.scores, starter: first,
    closer: null, handScores: [], matchOver: false, winner: null, events: [],
  }
}

export function newGame(opts: { names: string[]; rules?: Rules; first?: number }, shuffledDeck: Card[]): GameState {
  return deal({ rules: opts.rules ?? DEFAULT_RULES, names: opts.names, scores: [0, 0] }, shuffledDeck, opts.first ?? 0)
}

// ───────────── Analisi delle combinazioni ─────────────

export type Analysis = { ok: true; meld: Omit<Meld, 'id'> } | { ok: false; why: string }
const no = (why: string): Analysis => ({ ok: false, why })

// Scala: stesso seme, valori consecutivi, asso basso o alto (mai circolare), al massimo una matta (jolly o due di
// un altro seme, oppure il due del seme usato come matta se serve a coprire un buco). Il due del seme al suo
// posto (tra l'asso e il tre) è naturale.
function arrangeRun(cards: Card[], prefer: End): Analysis {
  if (cards.length < 3) return no('servono almeno 3 carte')
  if (cards.length > MAX_RUN) return no('una scala ha al massimo 14 carte')
  const suits = [...new Set(cards.filter((c) => !isJoker(c)).map((c) => c.s))]
  if (!suits.length) return no('ci sono solo jolly')
  for (const S of suits) {
    const foreign = cards.filter((c) => c.s !== S)
    if (foreign.length > 1 || foreign.some((c) => !isJoker(c) && c.r !== 2)) continue
    const twos = cards.filter((c) => c.s === S && c.r === 2)
    // Chi è la matta: quella estranea se c'è, altrimenti prima nessuna (il due è naturale) e poi il due del seme usato come matta.
    const options: (Card | null)[] = foreign.length ? [foreign[0]] : [null, ...(twos.length ? [twos[0]] : [])]
    for (const wild of options) {
      const nat = wild ? cards.filter((c) => c !== wild) : cards
      for (const rk of rankings(nat)) {
        const sorted = rk.slice().sort((x, y) => x - y)
        if (new Set(sorted).size !== sorted.length) continue
        const lo = sorted[0], hi = sorted[sorted.length - 1]
        const gaps = hi - lo + 1 - sorted.length
        let low = lo, hole: number | null = null
        if (!wild) { if (gaps !== 0) continue }
        else if (gaps === 1) hole = sorted.find((r, k) => k > 0 && r - sorted[k - 1] === 2)! - 1
        else if (gaps === 0) {
          const lowOk = lo > 1, highOk = hi < MAX_RUN
          if (!lowOk && !highOk) continue
          if (prefer === 'high' ? highOk : !lowOk) hole = hi + 1
          else { hole = lo - 1; low = lo - 1 }
        } else continue
        // sequenza posizione per posizione, con la matta nel posto `hole`
        const at = new Map<number, Card>()
        nat.forEach((c, k) => at.set(rk[k], c))
        if (wild && hole !== null) at.set(hole, wild)
        const ordered: Card[] = []
        for (let r = low; r < low + cards.length; r++) { const c = at.get(r); if (c) ordered.push(c) }
        if (ordered.length !== cards.length) continue
        return { ok: true, meld: { kind: 'run', suit: S, rank: low, cards: ordered, wild: wild ? ordered.indexOf(wild) : null } }
      }
    }
  }
  return no('non è una scala valida')
}

// Valori possibili delle carte naturali in una scala: l'asso vale 1 (basso) o 14 (alto); con due assi uno per parte.
function rankings(nat: Card[]): number[][] {
  const aces = nat.filter((c) => c.r === 1).length
  if (aces > 2) return []
  if (aces === 0) return [nat.map((c) => c.r)]
  if (aces === 1) return [nat.map((c) => c.r), nat.map((c) => (c.r === 1 ? 14 : c.r))]
  const first = nat.findIndex((c) => c.r === 1)
  return [nat.map((c, k) => (c.r === 1 ? (k === first ? 1 : 14) : c.r))]
}

// Gruppo: stesso valore, semi anche uguali, al massimo una matta (jolly o due). Non esistono gruppi di soli due.
function arrangeSet(cards: Card[]): Analysis {
  if (cards.length < 3) return no('servono almeno 3 carte')
  // niente gruppi di soli due (e matte): il valore del gruppo non può essere 2
  const ranks = [...new Set(cards.filter((c) => !isJoker(c) && c.r !== 2).map((c) => c.r))]
  for (const r of ranks) {
    const nat = cards.filter((c) => !isJoker(c) && c.r === r)
    const wl = cards.filter((c) => isJoker(c) || c.r !== r)
    if (wl.length > 1 || wl.some((c) => !isJoker(c) && c.r !== 2) || nat.length < 2) continue
    return { ok: true, meld: { kind: 'set', suit: null, rank: r, cards: [...nat, ...wl], wild: wl.length ? nat.length : null } }
  }
  return no('non è un gruppo valido')
}

// Una combinazione qualsiasi (prima scala, poi gruppo). Per l'interfaccia: serve a capire cosa si sta per calare.
export function analyze(cards: Card[], end: End = 'high'): Analysis {
  const run = arrangeRun(cards, end)
  if (run.ok) return run
  const set = arrangeSet(cards)
  if (set.ok) return set
  if (cards.length < 3) return no('servono almeno 3 carte')
  return no('non è né una scala né un gruppo valido')
}

// ───────────── Burraci e punti ─────────────

export type BurracoKind = 'reale' | 'super' | 'pulito' | 'semi' | 'sporco'
// Burraco = combinazione da 7 carte o più. Pulito 200 (nessuna matta), sporco 100; con `special`: reale 300 (scala da
// 13 carte senza matte), super 250 (gruppo da 8+ senza matte), semipulito 150 (scala da 8+ carte: 7 naturali di fila più
// una matta in testa o in coda; definizione di pagat.com, in FITAB non c'è).
export function burraco(m: Meld, rules: Rules): { kind: BurracoKind; pts: number } | null {
  const n = m.cards.length
  if (n < 7) return null
  if (m.wild === null) {
    if (rules.special && m.kind === 'run' && n >= 13) return { kind: 'reale', pts: 300 }
    if (rules.special && m.kind === 'set' && n >= 8) return { kind: 'super', pts: 250 }
    return { kind: 'pulito', pts: 200 }
  }
  if (rules.special && m.kind === 'run' && n >= 8 && (m.wild === 0 || m.wild === n - 1)) return { kind: 'semi', pts: 150 }
  return { kind: 'sporco', pts: 100 }
}

export const hasBurraco = (s: GameState, p: number) => s.melds[p].some((m) => burraco(m, s.rules))

// Punti già sul tavolo di un giocatore: carte calate + bonus dei burraci (per mostrarli durante la mano).
export function tablePoints(s: GameState, p: number): { cards: number; burraci: number; total: number } {
  const cards = s.melds[p].reduce((t, m) => t + sumPoints(m.cards), 0)
  const burraci = s.melds[p].reduce((t, m) => t + (burraco(m, s.rules)?.pts ?? 0), 0)
  return { cards, burraci, total: cards + burraci }
}

function scoreHand(s: GameState): HandScore[] {
  return [0, 1].map((p) => {
    const t = tablePoints(s, p)
    const close = s.closer === p ? 100 : 0, hand = sumPoints(s.hands[p]), pot = s.potTaken[p] ? 0 : -100
    return { melds: t.cards, burraci: t.burraci, close, hand, pot, total: t.cards + t.burraci + close - hand + pot }
  })
}

// ───────────── Regole di chiusura e pozzetto ─────────────

// Perché `card` non può essere l'ultima carta scartata (chiusura); null = si può.
function closeError(s: GameState, p: number, card: Card): string | null {
  if (isWildCard(card)) return 'non puoi chiudere scartando una matta'
  if (!hasBurraco(s, p)) return 'per chiudere serve almeno un burraco'
  return null
}

function takePot(s: GameState, p: number) {
  s.hands[p].push(...s.pots.shift()!)
  s.potTaken[p] = true
  s.events.push({ type: 'pot', p })
}

// Dopo che la mano di p cambia con una calata: mano vuota = prendi subito il pozzetto (se non l'hai già preso, altrimenti
// serve una carta da scartare); una sola carta rimasta che non potresti scartare per chiudere = mossa non permessa.
function checkHand(s: GameState, p: number): string | null {
  if (s.hands[p].length === 0) {
    if (s.potTaken[p]) return 'non puoi calare tutte le carte: te ne serve una da scartare'
    takePot(s, p)
  }
  const only = s.hands[p].length === 1 ? s.hands[p][0] : null
  if (only && only.id === s.takenCard) return 'ti resterebbe solo la carta del pozzo, che non puoi riscartare'
  if (only && s.potTaken[p] && !s.finalTurn) {
    const why = closeError(s, p, only)
    if (why) return `ti resterebbe una sola carta che non potresti scartare (${why})`
  }
  return null
}

function nextTurn(s: GameState) {
  s.turn = 1 - s.turn
  s.phase = 'draw'
  s.takenCard = null
}

function endHand(s: GameState, closer: number | null) {
  s.phase = 'over'
  s.closer = closer
  s.handScores = scoreHand(s)
  s.scores = s.scores.map((v, i) => v + s.handScores[i].total)
  const goal = TARGET[s.rules.mode]
  const top = Math.max(...s.scores)
  const tie = s.scores[0] === s.scores[1]
  s.matchOver = goal === null || (top >= goal && !tie)
  s.winner = s.matchOver ? (s.scores[0] > s.scores[1] ? 0 : 1) : null
}

// ───────────── Azioni ─────────────

const err = (error: string): Result => ({ error })
const take = (hand: Card[], ids: number[]): Card[] | null => {
  const out: Card[] = []
  for (const id of ids) { const c = hand.find((x) => x.id === id); if (!c || out.includes(c)) return null; out.push(c) }
  return out
}

function doMeld(s: GameState, p: number, groups: number[][], end: End): Result {
  if (!groups.length) return err('Scegli le carte da calare')
  const built: Omit<Meld, 'id'>[] = []
  const used: number[] = []
  for (const ids of groups) {
    const cards = take(s.hands[p], ids)
    if (!cards || ids.some((id) => used.includes(id))) return err('Carte non valide: non sono tutte nella tua mano')
    used.push(...ids)
    const a = analyze(cards, end)
    if (!a.ok) return err(a.why[0].toUpperCase() + a.why.slice(1))
    // un solo gruppo per valore: se esiste già (o lo calo due volte) si attacca
    if (a.meld.kind === 'set' && [...s.melds[p], ...built].some((m) => m.kind === 'set' && m.rank === a.meld.rank))
      return err('Hai già un gruppo di questo valore: attacca le carte a quello')
    built.push(a.meld)
  }
  if (s.rules.open50 && !s.melds[p].length) {
    const pts = built.reduce((t, m) => t + sumPoints(m.cards), 0)
    if (pts < OPEN_MIN) return err(`Apertura da ${OPEN_MIN}: servono almeno ${OPEN_MIN} punti (ne hai ${pts})`)
  }
  s.hands[p] = s.hands[p].filter((c) => !used.includes(c.id))
  for (const m of built) s.melds[p].push({ ...m, id: s.nextMeldId++ })
  const bad = checkHand(s, p)
  if (bad) return err(bad[0].toUpperCase() + bad.slice(1))
  s.events.push({ type: 'meld', p, n: built.length })
  return { state: s }
}

function doAttach(s: GameState, p: number, meldId: number, ids: number[], end: End | undefined): Result {
  const i = s.melds[p].findIndex((m) => m.id === meldId)
  if (i < 0) return err('Puoi attaccare carte solo ai tuoi giochi')
  const cards = take(s.hands[p], ids)
  if (!cards || !cards.length) return err('Carte non valide: non sono tutte nella tua mano')
  const m = s.melds[p][i]
  const all = [...m.cards, ...cards]
  // La matta resta dov'è (in testa o in coda); se viene sostituita dalla carta vera va in testa (pagat.com). `end` scelto
  // dal giocatore vince su tutto.
  const keepEnd: End = end ?? (m.wild === m.cards.length - 1 ? 'high' : m.wild === null ? 'high' : 'low')
  const a = m.kind === 'run' ? arrangeRun(all, keepEnd) : arrangeSet(all)
  if (!a.ok) return err('Quelle carte non si attaccano a questo gioco')
  if (a.meld.suit !== m.suit || (m.kind === 'set' && a.meld.rank !== m.rank)) return err('Quelle carte non si attaccano a questo gioco')
  s.melds[p][i] = { ...a.meld, id: m.id }
  s.hands[p] = s.hands[p].filter((c) => !ids.includes(c.id))
  const bad = checkHand(s, p)
  if (bad) return err(bad[0].toUpperCase() + bad.slice(1))
  s.events.push({ type: 'attach', p, meld: m.id, n: cards.length })
  return { state: s }
}

export function apply(prev: GameState, a: Action, shuf: Shuffle): Result {
  if (a.type === 'nextRound') {
    if (prev.phase !== 'over') return err('La mano non è finita')
    if (prev.matchOver) return err('La partita è finita')
    const first = 1 - prev.starter
    return { state: deal({ rules: prev.rules, names: prev.names, scores: prev.scores }, shuf(buildDeck()), first) }
  }
  if (prev.phase === 'over') return err('La mano è finita')
  const s: GameState = structuredClone(prev)
  s.events = []
  const p = s.turn

  switch (a.type) {
    case 'draw': {
      if (s.phase !== 'draw') return err('Hai già pescato: ora gioca e scarta')
      if (!s.deck.length) { s.events.push({ type: 'stock' }); endHand(s, null); return { state: s } }  // rete di sicurezza
      s.hands[p].push(s.deck.pop()!)
      s.phase = 'play'
      s.events.push({ type: 'draw', p })
      // pescato il terzultimo del tallone (ne restano 2): questo è l'ultimo turno (regola di pagat.com)
      if (s.deck.length <= 2) { s.finalTurn = true; s.events.push({ type: 'stock' }) }
      return { state: s }
    }
    case 'take': {
      if (s.phase !== 'draw') return err('Hai già pescato: ora gioca e scarta')
      if (!s.discard.length) return err('Il pozzo è vuoto')
      if (s.rules.block && isWildCard(topCard(s))) return err('Pozzo bloccato: in cima c\'è una matta')
      const n = s.discard.length
      s.takenCard = n === 1 ? s.discard[0].id : null
      s.hands[p].push(...s.discard)
      s.discard = []
      s.phase = 'play'
      s.events.push({ type: 'take', p, n })
      return { state: s }
    }
    case 'meld':
      if (s.phase !== 'play') return err('Prima pesca dal tallone o prendi il pozzo')
      return doMeld(s, p, a.groups, a.end ?? 'high')
    case 'attach':
      if (s.phase !== 'play') return err('Prima pesca dal tallone o prendi il pozzo')
      return doAttach(s, p, a.meld, a.ids, a.end)
    case 'discard': {
      if (s.phase !== 'play') return err('Prima pesca dal tallone o prendi il pozzo')
      const card = s.hands[p].find((c) => c.id === a.id)
      if (!card) return err('Quella carta non è nella tua mano')
      if (s.takenCard === card.id) return err('Hai preso il pozzo di una sola carta: non puoi riscartarla')
      const rest = s.hands[p].filter((c) => c !== card)
      const closing = rest.length === 0 && s.potTaken[p] && !s.finalTurn
      if (closing) {
        const why = closeError(s, p, card)
        if (why) return err(why[0].toUpperCase() + why.slice(1))
      }
      s.hands[p] = rest
      s.discard.push(card)
      s.events.push({ type: 'discard', p, card })
      // Hai scartato l'ultima carta senza pozzetto: lo prendi subito (lo userai al tuo turno; se la mano finisce prima,
      // le sue carte si sottraggono).
      if (!rest.length && !s.potTaken[p] && s.pots.length) takePot(s, p)
      if (closing) { s.events.push({ type: 'close', p }); endHand(s, p) }
      else if (s.finalTurn) endHand(s, null)
      else nextTurn(s)
      return { state: s }
    }
  }
}

// Messaggio d'errore di un'azione sul tavolo attuale (null = si può fare). Serve all'interfaccia per i suggerimenti
// mentre si trascina una carta.
export function actionError(s: GameState, a: Action): string | null {
  const r = apply(s, a, (x) => x)
  return 'error' in r ? r.error : null
}
