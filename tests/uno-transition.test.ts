import test from 'node:test'
import assert from 'node:assert/strict'
import * as uno from '../src/games/uno/engine.ts'
import { unoTransition } from '../src/games/uno/transition.ts'

const seeded = (seed: number) => () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296 }

test('UNO: in una partita intera ogni mossa è descritta in modo coerente col motore', () => {
  const rng = seeded(11)
  const shuf: uno.Shuffle = (cards) => uno.shuffle(cards, rng)
  let s = uno.newGame({ names: ['A', 'B'], rules: uno.DEFAULT_RULES, first: 0 }, shuf(uno.buildDeck()))
  let moves = 0, plays = 0, draws = 0
  for (let i = 0; i < 500; i++) {
    const cands: uno.Action[] = [
      ...s.hands[s.turn].map((c): uno.Action => ({ type: 'play', cards: [c.id] })),
      ...uno.COLORS.map((color): uno.Action => ({ type: 'color', color })),
      { type: 'draw' }, { type: 'pass' }, { type: 'accept' }, { type: 'challenge' }, { type: 'nextRound' },
    ].map((a) => [rng(), a] as const).sort((x, y) => x[0] - y[0]).map(([, a]) => a)
    let next: uno.GameState | null = null
    let action: uno.Action | null = null
    for (const a of cands) { const r = uno.apply(s, a, shuf); if ('state' in r) { next = r.state; action = a; break } }
    if (!next || !action) break
    const t = unoTransition(s, next)
    assert.ok(t, `mossa ${action.type} non riconosciuta come mossa`)
    if (action.type === 'play') {
      plays++
      assert.deepEqual(t.played.slice(0, action.cards.length).sort(), [...action.cards].sort(), 'carte giocate')
      assert.equal(t.by, s.turn)
    }
    if (action.type === 'draw') draws++
    assert.deepEqual(t.draws, next.events.flatMap((e) => (e.type === 'draw' ? [[e.p, e.n]] : [])))
    s = next; moves++
  }
  assert.ok(moves > 100 && plays > 20 && draws > 5, `partita poco varia: ${moves} mosse, ${plays} giocate, ${draws} pescate`)
})

test('UNO: riordinare la mano o premere UNO non è una mossa da animare', () => {
  const s = uno.newGame({ names: ['A', 'B'], rules: uno.DEFAULT_RULES, first: 0 }, uno.shuffle(uno.buildDeck(), seeded(3)))
  const reordered = { ...s, hands: s.hands.map((h, p) => (p === 0 ? [...h].reverse() : h)) }
  assert.equal(unoTransition(s, reordered), null)
  assert.equal(unoTransition(s, { ...s, uno: [true, false] }), null)
})
