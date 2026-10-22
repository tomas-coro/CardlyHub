export const CATEGORIES = ['ones', 'twos', 'threes', 'fours', 'fives', 'sixes', 'three', 'four', 'full', 'small', 'large', 'yahtzee', 'chance'] as const
export type Category = typeof CATEGORIES[number]
export type Scores = Partial<Record<Category, number>>

export type GameState = {
  names: [string, string]
  turn: 0 | 1
  dice: number[]
  held: boolean[]
  rollsLeft: number
  scores: [Scores, Scores]
  phase: 'playing' | 'over'
  winner: 0 | 1 | null
}

export type Action =
  | { type: 'roll' }
  | { type: 'hold'; index: number }
  | { type: 'score'; category: Category }

export type Result = { state: GameState; error?: never } | { error: string; state?: never }
type Random = () => number

export function newGame({ names, first = 0 }: { names: [string, string]; first?: 0 | 1 }): GameState {
  return { names, turn: first, dice: [1, 1, 1, 1, 1], held: Array(5).fill(false), rollsLeft: 3, scores: [{}, {}], phase: 'playing', winner: null }
}

const counts = (dice: number[]) => dice.reduce<number[]>((out, die) => { out[die]++; return out }, Array(7).fill(0))
const straight = (dice: number[], length: number) => {
  const values = [...new Set(dice)].sort((a, b) => a - b)
  return values.some((_, i) => values.slice(i, i + length).length === length && values.slice(i, i + length).every((value, j) => value === values[i] + j))
}

export function score(category: Category, dice: number[]): number {
  const count = counts(dice)
  const sum = dice.reduce((a, b) => a + b, 0)
  const upper = CATEGORIES.indexOf(category) + 1
  if (upper <= 6) return count[upper] * upper
  if (category === 'three') return count.some((n) => n >= 3) ? sum : 0
  if (category === 'four') return count.some((n) => n >= 4) ? sum : 0
  if (category === 'full') return count.includes(3) && count.includes(2) ? 25 : 0
  if (category === 'small') return straight(dice, 4) ? 30 : 0
  if (category === 'large') return straight(dice, 5) ? 40 : 0
  if (category === 'yahtzee') return count.includes(5) ? 50 : 0
  return sum
}

export function total(scores: Scores): number {
  const upper = CATEGORIES.slice(0, 6).reduce((sum, category) => sum + (scores[category] ?? 0), 0)
  return Object.values(scores).reduce((sum, value) => sum + value, 0) + (upper >= 63 ? 35 : 0)
}

export function apply(previous: GameState, action: Action, random: Random = () => 1 + Math.floor(Math.random() * 6)): Result {
  if (previous.phase === 'over') return { error: 'La partita è finita.' }
  const state = structuredClone(previous)
  if (action.type === 'roll') {
    if (!state.rollsLeft) return { error: 'Non hai più tiri.' }
    state.dice = state.dice.map((die, index) => state.held[index] ? die : random())
    if (state.dice.some((die) => !Number.isInteger(die) || die < 1 || die > 6)) return { error: 'Valore del dado non valido.' }
    state.rollsLeft--
    return { state }
  }
  if (action.type === 'hold') {
    if (state.rollsLeft === 3) return { error: 'Prima devi tirare i dadi.' }
    if (action.index < 0 || action.index >= 5) return { error: 'Dado non valido.' }
    state.held[action.index] = !state.held[action.index]
    return { state }
  }
  if (state.rollsLeft === 3) return { error: 'Prima devi tirare i dadi.' }
  if (state.scores[state.turn][action.category] !== undefined) return { error: 'Categoria già usata.' }
  state.scores[state.turn][action.category] = score(action.category, state.dice)
  if (state.scores.every((sheet) => CATEGORIES.every((category) => sheet[category] !== undefined))) {
    const totals = state.scores.map(total)
    state.phase = 'over'
    state.winner = totals[0] === totals[1] ? null : totals[0] > totals[1] ? 0 : 1
  } else {
    state.turn = state.turn === 0 ? 1 : 0
    state.dice = [1, 1, 1, 1, 1]
    state.held = Array(5).fill(false)
    state.rollsLeft = 3
  }
  return { state }
}
