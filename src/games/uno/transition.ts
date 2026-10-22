import type { GameState, UnoEvent } from './engine.ts'

// Cosa è successo tra due stati consecutivi, per riprodurlo animato sullo schermo di chi non ha fatto la mossa.
export type UnoTransition = {
  played: number[]               // id delle carte appena scese sugli scarti (vuoto se la mossa non ne ha giocate)
  by: number                     // chi le ha giocate
  draws: [number, number][]      // [giocatore, quante carte] pescate, per l'animazione dal mazzo
  events: UnoEvent[]             // eventi dell'ultima mossa, da cui il tavolo ricava il messaggio
  unoCall: boolean               // UNO dichiarato e giusto: appare la scritta
} | null

// Un salvataggio che non è una mossa (riordino della mano, UNO premuto) non cambia scarti, mazzo, turno né fase.
const isMove = (prev: GameState, next: GameState) =>
  next.disc.length !== prev.disc.length || next.deck.length !== prev.deck.length || next.turn !== prev.turn || next.phase !== prev.phase
  || next.hands.some((hand, p) => hand.length !== prev.hands[p].length) || next.wild?.v !== prev.wild?.v

export function unoTransition(prev: GameState, next: GameState): UnoTransition {
  if (!isMove(prev, next)) return null
  const before = new Set(prev.disc.map((c) => c.id))
  const played = next.disc.filter((c) => !before.has(c.id)).map((c) => c.id)
  const by = played.length ? Math.max(0, prev.hands.findIndex((hand) => hand.some((c) => c.id === played[0]))) : prev.turn
  const draws = next.events.flatMap((e) => (e.type === 'draw' ? [[e.p, e.n] as [number, number]] : []))
  const unoCall = played.length > 0 && prev.uno[by] && prev.hands[by].length - played.length === 1
    && !next.events.some((e) => e.type === 'draw' && e.why === 'uno')
  return { played, by, draws, events: next.events, unoCall }
}
