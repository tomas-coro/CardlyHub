// Test del motore del Burraco. Esecuzione: node --test tests/burraco-engine.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_RULES, HAND_SIZE, POT_SIZE, actionError, analyze, apply, buildDeck, burraco, cardPoints, newGame, shuffle, tablePoints } from '../src/games/burraco/engine.ts'
import type { Action, Card, GameState, Meld, Rules, Shuffle } from '../src/games/burraco/engine.ts'

let uid = 1000
// "h5" = cinque di cuori, "s13" = re di picche, "d1" = asso di quadri, "d2" = due di quadri (pinella), "j" = jolly
const mk = (code: string): Card => (code === 'j' ? { id: ++uid, s: 'j', r: 0 } : { id: ++uid, s: code[0] as Card['s'], r: +code.slice(1) })
const cs = (...codes: string[]) => codes.map(mk)
const keep: Shuffle = (x) => x.slice()

// Combinazione costruita a mano passando dall'analisi vera (così i test provano anche l'analisi).
let mid = 500
function meldOf(...codes: string[]): Meld {
  const a = analyze(cs(...codes))
  assert.ok(a.ok, `combinazione non valida: ${codes.join(' ')}`)
  return { ...a.meld, id: ++mid }
}

interface Setup {
  h0?: string[]; h1?: string[]; m0?: string[][]; m1?: string[][]; discard?: string[]; deck?: string[]
  pots?: number; taken?: [boolean, boolean]; turn?: number; phase?: GameState['phase']; rules?: Partial<Rules>; scores?: number[]
}
function scenario(o: Setup = {}): GameState {
  return {
    deck: cs(...(o.deck ?? Array(30).fill('c7'))), discard: cs(...(o.discard ?? ['c9'])),
    pots: Array.from({ length: o.pots ?? 2 }, () => cs(...Array(POT_SIZE).fill('d4'))),
    hands: [cs(...(o.h0 ?? ['h5'])), cs(...(o.h1 ?? ['h5']))], melds: [(o.m0 ?? []).map((m) => meldOf(...m)), (o.m1 ?? []).map((m) => meldOf(...m))],
    potTaken: o.taken ?? [false, false], turn: o.turn ?? 0, phase: o.phase ?? 'play', takenCard: null, finalTurn: false, nextMeldId: 900,
    rules: { ...DEFAULT_RULES, ...o.rules }, names: ['A', 'B'], scores: o.scores ?? [0, 0], starter: 0, closer: null,
    handScores: [], matchOver: false, winner: null, events: [],
  }
}
const run = (s: GameState, a: Action, shuf: Shuffle = keep) => {
  const r = apply(s, a, shuf)
  assert.ok('state' in r, 'error' in r ? `errore inatteso: ${r.error}` : '')
  return r.state
}
const fail = (s: GameState, a: Action, re: RegExp) => {
  const r = apply(s, a, keep)
  assert.ok('error' in r, 'doveva dare errore')
  assert.match(r.error, re)
}
const ids = (s: GameState, p: number, ...codes: string[]) => {
  // id delle carte di p che corrispondono ai codici (una per codice, nell'ordine)
  const pool = s.hands[p].slice()
  return codes.map((code) => {
    const i = pool.findIndex((c) => (code === 'j' ? c.s === 'j' : c.s === code[0] && c.r === +code.slice(1)))
    assert.ok(i >= 0, `${code} non è in mano`)
    return pool.splice(i, 1)[0].id
  })
}
const kinds = (codes: string[], end?: 'high' | 'low') => {
  const a = analyze(cs(...codes), end)
  return a.ok ? { kind: a.meld.kind, wild: a.meld.wild, rank: a.meld.rank, order: a.meld.cards.map((c) => (c.s === 'j' ? 'j' : c.s + c.r)) } : null
}

// ───────────── mazzo e distribuzione ─────────────

