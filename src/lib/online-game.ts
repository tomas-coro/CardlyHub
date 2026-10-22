export type OnlineGame<State> = {
  userId: string
  hostId: string
  state: State
  onState: (state: State) => void
  lastBy?: string   // uid di chi ha scritto l'ultimo stato
}

// Vero quando l'ultimo stato l'ha scritto l'altro giocatore: è la mossa da riprodurre animata sul nostro schermo.
export const isRemoteChange = ({ userId, lastBy }: Pick<OnlineGame<unknown>, 'userId' | 'lastBy'>): boolean => lastBy !== undefined && lastBy !== userId

export const playerIndex = ({ userId, hostId }: Pick<OnlineGame<unknown>, 'userId' | 'hostId'>): 0 | 1 => userId === hostId ? 0 : 1

// Firestore rifiuta array annidati (mani, pile, combinazioni) e valori undefined: lo stato di gioco
// viaggia quindi come testo JSON dentro l'invito e si ricostruisce alla lettura.
export const encodeState = (state: unknown): string => JSON.stringify(state)

export function decodeState<State>(raw: unknown): State {
  if (typeof raw !== 'string') throw new Error('Stato della partita non valido: formato inatteso.')
  return JSON.parse(raw) as State
}
