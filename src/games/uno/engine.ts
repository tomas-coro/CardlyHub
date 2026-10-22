// Motore di UNO a 2: funzioni pure, nessun import, nessun DOM.
// Lo stato è JSON semplice (niente Set/Map) così in Fase 2 si può salvare e sincronizzare su Supabase.
// Il caso sta FUORI dal motore: newGame riceve il mazzo già mescolato e apply riceve la funzione `shuffle`
// (serve solo al rimescolo degli scarti e a nextRound). Il motore non decide mai a caso.
// Il motore non muta mai lo stato che riceve: apply lavora su una copia e la restituisce.

export type Color = 'r' | 'b' | 'y' | 'g'
// v: '0'..'9', 'skip' (Salta), 'rev' (Inverti), 'd2' (+2), 'w' (Jolly), 'w4' (Jolly +4); c = 'w' per i due Jolly
export interface Card { id: number; c: Color | 'w'; v: string; chosen?: Color }  // chosen = colore scelto su un Jolly, per la grafica

export type Mode = 'single' | 'bo3' | 'bo5' | 'pts'
// Regole della casa: tutte spente = UNO ufficiale. Fisse per tutta la partita.
export interface Rules {
  s22: boolean   // +2 su +2: la pesca si somma
  challenge: boolean   // sfida del +4 (spenta di base: il +4 si pesca e basta)
  s44: boolean   // +4 su +4, e +2 su +4 se del colore scelto
  multi: boolean // più carte uguali (stesso numero/simbolo, mai Jolly) insieme
  swap: boolean  // 7 e 0 scambiano le mani (in due sono la stessa cosa)
  noSpecialEnd: boolean // l'ultima carta non può essere speciale (tutto ciò che non è un numero): si chiude solo con un numero
  drawUntil: boolean    // pesca finché giochi: se non hai niente si pesca finché esce una carta giocabile
  mercy: boolean        // pietà: chi arriva a 25 carte in mano perde la mano
  mode: Mode     // una mano, al meglio di 3, al meglio di 5, 500 punti
}

// Il Jolly appena giocato, in attesa di scelta colore (phase 'pick') o di sfida (phase 'challenge')
export interface WildPlay {
  v: 'w' | 'w4'
  by: number
  prev: Color        // colore in gioco prima del Jolly
  had: boolean       // chi l'ha giocato aveva in mano una carta del colore `prev`? (decide la sfida del +4)
  wasPending: number // pesca già accumulata prima del Jolly: se > 0 il +4 è un'impilata e non si sfida
}

export type UnoEvent =
  | { type: 'draw'; p: number; n: number; why: 'stack' | 'free' | 'uno' | 'challenge' | 'end' }  // n = carte davvero pescate
  | { type: 'skip'; p: number }                      // p perde il turno (Salta/Inverti)
  | { type: 'pass'; p: number }                      // p ha pescato e passa (o passa dopo aver pescato)
  | { type: 'swap' }                                 // mani scambiate (7/0)
  | { type: 'challenge'; by: number; won: boolean }  // by = chi ha sfidato; won = sfida riuscita
  | { type: 'reshuffle' }                            // gli scarti sono tornati nel mazzo
  | { type: 'mercy'; p: number }                     // p è arrivato a 25 carte e perde la mano

export interface GameState {
  deck: Card[]             // si pesca dalla FINE
  disc: Card[]             // scarti; l'ultima è la carta in cima
  hands: Card[][]
  turn: number             // di chi è il turno; in 'pick' è chi sceglie, in 'challenge' è chi può sfidare
  color: Color             // colore in gioco (diverso dalla carta in cima dopo un Jolly)
  pending: number          // pesca accumulata da +2/+4 non ancora subita
  drawn: number | null     // id della carta appena pescata e giocabile: è l'unica che si può giocare, oppure si passa
  uno: boolean[]           // UNO dichiarato, da giocare con la penultima carta; si azzera a ogni giocata
  phase: 'play' | 'pick' | 'challenge' | 'over'
  wild: WildPlay | null
  rules: Rules
  names: string[]
  scores: number[]         // mani vinte (single/bo3/bo5) o punti (pts)
  starter: number          // chi ha aperto questa mano; nella successiva apre l'altro
  roundWinner: number | null
  points: number           // punti delle carte rimaste all'avversario, a fine mano
  matchOver: boolean       // l'obiettivo è raggiunto: dopo 'over' non c'è nextRound
  events: UnoEvent[]       // cosa è successo nell'ULTIMA apply: serve alla grafica (toast, animazioni di pesca)
}

