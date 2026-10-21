// Test del motore di Machiavelli. Esecuzione: node --test tests/machiavelli-engine.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { analyze, apply, buildDeck, newGame, ordered, playedCount, shuffle } from '../src/games/machiavelli/engine.ts'
import type { Action, Card, GameState, Suit } from '../src/games/machiavelli/engine.ts'

let uid = 1000
// "h7" = 7 di cuori, "s13" = re di picche, "j" = jolly
const c = (code: string): Card => (code === 'j' ? { id: ++uid, s: 'j', r: 0 } : { id: ++uid, s: code[0] as Suit, r: +code.slice(1) })
const cards = (...codes: string[]) => codes.map(c)
const ok = (...codes: string[]) => analyze(cards(...codes)).ok

// stato di partita costruito a mano: tavolo e mano del giocatore 0 decisi dal test
function scenario(table: string[][], hand: string[], deckCodes: string[] = ['d2', 'd3']): GameState {
  const t = table.map((g, i) => ({ id: i + 1, cards: cards(...g) }))
  const h = cards(...hand)
  return {
    deck: cards(...deckCodes), table: t, hands: [h, cards('h1', 'h2')], names: ['A', 'B'], turn: 0,
    start: { table: t, hand: h.slice() }, nextGroupId: t.length + 1, passes: 0, phase: 'playing', winner: null,
  }
}
const run = (s: GameState, a: Action) => {
  const r = apply(s, a)
  assert.ok('state' in r, 'errore inatteso: ' + ('error' in r ? r.error : ''))
  return r.state
}
const fail = (s: GameState, a: Action) => {
  const r = apply(s, a)
  assert.ok('error' in r, 'doveva essere bloccata')
  return r.error
}
const idsOf = (s: GameState, ...codes: string[]) => {
  // cerca nella mano di chi gioca gli id delle carte indicate
  return codes.map((code) => {
    const f = c(code)
    const hit = s.hands[s.turn].find((x) => x.s === f.s && x.r === f.r)
    assert.ok(hit, 'carta non in mano: ' + code)
    return hit.id
  })
}

test('tris e poker', () => {
  assert.ok(ok('h7', 'd7', 'c7'))
  assert.ok(ok('h7', 'd7', 'c7', 's7'))
  assert.ok(!ok('h7', 'd7', 'c7', 's7', 'j'), 'poker oltre 4 carte')
  assert.ok(!ok('h7', 'h7', 'c7'), 'stesso seme (anche da due mazzi diversi)')
  assert.ok(!ok('h7', 'd7'), 'meno di 3 carte')
})

test('scale: asso alto e basso, mai circolare', () => {
  assert.ok(ok('h1', 'h2', 'h3'))
  assert.ok(ok('h12', 'h13', 'h1'))
  assert.ok(!ok('h13', 'h1', 'h2'), 'K-A-2 non vale')
  assert.ok(ok('s4', 's5', 's6', 's7'))
  assert.ok(!ok('s4', 's5', 's7'), 'buco senza jolly')
  assert.ok(!ok('s4', 'h5', 's6'), 'semi misti')
  assert.ok(!ok('s4', 's4', 's5'), 'carta doppia (due mazzi)')
})

test('jolly: buco, estremi, solo jolly, una carta + molti jolly', () => {
  assert.ok(ok('s4', 'j', 's6'), 'buco')
  assert.ok(ok('s4', 's5', 'j'), 'in coda')
  assert.ok(ok('j', 's5', 's6'), 'in testa')
  assert.ok(ok('h7', 'j', 'c7'), 'jolly in un tris')
  assert.ok(!ok('j', 'j', 'j'), 'solo jolly')
  assert.ok(ok('s5', 'j', 'j', 'j', 'j'), 'una carta vera + 4 jolly = scala valida')
  assert.ok(!ok('h1', 'j', 'h2', 'h3', 'h4', 'h5', 'h6', 'h7', 'h8', 'h9', 'h10', 'h11', 'h12', 'h13'), 'oltre 13 carte')
})

test('ordered: scala col jolly nel buco, asso alto in fondo', () => {
  const o = ordered(cards('s6', 'j', 's4'))
  assert.deepEqual(o.map((x) => x.s + x.r), ['s4', 'j0', 's6'])
  const a = ordered(cards('h1', 'h13', 'h12'))
  assert.deepEqual(a.map((x) => x.s + x.r), ['h12', 'h13', 'h1'])
})

test('mazzo: 104 senza jolly, 108 con jolly, id tutti diversi', () => {
  assert.equal(buildDeck(false).length, 104)
  const d = buildDeck(true)
  assert.equal(d.length, 108)
  assert.equal(new Set(d.map((x) => x.id)).size, 108)
  assert.equal(d.filter((x) => x.s === 'j').length, 4)
})

test('partita nuova: 13 carte a testa, resto nel mazzo', () => {
  const g = newGame({ names: ['A', 'B'] }, shuffle(buildDeck(true)))
  assert.equal(g.hands[0].length, 13)
  assert.equal(g.hands[1].length, 13)
  assert.equal(g.deck.length, 108 - 26)
  const all = new Set([...g.deck, ...g.hands[0], ...g.hands[1]].map((x) => x.id))
  assert.equal(all.size, 108)
})

