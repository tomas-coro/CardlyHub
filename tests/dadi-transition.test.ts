import test from 'node:test'
import assert from 'node:assert/strict'
import { apply, newGame } from '../src/games/dadi/engine.ts'
import { diceTransition } from '../src/games/dadi/transition.ts'

const fixed = (...values: number[]) => { let i = 0; return () => values[i++] ?? 1 }
const names: [string, string] = ['A', 'B']

test('un lancio è riconosciuto e porta i nuovi valori con i dadi tenuti', () => {
  let s = newGame({ names, first: 0 })
  s = apply(s, { type: 'roll' }, fixed(1, 2, 3, 4, 5)).state!
  s = apply(s, { type: 'hold', index: 0 }).state!
  const next = apply(s, { type: 'roll' }, fixed(6, 6, 6, 6)).state!
  const t = diceTransition(s, next)
  assert.deepEqual(t?.dice, [1, 6, 6, 6, 6])
  assert.deepEqual(t?.held, [true, false, false, false, false])
})

test('tenere un dado, scegliere una categoria o la rivincita non sono lanci', () => {
  let s = newGame({ names, first: 0 })
  s = apply(s, { type: 'roll' }, fixed(1, 2, 3, 4, 5)).state!
  const held = apply(s, { type: 'hold', index: 2 }).state!
  assert.equal(diceTransition(s, held), null)
  const scored = apply(s, { type: 'score', category: 'chance' }).state!
  assert.equal(diceTransition(s, scored), null)
  assert.equal(diceTransition(s, s), null)
})
