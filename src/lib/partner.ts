import type { User } from 'firebase/auth'
import { doc, getDoc, onSnapshot, runTransaction, serverTimestamp, setDoc, updateDoc, writeBatch } from 'firebase/firestore'
import { db } from './firebase.ts'
import { acceptPair as acceptedPair, createInvite as inviteData, createPair as pairData } from './partner-domain.ts'
import type { Invite, Pair } from './partner-domain.ts'
import { decodeState, encodeState } from './online-game.ts'

export type PairSnapshot = Pair & { id: string }
export type InviteSnapshot<State = unknown> = Invite<State> & { id: string }

const displayName = (user: User) => user.displayName?.trim() || user.email?.split('@')[0] || 'Giocatore'

export async function loadPairId(userId: string) {
  return (await getDoc(doc(db, 'users', userId))).get('pairId') as string | undefined
}

export async function createPair(user: User) {
  const pairId = user.uid
  const batch = writeBatch(db)
  batch.set(doc(db, 'pairs', pairId), { ...pairData(user.uid, displayName(user)), created_at: serverTimestamp() })
  batch.set(doc(db, 'users', user.uid), { pairId }, { merge: true })
  await batch.commit()
  return pairId
}

export async function acceptPair(pairId: string, user: User) {
  await runTransaction(db, async (transaction) => {
    const reference = doc(db, 'pairs', pairId)
    const snapshot = await transaction.get(reference)
    if (!snapshot.exists()) throw new Error('Link di abbinamento non valido.')
    const next = acceptedPair(snapshot.data() as Pair, user.uid, displayName(user))
    transaction.update(reference, next)
    transaction.set(doc(db, 'users', user.uid), { pairId }, { merge: true })
  })
}

export function subscribePair(pairId: string, next: (pair: PairSnapshot) => void, fail: (error: Error) => void) {
  return onSnapshot(doc(db, 'pairs', pairId), (snapshot) => {
    if (!snapshot.exists()) return fail(new Error('Abbinamento non trovato.'))
    next({ id: snapshot.id, ...snapshot.data() } as PairSnapshot)
  }, fail)
}

export async function invitePartner<State>(pair: PairSnapshot, userId: string, game: string, state: State) {
  const reference = doc(db, 'pairs', pair.id, 'invites', 'active')
  await setDoc(reference, { ...inviteData(pair, userId, game, encodeState(state)), updated_at: serverTimestamp() })
}

export function subscribeInvite<State>(pairId: string, next: (invite: InviteSnapshot<State> | null) => void, fail: (error: Error) => void) {
  return onSnapshot(doc(db, 'pairs', pairId, 'invites', 'active'), (snapshot) => {
    if (!snapshot.exists()) return next(null)
    try {
      const data = snapshot.data() as Invite<unknown>
      next({ id: snapshot.id, ...data, state: decodeState<State>(data.state) })
    } catch (error) {
      fail(error instanceof Error ? error : new Error('Invito illeggibile.'))
    }
  }, fail)
}

export const acceptInvite = (pairId: string) => updateDoc(doc(db, 'pairs', pairId, 'invites', 'active'), { status: 'accepted', updated_at: serverTimestamp() })
export const closeInvite = (pairId: string) => updateDoc(doc(db, 'pairs', pairId, 'invites', 'active'), { status: 'closed', updated_at: serverTimestamp() })
export const updateInviteState = <State>(pairId: string, state: State, by: string) => updateDoc(doc(db, 'pairs', pairId, 'invites', 'active'), { state: encodeState(state), last_by: by, updated_at: serverTimestamp() })
