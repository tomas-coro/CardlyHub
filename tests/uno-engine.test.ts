// Test del motore di UNO. Esecuzione: node --test tests/uno-engine.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_RULES, MERCY_LIMIT, NO_SPECIAL_END, apply, buildDeck, canPlay, canStack, cardPoints, newGame, playError, shuffle, siblings, topCard } from '../src/games/uno/engine.ts'
import type { Action, Card, Color, GameState, Rules, Shuffle } from '../src/games/uno/engine.ts'

let uid = 1000
// "r5" = cinque rosso, "bskip" = salta blu, "gd2" = +2 verde, "w" = Jolly, "w4" = Jolly +4
const mk = (code: string): Card =>
  code.startsWith('w') ? { id: ++uid, c: 'w', v: code } : { id: ++uid, c: code[0] as Color, v: code.slice(1) }
const cs = (...codes: string[]) => codes.map(mk)
const keep: Shuffle = (x) => x.slice()
const reverse: Shuffle = (x) => x.slice().reverse()

interface Setup {
  h0: string[]; h1: string[]; top?: string; color?: Color; deck?: string[]
  rules?: Partial<Rules>; turn?: number; pending?: number; scores?: number[]; starter?: number
}
// Stato costruito a mano: mani, carta in cima e mazzo (si pesca dalla FINE) decisi dal test.
function scenario(o: Setup): GameState {
  const t = mk(o.top ?? 'r5')
  return {
    deck: cs(...(o.deck ?? Array(20).fill('y1'))), disc: [t], hands: [cs(...o.h0), cs(...o.h1)], turn: o.turn ?? 0,
    color: o.color ?? (t.c as Color), pending: o.pending ?? 0, drawn: null, uno: [false, false], phase: 'play', wild: null,
    rules: { ...DEFAULT_RULES, ...o.rules }, names: ['A', 'B'], scores: o.scores ?? [0, 0], starter: o.starter ?? 0,
    roundWinner: null, points: 0, matchOver: false, events: [],
  }
}
const run = (s: GameState, a: Action, shuf: Shuffle = keep) => {
  const r = apply(s, a, shuf)
  assert.ok('state' in r, 'errore inatteso: ' + ('error' in r ? r.error : ''))
  return r.state
}
const fail = (s: GameState, a: Action, shuf: Shuffle = keep) => {
  const r = apply(s, a, shuf)
  assert.ok('error' in r, 'doveva dare errore')
  return r.error
}
// gioca le carte nelle posizioni date della mano di chi ha il turno
const play = (s: GameState, ...idx: number[]) => run(s, { type: 'play', cards: idx.map((i) => s.hands[s.turn][i].id) })
const color = (s: GameState, c: Color) => run(s, { type: 'color', color: c })
const draws = (s: GameState) => s.events.filter((e) => e.type === 'draw')

// ── mazzo e distribuzione ──

test('il mazzo ha 108 carte con id unici: 25 per colore e 8 Jolly', () => {
  const d = buildDeck()
  assert.equal(d.length, 108)
  assert.equal(new Set(d.map((x) => x.id)).size, 108)
  for (const c of ['r', 'b', 'y', 'g']) assert.equal(d.filter((x) => x.c === c).length, 25)
  assert.equal(d.filter((x) => x.v === 'w').length, 4)
  assert.equal(d.filter((x) => x.v === 'w4').length, 4)
  assert.equal(d.filter((x) => x.v === '0').length, 4)
})

test('newGame: 7 carte a testa, apre chi dice `first`, nessuna carta persa', () => {
  let n = 7
  const rng = () => ((n = (n * 16807) % 2147483647) / 2147483647)
  const s = newGame({ names: ['A', 'B'], first: 1 }, shuffle(buildDeck(), rng))
  assert.equal(s.hands[0].length, 7)
  assert.equal(s.hands[1].length, 7)
  assert.equal(s.turn, 1)
  assert.equal(s.deck.length + s.disc.length + 14, 108)
  assert.equal(s.color, topCard(s).c)
  assert.deepEqual(s.rules, DEFAULT_RULES)
})

test('la carta di apertura è sempre un numero: i Jolly e le azioni scoperti tornano in fondo al mazzo', () => {
  const s = newGame({ names: ['A', 'B'] }, cs('r3', 'w4', ...Array(14).fill('y1')))
  assert.equal(topCard(s).v, '3')
  assert.equal(s.deck.length, 1)
  assert.equal(s.deck[0].v, 'w4')
})

test('lo stato è JSON puro: sopravvive a un giro di stringa e si può continuare', () => {
  const s = scenario({ h0: ['r7', 'b1', 'b2'], h1: ['g1', 'g2', 'g3'] })
  const copy = JSON.parse(JSON.stringify(s))
  assert.deepEqual(copy, s)
  assert.deepEqual(play(copy, 0).hands[0].length, 2)
})

test('apply non muta lo stato che riceve', () => {
  const s = scenario({ h0: ['rd2', 'b1', 'b2'], h1: ['g1', 'g2', 'g3'] })
  const before = JSON.parse(JSON.stringify(s))
  play(s, 0)
  fail(s, { type: 'pass' })
  assert.deepEqual(s, before)
})