test('il mazzo ha 108 carte: ogni carta due volte, più 4 jolly, id tutti diversi', () => {
  const d = buildDeck()
  assert.equal(d.length, 108)
  assert.equal(new Set(d.map((c) => c.id)).size, 108)
  assert.equal(d.filter((c) => c.s === 'j').length, 4)
  for (const s of ['h', 'd', 'c', 's']) for (let r = 1; r <= 13; r++) assert.equal(d.filter((c) => c.s === s && c.r === r).length, 2)
})

test('newGame: 11 carte a testa, 2 pozzetti da 11, 1 carta scoperta, 63 nel tallone', () => {
  const s = newGame({ names: ['A', 'B'] }, shuffle(buildDeck(), () => 0.3))
  assert.equal(s.hands[0].length, HAND_SIZE)
  assert.equal(s.hands[1].length, HAND_SIZE)
  assert.deepEqual(s.pots.map((p) => p.length), [POT_SIZE, POT_SIZE])
  assert.equal(s.discard.length, 1)
  assert.equal(s.deck.length, 108 - 22 - 22 - 1)
  assert.equal(s.phase, 'draw')
  assert.equal(s.turn, 0)
  const all = [...s.deck, ...s.discard, ...s.pots.flat(), ...s.hands.flat()]
  assert.equal(new Set(all.map((c) => c.id)).size, 108)
})

// ───────────── analisi: scale ─────────────

test('scala: tre carte consecutive dello stesso seme', () => {
  assert.deepEqual(kinds(['h5', 'h3', 'h4']), { kind: 'run', wild: null, rank: 3, order: ['h3', 'h4', 'h5'] })
})
test('scala: l\'asso può essere basso o alto, ma non si gira (Q-K-A sì, K-A-2 no)', () => {
  assert.equal(kinds(['h1', 'h2', 'h3'])?.rank, 1)
  assert.equal(kinds(['h12', 'h13', 'h1'])?.rank, 12)
  assert.equal(kinds(['h13', 'h1', 'h3']), null)
  assert.equal(kinds(['h12', 'h13', 'h1', 'h3']), null)
})
test('scala: il jolly copre un buco, oppure sta in coda (di default in testa alla fine, "low" in principio)', () => {
  assert.deepEqual(kinds(['h3', 'h5', 'j']), { kind: 'run', wild: 1, rank: 3, order: ['h3', 'j', 'h5'] })
  assert.equal(kinds(['h3', 'h4', 'h5', 'j'])?.wild, 3)
  assert.equal(kinds(['h3', 'h4', 'h5', 'j'], 'low')?.wild, 0)
  assert.equal(kinds(['h3', 'h4', 'h5', 'j'], 'low')?.rank, 2)
})
test('scala: il due del seme al suo posto è naturale (nessuna matta)', () => {
  assert.deepEqual(kinds(['h1', 'h2', 'h3', 'h4']), { kind: 'run', wild: null, rank: 1, order: ['h1', 'h2', 'h3', 'h4'] })
})
test('scala: un due di un altro seme fa da matta; il due del seme fa da matta se serve a coprire un buco', () => {
  assert.equal(kinds(['h4', 'h5', 'h7', 'd2'])?.wild, 2)
  assert.deepEqual(kinds(['h4', 'h5', 'h2', 'h7']), { kind: 'run', wild: 2, rank: 4, order: ['h4', 'h5', 'h2', 'h7'] })
})
test('scala: non valida con due matte, semi misti, buchi, valori doppi o solo matte', () => {
  assert.equal(kinds(['h3', 'h4', 'j', 'j']), null)
  assert.equal(kinds(['h3', 'h4', 'j', 'd2']), null)
  assert.equal(kinds(['h3', 'h4', 's5']), null)
  assert.equal(kinds(['h3', 'h4', 'h7']), null)
  assert.equal(kinds(['h3', 'h3', 'h4']), null)
  assert.equal(kinds(['j', 'j', 'd2']), null)
  assert.equal(kinds(['h3', 'h4']), null)
})
test('scala lunga: A-2-...-K di cuori (13 carte) è valida e senza matte', () => {
  const codes = Array.from({ length: 13 }, (_, i) => 'h' + (i + 1))
  assert.deepEqual(kinds(codes)?.wild, null)
  assert.equal(kinds(codes)?.rank, 1)
})

