import test from 'node:test'
import assert from 'node:assert/strict'
import { addResult, emptyGameStat, normalizeStat } from '../src/lib/statistics.ts'

test('registra vittorie, pareggi, miglior e peggior punteggio senza mutare i dati precedenti', () => {
  const empty = emptyGameStat()
  const first = addResult(empty, { winner: 0, scores: [70, 50] })
  const second = addResult(first, { winner: null, scores: [60, 80] })

  assert.deepEqual(empty, { started: 0, completed: 0, wins: [0, 0], draws: 0, hands: [0, 0], best: [null, null], worst: [null, null] })
  assert.deepEqual(second, { started: 0, completed: 2, wins: [1, 0], draws: 1, hands: [0, 0], best: [70, 80], worst: [60, 50] })
})

test('una partita senza punteggio aggiorna il testa a testa ma non i record', () => {
  assert.deepEqual(addResult(emptyGameStat(), { winner: 1 }), {
    started: 0, completed: 1, wins: [0, 1], draws: 0, hands: [0, 0], best: [null, null], worst: [null, null],
  })
})

test('al meglio di 5 finito 2-3: una serie vinta da lei, ma le mani vinte da ciascuno restano contate', () => {
  const stat = addResult(emptyGameStat(), { winner: 1, hands: [2, 3] })
  assert.deepEqual(stat.wins, [0, 1])
  assert.deepEqual(stat.hands, [2, 3])
  assert.deepEqual(addResult(stat, { winner: 0, hands: [3, 1] }).hands, [5, 4])
})

test('i dati salvati dalla vecchia versione (points/pointGames) vengono normalizzati', () => {
  const old = { started: 3, completed: 2, wins: [1, 1], draws: 0, points: [100, 90], pointGames: 2 } as never
  assert.deepEqual(normalizeStat(old), { started: 3, completed: 2, wins: [1, 1], draws: 0, hands: [0, 0], best: [null, null], worst: [null, null] })
})
