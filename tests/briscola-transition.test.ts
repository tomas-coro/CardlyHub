import test from 'node:test'
import assert from 'node:assert/strict'
import { apply, buildDeck, newGame, shuffle } from '../src/games/briscola/engine.ts'
import type { GameState } from '../src/games/briscola/engine.ts'
import { briscolaTransition } from '../src/games/briscola/transition.ts'

const ok = (r: ReturnType<typeof apply>): GameState => { assert.ok('state' in r); return r.state }
const start = () => newGame({ names: ['A', 'B'], first: 0 }, shuffle(buildDeck(), () => 0.3))

test('la prima carta giocata è riconosciuta con chi l’ha giocata', () => {
  const s0 = start()
  const card = s0.hands[0][0]
  const t = briscolaTransition(s0, ok(apply(s0, { type: 'play', card: card.id })))
  assert.equal(t?.type, 'play')
  if (t?.type === 'play') { assert.equal(t.by, 0); assert.equal(t.card.id, card.id); assert.equal(t.trickComplete, false) }
})

test('la seconda carta completa la presa e dice chi la vince', () => {
  let s = start()
  s = ok(apply(s, { type: 'play', card: s.hands[0][0].id }))
  const next = ok(apply(s, { type: 'play', card: s.hands[1][0].id }))
  const t = briscolaTransition(s, next)
  assert.equal(t?.type, 'play')
  if (t?.type === 'play') { assert.equal(t.by, 1); assert.equal(t.trickComplete, true); assert.ok(t.winner === 0 || t.winner === 1) }
})

test('la raccolta dice chi vince e chi ha pescato (prima il vincitore)', () => {
  let s = start()
  s = ok(apply(s, { type: 'play', card: s.hands[0][0].id }))
  s = ok(apply(s, { type: 'play', card: s.hands[1][0].id }))
  const next = ok(apply(s, { type: 'collect' }))
  const t = briscolaTransition(s, next)
  assert.equal(t?.type, 'collect')
  if (t?.type === 'collect') { assert.equal(t.drawn[0], t.winner); assert.equal(t.drawn.length, 2) }
})

test('stati uguali o senza novità non producono animazione', () => {
  const s = start()
  assert.equal(briscolaTransition(s, s), null)
})