// ── giocare una carta ──

test('si gioca per colore, per numero o con un Jolly; altrimenti errore', () => {
  const s = scenario({ h0: ['r1', 'b5', 'g2', 'w'], h1: ['g1', 'g2', 'g3'] })  // in cima r5
  const [r1, b5, g2, w] = s.hands[0]
  assert.ok(canPlay(s, 0, r1.id))
  assert.ok(canPlay(s, 0, b5.id))
  assert.ok(canPlay(s, 0, w.id))
  assert.ok(!canPlay(s, 0, g2.id))
  assert.equal(fail(s, { type: 'play', cards: [g2.id] }), 'Questa carta non si può giocare')
  const n = play(s, 0)
  assert.equal(topCard(n).id, r1.id)
  assert.equal(n.turn, 1)
  assert.equal(n.hands[0].length, 3)
})

test('giocare una carta di un altro colore ma stesso numero cambia il colore in gioco', () => {
  const n = play(scenario({ h0: ['b5', 'b1', 'b2'], h1: ['g1', 'g2', 'g3'] }), 0)
  assert.equal(n.color, 'b')
})

test('errori: carta non in mano, doppioni, lista vuota', () => {
  const s = scenario({ h0: ['r1', 'b1', 'b2'], h1: ['r9', 'g2', 'g3'] })
  assert.match(fail(s, { type: 'play', cards: [s.hands[1][0].id] }), /non è nella tua mano/)
  assert.match(fail(s, { type: 'play', cards: [] }), /non valide/)
  assert.match(fail(s, { type: 'play', cards: [s.hands[0][0].id, s.hands[0][0].id] }), /non valide/)
})

test('Salta e Inverti (in due sono uguali): chi li gioca gioca ancora', () => {
  let n = play(scenario({ h0: ['rskip', 'b1', 'b2'], h1: ['g1', 'g2', 'g3'] }), 0)
  assert.equal(n.turn, 0)
  assert.deepEqual(n.events, [{ type: 'skip', p: 1 }])
  n = play(scenario({ h0: ['rrev', 'b1', 'b2'], h1: ['g1', 'g2', 'g3'] }), 0)
  assert.equal(n.turn, 0)
  // stesso simbolo di colore diverso: legale per valore, e il colore cambia
  n = play(scenario({ h0: ['bskip', 'b1', 'b2'], h1: ['g1', 'g2', 'g3'], top: 'rskip' }), 0)
  assert.equal(n.turn, 0)
  assert.equal(n.color, 'b')
})

// ── pescare ──

test('pesca non giocabile: la carta resta in mano e il turno passa', () => {
  const s = scenario({ h0: ['b1', 'g2', 'y9'], h1: ['g1', 'g2', 'g3'], deck: ['y1', 'b7'] })
  const n = run(s, { type: 'draw' })
  assert.equal(n.hands[0].length, 4)
  assert.equal(n.turn, 1)
  assert.equal(n.drawn, null)
  assert.deepEqual(n.events, [{ type: 'draw', p: 0, n: 1, why: 'free' }, { type: 'pass', p: 0 }])
})

test('pesca giocabile: è l\'unica carta che si può giocare, oppure si passa', () => {
  const s = scenario({ h0: ['b1', 'g2', 'y9'], h1: ['g1', 'g2', 'g3'], deck: ['y1', 'r9'] })
  const n = run(s, { type: 'draw' })
  assert.equal(n.turn, 0)
  assert.equal(n.drawn, n.hands[0][3].id)
  assert.equal(fail(n, { type: 'play', cards: [n.hands[0][0].id] }), 'Puoi giocare solo la carta pescata, oppure passare')
  assert.match(fail(n, { type: 'draw' }), /hai già pescato/)
  const played = play(n, 3)
  assert.equal(played.turn, 1)
  assert.equal(played.drawn, null)
  const passed = run(n, { type: 'pass' })
  assert.equal(passed.turn, 1)
  assert.equal(passed.drawn, null)
  assert.equal(passed.hands[0].length, 4)
})

test('non si può passare senza aver pescato', () => {
  assert.match(fail(scenario({ h0: ['r1', 'b1'], h1: ['g1', 'g2'] }), { type: 'pass' }), /dopo aver pescato/)
})

test('con mazzo e scarti finiti la pesca libera non fa niente e passa il turno (nessun crash)', () => {
  const s = scenario({ h0: ['b1', 'g2'], h1: ['g1', 'g2'], deck: [] })
  const n = run(s, { type: 'draw' })
  assert.equal(n.hands[0].length, 2)
  assert.equal(n.turn, 1)
})

test('mazzo finito: gli scarti (tranne la cima) si rimescolano con la funzione passata e perdono il colore scelto', () => {
  const s = scenario({ h0: ['b1', 'g2'], h1: ['g1', 'g2'], deck: [] })
  const wild = { ...mk('w'), chosen: 'b' as Color }
  s.disc = [wild, mk('r1'), mk('r2'), mk('r5')]
  const n = run(s, { type: 'draw' }, reverse)
  assert.equal(topCard(n).v, '5')
  assert.equal(n.disc.length, 1)
  // scarti [w, r1, r2] invertiti = [r2, r1, w]: si pesca dalla fine, quindi arriva il Jolly, senza `chosen`
  assert.equal(n.hands[0][2].v, 'w')
  assert.equal(n.hands[0][2].chosen, undefined)
  assert.equal(n.deck.length, 2)
  assert.ok(n.events.some((e) => e.type === 'reshuffle'))
})

