// Test del motore della Briscola. Esecuzione: node --test tests/briscola-engine.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { apply, buildDeck, newGame, points, score, shuffle, strength, trickWinner, winner } from '../src/games/briscola/engine.ts'
import type { Card, GameState, Suit } from '../src/games/briscola/engine.ts'

let uid = 1000
// "coppe3" = tre di coppe, "denari10" = re di denari
const c = (code: string): Card => {
  const m = code.match(/^([a-z]+)(\d+)$/)!
  return { id: ++uid, s: m[1] as Suit, r: +m[2] }
}
const cards = (...codes: string[]) => codes.map(c)

// stato costruito a mano: mani, briscola e mazzo decisi dal test
function scenario(h0: string[], h1: string[], trump = 'denari2', deckCodes: string[] = []): GameState {
  const t = c(trump)
  return {
    deck: [t, ...cards(...deckCodes)], trump: t, hands: [cards(...h0), cards(...h1)], piles: [[], []],
    table: [], names: ['A', 'B'], turn: 0, phase: 'playing',
  }
}
const run = (s: GameState, a: Parameters<typeof apply>[1]) => {
  const r = apply(s, a)
  assert.ok('state' in r, 'errore inatteso: ' + ('error' in r ? r.error : ''))
  return r.state
}
const play = (s: GameState, p: number, i: number) => run(s, { type: 'play', card: s.hands[p][i].id })

test('il mazzo ha 40 carte e 120 punti', () => {
  const d = buildDeck()
  assert.equal(d.length, 40)
  assert.equal(new Set(d.map((x) => x.id)).size, 40)
  assert.equal(d.reduce((sum, x) => sum + points(x), 0), 120)
})

test('punti: Asso 11, Tre 10, Re 4, Cavallo 3, Fante 2, gli altri 0', () => {
  assert.deepEqual([1, 3, 10, 9, 8, 7, 6, 5, 4, 2].map((r) => points({ id: 0, s: 'coppe', r })), [11, 10, 4, 3, 2, 0, 0, 0, 0, 0])
})

test('forza: Asso > Tre > Re > Cavallo > Fante > 7 > 6 > 5 > 4 > 2', () => {
  const order = [1, 3, 10, 9, 8, 7, 6, 5, 4, 2]
  for (let i = 0; i < order.length - 1; i++) assert.ok(strength({ id: 0, s: 'coppe', r: order[i] }) > strength({ id: 0, s: 'coppe', r: order[i + 1] }))
})

test('shuffle non perde carte e dipende dall\'rng passato', () => {
  const d = buildDeck()
  const a = shuffle(d, () => 0.3)
  const b = shuffle(d, () => 0.3)
  assert.deepEqual(a, b)
  assert.equal(new Set(a.map((x) => x.id)).size, 40)
  assert.notDeepEqual(a, d)
})

test('newGame: 3 carte a testa, briscola sotto il mazzo, 34 carte nel mazzo', () => {
  const s = newGame({ names: ['A', 'B'], first: 1 }, buildDeck())
  assert.deepEqual([s.hands[0].length, s.hands[1].length], [3, 3])
  assert.equal(s.deck.length, 34)             // 40 - 6 date; la briscola è ancora nel mazzo, come ultima
  assert.equal(s.deck[0].id, s.trump.id)
  assert.equal(s.turn, 1)
  // si pesca dalla fine: la prima carta data a chi apre è l'ultima del mazzo originale
  assert.equal(s.hands[1][0].id, 40)
})

test('stesso seme: vince la carta più forte, anche se è di chi ha risposto', () => {
  assert.equal(trickWinner([{ p: 0, card: c('coppe7') }, { p: 1, card: c('coppe3') }], 'denari'), 1)
  assert.equal(trickWinner([{ p: 0, card: c('coppe1') }, { p: 1, card: c('coppe3') }], 'denari'), 0)
  assert.equal(trickWinner([{ p: 1, card: c('coppe10') }, { p: 0, card: c('coppe9') }], 'denari'), 1)
})

test('semi diversi: vince chi ha aperto, a meno che chi risponde giochi briscola', () => {
  assert.equal(trickWinner([{ p: 0, card: c('coppe2') }, { p: 1, card: c('spade1') }], 'denari'), 0)  // l'asso di un altro seme non batte
  assert.equal(trickWinner([{ p: 0, card: c('coppe1') }, { p: 1, card: c('denari2') }], 'denari'), 1) // anche il due di briscola batte l'asso
  assert.equal(trickWinner([{ p: 0, card: c('denari2') }, { p: 1, card: c('spade1') }], 'denari'), 0) // briscola aperta, risposta non briscola
  assert.equal(trickWinner([{ p: 0, card: c('denari4') }, { p: 1, card: c('denari2') }], 'denari'), 0)
})

test('play: la prima carta passa il turno, la seconda aspetta collect', () => {
  let s = scenario(['coppe1', 'coppe2', 'coppe4'], ['spade1', 'spade2', 'spade4'])
  s = play(s, 0, 0)
  assert.equal(s.turn, 1)
  assert.equal(s.table.length, 1)
  assert.equal(s.hands[0].length, 2)
  s = play(s, 1, 0)
  assert.equal(s.table.length, 2)
  assert.equal(s.piles[0].length + s.piles[1].length, 0)   // non è ancora stata assegnata
})