test('mossa: nuova combinazione dalla mano', () => {
  const s = scenario([], ['h7', 'd7', 'c7', 'h2'])
  const n = run(s, { type: 'move', ids: idsOf(s, 'h7', 'd7', 'c7'), target: null })
  assert.equal(n.table.length, 1)
  assert.equal(n.hands[0].length, 1)
  assert.equal(playedCount(n), 3)
})

test('mossa: aggiungere a una combinazione esistente', () => {
  const s = scenario([['s4', 's5', 's6']], ['s7', 's1'])
  const n = run(s, { type: 'move', ids: idsOf(s, 's7'), target: 1 })
  assert.deepEqual(n.table[0].cards.map((x) => x.r), [4, 5, 6, 7])
})

test('mossa bloccata se rompe un altra combinazione, e lo stato non cambia', () => {
  const s = scenario([['s4', 's5', 's6']], ['h9', 'd9'])
  const mid = s.table[0].cards[1].id // il 5 al centro: toglierlo lascia 2 carte separate
  const err = fail(s, { type: 'move', ids: [mid, ...idsOf(s, 'h9', 'd9')], target: null })
  assert.match(err, /resterebbero/)
})

test('mossa bloccata se la nuova combinazione non vale', () => {
  const s = scenario([], ['h7', 'd8', 'c2'])
  fail(s, { type: 'move', ids: idsOf(s, 'h7', 'd8', 'c2'), target: null })
})

test('dal tavolo si prendono carte per fare altro, ma non tornano in mano', () => {
  // poker 7: prendo il 7 di picche e lo uso in una scala con 5 e 6 di mano
  const s = scenario([['h7', 'd7', 'c7', 's7']], ['s5', 's6'])
  const sev = s.table[0].cards.find((x) => x.s === 's')!.id
  const n = run(s, { type: 'move', ids: [sev, ...idsOf(s, 's5', 's6')], target: null })
  assert.equal(n.table.length, 2)
  assert.equal(n.hands[0].length, 0, 'mano vuota')
  assert.equal(n.phase, 'over')
  assert.equal(n.winner, 0)
})

// tavolo con un riordino valido senza carte dalla mano: il 7 di picche passa dal poker alla scala
const reorderOnly = () => {
  const s = scenario([['h7', 'd7', 'c7', 's7'], ['s8', 's9', 's10']], ['h2'], ['d2', 'd3'])
  const sev = s.table[0].cards.find((x) => x.s === 's')!.id
  return { s, moved: run(s, { type: 'move', ids: [sev], target: 2 }) }
}

test('fine turno: riordinare solo il tavolo non basta, serve una carta dalla mano', () => {
  const { s, moved } = reorderOnly()
  assert.equal(moved.table[1].cards.length, 4, 'il riordino e valido')
  assert.equal(playedCount(moved), 0)
  fail(moved, { type: 'end' })
  fail(s, { type: 'end' })
})

test('fine turno: passa al giocatore dopo con snapshot nuovo', () => {
  const s = scenario([], ['h7', 'd7', 'c7', 'h2'])
  const m = run(s, { type: 'move', ids: idsOf(s, 'h7', 'd7', 'c7'), target: null })
  const e = run(m, { type: 'end' })
  assert.equal(e.turn, 1)
  assert.equal(e.start.hand.length, 2)
  assert.equal(e.start.table.length, 1)
  assert.equal(playedCount(e), 0)
})

test('annulla: ripristina tavolo e mano', () => {
  const s = scenario([['s4', 's5', 's6']], ['s7', 'h9'])
  const m = run(s, { type: 'move', ids: idsOf(s, 's7'), target: 1 })
  const u = run(m, { type: 'undo' })
  assert.deepEqual(u.table, s.table)
  assert.equal(u.hands[0].length, 2)
})

test('pesca: dopo aver posato è vietato', () => {
  const s = scenario([], ['h7', 'd7', 'c7', 'h2'])
  const m = run(s, { type: 'move', ids: idsOf(s, 'h7', 'd7', 'c7'), target: null })
  fail(m, { type: 'draw' })
})

test('pesca: tavolo riordinato senza posare torna com era, 1 carta in mano, turno all altro', () => {
  const { s, moved } = reorderOnly()
  const n = run(moved, { type: 'draw' })
  assert.deepEqual(n.table, s.table, 'il riordino viene annullato')
  assert.equal(n.hands[0].length, 2)
  assert.equal(n.deck.length, 1)
  assert.equal(n.turn, 1)
})

test('mazzo vuoto: passa, due passi di fila chiudono la partita senza vincitore', () => {
  const s = scenario([], ['s5'], [])
  const p1 = run(s, { type: 'draw' })
  assert.equal(p1.phase, 'playing')
  assert.equal(p1.turn, 1)
  assert.equal(p1.passes, 1)
  const p2 = run(p1, { type: 'draw' })
  assert.equal(p2.phase, 'over')
  assert.equal(p2.winner, null)
  fail(p2, { type: 'draw' })
})

test('un passo viene azzerato se qualcuno posa', () => {
  const s: GameState = { ...scenario([], ['s5'], []), passes: 1 }
  const t = scenario([], ['h7', 'd7', 'c7', 'h2'], [])
  const m = run({ ...t, passes: 1 }, { type: 'move', ids: idsOf(t, 'h7', 'd7', 'c7'), target: null })
  assert.equal(run(m, { type: 'end' }).passes, 0)
  void s
})