// ── +2, +4, impilare ──

test('+2: l\'avversario che non può rispondere pesca 2 e salta il turno', () => {
  const n = play(scenario({ h0: ['rd2', 'b1', 'b2'], h1: ['g1', 'g2', 'g3'] }), 0)
  assert.equal(n.hands[1].length, 5)
  assert.equal(n.pending, 0)
  assert.equal(n.turn, 0)
  assert.deepEqual(draws(n), [{ type: 'draw', p: 1, n: 2, why: 'stack' }])
})

test('+2 su +2 (s22): la pesca si somma finché uno non può rispondere', () => {
  const s = scenario({ h0: ['rd2', 'b1', 'b2'], h1: ['gd2', 'g1', 'g2'], rules: { s22: true } })
  let n = play(s, 0)
  assert.equal(n.turn, 1)
  assert.equal(n.pending, 2)
  assert.equal(fail(n, { type: 'play', cards: [n.hands[1][1].id] }), 'Devi rispondere con un +2 o +4 valido, oppure pescare')
  n = play(n, 0)  // gd2
  assert.equal(n.pending, 0)
  assert.equal(n.hands[0].length, 6)  // 2 carte + 4 pescate
  assert.equal(n.turn, 1)
  // oppure pesca la pesca accumulata invece di impilare
  const d = run(play(s, 0), { type: 'draw' })
  assert.equal(d.hands[1].length, 5)
  assert.equal(d.turn, 0)
})

test('senza s22 un +2 non si impila nemmeno se lo hai', () => {
  const n = play(scenario({ h0: ['rd2', 'b1', 'b2'], h1: ['gd2', 'g1', 'g2'] }), 0)
  assert.equal(n.hands[1].length, 5)
  assert.equal(n.turn, 0)
})

test('s44: +4 su +4 e +2 su +4 solo del colore scelto', () => {
  const s = scenario({ h0: ['w4', 'bd2', 'rd2', 'g1'], h1: ['y1', 'y2', 'y3'], top: 'w4', color: 'b', pending: 4, rules: { s44: true } })
  assert.ok(canPlay(s, 0, s.hands[0][0].id))
  assert.ok(canPlay(s, 0, s.hands[0][1].id))
  assert.ok(!canPlay(s, 0, s.hands[0][2].id))
  assert.ok(!canPlay(s, 0, s.hands[0][3].id))
  let n = play(s, 0)            // +4 sopra +4
  n = color(n, 'y')
  assert.equal(n.phase, 'play')  // impilata: nessuna sfida
  assert.equal(n.pending, 0)
  assert.equal(n.hands[1].length, 11)  // 3 + 8
  assert.equal(n.turn, 1)              // dopo un +4 gioca chi ha pescato
  assert.equal(topCard(n).chosen, 'y')
})

test('senza s44 sopra un +4 non si risponde con niente', () => {
  const s = scenario({ h0: ['w4', 'bd2'], h1: ['y1', 'y2'], top: 'w4', color: 'b', pending: 4 })
  assert.match(fail(s, { type: 'play', cards: [s.hands[0][0].id] }), /rispondere/)
  assert.ok(!canStack(s, 0))
})

// ── Jolly, scelta del colore, sfida del +4 ──

test('Jolly: il turno resta a chi lo gioca finché non sceglie il colore', () => {
  let n = play(scenario({ h0: ['w', 'b1', 'b2'], h1: ['b9', 'g1', 'g2'] }), 0)
  assert.equal(n.phase, 'pick')
  assert.equal(n.turn, 0)
  assert.equal(n.color, 'r')
  assert.match(fail(n, { type: 'draw' }), /ora non si pesca/)
  assert.match(fail(n, { type: 'play', cards: [n.hands[0][0].id] }), /ora non si gioca/)
  assert.match(fail(n, { type: 'color', color: 'x' as Color }), /non valido/)
  n = color(n, 'b')
  assert.equal(n.phase, 'play')
  assert.equal(n.turn, 1)
  assert.equal(n.color, 'b')
  assert.equal(topCard(n).chosen, 'b')
  assert.ok(canPlay(n, 1, n.hands[1][0].id))   // b9 combacia col colore scelto
  assert.ok(!canPlay(n, 1, n.hands[1][1].id))
  assert.match(fail(play(scenario({ h0: ['r1', 'b1'], h1: ['g1', 'g2'] }), 0), { type: 'color', color: 'r' }), /non si sceglie/)
})

test('+4 con colore in mano: sfida riuscita, il colpevole pesca 4 e chi ha sfidato gioca', () => {
  let n = color(play(scenario({ h0: ['w4', 'r9', 'b2'], h1: ['y1', 'y2', 'y3'], rules: { challenge: true } }), 0), 'b')
  assert.equal(n.phase, 'challenge')
  assert.equal(n.turn, 1)
  assert.equal(n.pending, 4)
  n = run(n, { type: 'challenge' })
  assert.equal(n.hands[0].length, 6)   // 2 + 4
  assert.equal(n.hands[1].length, 3)
  assert.equal(n.pending, 0)
  assert.equal(n.phase, 'play')
  assert.equal(n.turn, 1)
  assert.deepEqual(n.events[0], { type: 'challenge', by: 1, won: true })
})

