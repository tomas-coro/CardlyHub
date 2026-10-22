import test from 'node:test'
import assert from 'node:assert/strict'
import { randomTournamentGame, tournamentGame, winsNeeded } from '../src/lib/tournament.ts'

test('al meglio di 3, 5 o 7 richiede 2, 3 o 4 vittorie', () => {
  assert.equal(winsNeeded(3), 2)
  assert.equal(winsNeeded(5), 3)
  assert.equal(winsNeeded(7), 4)
})

test('la scelta casuale usa solo i giochi selezionati', () => {
  assert.equal(randomTournamentGame(['briscola', 'uno'], () => 0), 'briscola')
  assert.equal(randomTournamentGame(['briscola', 'uno'], () => 0.99), 'uno')
  assert.throws(() => randomTournamentGame([], () => 0), /almeno un gioco/)
})

test('la scelta ordinata segue la sequenza e ricomincia dal primo gioco', () => {
  const games = ['briscola', 'uno', 'burraco']
  assert.equal(tournamentGame(games, 1, 'ordered'), 'briscola')
  assert.equal(tournamentGame(games, 3, 'ordered'), 'burraco')
  assert.equal(tournamentGame(games, 4, 'ordered'), 'briscola')
})
