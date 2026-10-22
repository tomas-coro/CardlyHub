export type BestOf = 3 | 5 | 7

export const winsNeeded = (bestOf: BestOf) => Math.ceil(bestOf / 2)

export function randomTournamentGame<T>(games: readonly T[], random = Math.random): T {
  if (!games.length) throw new Error('Scegli almeno un gioco per il torneo.')
  return games[Math.floor(random() * games.length)]
}
