import { signInAnonymously } from 'firebase/auth'
import { doc, onSnapshot, runTransaction, serverTimestamp } from 'firebase/firestore'
import { auth, db } from './firebase.ts'
import { addPlayer, createRoomCode, MAX_PLAYERS, normalizeName } from './rooms-domain.ts'
import type { RoomPlayer, RoomPlayers } from './rooms-domain.ts'

export type RoomSnapshot = {
  id: string
  code: string
  game: string
  host_id: string
  status: 'waiting' | 'playing' | 'finished'
  players: RoomPlayer[]
}

type RoomDocument = {
  code: string
  game: string
  host_id: string
  status: RoomSnapshot['status']
  players: RoomPlayers
}

async function userId() {
  await auth.authStateReady()
  return (auth.currentUser ?? (await signInAnonymously(auth)).user).uid
}

function roomSnapshot(id: string, data: RoomDocument): RoomSnapshot {
  return { ...data, id, players: Object.values(data.players).sort((a, b) => a.seat - b.seat) }
}

export async function createRoom(game: string, value: string) {
  const uid = await userId()
  const name = normalizeName(value)
  if (!MAX_PLAYERS[game]) throw new Error('Gioco non valido.')

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = createRoomCode()
    const room = doc(db, 'rooms', code)
    try {
      await runTransaction(db, async (transaction) => {
        if ((await transaction.get(room)).exists()) throw new Error('CODE_COLLISION')
        transaction.set(room, {
          code,
          game,
          host_id: uid,
          status: 'waiting',
          players: { [uid]: { user_id: uid, seat: 0, name } },
          created_at: serverTimestamp(),
        })
      })
      return { id: code, code }
    } catch (error) {
      if (!(error instanceof Error) || error.message !== 'CODE_COLLISION') throw error
    }
  }
  throw new Error('Impossibile generare il codice stanza.')
}

export async function joinRoom(value: string, name: string) {
  const uid = await userId()
  const code = value.trim().toUpperCase()
  if (!/^[A-HJ-NP-Z2-9]{6}$/.test(code)) throw new Error('Codice stanza non valido.')
  const room = doc(db, 'rooms', code)

  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(room)
    if (!snapshot.exists()) throw new Error('Stanza non trovata.')
    const data = snapshot.data() as RoomDocument
    if (data.status !== 'waiting') throw new Error('La partita è già iniziata.')
    transaction.update(room, { players: addPlayer(data.players, uid, name, MAX_PLAYERS[data.game]) })
  })
  return { id: code, code }
}

export function subscribeRoom(id: string, next: (room: RoomSnapshot) => void, fail: (error: Error) => void) {
  return onSnapshot(doc(db, 'rooms', id), (snapshot) => {
    if (!snapshot.exists()) return fail(new Error('Stanza non trovata.'))
    next(roomSnapshot(snapshot.id, snapshot.data() as RoomDocument))
  }, fail)
}
