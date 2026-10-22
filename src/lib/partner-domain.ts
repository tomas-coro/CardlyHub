export type Pair = {
  members: string[]
  names: Record<string, string>
}

export type Invite<State = unknown> = {
  game: string
  host_id: string
  guest_id: string
  status: 'pending' | 'accepted' | 'closed'
  state: State
}

export function createPair(userId: string, name: string): Pair {
  return { members: [userId], names: { [userId]: name } }
}

export function acceptPair(pair: Pair, userId: string, name: string): Pair {
  if (pair.members.includes(userId)) throw new Error('Non puoi abbinare lo stesso account.')
  if (pair.members.length !== 1) throw new Error('Questa coppia è già completa.')
  return { members: [...pair.members, userId], names: { ...pair.names, [userId]: name } }
}

export function partnerOf(pair: Pair, userId: string) {
  const id = pair.members.find((member) => member !== userId)
  return id ? { id, name: pair.names[id] } : null
}

export function createInvite<State>(pair: Pair, hostId: string, game: string, state: State): Invite<State> {
  const partner = partnerOf(pair, hostId)
  if (!partner) throw new Error('Abbina prima il secondo account.')
  return { game, host_id: hostId, guest_id: partner.id, status: 'pending', state }
}
