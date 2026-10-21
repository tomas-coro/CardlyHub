import { useState } from 'react'
import type { FormEvent } from 'react'
import './App.css'

type Mode = 'create' | 'join'

function App() {
  const [mode, setMode] = useState<Mode>('create')
  const [message, setMessage] = useState('')

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage(
      mode === 'create'
        ? 'Room setup saved. Online rooms are the next step.'
        : 'Room code accepted. Online rooms are the next step.',
    )
  }

  return (
    <main>
      <header className="site-header">
        <a className="brand" href="/" aria-label="CardlyHub home">
          <span aria-hidden="true">♣</span> CardlyHub
        </a>
        <p>Classic cards, played together.</p>
      </header>

      <section className="hero" aria-labelledby="page-title">
        <div className="intro">
          <p className="kicker">Machiavelli · private table</p>
          <h1 id="page-title">Your table is ready when your friend is.</h1>
          <p className="lead">
            Open a private room, share the code and play live. No account needed.
          </p>
          <ul className="quick-facts" aria-label="Game highlights">
            <li>2 players</li>
            <li>Live turns</li>
            <li>Undo anytime</li>
          </ul>

          <div className="room-panel">
            <div className="mode-switch" role="group" aria-label="Room action">
              <button
                className={mode === 'create' ? 'active' : ''}
                type="button"
                aria-pressed={mode === 'create'}
                onClick={() => {
                  setMode('create')
                  setMessage('')
                }}
              >
                Create a room
              </button>
              <button
                className={mode === 'join' ? 'active' : ''}
                type="button"
                aria-pressed={mode === 'join'}
                onClick={() => {
                  setMode('join')
                  setMessage('')
                }}
              >
                Join with a code
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <label>
                Your name
                <input name="playerName" autoComplete="nickname" maxLength={24} required />
              </label>

              {mode === 'create' ? (
                <div className="options-row">
                  <label>
                    Match
                    <select name="matchType" defaultValue="quick">
                      <option value="quick">Quick match</option>
                      <option value="best-of-3">Best of 3</option>
                      <option value="best-of-5">Best of 5</option>
                      <option value="101">First to 101</option>
                    </select>
                  </label>
                  <label>
                    Table moves
                    <select name="tableMoves" defaultValue="immediate">
                      <option value="immediate">Immediately</option>
                      <option value="after-opening">After opening</option>
                    </select>
                  </label>
                </div>
              ) : (
                <label>
                  Room code
                  <input
                    className="room-code"
                    name="roomCode"
                    inputMode="text"
                    autoComplete="off"
                    minLength={6}
                    maxLength={6}
                    pattern="[A-Za-z0-9]{6}"
                    placeholder="A7K2Q9"
                    required
                  />
                </label>
              )}

              <button className="primary-action" type="submit">
                {mode === 'create' ? 'Create private room' : 'Join room'}
              </button>
              <p className="form-note" aria-live="polite">
                {message || 'Free to play · 2 players · no sign-up'}
              </p>
            </form>
          </div>
        </div>

        <div className="table-scene" aria-label="A Machiavelli card table illustration">
          <div className="table-mark">
            <span>M</span>
            <small>Machiavelli</small>
          </div>
          <div className="card card-one">
            <span>7</span>
            <b>♥</b>
            <span>7</span>
          </div>
          <div className="card card-two black">
            <span>8</span>
            <b>♣</b>
            <span>8</span>
          </div>
          <div className="card card-three">
            <span>9</span>
            <b>♦</b>
            <span>9</span>
          </div>
          <p>104 cards. No jokers.<br />Make, move, rethink.</p>
        </div>
      </section>
    </main>
  )
}

export default App
