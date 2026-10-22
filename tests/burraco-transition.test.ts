import test from 'node:test'
import assert from 'node:assert/strict'
import * as burraco from '../src/games/burraco/engine.ts'
import { burracoMove } from '../src/games/burraco/transition.ts'

const seeded = (seed: number) => () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296 }

test('Burraco: pescate, prese e scarti sono mosse; riordinare la mano no', () => {
  const rng = seeded(7)
  const shuf: burraco.Shuffle = (cards) => burraco.shuffle(cards, rng)
  let s = burraco.newGame({ names: ['A', 'B'], rules: burraco.DEFAULT_RULES, first: 0 }, shuf(burraco.buildDeck()))
  const reordered = { ...s, hands: s.hands.map((h, p) => (p === 0 ? [...h].reverse() : h)) }
  assert.equal(burracoMove(s, reordered), null)
  let moves = 0
  for (let i = 0; i < 300; i++) {
    const cands: burraco.Action[] = [
      { type: 'draw' }, { type: 'take' },
      ...s.hands[s.turn].map((c): burraco.Action => ({ type: 'discard', id: c.id })),
      { type: 'nextRound' },
    ].map((a) => [rng(), a] as const).sort((x, y) => x[0] - y[0]).map(([, a]) => a)
    let next: burraco.GameState | null = null
    let kind = ''
    for (const a of cands) { const r = burraco.apply(s, a, shuf); if ('state' in r) { next = r.state; kind = a.type; break } }
    if (!next) break
    const events = burracoMove(s, next)
    assert.ok(events, `la mossa ${kind} non è stata riconosciuta`)
    assert.equal(events, next.events)
    s = next; moves++
  }
  assert.ok(moves > 50, `partita troppo corta (${moves})`)
})
