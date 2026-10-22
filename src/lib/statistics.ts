import type { GameResult } from './game-result.ts'

export type GameStat = {
  started: number
  completed: number
  wins: [number, number]
  draws: number
  points: [number, number]
  pointGames: number
}

export const emptyGameStat = (): GameStat => ({ started: 0, completed: 0, wins: [0, 0], draws: 0, points: [0, 0], pointGames: 0 })

export function addResult(item: GameStat, result: GameResult): GameStat {
  const wins: [number, number] = [...item.wins]
  if (result.winner !== null) wins[result.winner]++
  return {
    ...item,
    completed: item.completed + 1,
    wins,
    draws: item.draws + Number(result.winner === null),
    points: result.scores ? [item.points[0] + result.scores[0], item.points[1] + result.scores[1]] : item.points,
    pointGames: item.pointGames + Number(Boolean(result.scores)),
  }
}
