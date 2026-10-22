export type RoomPlayer = { user_id: string; seat: number; name: string }
export type RoomPlayers = Record<string, RoomPlayer>

export const MAX_PLAYERS: Record<string, number> = {
  briscola: 4,
  machiavelli: 6,
  uno: 10,
  burraco: 2,
  dadi: 6,
}

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function createRoomCode(random = Math.random) {
  return Array.from({ length: 6 }, () => CODE_ALPHABET[Math.floor(random() * CODE_ALPHABET.length)]).join('')
}

export function normalizeName(value: string) {
  const name = value.trim()
  if (name.length < 1 || name.length > 24) throw new Error('Il nome deve avere da 1 a 24 caratteri.')
  return name
}

export function addPlayer(players: RoomPlayers, userId: string, value: string, maxPlayers: number): RoomPlayers {
  const name = normalizeName(value)
  const current = players[userId]
  if (current) return { ...players, [userId]: { ...current, name } }

  const occupied = new Set(Object.values(players).map(({ seat }) => seat))
  const seat = Array.from({ length: maxPlayers }, (_, index) => index).find((index) => !occupied.has(index))
  if (seat === undefined) throw new Error('La stanza è piena.')
  return { ...players, [userId]: { user_id: userId, seat, name } }
}
