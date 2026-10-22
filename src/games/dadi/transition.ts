import type { GameState } from './engine.ts'

// Confronta lo stato di prima con quello di dopo e dice se in mezzo c'è stato un lancio dei dadi.
// Serve a riprodurre sul nostro schermo il lancio dell'avversario: `held` sono i dadi che restano fermi.
export function diceTransition(prev: GameState, next: GameState): { dice: number[]; held: boolean[] } | null {
  const rolled = prev.phase === 'playing' && next.turn === prev.turn && next.rollsLeft === prev.rollsLeft - 1
  return rolled ? { dice: next.dice, held: prev.held } : null
}
