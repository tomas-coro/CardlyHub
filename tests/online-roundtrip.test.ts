import test from 'node:test'
import assert from 'node:assert/strict'
import { decodeState, encodeState } from '../src/lib/online-game.ts'
import * as dadi from '../src/games/dadi/engine.ts'
import * as briscola from '../src/games/briscola/engine.ts'
import * as uno from '../src/games/uno/engine.ts'
import * as burraco from '../src/games/burraco/engine.ts'
import * as machiavelli from '../src/games/machiavelli/engine.ts'

// Lo stato di ogni gioco viaggia su Firestore come testo JSON. JSON perde in silenzio undefined dentro gli array
// (diventa null) e NaN/Infinity: qui giochiamo partite intere (mosse casuali ma legali) e a ogni passo
// controlliamo che andata e ritorno restituiscano lo stesso stato, a meno delle chiavi undefined (innocue).
const strip = (v: unknown): unknown => Array.isArray(v) ? v.map(strip)
  : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).filter(([, x]) => x !== undefined).map(([k, x]) => [k, strip(x)]))
    : v

const seeded = (seed: number) => () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296 }

type Step = { state: unknown } | { error: string }
// Prova le mosse candidate in ordine casuale e applica la prima accettata dal motore.
function play(first: unknown, candidates: (s: any) => (() => Step)[], rng: () => number, steps: number) {
  let s: any = first
  let played = 0
  check(s)
  for (let i = 0; i < steps; i++) {
    const options = candidates(s).map((c) => [rng(), c] as const).sort((a, b) => a[0] - b[0])
    const ok = options.map(([, c]) => c()).find((r) => 'state' in r) as { state: unknown } | undefined
    if (!ok) break
    s = ok.state
    played++
    check(s)
  }
  return played
}
function check(s: unknown) {
  assert.deepEqual(decodeState(encodeState(s)), strip(s))
}

const names: [string, string] = ['A', 'B']

test('Dadi: una partita intera sopravvive all’andata e ritorno JSON', () => {
  const rng = seeded(1)
  const roll = () => 1 + Math.floor(rng() * 6)
  const n = play(dadi.newGame({ names, first: 0 }), (s) => [
    ...dadi.CATEGORIES.map((category) => () => dadi.apply(s, { type: 'score', category }, roll)),
    () => dadi.apply(s, { type: 'hold', index: Math.floor(rng() * 5) }, roll),
    () => dadi.apply(s, { type: 'roll' }, roll),
  ], rng, 400)
  assert.ok(n > 40, `partita troppo corta (${n} mosse)`)
})

test('Briscola: una partita intera sopravvive all’andata e ritorno JSON', () => {
  const rng = seeded(2)
  const n = play(briscola.newGame({ names, first: 0 }, briscola.shuffle(briscola.buildDeck(), rng)), (s) => [
    () => briscola.apply(s, { type: 'collect' }),
    ...s.hands[s.turn].map((c: briscola.Card) => () => briscola.apply(s, { type: 'play', card: c.id })),
  ], rng, 400)
  assert.ok(n > 40, `partita troppo corta (${n} mosse)`)
})

test('UNO: mosse casuali sopravvivono all’andata e ritorno JSON', () => {
  const rng = seeded(3)
  const shuf: uno.Shuffle = (cards) => uno.shuffle(cards, rng)
  const n = play(uno.newGame({ names, rules: uno.DEFAULT_RULES, first: 0 }, shuf(uno.buildDeck())), (s) => [
    ...s.hands[s.turn].map((c: uno.Card) => () => uno.apply(s, { type: 'play', cards: [c.id] }, shuf)),
    ...uno.COLORS.map((color) => () => uno.apply(s, { type: 'color', color }, shuf)),
    () => uno.apply(s, { type: 'draw' }, shuf), () => uno.apply(s, { type: 'pass' }, shuf),
    () => uno.apply(s, { type: 'accept' }, shuf), () => uno.apply(s, { type: 'challenge' }, shuf),
    () => uno.apply(s, { type: 'nextRound' }, shuf),
  ], rng, 600)
  assert.ok(n > 80, `partita troppo corta (${n} mosse)`)
})

test('Burraco: pescate, scarti e prese del pozzo sopravvivono all’andata e ritorno JSON', () => {
  const rng = seeded(4)
  const shuf: burraco.Shuffle = (cards) => burraco.shuffle(cards, rng)
  const n = play(burraco.newGame({ names, rules: burraco.DEFAULT_RULES, first: 0 }, shuf(burraco.buildDeck())), (s) => [
    () => burraco.apply(s, { type: 'draw' }, shuf), () => burraco.apply(s, { type: 'take' }, shuf),
    ...s.hands[s.turn].map((c: { id: number }) => () => burraco.apply(s, { type: 'discard', id: c.id }, shuf)),
    () => burraco.apply(s, { type: 'nextRound' }, shuf),
  ], rng, 600)
  assert.ok(n > 80, `partita troppo corta (${n} mosse)`)
})

test('Machiavelli: pescate e fine turno sopravvivono all’andata e ritorno JSON', () => {
  const rng = seeded(5)
  const n = play(machiavelli.newGame({ names, first: 0 }, machiavelli.shuffle(machiavelli.buildDeck(true), rng)), (s) => [
    () => machiavelli.apply(s, { type: 'draw' }), () => machiavelli.apply(s, { type: 'end' }), () => machiavelli.apply(s, { type: 'undo' }),
    ...s.hands[s.turn].map((c: { id: number }) => () => machiavelli.apply(s, { type: 'move', ids: [c.id], target: null })),
  ], rng, 300)
  assert.ok(n > 20, `partita troppo corta (${n} mosse)`)
})