test('+4 senza il colore in mano: sfida persa, lo sfidante pesca 6 e perde il turno', () => {
  let n = color(play(scenario({ h0: ['w4', 'b1', 'b2'], h1: ['y1', 'y2', 'y3'], rules: { challenge: true } }), 0), 'b')
  n = run(n, { type: 'challenge' })
  assert.equal(n.hands[1].length, 9)   // 3 + 6
  assert.equal(n.hands[0].length, 2)
  assert.equal(n.turn, 0)
  assert.deepEqual(n.events[0], { type: 'challenge', by: 1, won: false })
})

test('+4 senza sfida (regola di base): chi lo riceve pesca 4 subito e poi gioca lui', () => {
  const n = color(play(scenario({ h0: ['w4', 'b1', 'b2'], h1: ['y1', 'y2', 'y3'] }), 0), 'b')
  assert.equal(n.phase, 'play')
  assert.equal(n.hands[1].length, 7)   // 3 + 4, nessuna fase di sfida
  assert.equal(n.pending, 0)
  assert.equal(n.turn, 1)
})

test('+2 subito: chi pesca salta il turno come nel UNO ufficiale', () => {
  const n = play(scenario({ h0: ['rd2', 'b1'], h1: ['y1', 'y2', 'y3'] }), 0)
  assert.equal(n.hands[1].length, 5)
  assert.equal(n.turn, 0)
})

test('+4 accettato: si pescano 4 e poi gioca chi ha pescato', () => {
  const n = run(color(play(scenario({ h0: ['w4', 'b1', 'b2'], h1: ['y1', 'y2', 'y3'], rules: { challenge: true } }), 0), 'b'), { type: 'accept' })
  assert.equal(n.hands[1].length, 7)
  assert.equal(n.turn, 1)
  assert.equal(n.pending, 0)
})

test('la penalità UNO non cambia il verdetto della sfida (il colore si guarda prima di pescare)', () => {
  // dopo il +4 resta solo b1: UNO dimenticato -> pesca 2 (r9 e r8), ma `had` era già deciso
  const s = scenario({ h0: ['w4', 'b1'], h1: ['y1', 'y2', 'y3'], deck: ['y1', 'y1', 'y1', 'y1', 'y1', 'y1', 'r9', 'r8'], rules: { challenge: true } })
  let n = color(play(s, 0), 'b')
  assert.equal(n.hands[0].length, 3)
  n = run(n, { type: 'challenge' })
  assert.equal(n.hands[1].length, 9)   // sfida persa
})

test('con s44 e un +4 in mano, "accept" pesca comunque (non resta in gioco con la pesca in sospeso)', () => {
  const s = scenario({ h0: ['w4', 'r9', 'b2'], h1: ['w4', 'y1', 'y2'], rules: { s44: true, challenge: true } })
  const ch = color(play(s, 0), 'b')
  assert.ok(canStack(ch, 1))
  const n = run(ch, { type: 'accept' })
  assert.equal(n.hands[1].length, 7)
  assert.equal(n.pending, 0)
  assert.equal(n.turn, 1)
})

test('"stack" risponde invece di sfidare; senza carte per farlo è un errore', () => {
  const s = scenario({ h0: ['w4', 'r9', 'b2'], h1: ['w4', 'y1', 'y2'], rules: { s44: true, challenge: true } })
  let n = run(color(play(s, 0), 'b'), { type: 'stack' })
  assert.equal(n.phase, 'play')
  assert.equal(n.turn, 1)
  assert.equal(n.pending, 4)
  n = color(play(n, 0), 'g')           // +4 sopra +4: nessuna sfida
  assert.equal(n.pending, 0)
  assert.equal(n.hands[0].length, 10)  // 2 + 8
  const noStack = color(play(scenario({ h0: ['w4', 'r9', 'b2'], h1: ['w4', 'y1', 'y2'], rules: { challenge: true } }), 0), 'b')  // s44 spento
  assert.match(fail(noStack, { type: 'stack' }), /nessuna carta/)
})

test('sfida, accetta e impila fuori fase danno errore', () => {
  const s = scenario({ h0: ['r1', 'b1'], h1: ['g1', 'g2'] })
  for (const type of ['challenge', 'accept', 'stack'] as const) assert.match(fail(s, { type }), /nessun \+4/)
})

// ── UNO! ──

test('UNO dimenticato: con una carta sola rimasta si pescano 2', () => {
  const n = play(scenario({ h0: ['r1', 'r2'], h1: ['g1', 'g2', 'g3'] }), 0)
  assert.equal(n.hands[0].length, 3)
  assert.deepEqual(draws(n), [{ type: 'draw', p: 0, n: 2, why: 'uno' }])
})