export type Action =
  | { type: 'play'; cards: number[] }                      // id delle carte dalla mano di chi ha il turno; l'ultima decide il colore
  | { type: 'color'; color: Color }                        // dopo un Jolly
  | { type: 'draw' }                                       // pesca dal mazzo (o subisce la pesca accumulata)
  | { type: 'pass' }                                       // dopo aver pescato una carta giocabile, non la gioca
  | { type: 'uno'; player: number; on: boolean }           // si può premere anche fuori turno
  | { type: 'challenge' }                                  // sfida il +4
  | { type: 'accept' }                                     // non sfida: pesca 4 (o tutta la pesca accumulata)
  | { type: 'stack' }                                      // non sfida e risponde con un altro +4/+2 (solo con s44)
  | { type: 'nextRound' }                                  // nuova mano, a mano finita e partita non finita

export type Result = { state: GameState } | { error: string }
export type Shuffle = (cards: Card[]) => Card[]

export const COLORS: Color[] = ['r', 'b', 'y', 'g']
export const HAND_SIZE = 7
export const MAX_MULTI = 4
export const MERCY_LIMIT = 25
export const GOAL: Record<Mode, number> = { single: 1, bo3: 2, bo5: 3, pts: 500 }
export const DEFAULT_RULES: Rules = { challenge: false, s22: false, s44: false, multi: false, swap: false, noSpecialEnd: false, drawUntil: false, mercy: false, mode: 'bo3' }

export const NO_SPECIAL_END = 'Non puoi chiudere con una carta speciale'
export const isNumber = (c: Card) => /^\d$/.test(c.v)
// Punti a fine mano: numero = valore, Salta/Inverti/+2 = 20, Jolly e +4 = 50.
export const cardPoints = (c: Card) => (isNumber(c) ? +c.v : c.c === 'w' ? 50 : 20)
export const topCard = (s: GameState) => s.disc[s.disc.length - 1]

