import { trickWinner } from './engine.ts'
import type { Card, GameState } from './engine.ts'

// Cosa è successo tra due stati consecutivi, per riprodurlo animato sullo schermo di chi non ha fatto la mossa.
export type Transition =
  | { type: 'play'; by: number; card: Card; trickComplete: boolean; winner: number | null }  // una carta scesa sul tavolo
  | { type: 'collect'; winner: number; drawn: number[] }                                       // presa raccolta, chi ha pescato
  | null

export function briscolaTransition(prev: GameState, next: GameState): Transition {
  if (next.table.length === prev.table.length + 1) {
    const played = next.table[next.table.length - 1]
    const complete = next.table.length === 2
    return { type: 'play', by: played.p, card: played.card, trickComplete: complete, winner: complete ? trickWinner(next.table, next.trump.s) : null }
  }
  if (prev.table.length === 2 && next.table.length === 0) {
    const winner = trickWinner(prev.table, prev.trump.s)
    const drawn = [winner, 1 - winner].filter((p) => next.hands[p].length > prev.hands[p].length)  // pesca prima chi ha preso
    return { type: 'collect', winner, drawn }
  }
  return null
}