test('UNO dichiarato: niente penalità, e la dichiarazione si azzera dopo la giocata', () => {
  let s = scenario({ h0: ['r1', 'r2'], h1: ['g1', 'g2', 'g3'] })
  s = run(s, { type: 'uno', player: 0, on: true })
  assert.equal(s.uno[0], true)
  const n = play(s, 0)
  assert.equal(n.hands[0].length, 1)
  assert.equal(n.uno[0], false)
})

test('UNO si può dichiarare anche fuori turno, è idempotente e vale solo con 3 carte o meno', () => {
  const s = scenario({ h0: ['r1', 'r2', 'r3'], h1: ['g1', 'g2', 'g3'] })
  let n = run(s, { type: 'uno', player: 1, on: true })
  n = run(n, { type: 'uno', player: 1, on: true })
  assert.equal(n.uno[1], true)
  n = run(n, { type: 'uno', player: 1, on: false })
  assert.equal(n.uno[1], false)
  assert.deepEqual(n.events, [])
  assert.match(fail(scenario({ h0: ['r1', 'r2', 'r3', 'r4'], h1: ['g1'] }), { type: 'uno', player: 0, on: true }), /3 carte o meno/)
})

// ── più carte uguali ──

test('multi: le carte con lo stesso numero si giocano insieme, l\'ultima decide il colore', () => {
  const s = scenario({ h0: ['r3', 'b3', 'g3', 'y3', 'rskip'], h1: ['g1', 'g2', 'g4'], rules: { multi: true }, top: 'r5' })
  assert.deepEqual(siblings(s, 0, s.hands[0][0].id).map((c) => c.c), ['b', 'g', 'y'])
  const n = play(s, 0, 1, 2)
  assert.equal(n.disc.length, 4)  // la cima di prima + 3 giocate
  assert.equal(n.color, 'g')
  assert.equal(n.hands[0].length, 2)
  assert.equal(n.turn, 1)
  assert.equal(play(s, 0, 1, 2, 3).color, 'y')
})

test('multi: errori (regola spenta, Jolly, valori diversi, prima carta illegale, pesca in sospeso, più di 4)', () => {
  const rules = { multi: true }
  const s = scenario({ h0: ['r3', 'b3', 'w', 'rskip', 'b4'], h1: ['g1', 'g2', 'g4'], rules })
  const id = (i: number) => s.hands[0][i].id
  const off = scenario({ h0: ['r3', 'b3', 'b4'], h1: ['g1', 'g2'] })
  assert.match(fail(off, { type: 'play', cards: [off.hands[0][0].id, off.hands[0][1].id] }), /spente/)
  assert.deepEqual(siblings(off, 0, off.hands[0][0].id), [])
  assert.match(fail(s, { type: 'play', cards: [id(0), id(2)] }), /mai Jolly/)
  assert.match(fail(s, { type: 'play', cards: [id(0), id(3)] }), /solo carte uguali/)
  assert.equal(fail(s, { type: 'play', cards: [id(1), id(0)] }), 'Questa carta non si può giocare')  // b3 su r5 non combacia
  assert.deepEqual(siblings(s, 0, id(2)), [])   // un Jolly non ha "uguali"
  const five = scenario({ h0: ['r3', 'b3', 'g3', 'y3', 'r3'], h1: ['g1', 'g2'], rules })
  assert.match(fail(five, { type: 'play', cards: five.hands[0].map((c) => c.id) }), /al massimo 4/)
  const pend = scenario({ h0: ['rd2', 'bd2'], h1: ['g1', 'g2'], rules: { multi: true, s22: true }, top: 'gd2', pending: 2 })
  assert.match(fail(pend, { type: 'play', cards: pend.hands[0].map((c) => c.id) }), /una carta sola/)
  assert.deepEqual(siblings(pend, 0, pend.hands[0][0].id), [])
})

test('multi: due +2 insieme valgono 4, due Salta fanno giocare ancora', () => {
  let n = play(scenario({ h0: ['rd2', 'bd2', 'b1'], h1: ['g1', 'g2', 'g3'], rules: { multi: true } }), 0, 1)
  assert.equal(n.hands[1].length, 7)
  assert.equal(n.turn, 0)
  n = play(scenario({ h0: ['rskip', 'bskip', 'b1'], h1: ['g1', 'g2', 'g3'], rules: { multi: true } }), 0, 1)
  assert.equal(n.turn, 0)
})

test('multi: se restano meno carte del previsto vale lo stesso UNO dimenticato', () => {
  const n = play(scenario({ h0: ['r3', 'b3', 'g1'], h1: ['g2', 'g4', 'g5'], rules: { multi: true }, top: 'r3' }), 0, 1)
  assert.equal(n.hands[0].length, 3)  // 1 rimasta + 2 di penalità
})

// ── 7 e 0 ──

test('7 e 0: le mani si scambiano', () => {
  const s7 = scenario({ h0: ['r7', 'b1', 'b2'], h1: ['g1', 'g2', 'g3', 'g4'], rules: { swap: true } })
  let n = play(s7, 0)
  assert.deepEqual(n.hands[0].map((c) => c.v), ['1', '2', '3', '4'])
  assert.equal(n.hands[1].length, 2)
  assert.deepEqual(n.events, [{ type: 'swap' }])
  assert.equal(n.turn, 1)
  n = play(scenario({ h0: ['r0', 'b1', 'b2'], h1: ['g1', 'g2', 'g3', 'g4'], rules: { swap: true } }), 0)
  assert.equal(n.hands[1].length, 2)
  assert.equal(play(scenario({ h0: ['r7', 'b1', 'b2'], h1: ['g1', 'g2', 'g3', 'g4'] }), 0).hands[1].length, 4)  // regola spenta
})

