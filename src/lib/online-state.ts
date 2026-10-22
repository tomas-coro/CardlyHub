import { buildDeck as buildBriscolaDeck, newGame as newBriscolaGame, shuffle as shuffleBriscola } from '../games/briscola/engine.ts'
import type { GameState as BriscolaState } from '../games/briscola/engine.ts'
import { DEFAULT_RULES as UNO_RULES, buildDeck as buildUnoDeck, newGame as newUnoGame, shuffle as shuffleUno } from '../games/uno/engine.ts'
import type { GameState as UnoState } from '../games/uno/engine.ts'
import { DEFAULT_RULES as BURRACO_RULES, buildDeck as buildBurracoDeck, newGame as newBurracoGame, shuffle as shuffleBurraco } from '../games/burraco/engine.ts'
import type { GameState as BurracoState } from '../games/burraco/engine.ts'
import { buildDeck as buildMachiavelliDeck, newGame as newMachiavelliGame, shuffle as shuffleMachiavelli } from '../games/machiavelli/engine.ts'
import type { GameState as MachiavelliState } from '../games/machiavelli/engine.ts'
import { newGame as newDadiGame } from '../games/dadi/engine.ts'
import type { GameState as DadiState } from '../games/dadi/engine.ts'


export type OnlineGameId = 'briscola' | 'machiavelli' | 'uno' | 'burraco' | 'dadi'
export type OnlineState = BriscolaState | UnoState | BurracoState | MachiavelliState | DadiState

// Stato iniziale di una partita online. `rules` (UNO e Burraco) permette alla rivincita di tenere le regole in uso.
export function makeOnlineState(id: OnlineGameId, names: [string, string], rules?: unknown): OnlineState {
  const first = (Math.random() < 0.5 ? 0 : 1) as 0 | 1
  if (id === 'briscola') return newBriscolaGame({ names, first }, shuffleBriscola(buildBriscolaDeck()))
  if (id === 'uno') return newUnoGame({ names, rules: (rules as typeof UNO_RULES) ?? UNO_RULES, first }, shuffleUno(buildUnoDeck()))
  if (id === 'burraco') return newBurracoGame({ names, rules: (rules as typeof BURRACO_RULES) ?? BURRACO_RULES, first }, shuffleBurraco(buildBurracoDeck()))
  if (id === 'machiavelli') return newMachiavelliGame({ names, first }, shuffleMachiavelli(buildMachiavelliDeck(true)))
  return newDadiGame({ names, first })
}
