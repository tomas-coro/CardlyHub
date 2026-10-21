import { useState } from 'react'
import './App.css'

type Concept = 1 | 2 | 3

function ConceptPicker({ concept, onChange }: { concept: Concept; onChange: (concept: Concept) => void }) {
  return (
    <nav className="concept-picker" aria-label="Scegli il mockup">
      <strong>Confronta le proposte</strong>
      <div>
        <button className={concept === 1 ? 'selected' : ''} onClick={() => onChange(1)}>1 · Sala giochi</button>
        <button className={concept === 2 ? 'selected' : ''} onClick={() => onChange(2)}>2 · Circolo italiano</button>
        <button className={concept === 3 ? 'selected' : ''} onClick={() => onChange(3)}>3 · Arcade</button>
      </div>
    </nav>
  )
}

function SalaGiochi() {
  return (
    <section className="concept concept-one">
      <header>
        <a className="logo" href="/" aria-label="CardlyHub, pagina iniziale"><i>♣</i> CardlyHub</a>
        <p>Il tavolo da gioco che porti con te.</p>
        <button type="button">Entra con un codice</button>
      </header>

      <div className="playroom-layout">
        <div className="playroom-copy">
          <span className="tag">Nessun account. Solo una partita.</span>
          <h1>Un tavolo per ogni mazzo.</h1>
          <p>Scegli il gioco, invita chi vuoi e comincia. Oppure prenditi cinque minuti solo per te.</p>
          <button className="cta-one" type="button">Crea una stanza</button>
        </div>

        <div className="game-shelf" aria-label="Giochi disponibili">
          <article className="game-tile machiavelli">
            <div className="mini-cards french"><b>7♥</b><b>8♣</b><b>9♦</b></div>
            <span>2 giocatori</span>
            <h2>Machiavelli</h2>
            <p>Componi, sposta, sorprendi.</p>
          </article>
          <article className="game-tile briscola">
            <div className="italian-card"><b>3</b><i>🏆</i><small>COPPE</small></div>
            <span>2–4 giocatori</span>
            <h2>Briscola</h2>
            <p>La classica sfida italiana.</p>
          </article>
          <article className="game-tile solitario">
            <div className="solitaire-stack"><i></i><i></i><b>A♠</b></div>
            <span>1 giocatore</span>
            <h2>Solitario</h2>
            <p>Una pausa, al tuo ritmo.</p>
          </article>
        </div>
      </div>
    </section>
  )
}

function CircoloItaliano() {
  return (
    <section className="concept concept-two">
      <header>
        <a className="logo" href="/" aria-label="CardlyHub, pagina iniziale">CardlyHub</a>
        <p>Giochi di carte, ovunque ci sia compagnia.</p>
        <button type="button">Come funziona</button>
      </header>

      <div className="circolo-layout">
        <div className="circolo-visual" aria-hidden="true">
          <div className="sun"></div>
          <div className="regional-card bastoni"><b>ASSO</b><i>♜</i><span>BASTONI</span></div>
          <div className="regional-card coppe"><b>TRE</b><i>●<br />● ●</i><span>COPPE</span></div>
          <p>Dal tavolo del bar<br />allo schermo di casa.</p>
        </div>

        <div className="circolo-copy">
          <p className="edition">Edizione italiana</p>
          <h1>Le partite di sempre, con chi vuoi.</h1>
          <p className="intro">Machiavelli, Briscola e Solitario in uno spazio semplice, accogliente e senza registrazione.</p>

          <div className="game-menu">
            <button type="button"><span>01</span><b>Machiavelli</b><small>Gioca insieme</small></button>
            <button type="button"><span>02</span><b>Briscola</b><small>Sfida gli amici</small></button>
            <button type="button"><span>03</span><b>Solitario</b><small>Gioca da solo</small></button>
          </div>
          <div className="circolo-actions">
            <button className="primary" type="button">Scegli un gioco</button>
            <button type="button">Ho un codice stanza</button>
          </div>
        </div>
      </div>
    </section>
  )
}

function Arcade() {
  return (
    <section className="concept concept-three">
      <header>
        <a className="logo" href="/" aria-label="CardlyHub, pagina iniziale"><i>CH</i> CardlyHub</a>
        <p>La tua sala carte digitale</p>
        <button type="button">Codice stanza ↗</button>
      </header>

      <div className="arcade-layout">
        <div className="arcade-copy">
          <p className="online"><i></i> Tavoli aperti</p>
          <h1>Scegli.<br />Mescola.<br />Gioca.</h1>
          <p>Classici italiani, giochi internazionali e sfide in solitaria. Tutto nello stesso posto.</p>
          <button className="arcade-cta" type="button">Inizia a giocare <span>▶</span></button>
        </div>

        <div className="arcade-library">
          <div className="library-title"><span>In evidenza</span><small>3 giochi</small></div>
          <article className="arcade-game featured">
            <div className="pixel-art">7<span>♥</span></div>
            <div><small>Strategia · 2 giocatori</small><h2>Machiavelli</h2><p>Il tavolo cambia a ogni mossa.</p></div>
            <button type="button" aria-label="Apri Machiavelli">→</button>
          </article>
          <article className="arcade-game">
            <div className="cup-art">♛<span>coppe</span></div>
            <div><small>Classico italiano · 2–4</small><h2>Briscola</h2><p>Conta le carte, prendi la mano.</p></div>
            <button type="button" aria-label="Apri Briscola">→</button>
          </article>
          <article className="arcade-game">
            <div className="solo-art">A♠</div>
            <div><small>In solitaria · senza fretta</small><h2>Solitario</h2><p>La tua partita, i tuoi tempi.</p></div>
            <button type="button" aria-label="Apri Solitario">→</button>
          </article>
        </div>
      </div>
    </section>
  )
}

function App() {
  const [concept, setConcept] = useState<Concept>(1)

  return (
    <main className={`show-concept-${concept}`}>
      <ConceptPicker concept={concept} onChange={setConcept} />
      {concept === 1 && <SalaGiochi />}
      {concept === 2 && <CircoloItaliano />}
      {concept === 3 && <Arcade />}
    </main>
  )
}

export default App
