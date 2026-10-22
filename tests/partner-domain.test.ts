import test from 'node:test'
import assert from 'node:assert/strict'
import { acceptPair, createPair, createInvite, partnerOf } from '../src/lib/partner-domain.ts'

test('crea una coppia con il proprietario come unico membro', () => {
  assert.deepEqual(createPair('tomas', 'Tomas'), {
    members: ['tomas'],
    names: { tomas: 'Tomas' },
  })
})

test('il secondo account completa la coppia', () => {
  assert.deepEqual(acceptPair(createPair('tomas', 'Tomas'), 'lei', 'Amore'), {
    members: ['tomas', 'lei'],
    names: { tomas: 'Tomas', lei: 'Amore' },
  })
})

test('non accetta il proprietario o un terzo account', () => {
  const pending = createPair('tomas', 'Tomas')
  assert.throws(() => acceptPair(pending, 'tomas', 'Tomas'), /stesso account/i)
  const complete = acceptPair(pending, 'lei', 'Amore')
  assert.throws(() => acceptPair(complete, 'altro', 'Altro'), /completa/i)
})

test('trova il partner solo in una coppia completa', () => {
  const pair = acceptPair(createPair('tomas', 'Tomas'), 'lei', 'Amore')
  assert.deepEqual(partnerOf(pair, 'tomas'), { id: 'lei', name: 'Amore' })
  assert.equal(partnerOf(createPair('tomas', 'Tomas'), 'tomas'), null)
})

test('crea un invito generico indirizzato al partner', () => {
  const pair = acceptPair(createPair('tomas', 'Tomas'), 'lei', 'Amore')
  assert.deepEqual(createInvite(pair, 'tomas', 'briscola', { turn: 0 }), {
    game: 'briscola', host_id: 'tomas', guest_id: 'lei', status: 'pending', state: { turn: 0 }, last_by: 'tomas',
  })
})