// ───────────── analisi: gruppi ─────────────

test('gruppo: stesso valore, semi anche uguali, anche con una matta', () => {
  assert.equal(kinds(['s13', 'h13', 'd13'])?.kind, 'set')
  assert.equal(kinds(['s13', 's13', 'h13'])?.kind, 'set')
  assert.equal(kinds(['s13', 'h13', 'j'])?.wild, 2)
  assert.equal(kinds(['s13', 'h13', 'd2'])?.wild, 2)
})
test('niente gruppi di soli due (e matte), come da pagat.com', () => {
  assert.equal(kinds(['s2', 'h2', 'd2']), null)
  assert.equal(kinds(['s2', 'h2', 'j']), null)
  assert.equal(kinds(['s2', 'h2', 'd5']), null)
})
test('gruppo non valido: due matte, valori diversi, meno di 3 carte', () => {
  assert.equal(kinds(['s13', 'j', 'j']), null)
  assert.equal(kinds(['s13', 'h13', 'j', 'd2']), null)
  assert.equal(kinds(['s13', 'h12', 'd13']), null)
  assert.equal(kinds(['s13', 'h13']), null)
})

// ───────────── burraci e punti ─────────────

const ruleOff: Rules = { ...DEFAULT_RULES }
const ruleOn: Rules = { ...DEFAULT_RULES, special: true }
const seven = (suit: string, from: number) => Array.from({ length: 7 }, (_, i) => suit + (from + i))

