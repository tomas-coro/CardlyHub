import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { createRoom, joinRoom, loadRoom, subscribeRoom, supabaseConfigured, unsubscribeRoom } from './lib/rooms.ts'
import type { RoomSnapshot } from './lib/rooms.ts'

type Mode = 'create' | 'join'

const GAME_NAMES: Record<string, string> = {
  briscola: 'Briscola', machiavelli: 'Machiavelli', uno: 'UNO', burraco: 'Burraco', dadi: 'Dadi',
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Qualcosa è andato storto.'
}

export default function RoomLobby({ initialMode, onClose }: { initialMode: Mode; onClose: () => void }) {
  const [mode, setMode] = useState(initialMode)
  const [roomId, setRoomId] = useState<string | null>(null)
  const [room, setRoom] = useState<RoomSnapshot | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!roomId) return
    let active = true
    const refresh = () => loadRoom(roomId).then((next) => { if (active) setRoom(next) }).catch((reason: unknown) => { if (active) setError(errorMessage(reason)) })
    refresh()
    const channel = subscribeRoom(roomId, refresh)
    return () => { active = false; void unsubscribeRoom(channel) }
  }, [roomId])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')
    const form = new FormData(event.currentTarget)
    try {
      const result = mode === 'create'
        ? await createRoom(String(form.get('game')), String(form.get('name')))
        : await joinRoom(String(form.get('code')), String(form.get('name')))
      setRoomId(result.id)
    } catch (reason) {
      setError(errorMessage(reason))
    } finally {
      setBusy(false)
    }
  }

  async function copyCode() {
    if (!room) return
    await navigator.clipboard.writeText(room.code)
    setCopied(true)
  }

  return (
    <div className="room-overlay" role="dialog" aria-modal="true" aria-labelledby="room-title">
      <section className="room-modal">
        <button className="room-close" onClick={onClose} aria-label="Chiudi">×</button>
        {room ? (
          <>
            <p className="status"><i /> Stanza online</p>
            <h2 id="room-title">{GAME_NAMES[room.game]}</h2>
            <p>Condividi questo codice con gli altri giocatori.</p>
            <button className="room-code-live" onClick={copyCode}>{room.code}<small>{copied ? 'Copiato' : 'Copia'}</small></button>
            <div className="room-player-list">
              {room.players.map((player) => <div key={player.user_id}><i>{player.name.slice(0, 2).toUpperCase()}</i><b>{player.name}</b><small>{player.user_id === room.host_id ? 'Host' : `Posto ${player.seat + 1}`}</small></div>)}
            </div>
            <p className="room-note" aria-live="polite">Lobby sincronizzata in tempo reale. L'avvio della partita online arriva nel prossimo passo.</p>
          </>
        ) : (
          <>
            <p className="status"><i /> Multiplayer</p>
            <h2 id="room-title">{mode === 'create' ? 'Apri un tavolo' : 'Entra al tavolo'}</h2>
            {!supabaseConfigured ? (
              <p className="room-error" role="alert">Configura Supabase in <code>.env.local</code> prima di creare una stanza.</p>
            ) : (
              <form onSubmit={submit}>
                <label>Il tuo nome<input name="name" autoComplete="nickname" maxLength={24} required autoFocus /></label>
                {mode === 'create' ? (
                  <label>Gioco<select name="game" defaultValue="briscola">{Object.entries(GAME_NAMES).map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
                ) : (
                  <label>Codice stanza<input className="room-code-input" name="code" autoComplete="off" minLength={6} maxLength={6} pattern="[A-Za-z0-9]{6}" required /></label>
                )}
                <button className="main-action" disabled={busy}>{busy ? 'Connessione…' : mode === 'create' ? 'Crea stanza' : 'Entra'}</button>
                {error && <p className="room-error" role="alert">{error}</p>}
              </form>
            )}
            <button className="room-switch" onClick={() => { setMode(mode === 'create' ? 'join' : 'create'); setError('') }}>
              {mode === 'create' ? 'Hai già un codice?' : 'Vuoi creare una stanza?'}
            </button>
          </>
        )}
      </section>
    </div>
  )
}
