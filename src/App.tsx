import { useState } from 'react'
import './App.css'

type Concept = 1 | 2 | 3

function ConceptPicker({ concept, onChange }: { concept: Concept; onChange: (concept: Concept) => void }) {
  return (
    <nav className="concept-picker" aria-label="Scegli il mockup">
      <strong>Nuove proposte</strong>
      <div>
        <button className={concept === 1 ? 'selected' : ''} onClick={() => onChange(1)}>1 · Portale</button>
        <button className={concept === 2 ? 'selected' : ''} onClick={() => onChange(2)}>2 · Club</button>
        <button className={concept === 3 ? 'selected' : ''} onClick={() => onChange(3)}>3 · Playground</button>
      </div>
    </nav>
  )
}

function Portale() {
  return (
    <section className="concept portal">
      <header>
        <a className="portal-logo" href="/" aria-label="CardlyHub, pagina iniziale"><i>c</i> CardlyHub</a>
        <nav aria-label="Navigazione principale"><a href="#giochi">Giochi</a><a href="#come-funziona">Come funziona</a></nav>
        <button type="button">Entra in una stanza</button>
      </header>

      <div className="portal-layout">
        <div className="portal-copy">
          <p className="portal-kicker"><i></i> Il tuo spazio per giocare</p>
          <h1>Tutti i tavoli iniziano da qui.</h1>
          <p>Scopri nuovi giochi, ritrova i tuoi preferiti e condividi il tavolo con chi vuoi. Senza complicazioni.</p>
          <div className="portal-actions">
            <button className="primary" type="button">Esplora i giochi <span>↗</span></button>
            <button type="button">Ho un codice stanza</button>
          </div>
        </div>

        <div className="portal-art" aria-hidden="true">
          <div className="portal-ring"></div>
          <div className="abstract-card card-a"><i></i><b>●</b><span></span></div>
          <div className="abstract-card card-b"><i></i><b>✦</b><span></span></div>
          <div className="abstract-card card-c"><i></i><b>≈</b><span></span></div>
          <small>Entra. Scegli. Gioca.</small>
        </div>
      </div>
    </section>
  )
}

function Club() {
  return (
    <section className="concept club">
      <header>
        <a className="club-logo" href="/" aria-label="CardlyHub, pagina iniziale">Cardly<span>Hub</span></a>
        <p>Un posto libero al tavolo, sempre.</p>
        <nav aria-label="Navigazione principale"><a href="#giochi">Giochi</a><button type="button">Accedi alla stanza</button></nav>
      </header>

      <div className="club-layout">
        <div className="club-copy">
          <p className="club-kicker">Benvenuti al CardlyHub</p>
          <h1>Il tuo posto al tavolo.</h1>
          <p>Una casa digitale per giocare insieme o concederti una partita in tranquillità.</p>
          <button className="club-cta" type="button">Vai alla sezione giochi <span>→</span></button>
        </div>

        <div className="club-table" aria-hidden="true">
          <div className="seat seat-one"><i></i><span>Tu</span></div>
          <div className="seat seat-two"><i></i><span>Invita</span></div>
          <div className="seat seat-three"><i></i></div>
          <div className="seat seat-four"><i></i></div>
          <div className="table-center"><b>CH</b><small>Pronti a giocare?</small></div>
          <div className="tile tile-one"></div>
          <div className="tile tile-two"></div>
          <div className="tile tile-three"></div>
        </div>
      </div>
      <footer><span>Gioca da solo</span><i></i><span>Invita gli amici</span><i></i><span>Entra senza account</span></footer>
    </section>
  )
}

function Playground() {
  return (
    <section className="concept playground">
      <header>
        <a className="play-logo" href="/" aria-label="CardlyHub, pagina iniziale">CARDLY<br />HUB!</a>
        <p>La casa online dei giochi di carte.</p>
        <button type="button">CODICE STANZA</button>
      </header>

      <div className="play-layout">
        <div className="play-title">
          <p>Scegli il tuo modo di giocare</p>
          <h1>GIOCA<br /><span>COME</span><br />VUOI.</h1>
        </div>

        <div className="play-collage" aria-hidden="true">
          <div className="burst">VIA!</div>
          <div className="play-card play-card-one"><b>?</b><span>SCOPRI</span></div>
          <div className="play-card play-card-two"><b>☺</b><span>INSIEME</span></div>
          <div className="play-card play-card-three"><b>1</b><span>DA SOLO</span></div>
        </div>

        <div className="play-action">
          <p>Un solo posto, tanti modi di divertirsi. Il prossimo gioco lo scegli tu.</p>
          <button type="button">VEDI TUTTI I GIOCHI <span>▶</span></button>
        </div>
      </div>
    </section>
  )
}

function App() {
  const [concept, setConcept] = useState<Concept>(1)

  return (
    <main>
      <ConceptPicker concept={concept} onChange={setConcept} />
      {concept === 1 && <Portale />}
      {concept === 2 && <Club />}
      {concept === 3 && <Playground />}
    </main>
  )
}

export default App