test('burraco: sotto le 7 carte non esiste', () => {
  assert.equal(burraco(meldOf('h3', 'h4', 'h5', 'h6', 'h7', 'h8'), ruleOff), null)
})
test('burraco: pulito 200, sporco 100 (matta dentro la scala)', () => {
  assert.deepEqual(burraco(meldOf(...seven('h', 3)), ruleOff), { kind: 'pulito', pts: 200 })
  assert.deepEqual(burraco(meldOf('h3', 'h4', 'h5', 'j', 'h7', 'h8', 'h9'), ruleOff), { kind: 'sporco', pts: 100 })
})
test('burraco: con i bonus extra reale 300, super 250, semipulito 150; senza, tutto 200/100', () => {
  const reale = meldOf(...Array.from({ length: 13 }, (_, i) => 'h' + (i + 1)))
  const sup = meldOf('s9', 'h9', 'd9', 'c9', 's9', 'h9', 'd9', 'c9')
  const semi = meldOf('h3', 'h4', 'h5', 'h6', 'h7', 'h8', 'h9', 'j')
  assert.equal(burraco(reale, ruleOn)?.pts, 300)
  assert.equal(burraco(sup, ruleOn)?.pts, 250)
  assert.equal(burraco(semi, ruleOn)?.pts, 150)
  assert.equal(burraco(reale, ruleOff)?.pts, 200)
  assert.equal(burraco(sup, ruleOff)?.pts, 200)
  assert.equal(burraco(semi, ruleOff)?.pts, 100)
})
test('burraco: il semipulito vale solo da 8 carte, con la matta a un\'estremità; il due naturale non è matta', () => {
  assert.equal(burraco(meldOf('h3', 'h4', 'j', 'h6', 'h7', 'h8', 'h9', 'h10'), ruleOn)?.kind, 'sporco')
  assert.equal(burraco(meldOf('h3', 'h4', 'h5', 'h6', 'h7', 'h8', 'j'), ruleOn)?.kind, 'sporco', '6 naturali + matta = 7 carte: sporco')
  assert.equal(burraco(meldOf('h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'h7'), ruleOn)?.kind, 'pulito')
})
test('punti delle carte: jolly 30, due 20, asso 15, 8-K 10, 3-7 5', () => {
  assert.deepEqual(cs('j', 'h2', 'h1', 'h8', 'h13', 'h3', 'h7').map(cardPoints), [30, 20, 15, 10, 10, 5, 5])
})
test('tablePoints: carte calate + bonus dei burraci', () => {
  const s = scenario({ m0: [seven('h', 3), ['s13', 'h13', 'd13']] })
  // 3..9 = 5+5+5+5+5+10+10 = 45 ... 3,4,5,6,7 = 25; 8,9 = 20 -> 45; re = 30; burraco pulito 200
  assert.deepEqual(tablePoints(s, 0), { cards: 75, burraci: 200, total: 275 })
})

// ───────────── turno: pesca, pozzo, scarto ─────────────

test('pesca: una carta dal tallone, poi si gioca; non si pesca due volte', () => {
  const s0 = scenario({ phase: 'draw', deck: ['d9', 'c7'] })
  const s1 = run(s0, { type: 'draw' })
  assert.equal(s1.hands[0].length, 2)
  assert.equal(s1.deck.length, 1)
  assert.equal(s1.phase, 'play')
  fail(s1, { type: 'draw' }, /già pescato/)
  assert.equal(s0.hands[0].length, 1, 'lo stato di partenza non è stato toccato')
})
test('non si gioca prima di aver pescato', () => {
  const s = scenario({ phase: 'draw', h0: ['h5', 'h6', 'h7'] })
  fail(s, { type: 'meld', groups: [ids(s, 0, 'h5', 'h6', 'h7')] }, /Prima pesca/)
  fail(s, { type: 'discard', id: s.hands[0][0].id }, /Prima pesca/)
})
test('pozzo: si prende tutto, si gioca, si scarta e il turno passa', () => {
  const s0 = scenario({ phase: 'draw', discard: ['c9', 'd3', 's12'], h0: ['h5'] })
  const s1 = run(s0, { type: 'take' })
  assert.equal(s1.hands[0].length, 4)
  assert.equal(s1.discard.length, 0)
  const s2 = run(s1, { type: 'discard', id: s1.hands[0][0].id })
  assert.equal(s2.turn, 1)
  assert.equal(s2.phase, 'draw')
  assert.equal(s2.discard.length, 1)
})
test('pozzo bloccato dalla matta (regola della casa) e pozzo vuoto', () => {
  const blocked = scenario({ phase: 'draw', discard: ['c9', 'j'], rules: { block: true } })
  fail(blocked, { type: 'take' }, /bloccato/)
  const two = scenario({ phase: 'draw', discard: ['c9', 'd2'], rules: { block: true } })
  fail(two, { type: 'take' }, /bloccato/)
  const free = scenario({ phase: 'draw', discard: ['c9', 'j'] })
  assert.equal(run(free, { type: 'take' }).hands[0].length, 3)
  fail(scenario({ phase: 'draw', discard: [] }), { type: 'take' }, /vuoto/)
})
test('pozzo di una sola carta: non puoi riscartare quella stessa carta nello stesso turno', () => {
  const s1 = run(scenario({ phase: 'draw', discard: ['c9'], h0: ['h5', 'h6'] }), { type: 'take' })
  const taken = s1.hands[0].find((c) => c.s === 'c')!
  fail(s1, { type: 'discard', id: taken.id }, /una sola carta/)
  assert.equal(run(s1, { type: 'discard', id: s1.hands[0][0].id }).turn, 1)
})
test('scarto: la carta deve essere in mano', () => {
  fail(scenario(), { type: 'discard', id: 99999 }, /non è nella tua mano/)
})

// ───────────── calare e attaccare ─────────────

test('calare una scala toglie le carte dalla mano', () => {
  const s0 = scenario({ h0: ['h5', 'h6', 'h7', 's2'] })
  const s1 = run(s0, { type: 'meld', groups: [ids(s0, 0, 'h5', 'h6', 'h7')] })
  assert.equal(s1.hands[0].length, 1)
  assert.equal(s1.melds[0].length, 1)
  assert.equal(s1.melds[0][0].kind, 'run')
})
test('calare carte non valide o non tue dà errore', () => {
  const s = scenario({ h0: ['h5', 'h6', 's9', 's2'] })
  fail(s, { type: 'meld', groups: [ids(s, 0, 'h5', 'h6', 's9')] }, /né una scala né un gruppo/)
  fail(s, { type: 'meld', groups: [[...ids(s, 0, 'h5', 'h6'), 99999]] }, /non sono tutte nella tua mano/)
  fail(s, { type: 'meld', groups: [] }, /Scegli/)
})
test('un solo gruppo per valore: il secondo si attacca', () => {
  const s0 = scenario({ h0: ['s9', 'h9', 'd9', 'c13'], m0: [['s13', 'h13', 'd13']] })
  const s1 = run(s0, { type: 'meld', groups: [ids(s0, 0, 's9', 'h9', 'd9')] })
  assert.equal(s1.melds[0].length, 2)
  const s2 = scenario({ h0: ['s13', 'h13', 'd13', 'c5'], m0: [['c13', 'h13', 'j']] })
  fail(s2, { type: 'meld', groups: [ids(s2, 0, 's13', 'h13', 'd13')] }, /già un gruppo/)
})
test('attacca a una scala: in coda, in testa, e il jolly va in fondo', () => {
  const s0 = scenario({ h0: ['h8', 'h2', 'j', 's2'], m0: [['h3', 'h4', 'h5', 'h6', 'h7']] })
  const s1 = run(s0, { type: 'attach', meld: s0.melds[0][0].id, ids: ids(s0, 0, 'h8') })
  assert.equal(s1.melds[0][0].cards.length, 6)
  const s2 = run(s1, { type: 'attach', meld: s1.melds[0][0].id, ids: ids(s1, 0, 'h2') })
  assert.equal(s2.melds[0][0].rank, 2)
  assert.equal(s2.melds[0][0].wild, null, 'il due del seme in testa alla scala è naturale')
  const s3 = run(s2, { type: 'attach', meld: s2.melds[0][0].id, ids: ids(s2, 0, 'j') })
  assert.equal(s3.melds[0][0].wild, 7)
})
test('attacca: la matta in mezzo si sostituisce con la carta vera e la matta resta nella scala', () => {
  const s0 = scenario({ h0: ['h5', 's2'], m0: [['h3', 'h4', 'j', 'h6', 'h7']] })
  const s1 = run(s0, { type: 'attach', meld: s0.melds[0][0].id, ids: ids(s0, 0, 'h5') })
  const m = s1.melds[0][0]
  assert.equal(m.cards.length, 6)
  assert.equal(m.wild, 0, 'la matta sostituita va in testa (pagat.com)')
  assert.equal(m.cards.filter((c) => c.s !== 'j').map((c) => c.r).join(), '3,4,5,6,7')
})
test('attacca: una matta già a un\'estremità non si sposta quando attacchi altre carte', () => {
  const s = scenario({ h0: ['h8', 's2'], m0: [['h3', 'h4', 'h5', 'h6', 'h7', 'j']] })
  const m = run(s, { type: 'attach', meld: s.melds[0][0].id, ids: ids(s, 0, 'h8') }).melds[0][0]
  assert.equal(m.wild, 6, 'la matta resta in coda (ora sta per il 9)')
  assert.equal(m.cards.length, 7)
  const lo = scenario({ h0: ['h8', 's2'] })
  const low = analyze(cs('j', 'h4', 'h5', 'h6', 'h7'), 'low')
  assert.ok(low.ok && low.meld.wild === 0)
  lo.melds[0].push({ ...low.meld, id: 777 })
  const m2 = run(lo, { type: 'attach', meld: lo.melds[0][0].id, ids: ids(lo, 0, 'h8') }).melds[0][0]
  assert.equal(m2.wild, 0)
})
test('attacca: end "low" mette la matta in testa', () => {
  const s0 = scenario({ h0: ['j', 's2'], m0: [['h4', 'h5', 'h6']] })
  const s1 = run(s0, { type: 'attach', meld: s0.melds[0][0].id, ids: ids(s0, 0, 'j'), end: 'low' })
  assert.equal(s1.melds[0][0].wild, 0)
  assert.equal(s1.melds[0][0].rank, 3)
})
test('attacca a un gruppo; carte sbagliate o gioco non tuo sono rifiutati', () => {
  const s = scenario({ h0: ['c13', 'h5', 's2'], m0: [['s13', 'h13', 'd13']], m1: [['s9', 'h9', 'd9']] })
  assert.equal(run(s, { type: 'attach', meld: s.melds[0][0].id, ids: ids(s, 0, 'c13') }).melds[0][0].cards.length, 4)
  fail(s, { type: 'attach', meld: s.melds[0][0].id, ids: ids(s, 0, 'h5') }, /non si attaccano/)
  fail(s, { type: 'attach', meld: s.melds[1][0].id, ids: ids(s, 0, 'c13') }, /solo ai tuoi/)
})
test('apertura da 50 (regola della casa): la prima calata deve valere almeno 50', () => {
  const s = scenario({ h0: ['h5', 'h6', 'h7', 'd13', 'c13', 's13', 'h13', 's2'], rules: { open50: true } })
  fail(s, { type: 'meld', groups: [ids(s, 0, 'h5', 'h6', 'h7')] }, /almeno 50/)
  const ok = run(s, { type: 'meld', groups: [ids(s, 0, 'h5', 'h6', 'h7'), ids(s, 0, 'd13', 'c13', 's13', 'h13')] })  // 15 + 40 = 55
  assert.equal(ok.melds[0].length, 2)
  const already = scenario({ h0: ['h5', 'h6', 'h7', 's2'], m0: [['d13', 'c13', 's13']], rules: { open50: true } })
  assert.equal(run(already, { type: 'meld', groups: [ids(already, 0, 'h5', 'h6', 'h7')] }).melds[0].length, 2)
})

// ───────────── pozzetto ─────────────

test('calare tutte le carte senza aver preso il pozzetto: lo prendi subito e continui a giocare', () => {
  const s0 = scenario({ h0: ['h5', 'h6', 'h7'] })
  const s1 = run(s0, { type: 'meld', groups: [ids(s0, 0, 'h5', 'h6', 'h7')] })
  assert.equal(s1.potTaken[0], true)
  assert.equal(s1.hands[0].length, POT_SIZE)
  assert.equal(s1.pots.length, 1)
  assert.equal(s1.phase, 'play')
  assert.equal(s1.turn, 0)
})
test('con il pozzetto già preso non puoi calare tutte le carte: te ne serve una da scartare', () => {
  const s = scenario({ h0: ['h5', 'h6', 'h7'], taken: [true, false], pots: 1 })
  fail(s, { type: 'meld', groups: [ids(s, 0, 'h5', 'h6', 'h7')] }, /una da scartare/)
})
test('non puoi lasciarti una sola carta che non potresti scartare per chiudere', () => {
  // pozzetto preso, nessun burraco: l'ultima carta non si potrebbe scartare
  const s = scenario({ h0: ['h5', 'h6', 'h7', 's9'], taken: [true, false], pots: 1 })
  fail(s, { type: 'meld', groups: [ids(s, 0, 'h5', 'h6', 'h7')] }, /non potresti scartare/)
  // con un burraco ci si può arrivare, ma non se l'ultima è una matta
  const b = scenario({ h0: ['h5', 'h6', 'h7', 'j'], m0: [seven('c', 3)], taken: [true, false], pots: 1 })
  fail(b, { type: 'meld', groups: [ids(b, 0, 'h5', 'h6', 'h7')] }, /matta/)
  const ok = scenario({ h0: ['h5', 'h6', 'h7', 's9'], m0: [seven('c', 3)], taken: [true, false], pots: 1 })
  assert.equal(run(ok, { type: 'meld', groups: [ids(ok, 0, 'h5', 'h6', 'h7')] }).hands[0].length, 1)
})
test('scartare l\'ultima carta senza pozzetto: lo prendi subito, lo userai al tuo turno', () => {
  const s0 = scenario({ h0: ['h5'], h1: ['d6'] })
  const s1 = run(s0, { type: 'discard', id: s0.hands[0][0].id })
  assert.equal(s1.turn, 1)
  assert.equal(s1.potTaken[0], true)
  assert.equal(s1.hands[0].length, POT_SIZE)
  assert.equal(s1.pots.length, 1)
})
test('se l\'avversario chiude mentre hai il pozzetto in mano, le sue carte si sottraggono (non -100)', () => {
  const s0 = scenario({ h0: ['h5'], m1: [seven('c', 3)], h1: [], taken: [false, true], turn: 0, pots: 1, rules: { mode: 'hand' } })
  const s1 = run(s0, { type: 'discard', id: s0.hands[0][0].id })     // A scarta l'ultima e prende il pozzetto (11 x d4 = 55)
  const s2 = run(s1, { type: 'draw' })
  const last = s2.hands[1][0]
  const s3 = run(s2, { type: 'discard', id: last.id })                // B ha 1 carta (pescata) e chiude
  assert.equal(s3.handScores[0].hand, 55)
  assert.equal(s3.handScores[0].pot, 0)
})
test('il primo che finisce prende il primo pozzetto: i pozzetti sono di nessuno', () => {
  const s0 = scenario({ h0: ['h5', 'h6', 'h7'], pots: 2 })
  const s1 = run(s0, { type: 'meld', groups: [ids(s0, 0, 'h5', 'h6', 'h7')] })
  assert.equal(s1.pots.length, 1)
  assert.equal(s1.potTaken[1], false)
})

// ───────────── chiusura e punteggio ─────────────

test('chiusura: scarti l\'ultima carta con pozzetto preso e un burraco -> +100 e la mano finisce', () => {
  const s0 = scenario({ h0: ['s9'], m0: [seven('c', 3)], m1: [['d10', 'd11', 'd12']], h1: ['h5', 'h6'], taken: [true, true], pots: 0, rules: { mode: 'hand' } })
  const s1 = run(s0, { type: 'discard', id: s0.hands[0][0].id })
  assert.equal(s1.phase, 'over')
  assert.equal(s1.closer, 0)
  // A: carte 3..9 = 45, burraco 200, chiusura 100, mano 0, pozzetto preso 0 -> 345
  // B: carte 10+10+10 = 30, mano 5+5 = 10 -> 20
  assert.deepEqual(s1.handScores.map((h) => h.total), [345, 20])
  assert.deepEqual(s1.scores, [345, 20])
  assert.equal(s1.matchOver, true)
  assert.equal(s1.winner, 0)
})
test('chiusura vietata: senza burraco o scartando una matta', () => {
  const noBur = scenario({ h0: ['s9'], m0: [['h5', 'h6', 'h7']], taken: [true, true], pots: 0 })
  fail(noBur, { type: 'discard', id: noBur.hands[0][0].id }, /burraco/)
  const wild = scenario({ h0: ['j'], m0: [seven('c', 3)], taken: [true, true], pots: 0 })
  fail(wild, { type: 'discard', id: wild.hands[0][0].id }, /matta/)
  const two = scenario({ h0: ['d2'], m0: [seven('c', 3)], taken: [true, true], pots: 0 })
  fail(two, { type: 'discard', id: two.hands[0][0].id }, /matta/)
})
test('punteggio: pozzetto non preso -100 e carte in mano sottratte', () => {
  const s0 = scenario({ h0: ['s9'], m0: [seven('c', 3)], h1: ['j', 'h1'], taken: [true, false], pots: 1, rules: { mode: 'hand' } })
  const s1 = run(s0, { type: 'discard', id: s0.hands[0][0].id })
  // B: nessuna calata, mano 30+15 = 45, pozzetto non preso -100 -> -145
  assert.deepEqual(s1.handScores[1], { melds: 0, burraci: 0, close: 0, hand: 45, pot: -100, total: -145 })
})
test('tallone: pescato il terzultimo è l\'ultimo turno, dopo lo scarto la mano finisce senza +100', () => {
  const s0 = scenario({ phase: 'draw', deck: ['c7', 'c8', 'c10'], h0: ['h5', 'h6', 'h7'], m0: [seven('d', 3)], taken: [true, true], pots: 0, rules: { mode: 'hand' } })
  const s1 = run(s0, { type: 'draw' })
  assert.equal(s1.deck.length, 2)
  assert.equal(s1.finalTurn, true)
  assert.equal(s1.phase, 'play')
  const s2 = run(s1, { type: 'meld', groups: [ids(s1, 0, 'h5', 'h6', 'h7')] })   // si può ancora calare
  const s3 = run(s2, { type: 'discard', id: s2.hands[0][0].id })
  assert.equal(s3.phase, 'over')
  assert.equal(s3.closer, null)
  assert.equal(s3.handScores[0].close, 0, 'niente +100 anche se hai scartato l\'ultima carta')
  fail(s3, { type: 'take' }, /finita/)
})
test('tallone: con più di 3 carte la mano continua', () => {
  const s1 = run(scenario({ phase: 'draw', deck: ['c7', 'c8', 'c10', 'c11'] }), { type: 'draw' })
  assert.equal(s1.finalTurn, false)
})
test('tallone vuoto (rete di sicurezza): pescare chiude la mano', () => {
  const s1 = run(scenario({ phase: 'draw', deck: [], rules: { mode: 'hand' } }), { type: 'draw' })
  assert.equal(s1.phase, 'over')
})
test('presa di un pozzo da una sola carta: non puoi calare e restare con quella sola carta', () => {
  const s0 = scenario({ phase: 'draw', discard: ['c9'], h0: ['h5', 'h6', 'h7'] })
  const s1 = run(s0, { type: 'take' })
  fail(s1, { type: 'meld', groups: [ids(s1, 0, 'h5', 'h6', 'h7')] }, /solo la carta del pozzo/)
})
test('partita a 1005: finisce solo se qualcuno arriva a 1005 e non c\'è pareggio; nextRound alterna chi apre', () => {
  const mid = scenario({ h0: ['s9'], m0: [seven('c', 3)], taken: [true, true], pots: 0, scores: [500, 400] })
  const s1 = run(mid, { type: 'discard', id: mid.hands[0][0].id })
  assert.equal(s1.scores[0], 845)
  assert.equal(s1.matchOver, false)
  const s2 = run(s1, { type: 'nextRound' }, (x) => shuffle(x, () => 0.5))
  assert.equal(s2.starter, 1)
  assert.equal(s2.turn, 1)
  assert.equal(s2.hands[0].length, HAND_SIZE)
  assert.deepEqual(s2.scores, s1.scores)
  const end = scenario({ h0: ['s9'], m0: [seven('c', 3)], taken: [true, true], pots: 0, scores: [900, 400] })
  const s3 = run(end, { type: 'discard', id: end.hands[0][0].id })
  assert.equal(s3.matchOver, true)
  assert.equal(s3.winner, 0)
  fail(s3, { type: 'nextRound' }, /partita è finita/)
  fail(scenario(), { type: 'nextRound' }, /non è finita/)
})
test('a mano finita non si gioca più', () => {
  const s0 = scenario({ h0: ['s9'], m0: [seven('c', 3)], taken: [true, true], pots: 0 })
  const s1 = run(s0, { type: 'discard', id: s0.hands[0][0].id })
  fail(s1, { type: 'draw' }, /finita/)
})
test('actionError: dice perché un\'azione non si può fare (per i suggerimenti del trascinamento)', () => {
  const s = scenario({ h0: ['h5', 'h6', 's9'] })
  assert.equal(actionError(s, { type: 'meld', groups: [ids(s, 0, 'h5', 'h6')] }), 'Servono almeno 3 carte')
  assert.equal(actionError(s, { type: 'discard', id: s.hands[0][2].id }), null)
})
test('il motore non muta lo stato che riceve', () => {
  const s0 = scenario({ h0: ['h5', 'h6', 'h7', 's2'] })
  const snap = JSON.stringify(s0)
  run(s0, { type: 'meld', groups: [ids(s0, 0, 'h5', 'h6', 'h7')] })
  assert.equal(JSON.stringify(s0), snap)
})