test('7 e 0 con più carte: lo 0 scambia una volta, due 7 insieme si annullano', () => {
  const rules = { swap: true, multi: true }
  const seven = play(scenario({ h0: ['r7', 'b7', 'b1', 'b2'], h1: ['g1', 'g2', 'g3', 'g4', 'g5'], rules }), 0, 1)
  assert.equal(seven.hands[1].length, 5)
  assert.ok(!seven.events.some((e) => e.type === 'swap'))
  const zero = play(scenario({ h0: ['r0', 'b0', 'b1', 'b2'], h1: ['g1', 'g2', 'g3', 'g4', 'g5'], rules }), 0, 1)
  assert.equal(zero.hands[1].length, 2)
})

test('un 7 come ultima carta chiude la mano senza scambiare', () => {
  const n = play(scenario({ h0: ['r7'], h1: ['g1', 'g2', 'g3'], rules: { swap: true } }), 0)
  assert.equal(n.phase, 'over')
  assert.equal(n.hands[0].length, 0)
  assert.equal(n.hands[1].length, 3)
})

// ── fine mano, punti, modalità ──

test('punti delle carte: numero = valore, Salta/Inverti/+2 = 20, Jolly e +4 = 50', () => {
  assert.deepEqual(cs('r0', 'b9', 'gskip', 'yrev', 'rd2', 'w', 'w4').map(cardPoints), [0, 9, 20, 20, 20, 50, 50])
})

test('mano singola: chi finisce le carte vince e la partita è chiusa; i punti sono le carte dell\'avversario', () => {
  const n = play(scenario({ h0: ['r7'], h1: ['w', 'rskip', 'b9'], rules: { mode: 'single' } }), 0)
  assert.equal(n.phase, 'over')
  assert.equal(n.roundWinner, 0)
  assert.equal(n.points, 79)
  assert.deepEqual(n.scores, [1, 0])
  assert.equal(n.matchOver, true)
})

test('al meglio di 3 e di 5: si contano le mani vinte, non i punti', () => {
  const win = (mode: Rules['mode'], scores: number[]) => play(scenario({ h0: ['r7'], h1: ['w', 'b9'], rules: { mode }, scores }), 0)
  const a = win('bo3', [0, 0])
  assert.deepEqual(a.scores, [1, 0])
  assert.equal(a.matchOver, false)
  assert.equal(win('bo3', [1, 1]).matchOver, true)
  assert.equal(win('bo5', [1, 1]).matchOver, false)
  assert.equal(win('bo5', [2, 1]).matchOver, true)
})

test('500 punti: la mano dà le carte rimaste all\'avversario, la partita finisce a 500', () => {
  const win = (scores: number[]) => play(scenario({ h0: ['r7'], h1: ['w', 'b9'], rules: { mode: 'pts' }, scores }), 0)
  const a = win([0, 0])
  assert.deepEqual(a.scores, [59, 0])
  assert.equal(a.matchOver, false)
  assert.equal(win([441, 0]).matchOver, true)
  assert.equal(win([440, 0]).matchOver, false)
})

test('ultima carta +2: l\'avversario la pesca prima del conteggio (regola ufficiale)', () => {
  const n = play(scenario({ h0: ['rd2'], h1: ['g1', 'g2'], rules: { mode: 'pts' } }), 0)
  assert.equal(n.hands[1].length, 4)
  assert.equal(n.points, 1 + 2 + 1 + 1)
  assert.deepEqual(draws(n), [{ type: 'draw', p: 1, n: 2, why: 'end' }])
})

test('ultima carta +4 o +2 impilato: si pesca tutto, anche la pesca già accumulata', () => {
  const w4 = play(scenario({ h0: ['w4'], h1: ['g1', 'g2'], rules: { mode: 'pts' } }), 0)
  assert.equal(w4.phase, 'over')
  assert.equal(w4.hands[1].length, 6)
  const stacked = play(scenario({ h0: ['gd2'], h1: ['g1'], top: 'rd2', pending: 2, rules: { s22: true, mode: 'pts' } }), 0)
  assert.equal(stacked.hands[1].length, 5)
  const plain = play(scenario({ h0: ['w'], h1: ['g1', 'g2'] }), 0)
  assert.equal(plain.phase, 'over')
  assert.equal(plain.hands[1].length, 2)
})

test('dopo la fine mano ogni azione tranne nextRound è rifiutata; nextRound non c\'è a metà mano', () => {
  const s = scenario({ h0: ['r1', 'b1'], h1: ['g1', 'g2'] })
  assert.match(fail(s, { type: 'nextRound' }), /non è finita/)
  const over = play(scenario({ h0: ['r7'], h1: ['g1', 'g2'], rules: { mode: 'bo3' } }), 0)
  for (const a of [{ type: 'draw' }, { type: 'pass' }, { type: 'uno', player: 0, on: true }, { type: 'play', cards: [1] }] as Action[]) {
    assert.match(fail(over, a), /finita/)
  }
})

