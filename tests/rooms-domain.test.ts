import { test } from 'node:test'
import assert from 'node:assert/strict'
import { addPlayer, createRoomCode, normalizeName } from '../src/lib/rooms-domain.ts'

test('genera un codice stanza leggibile di 6 caratteri', () => {
  assert.equal(createRoomCode(() => 0), 'AAAAAA')
  assert.match(createRoomCode(() => 0.999), /^[A-HJ-NP-Z2-9]{6}$/)
})

test('normalizza il nome e rifiuta nomi non validi', () => {
  assert.equal(normalizeName('  Ada  '), 'Ada')
  assert.throws(() => normalizeName('   '), /1 a 24/)
  assert.throws(() => normalizeName('a'.repeat(25)), /1 a 24/)
})

test('aggiunge il giocatore nel primo posto libero', () => {
  const players = {
    host: { user_id: 'host', seat: 0, name: 'Ada' },
    other: { user_id: 'other', seat: 2, name: 'Lin' },
  }
  assert.deepEqual(addPlayer(players, 'new', '  Max  ', 4).new, { user_id: 'new', seat: 1, name: 'Max' })
})

test('un giocatore già presente aggiorna solo il nome', () => {
  const players = { host: { user_id: 'host', seat: 0, name: 'Ada' } }
  assert.deepEqual(addPlayer(players, 'host', 'Grace', 2), {
    host: { user_id: 'host', seat: 0, name: 'Grace' },
  })
})

test('rifiuta l’ingresso quando la stanza è piena', () => {
  const players = {
    a: { user_id: 'a', seat: 0, name: 'A' },
    b: { user_id: 'b', seat: 1, name: 'B' },
  }
  assert.throws(() => addPlayer(players, 'c', 'C', 2), /piena/)
})