test('play: errori chiari (carta non tua, terza carta, partita finita)', () => {
  const s = scenario(['coppe1', 'coppe2', 'coppe4'], ['spade1', 'spade2', 'spade4'])
  assert.ok('error' in apply(s, { type: 'play', card: s.hands[1][0].id }))   // carta dell'altro
  assert.ok('error' in apply(s, { type: 'play', card: 99999 }))
  const full = play(play(s, 0, 0), 1, 0)
  assert.ok('error' in apply(full, { type: 'play', card: full.hands[0][0].id }))
  assert.ok('error' in apply(s, { type: 'collect' }))                        // presa non completa
  assert.ok('error' in apply({ ...s, phase: 'over' }, { type: 'play', card: s.hands[0][0].id }))
})

test('collect: il vincitore prende, pesca per primo e apre la presa dopo', () => {
  // Tomas apre coppe2, Lei risponde con spade1 (altro seme, non briscola): vince Tomas
  let s = scenario(['coppe2', 'coppe4', 'coppe5'], ['spade1', 'spade2', 'spade4'], 'denari2', ['bastoni4', 'bastoni5'])
  const [d1, d2] = [s.deck[2], s.deck[1]]   // si pesca dalla fine
  s = run(play(play(s, 0, 0), 1, 0), { type: 'collect' })
  assert.equal(s.piles[0].length, 2)
  assert.equal(s.turn, 0)
  assert.equal(s.hands[0].at(-1)!.id, d1.id)   // pesca prima Tomas
  assert.equal(s.hands[1].at(-1)!.id, d2.id)
  assert.equal(s.table.length, 0)
  assert.equal(s.deck.length, 1)
})

test('l\'ultima pescata è la briscola scoperta: la prende chi ha perso l\'ultima presa', () => {
  // mazzo = solo la briscola: vince Tomas, pesca per primo ma non c'è nulla... prima Tomas prende l'unica carta rimasta (la briscola)
  let s = scenario(['coppe2', 'coppe4', 'coppe5'], ['spade1', 'spade2', 'spade4'], 'denari7', ['bastoni4'])
  assert.equal(s.deck.length, 2)               // briscola + una carta
  s = run(play(play(s, 0, 0), 1, 0), { type: 'collect' })   // vince 0: pesca bastoni4, Lei pesca la briscola
  assert.equal(s.deck.length, 0)
  assert.equal(s.hands[1].at(-1)!.id, s.trump.id)
  assert.equal(s.hands[0].length, 3)
  assert.equal(s.hands[1].length, 3)
})

test('a mazzo vuoto le mani si svuotano e la partita finisce', () => {
  let s = scenario(['coppe2'], ['spade1'])
  s = { ...s, deck: [] }
  s = run(play(play(s, 0, 0), 1, 0), { type: 'collect' })
  assert.equal(s.phase, 'over')
  assert.ok('error' in apply(s, { type: 'collect' }))
})

test('vince chi supera 60; con la partita in corso winner è null', () => {
  const base = scenario([], [])
  const all = buildDeck()
  const A = all.filter((x) => x.r === 1 || x.r === 3)          // 4 assi + 4 tre = 84 punti
  const ids = new Set(A.map((x) => x.id))
  const s: GameState = { ...base, piles: [all.filter((x) => !ids.has(x.id)), A], phase: 'over' }
  assert.equal(score(s, 1), 84)
  assert.equal(winner(s), 1)
  assert.equal(winner({ ...s, phase: 'playing' }), null)
})

test('pareggio vero: 60 a 60', () => {
  const base = scenario([], [])
  // A: 4 assi (44) + 1 tre (10) + 1 Re (4) + 1 Fante (2) = 60. B: i restanti
  const all = buildDeck()
  const pick = (r: number, n: number) => all.filter((x) => x.r === r).slice(0, n)
  const A = [...pick(1, 4), ...pick(3, 1), ...pick(10, 1), ...pick(8, 1)]
  const ids = new Set(A.map((x) => x.id))
  const B = all.filter((x) => !ids.has(x.id))
  const s: GameState = { ...base, piles: [A, B], phase: 'over' }
  assert.equal(score(s, 0), 60)
  assert.equal(score(s, 1), 60)
  assert.equal(winner(s), -1)
})

test('partita intera casuale: 20 prese, 120 punti, nessuna carta persa', () => {
  for (let seed = 1; seed <= 25; seed++) {
    let x = seed * 9301
    const rng = () => ((x = (x * 16807) % 2147483647) / 2147483647)
    let s = newGame({ names: ['A', 'B'], first: seed % 2 }, shuffle(buildDeck(), rng))
    let tricks = 0
    while (s.phase === 'playing') {
      if (s.table.length === 2) { s = run(s, { type: 'collect' }); tricks++; continue }
      const hand = s.hands[s.turn]
      s = run(s, { type: 'play', card: hand[Math.floor(rng() * hand.length)].id })
    }
    assert.equal(tricks, 20)
    assert.equal(score(s, 0) + score(s, 1), 120)
    assert.equal(s.piles[0].length + s.piles[1].length, 40)
    assert.equal(s.deck.length, 0)
  }
})
