import { useEffect, useRef, useState } from 'react'
import BriscolaTable from '../games/briscola/BriscolaTable.tsx'
import BurracoTable from '../games/burraco/BurracoTable.tsx'
import DadiTable from '../games/dadi/DadiTable.tsx'
import MachiavelliTable from '../games/machiavelli/MachiavelliTable.tsx'
import UnoTable from '../games/uno/UnoTable.tsx'
import { makeOnlineState, type OnlineGameId, type OnlineState } from '../lib/online-state.ts'

// Banco di prova SOLO per lo sviluppo (vite dev): due tavoli affiancati che si scambiano lo stato come farebbero due
// dispositivi online, senza Firebase né login. Apri /?sim=dadi (o briscola, uno, machiavelli, burraco).
// Ogni metà è un iframe con la sua finestra, così layout e viewport sono quelli veri; lo stato passa da BroadcastChannel.

type Msg = { type: 'hello' } | { type: 'state'; state: OnlineState; by: string }

export default function OnlineSim() {
  const q = new URLSearchParams(location.search)
  const game = q.get('sim') as OnlineGameId
  const me = q.get('me')
  if (me === null) {
    const frame = (n: number) => <iframe title={n === 0 ? 'Tomas' : 'Lei'} src={`/?sim=${game}&me=${n}`} style={{ flex: 1, minWidth: 0, height: '100vh', border: 0 }} />
    return <div style={{ display: 'flex', gap: 4, background: '#000' }}>{frame(0)}{frame(1)}</div>
  }
  return <Client game={game} me={Number(me)} />
}

function Client({ game, me }: { game: OnlineGameId; me: number }) {
  const [state, setState] = useState<OnlineState | null>(() => me === 0 ? makeOnlineState(game, ['Tomas', 'Lei']) : null)
  const [by, setBy] = useState('0')
  const channel = useRef<BroadcastChannel | null>(null)
  const latest = useRef(state)
  useEffect(() => { latest.current = state }, [state])

  useEffect(() => {
    const ch = new BroadcastChannel(`cardly-sim-${game}`)
    channel.current = ch
    ch.onmessage = (e: MessageEvent<Msg>) => {
      if (e.data.type === 'hello' && me === 0 && latest.current) ch.postMessage({ type: 'state', state: latest.current, by: '0' } satisfies Msg)
      if (e.data.type === 'state') { setState(e.data.state); setBy(e.data.by) }
    }
    if (me !== 0) ch.postMessage({ type: 'hello' } satisfies Msg)
    return () => ch.close()
  }, [game, me])

  useEffect(() => {
    // appigli per i test automatici: leggere lo stato e scriverne uno nuovo come se l'avessi mosso io
    Object.assign(window, {
      __simState: state,
      __simPush: (next: OnlineState) => { setState(next); setBy(String(me)); channel.current?.postMessage({ type: 'state', state: next, by: String(me) } satisfies Msg) },
    })
  }, [state, me])

  if (!state) return <p style={{ color: '#fff', padding: 20 }}>In attesa dell’altro giocatore…</p>
  const online = {
    userId: String(me), hostId: '0', state, lastBy: by,
    onState: (next: OnlineState) => {
      const copy = JSON.parse(JSON.stringify(next)) as OnlineState   // come farebbe Firestore: tutto passa da JSON
      setState(copy); setBy(String(me))
      channel.current?.postMessage({ type: 'state', state: copy, by: String(me) } satisfies Msg)
    },
  }
  const back = () => undefined
  // appigli per i test automatici: leggere lo stato e scriverne uno nuovo come se l'avessi mosso io
  // lo stato è del gioco giusto per costruzione: il cast evita un tipo diverso per ogni tavolo
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const o = online as any
  if (game === 'dadi') return <DadiTable onBack={back} online={o} onRematch={() => undefined} />
  if (game === 'briscola') return <BriscolaTable onBack={back} deck="napoletane" online={o} />
  if (game === 'uno') return <UnoTable onBack={back} online={o} onRematch={() => undefined} />
  if (game === 'burraco') return <BurracoTable onBack={back} online={o} onRematch={() => undefined} />
  return <MachiavelliTable onBack={back} online={o} onRematch={() => undefined} />
}
