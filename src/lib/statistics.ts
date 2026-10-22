import type { GameResult } from './game-result.ts'

type Pair = [number, number]
type PairOrNull = [number | null, number | null]

export type GameStat = {
  started: number
  completed: number
  wins: Pair          // partite (o serie "al meglio di") vinte da ciascuno
  draws: number
  hands: Pair         // mani singole vinte dentro le serie "al meglio di" (solo dove esistono, es. UNO)
  best: PairOrNull    // miglior punteggio di ciascuno
  worst: PairOrNull   // peggior punteggio di ciascuno
}

export const emptyGameStat = (): GameStat => ({ started: 0, completed: 0, wins: [0, 0], draws: 0, hands: [0, 0], best: [null, null], worst: [null, null] })

// Riempie i campi nuovi nei dati salvati da versioni vecchie (che avevano `points` e `pointGames`, ora tolti).
export function normalizeStat(item: Partial<GameStat>): GameStat {
  const base = emptyGameStat()
  return {
    started: item.started ?? 0,
    completed: item.completed ?? 0,
    wins: item.wins ?? base.wins,
    draws: item.draws ?? 0,
    hands: item.hands ?? base.hands,
    best: item.best ?? base.best,
    worst: item.worst ?? base.worst,
  }
}

const pick = (old: number | null, now: number, better: (a: number, b: number) => boolean) => (old === null || better(now, old) ? now : old)

export function addResult(raw: GameStat, result: GameResult): GameStat {
  const item = normalizeStat(raw)
  const wins: Pair = [...item.wins]
  if (result.winner !== null) wins[result.winner]++
  const { scores, hands } = result
  return {
    ...item,
    completed: item.completed + 1,
    wins,
    draws: item.draws + Number(result.winner === null),
    hands: hands ? [item.hands[0] + hands[0], item.hands[1] + hands[1]] : item.hands,
    best: scores ? [pick(item.best[0], scores[0], (a, b) => a > b), pick(item.best[1], scores[1], (a, b) => a > b)] : item.best,
    worst: scores ? [pick(item.worst[0], scores[0], (a, b) => a < b), pick(item.worst[1], scores[1], (a, b) => a < b)] : item.worst,
  }
}
