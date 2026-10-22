import test from 'node:test'
import assert from 'node:assert/strict'
import { CATEGORIES, apply, newGame, score } from '../src/games/dadi/engine.ts'

const fixed = (...values: number[]) => {
  let i = 0
  return () => values[i++] ?? 1
}

test('una partita nuova parte dal giocatore scelto con tredici categorie libere', () => {
  const game = newGame({ names: ['Tomas', 'Giulia'], first: 1 })
  assert.equal(game.turn, 1)
  assert.equal(game.rollsLeft, 3)
  assert.deepEqual(game.scores, [{}, {}])
  assert.equal(CATEGORIES.length, 13)
})

test('si lanciano i dadi fino a tre volte e quelli bloccati non cambiano', () => {
  let game = newGame({ names: ['Tomas', 'Giulia'], first: 0 })
  game = apply(game, { type: 'roll' }, fixed(1, 2, 3, 4, 5)).state
  game = apply(game, { type: 'hold', index: 1 }).state
  game = apply(game, { type: 'roll' }, fixed(6, 6, 6, 6)).state
  assert.deepEqual(game.dice, [6, 2, 6, 6, 6])
  game = apply(game, { type: 'roll' }, fixed(5, 5, 5, 5)).state
  assert.equal(game.rollsLeft, 0)
  assert.match(apply(game, { type: 'roll' }, fixed()).error ?? '', /tiri/i)
})

test('il punteggio Yahtzee copre le combinazioni principali', () => {
  assert.equal(score('full', [2, 2, 3, 3, 3]), 25)
  assert.equal(score('small', [1, 2, 3, 4, 6]), 30)
  assert.equal(score('large', [2, 3, 4, 5, 6]), 40)
  assert.equal(score('small', [1, 2, 2, 2, 2]), 0)
  assert.equal(score('large', [5, 6, 6, 6, 6]), 0)
  assert.equal(score('yahtzee', [4, 4, 4, 4, 4]), 50)
  assert.equal(score('four', [5, 5, 5, 5, 2]), 22)
})

test('segnare una categoria passa il turno e vieta di riutilizzarla', () => {
  let game = newGame({ names: ['Tomas', 'Giulia'], first: 0 })
  game = apply(game, { type: 'roll' }, fixed(3, 3, 3, 4, 5)).state
  game = apply(game, { type: 'score', category: 'threes' }).state
  assert.equal(game.scores[0].threes, 9)
  assert.equal(game.turn, 1)
  assert.equal(game.rollsLeft, 3)
  game = apply(game, { type: 'roll' }, fixed(1, 1, 2, 4, 5)).state
  game = apply(game, { type: 'score', category: 'ones' }).state
  game = apply(game, { type: 'roll' }, fixed(3, 3, 3, 3, 3)).state
  assert.match(apply(game, { type: 'score', category: 'threes' }).error ?? '', /usata/i)
})