test('nextRound: nuova mano, apre l\'altro, punteggio e regole restano', () => {
  const over = play(scenario({ h0: ['r7'], h1: ['g1', 'g2'], rules: { mode: 'bo3', multi: true }, starter: 0 }), 0)
  const n = run(over, { type: 'nextRound' })
  assert.equal(n.phase, 'play')
  assert.equal(n.starter, 1)
  assert.equal(n.turn, 1)
  assert.deepEqual(n.scores, [1, 0])
  assert.equal(n.rules.multi, true)
  assert.equal(n.hands[0].length, 7)
  assert.equal(n.hands[1].length, 7)
  assert.equal(n.roundWinner, null)
  assert.equal(n.matchOver, false)
  assert.equal(n.deck.length + n.disc.length + 14, 108)
  // e la mano dopo apre di nuovo il primo
  assert.equal(run({ ...n, phase: 'over', roundWinner: 1 }, { type: 'nextRound' }).starter, 0)
})

test('nextRound dopo la fine della partita è rifiutato', () => {
  const over = play(scenario({ h0: ['r7'], h1: ['g1', 'g2'], rules: { mode: 'single' } }), 0)
  assert.match(fail(over, { type: 'nextRound' }), /partita è finita/)
})

test('un\'intera mano giocata a turno: ogni carta resta contata', () => {
  // partita vera con mazzo mescolato e giocatori che giocano la prima carta valida o pescano
  let n = 3
  const rng = () => ((n = (n * 48271) % 2147483647) / 2147483647)
  const mix: Shuffle = (c) => shuffle(c, rng)
  let s = newGame({ names: ['A', 'B'], rules: { s22: true, s44: true, multi: true, swap: true, mode: 'single' } }, mix(buildDeck()))
  for (let step = 0; step < 2000 && s.phase !== 'over'; step++) {
    const total = s.deck.length + s.disc.length + s.hands[0].length + s.hands[1].length
    assert.equal(total, 108, 'passo ' + step)
    let a: Action
    if (s.phase === 'pick') a = { type: 'color', color: 'r' }
    else if (s.phase === 'challenge') a = { type: 'accept' }
    else {
      // dichiara UNO appena può, altrimenti la penalità di 2 carte non gli lascia mai finire la mano
      if (s.hands[s.turn].length <= 3) s = run(s, { type: 'uno', player: s.turn, on: true })
      const ok = s.hands[s.turn].find((c) => canPlay(s, s.turn, c.id))
      a = ok ? { type: 'play', cards: [ok.id] } : s.drawn !== null ? { type: 'pass' } : { type: 'draw' }
    }
    s = run(s, a, mix)
  }
  assert.equal(s.phase, 'over', 'la mano doveva finire')
  assert.equal(playError(s, 0, 1), 'La mano è finita')
})

// ── regole nuove: niente chiusura speciale, pesca finché giochi, pietà ──

test('noSpecialEnd: con una carta sola si chiude solo con un numero', () => {
  const rules = { noSpecialEnd: true }
  const win = play(scenario({ h0: ['r7'], h1: ['g1', 'g2'], rules }), 0)
  assert.equal(win.phase, 'over')
  for (const code of ['rskip', 'rrev', 'rd2', 'w', 'w4']) {
    const s = scenario({ h0: [code], h1: ['g1', 'g2'], rules })
    assert.equal(fail(s, { type: 'play', cards: [s.hands[0][0].id] }), NO_SPECIAL_END, code)
    assert.ok(!canPlay(s, 0, s.hands[0][0].id), code)
    assert.equal(playError(s, 0, s.hands[0][0].id), NO_SPECIAL_END)
  }
  // regola spenta: si chiude con la speciale
  assert.equal(play(scenario({ h0: ['rskip'], h1: ['g1', 'g2'] }), 0).phase, 'over')
})

test('noSpecialEnd: con più carte la speciale si gioca, e con la sola speciale rimasta si pesca', () => {
  const rules = { noSpecialEnd: true }
  const n = play(scenario({ h0: ['rskip', 'r7'], h1: ['g1', 'g2', 'g3'], rules }), 0)
  assert.equal(n.phase, 'play')           // resta il 7 (e la penalità UNO)
  const stuck = scenario({ h0: ['rskip'], h1: ['g1', 'g2'], rules, deck: ['y1', 'y2'] })
  const d = run(stuck, { type: 'draw' })  // pesca y2: non giocabile su r5, passa
  assert.equal(d.hands[0].length, 2)
  assert.equal(d.turn, 1)
})

test('noSpecialEnd: vale anche per più carte uguali che svuotano la mano, e per la pesca da impilare', () => {
  const s = scenario({ h0: ['rskip', 'bskip'], h1: ['g1', 'g2'], rules: { noSpecialEnd: true, multi: true } })
  assert.equal(fail(s, { type: 'play', cards: s.hands[0].map((c) => c.id) }), NO_SPECIAL_END)
  const nums = scenario({ h0: ['r3', 'b3'], h1: ['g1', 'g2'], rules: { noSpecialEnd: true, multi: true }, top: 'r3' })
  assert.equal(run(nums, { type: 'play', cards: nums.hands[0].map((c) => c.id) }).phase, 'over')
  const pend = scenario({ h0: ['gd2'], h1: ['g1'], top: 'rd2', pending: 2, rules: { noSpecialEnd: true, s22: true } })
  assert.ok(!canPlay(pend, 0, pend.hands[0][0].id))
})