export function buildDeck(): Card[] {
  const d: Card[] = []
  const add = (c: Card['c'], v: string) => d.push({ id: d.length + 1, c, v })
  for (const c of COLORS) {
    add(c, '0')
    for (let k = 0; k < 2; k++) {
      for (let n = 1; n <= 9; n++) add(c, String(n))
      add(c, 'skip'); add(c, 'rev'); add(c, 'd2')
    }
  }
  for (let k = 0; k < 4; k++) { add('w', 'w'); add('w', 'w4') }
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

// Distribuisce 7 carte a testa e scopre la prima: sempre un numero (le altre tornano in fondo al mazzo).
function deal(base: Pick<GameState, 'rules' | 'names' | 'scores'>, shuffledDeck: Card[], first: number): GameState {
  const deck = shuffledDeck.slice()
  const hands: Card[][] = [[], []]
  for (let i = 0; i < HAND_SIZE; i++) {
    hands[first].push(deck.pop()!)
    hands[1 - first].push(deck.pop()!)
  }
  let open = deck.pop()
  while (open && !isNumber(open)) { deck.unshift(open); open = deck.pop() }
  if (!open) throw new Error('il mazzo non ha nessun numero da scoprire')
  return {
    deck, disc: [open], hands, turn: first, color: open.c as Color, pending: 0, drawn: null, uno: [false, false],
    phase: 'play', wild: null, rules: base.rules, names: base.names, scores: base.scores, starter: first,
    roundWinner: null, points: 0, matchOver: false, events: [],
  }
}

export function newGame(opts: { names: string[]; rules?: Rules; first?: number }, shuffledDeck: Card[]): GameState {
  return deal({ rules: opts.rules ?? DEFAULT_RULES, names: opts.names, scores: [0, 0] }, shuffledDeck, opts.first ?? 0)
}

// ── Domande sulle regole: la grafica le usa per tremare/mostrare i toast, senza rifare le regole ──

const baseLegal = (s: GameState, c: Card) => c.c === 'w' || c.c === s.color || c.v === topCard(s).v

// Con una pesca in sospeso si può solo impilare: +2 su +2 (s22); +4 su +4 e +2 del colore scelto su +4 (s44).
function stackOk(s: GameState, c: Card): boolean {
  const t = topCard(s)
  if (t.v === 'd2') return c.v === 'd2' && s.rules.s22
  if (t.v === 'w4') return s.rules.s44 && (c.v === 'w4' || (c.v === 'd2' && c.c === s.color))
  return false
}

export const canStack = (s: GameState, p: number) => s.pending > 0 && s.hands[p].some((c) => stackOk(s, c))

// null se la carta si può giocare ora da p, altrimenti il motivo (già in italiano, pronto per il toast).
export function playError(s: GameState, p: number, cardId: number): string | null {
  if (s.phase === 'over') return 'La mano è finita'
  if (s.phase !== 'play' || s.turn !== p) return 'Non è il tuo turno'
  const c = s.hands[p].find((x) => x.id === cardId)
  if (!c) return 'Quella carta non è nella tua mano'
  if (s.rules.noSpecialEnd && s.hands[p].length === 1 && !isNumber(c)) return NO_SPECIAL_END
  if (s.pending > 0) return stackOk(s, c) ? null : 'Devi rispondere con un +2 o +4 valido, oppure pescare'
  if (s.drawn !== null) return c.id === s.drawn && baseLegal(s, c) ? null : 'Puoi giocare solo la carta pescata, oppure passare'
  return baseLegal(s, c) ? null : 'Questa carta non si può giocare'
}
export const canPlay = (s: GameState, p: number, cardId: number) => playError(s, p, cardId) === null

// Le altre carte che si possono giocare insieme a questa (regola "più carte uguali"). Vuoto se la regola è spenta.
export function siblings(s: GameState, p: number, cardId: number): Card[] {
  const c = s.hands[p].find((x) => x.id === cardId)
  if (!c || !s.rules.multi || s.pending > 0 || s.drawn !== null || c.c === 'w') return []
  return s.hands[p].filter((x) => x.id !== cardId && x.v === c.v && x.c !== 'w')
}

// ── Meccanica interna: lavora sulla COPIA di stato creata da apply ──

// Pesca n carte per p. Se il mazzo finisce rimescola gli scarti (tranne la carta in cima). Ritorna quante ne ha pescate.
// Con `until` si ferma appena la carta pescata lo soddisfa (n = Infinity: pesca finché serve).
function draw(s: GameState, p: number, n: number, why: 'stack' | 'free' | 'uno' | 'challenge' | 'end', shuf: Shuffle, until?: (c: Card) => boolean): number {
  let got = 0
  for (let i = 0; i < n; i++) {
    if (!s.deck.length) {
      const top = s.disc.pop()!
      s.deck = shuf(s.disc.splice(0))
      s.deck.forEach((c) => delete c.chosen)
      s.disc = [top]
      if (s.deck.length) s.events.push({ type: 'reshuffle' })
    }
    if (!s.deck.length) break
    const c = s.deck.pop()!
    s.hands[p].push(c)
    got++
    if (until?.(c)) break
  }
  if (got) s.events.push({ type: 'draw', p, n: got, why })
  return got
}

// Dopo aver subito una pesca forzata: se veniva da un +4 il turno resta a chi ha pescato (regola della casa),
// se veniva da un +2 si salta il turno come nel UNO ufficiale.
const turnAfterForced = (s: GameState, n: number) => (topCard(s).v === 'w4' ? n : 1 - n)

// Dà il turno a n. Se n ha una pesca in sospeso e non può impilare, la subisce.
function advance(s: GameState, n: number, shuf: Shuffle) {
  s.turn = n
  s.drawn = null
  if (s.phase === 'play' && s.pending > 0 && !canStack(s, n)) {
    const k = s.pending
    s.pending = 0
    const next = turnAfterForced(s, n)
    draw(s, n, k, 'stack', shuf)
    s.turn = next
  }
}

function endRound(s: GameState, p: number, shuf: Shuffle) {
  // Se l'ultima carta è un +2/+4 la pesca la subisce l'avversario PRIMA del conteggio (regola ufficiale).
  if (s.pending > 0) { draw(s, 1 - p, s.pending, 'end', shuf); s.pending = 0 }
  const sum = s.hands[1 - p].reduce((a, c) => a + cardPoints(c), 0)
  s.scores[p] += s.rules.mode === 'pts' ? sum : 1
  s.points = sum
  s.phase = 'over'
  s.roundWinner = p
  s.drawn = null
  s.wild = null
  s.matchOver = s.rules.mode === 'single' || s.scores[p] >= GOAL[s.rules.mode]
}

function playCards(s: GameState, ids: number[], shuf: Shuffle) {
  const p = s.turn
  const cards = ids.map((id) => s.hands[p].find((c) => c.id === id)!)
  s.hands[p] = s.hands[p].filter((c) => !ids.includes(c.id))
  const hand = s.hands[p]
  const prev = s.color, wasPending = s.pending
  // "aveva il colore": calcolato ora, prima dell'eventuale penalità UNO che potrebbe pescargli una carta di quel colore
  const had = hand.some((c) => c.c === prev)
  s.disc.push(...cards)
  s.drawn = null
  const last = cards[cards.length - 1], k = cards.length

  if (hand.length === 0) {
    if (last.v === 'd2') s.pending += 2 * k
    else if (last.v === 'w4') s.pending += 4
    return endRound(s, p, shuf)
  }
  if (hand.length === 1 && !s.uno[p]) draw(s, p, 2, 'uno', shuf)
  s.uno[p] = false
  if (last.c !== 'w') s.color = last.c

  if (last.v === 'skip' || last.v === 'rev') {  // in due Inverti = Salta: gioca ancora p
    s.events.push({ type: 'skip', p: 1 - p })
    return advance(s, p, shuf)
  }
  if (last.v === 'd2') { s.pending += 2 * k; return advance(s, 1 - p, shuf) }
  if (last.c === 'w') {  // Jolly: il turno resta a p finché non sceglie il colore
    s.phase = 'pick'
    s.wild = { v: last.v as 'w' | 'w4', by: p, prev, had, wasPending }
    return
  }
  if (s.rules.swap && (last.v === '7' || last.v === '0')) {
    // lo 0 scambia una volta; il 7 una volta per carta giocata (due 7 insieme si annullano)
    if (last.v === '0' || k % 2 === 1) {
      ;[s.hands[0], s.hands[1]] = [s.hands[1], s.hands[0]]
      s.events.push({ type: 'swap' })
    }
  }
  advance(s, 1 - p, shuf)
}

function step(prev: GameState, a: Action, shuf: Shuffle): Result {
  const s: GameState = structuredClone(prev)
  s.events = []
  const p = s.turn

  if (a.type === 'nextRound') {
    if (s.phase !== 'over') return { error: 'la mano non è finita' }
    if (s.matchOver) return { error: 'la partita è finita' }
    return { state: deal(s, shuf(buildDeck()), 1 - s.starter) }
  }
  if (s.phase === 'over') return { error: 'la mano è finita' }

  if (a.type === 'uno') {
    const h = s.hands[a.player]
    if (!h) return { error: 'giocatore inesistente' }
    if (h.length < 1 || h.length > 3) return { error: 'UNO si dichiara con 3 carte o meno' }
    s.uno[a.player] = a.on
    return { state: s }
  }

  if (a.type === 'play') {
    if (s.phase !== 'play') return { error: 'ora non si gioca una carta' }
    if (!a.cards.length || new Set(a.cards).size !== a.cards.length) return { error: 'carte non valide' }
    const err = playError(s, p, a.cards[0])
    if (err) return { error: err }
    if (a.cards.length > 1) {
      const first = s.hands[p].find((c) => c.id === a.cards[0])!
      const all = a.cards.map((id) => s.hands[p].find((c) => c.id === id))
      if (!s.rules.multi) return { error: 'le carte uguali insieme sono spente nelle regole' }
      if (s.pending > 0 || s.drawn !== null) return { error: 'ora si può giocare una carta sola' }
      if (a.cards.length > MAX_MULTI) return { error: `al massimo ${MAX_MULTI} carte insieme` }
      if (all.some((c) => !c || c.c === 'w' || c.v !== first.v)) return { error: 'insieme si giocano solo carte uguali, mai Jolly' }
      if (s.rules.noSpecialEnd && a.cards.length === s.hands[p].length && !isNumber(first)) return { error: NO_SPECIAL_END }
    }
    playCards(s, a.cards, shuf)
    return { state: s }
  }

  if (a.type === 'color') {
    if (s.phase !== 'pick' || !s.wild) return { error: 'ora non si sceglie il colore' }
    if (!COLORS.includes(a.color)) return { error: 'colore non valido' }
    const w = s.wild
    s.color = a.color
    topCard(s).chosen = a.color
    if (w.v === 'w4') {
      s.pending += 4
      // un +4 sopra una pesca già in corso è un'impilata: non si sfida
      if (w.wasPending === 0 && s.rules.challenge) s.phase = 'challenge'
      else { s.phase = 'play'; s.wild = null }
    } else { s.phase = 'play'; s.wild = null }
    advance(s, 1 - w.by, shuf)  // in 'challenge' advance non fa pescare: decide chi risponde
    return { state: s }
  }

  if (a.type === 'challenge' || a.type === 'accept' || a.type === 'stack') {
    if (s.phase !== 'challenge' || !s.wild) return { error: 'non c\'è nessun +4 da sfidare' }
    const w = s.wild, n = s.turn
    if (a.type === 'stack' && !canStack(s, n)) return { error: 'non hai nessuna carta per rispondere' }
    s.wild = null
    s.phase = 'play'
    if (a.type === 'stack') return { state: s }  // il turno resta a chi deve rispondere, che ora gioca la carta o pesca
    if (a.type === 'accept') {
      const k = s.pending
      s.pending = 0
      const next = turnAfterForced(s, n)
      draw(s, n, k, 'stack', shuf)
      advance(s, next, shuf)
      return { state: s }
    }
    s.pending = 0
    s.events.push({ type: 'challenge', by: n, won: w.had })
    if (w.had) { draw(s, w.by, 4, 'challenge', shuf); advance(s, n, shuf) }       // colpevole: pesca 4, e chi ha sfidato gioca
    else { draw(s, n, 6, 'challenge', shuf); advance(s, w.by, shuf) }              // sfida persa: pesca 6 e perde il turno
    return { state: s }
  }

  if (s.phase !== 'play') return { error: 'ora non si pesca' }

  if (a.type === 'draw') {
    if (s.drawn !== null) return { error: 'hai già pescato: gioca la carta pescata o passa' }
    if (s.pending > 0) {
      const k = s.pending
      s.pending = 0
      const next = turnAfterForced(s, p)
      draw(s, p, k, 'stack', shuf)
      advance(s, next, shuf)
      return { state: s }
    }
    const got = s.rules.drawUntil ? draw(s, p, Infinity, 'free', shuf, (c) => baseLegal(s, c)) : draw(s, p, 1, 'free', shuf)
    const c = s.hands[p][s.hands[p].length - 1]
    if (got && baseLegal(s, c)) s.drawn = c.id           // giocabile: la può giocare oppure passare
    else { s.events.push({ type: 'pass', p }); advance(s, 1 - p, shuf) }  // non giocabile (o mazzo finito): passa
    return { state: s }
  }

  if (a.type === 'pass') {
    if (s.drawn === null) return { error: 'puoi passare solo dopo aver pescato' }
    s.events.push({ type: 'pass', p })
    advance(s, 1 - p, shuf)
    return { state: s }
  }

  return { error: 'azione sconosciuta' }
}

// Pietà: a 25 carte in mano si perde la mano (vince l'altro, con i punti delle carte di chi ha perso).
// Se per uno scambio di mani entrambi ne hanno 25 o più, perde chi ne ha di più (a pari merito il giocatore 0).
function mercy(s: GameState, shuf: Shuffle) {
  if (!s.rules.mercy || s.phase === 'over') return
  const [a, b] = s.hands.map((h) => h.length)
  if (Math.max(a, b) < MERCY_LIMIT) return
  const loser = b > a ? 1 : 0
  s.events.push({ type: 'mercy', p: loser })
  s.pending = 0
  endRound(s, 1 - loser, shuf)
}

export function apply(prev: GameState, a: Action, shuf: Shuffle): Result {
  const r = step(prev, a, shuf)
  if ('state' in r) mercy(r.state, shuf)
  return r
}
