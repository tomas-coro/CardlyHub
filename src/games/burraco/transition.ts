import type { BurracoEvent, GameState } from './engine.ts'

// Un salvataggio che non è una mossa (riordino della mano) non cambia tallone, pozzo, turno, fase, mani né calate:
// senza questo controllo l'avversario rivedrebbe lo stesso messaggio a ogni riordino.
export function burracoMove(prev: GameState, next: GameState): BurracoEvent[] | null {
  const meldCards = (s: GameState) => s.melds.map((player) => player.reduce((n, m) => n + m.cards.length, 0))
  const moved = next.deck.length !== prev.deck.length || next.discard.length !== prev.discard.length || next.turn !== prev.turn
    || next.phase !== prev.phase || next.pots.length !== prev.pots.length
    || next.hands.some((hand, p) => hand.length !== prev.hands[p].length)
    || meldCards(next).some((n, p) => n !== meldCards(prev)[p])
  return moved ? next.events : null
}
