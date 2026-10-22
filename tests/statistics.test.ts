import test from 'node:test'
import assert from 'node:assert/strict'
import { addResult, emptyGameStat } from '../src/lib/statistics.ts'

test('registra vittorie, pareggi e medie punti senza mutare i dati precedenti', () => {
  const empty = emptyGameStat()
  const first = addResult(empty, { winner: 0, scores: [70, 50] })
  const second = addResult(first, { winner: null, scores: [60, 60] })

  assert.deepEqual(empty, { started: 0, completed: 0, wins: [0, 0], draws: 0, points: [0, 0], pointGames: 0 })
  assert.deepEqual(second, { started: 0, completed: 2, wins: [1, 0], draws: 1, points: [130, 110], pointGames: 2 })
})

test('una partita senza punteggio aggiorna il testa a testa ma non la media', () => {
  assert.deepEqual(addResult(emptyGameStat(), { winner: 1 }), {
    started: 0, completed: 1, wins: [0, 1], draws: 0, points: [0, 0], pointGames: 0,
  })
})