test('drawUntil: si pesca finché esce una carta giocabile, che si può giocare o passare', () => {
  const s = scenario({ h0: ['b1', 'g2'], h1: ['g1', 'g2'], deck: ['y1', 'r9', 'g2', 'b4'], rules: { drawUntil: true } })  // pesca b4, g2, r9
  const n = run(s, { type: 'draw' })
  assert.equal(n.hands[0].length, 5)
  assert.equal(n.turn, 0)
  assert.equal(n.drawn, n.hands[0][4].id)
  assert.deepEqual(n.events, [{ type: 'draw', p: 0, n: 3, why: 'free' }])
  assert.equal(play(n, 4).turn, 1)
  // senza la regola: una carta sola e passa
  const off = run({ ...s, rules: { ...s.rules, drawUntil: false } }, { type: 'draw' })
  assert.equal(off.hands[0].length, 3)
  assert.equal(off.turn, 1)
})

test('drawUntil: se non esce nulla di giocabile si pesca tutto il possibile e si passa', () => {
  const s = scenario({ h0: ['b1', 'g2'], h1: ['g1', 'g2'], deck: ['g2', 'b4'], rules: { drawUntil: true } })
  const n = run(s, { type: 'draw' })
  assert.equal(n.hands[0].length, 4)
  assert.equal(n.drawn, null)
  assert.equal(n.turn, 1)
})

test('drawUntil non tocca la pesca di +2/+4: quella è sempre fissa', () => {
  const n = play(scenario({ h0: ['rd2', 'b1', 'b2'], h1: ['g1', 'g2', 'g3'], rules: { drawUntil: true } }), 0)
  assert.equal(n.hands[1].length, 5)
})

test('pietà: a 25 carte in mano si perde la mano, e l\'altro prende i punti', () => {
  const big = Array(MERCY_LIMIT - 2).fill('g1')   // 23 carte
  const n = play(scenario({ h0: ['rd2', 'b1', 'b2'], h1: big, rules: { mercy: true, mode: 'pts' } }), 0)
  assert.equal(n.hands[1].length, MERCY_LIMIT)
  assert.equal(n.phase, 'over')
  assert.equal(n.roundWinner, 0)
  assert.equal(n.points, MERCY_LIMIT)
  assert.deepEqual(n.scores, [MERCY_LIMIT, 0])
  assert.ok(n.events.some((e) => e.type === 'mercy' && e.p === 1))
  assert.equal(n.pending, 0)
  // 24 carte non basta, e a regola spenta non succede niente
  assert.equal(play(scenario({ h0: ['rd2', 'b1', 'b2'], h1: Array(22).fill('g1'), rules: { mercy: true } }), 0).phase, 'play')
  assert.equal(play(scenario({ h0: ['rd2', 'b1', 'b2'], h1: big }), 0).phase, 'play')
})

test('pietà: vale anche per chi pesca da solo, e conta le mani vinte nelle serie', () => {
  const s = scenario({ h0: ['b1', 'g2'], h1: ['g1', 'g2'], deck: ['y1'], rules: { mercy: true, mode: 'bo3' } })
  s.hands[0] = cs(...Array(24).fill('g3'))
  const n = run(s, { type: 'draw' })   // pesca y1: 25 carte
  assert.equal(n.phase, 'over')
  assert.equal(n.roundWinner, 1)
  assert.deepEqual(n.scores, [0, 1])
})

test('partite intere con tutte le regole accese finiscono sempre e non perdono carte', () => {
  for (let seed = 1; seed <= 25; seed++) {
    let n = seed * 7919
    const rng = () => ((n = (n * 48271) % 2147483647) / 2147483647)
    const mix: Shuffle = (c) => shuffle(c, rng)
    let s = newGame({ names: ['A', 'B'], rules: { s22: true, s44: true, multi: true, swap: true, noSpecialEnd: true, drawUntil: true, mercy: true, mode: 'single' } }, mix(buildDeck()))
    for (let step = 0; step < 3000 && s.phase !== 'over'; step++) {
      assert.equal(s.deck.length + s.disc.length + s.hands[0].length + s.hands[1].length, 108, `seed ${seed} passo ${step}`)
      let a: Action
      if (s.phase === 'pick') a = { type: 'color', color: 'r' }
      else if (s.phase === 'challenge') a = { type: 'accept' }
      else {
        if (s.hands[s.turn].length <= 3) s = run(s, { type: 'uno', player: s.turn, on: true })
        const ok = s.hands[s.turn].find((c) => canPlay(s, s.turn, c.id))
        a = ok ? { type: 'play', cards: [ok.id] } : s.drawn !== null ? { type: 'pass' } : { type: 'draw' }
      }
      s = run(s, a, mix)
    }
    assert.equal(s.phase, 'over', `seed ${seed}: la mano doveva finire`)
  }
})
