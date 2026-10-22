import test from 'node:test'
import assert from 'node:assert/strict'
import { playerIndex } from '../src/lib/online-game.ts'

test('l’host è il giocatore 0 e l’ospite è il giocatore 1', () => {
  assert.equal(playerIndex({ userId: 'host', hostId: 'host' }), 0)
  assert.equal(playerIndex({ userId: 'guest', hostId: 'host' }), 1)
})
