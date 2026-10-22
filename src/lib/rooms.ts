import { createClient, type RealtimeChannel } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

export const supabaseConfigured = Boolean(url && key)
const supabase = supabaseConfigured ? createClient(url, key) : null

export type RoomPlayer = { user_id: string; seat: number; name: string }
export type RoomSnapshot = {
  id: string
  code: string
  game: string
  host_id: string
  status: 'waiting' | 'playing' | 'finished'
  players: RoomPlayer[]
}

function client() {
  if (!supabase) throw new Error('Supabase non è configurato. Aggiungi le variabili VITE_SUPABASE_* nel file .env.local.')
  return supabase
}

async function ensureSession() {
  const db = client()
  const { data } = await db.auth.getSession()
  if (data.session) return
  const { error } = await db.auth.signInAnonymously()
  if (error) throw error
}

async function enterRoom(functionName: 'create_room' | 'join_room', values: Record<string, string>) {
  await ensureSession()
  const { data, error } = await client().rpc(functionName, values)
  if (error) throw error
  const room = data?.[0]
  if (!room) throw new Error('Supabase non ha restituito la stanza.')
  return { id: room.room_id as string, code: room.room_code as string }
}

export const createRoom = (game: string, name: string) => enterRoom('create_room', { p_game: game, p_name: name })
export const joinRoom = (code: string, name: string) => enterRoom('join_room', { p_code: code, p_name: name })

export async function loadRoom(id: string): Promise<RoomSnapshot> {
  const db = client()
  const [{ data: room, error: roomError }, { data: players, error: playersError }] = await Promise.all([
    db.from('rooms').select('id, code, game, host_id, status').eq('id', id).single(),
    db.from('room_players').select('user_id, seat, name').eq('room_id', id).order('seat'),
  ])
  if (roomError) throw roomError
  if (playersError) throw playersError
  return { ...room, players } as RoomSnapshot
}

export function subscribeRoom(id: string, refresh: () => void): RealtimeChannel {
  return client().channel(`room:${id}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${id}` }, refresh)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'room_players', filter: `room_id=eq.${id}` }, refresh)
    .subscribe()
}

export function unsubscribeRoom(channel: RealtimeChannel) {
  return client().removeChannel(channel)
}
