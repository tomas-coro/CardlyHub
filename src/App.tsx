import { useState } from 'react'
import './App.css'
import DadiTable from './games/dadi/DadiTable'
import MachiavelliTable from './games/machiavelli/MachiavelliTable'
import BriscolaTable from './games/briscola/BriscolaTable'
import denari7 from './assets/cards/napoletane/denari-07.jpg'
import bastoni3 from './assets/cards/napoletane/bastoni-03.jpg'
import coppe1 from './assets/cards/napoletane/coppe-01.jpg'

type Concept = 1 | 2 | 3

const games = [
  { id: 'briscola', name: 'Briscola', meta: '2–4 giocatori', className: 'coral' },
  { id: 'machiavelli', name: 'Machiavelli', meta: '2–6 giocatori', className: 'lime' },
  { id: 'uno', name: 'UNO', meta: '2–10 giocatori', className: 'violet' },
  { id: 'dadi', name: 'Dadi', meta: '2–6 giocatori', className: 'coral' },
] as const

type Game = typeof games[number]
const defaultRecents = games.map(({ id }) => id)

function loadRecents() {
  try {
    const saved = JSON.parse(localStorage.getItem('recent-games') ?? '[]')
    if (Array.isArray(saved)) {
      const valid = saved.filter((id): id is Game['id'] => games.some((game) => game.id === id))
      if (valid.length) return [...new Set(valid), ...defaultRecents.filter((id) => !valid.includes(id))]
    }
  } catch { /* use defaults */ }
  return defaultRecents
}

function Picker({ concept, onChange }: { concept: Concept; onChange: (concept: Concept) => void }) {
  return (
    <nav className="picker" aria-label="Scegli il mockup">
      <span>Tre direzioni, una sola identità</span>
      <div>
        <button className={concept === 1 ? 'active' : ''} onClick={() => onChange(1)}>01 Prodotto</button>
        <button className={concept === 2 ? 'active' : ''} onClick={() => onChange(2)}>02 Serata</button>
        <button className={concept === 3 ? 'active' : ''} onClick={() => onChange(3)}>03 Giochi</button>
      </div>
    </nav>
  )
}

function Logo() {
  return <a className="logo" href="/" aria-label="CardlyHub, pagina iniziale"><i>◆</i>CardlyHub</a>
}

function Header() {
  return (
    <header className="site-header">
      <Logo />
      <nav aria-label="Navigazione principale"><a href="#games">Giochi</a><a href="#how">Come funziona</a></nav>
      <button className="outline-action">Ho un codice</button>
    </header>
  )
}

// Fronte UNO, direzione "Pop + indici grandi" (mockups/02-uno-tavolo.html, tema th-b). Geometria su viewBox 200x300.
const unoColors = { red: '#e4261f', blue: '#1f6fd1', yellow: '#f7c600', green: '#2f9e44' } as const

function UnoReverse({ x, y, size, color }: { x: number; y: number; size: number; color: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${size / 24})`} fill="none" stroke={color} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 9h13l-3.5-3.5M20 15H7l3.5 3.5" />
    </g>
  )
}

function UnoFace({ color, value }: { color: keyof typeof unoColors; value: string }) {
  const fill = unoColors[color]
  const ink = color === 'yellow' ? '#16181d' : '#fff'
  const isReverse = value === 'rev'
  const index = (rotate: boolean) => (
    <g transform={rotate ? 'rotate(180 100 150)' : undefined}>
      {isReverse
        ? <UnoReverse x={10} y={8} size={56} color={ink} />
        : <text x="16" y="56" fontSize="54" fontWeight="900" fill={ink} fontFamily="inherit">{value}</text>}
    </g>
  )
  return (
    <svg className="card real" viewBox="0 0 200 300">
      <rect width="200" height="300" rx="18" fill="#fff" />
      <clipPath id={`uno-face-${color}`}><rect x="10" y="10" width="180" height="280" rx="16" /></clipPath>
      <g clipPath={`url(#uno-face-${color})`}>
        <rect x="10" y="10" width="180" height="280" fill={fill} />
        <circle cx="168" cy="268" r="62" fill="#000" fillOpacity=".16" />
        <circle cx="163" cy="39" r="11" fill="#fff" fillOpacity=".3" />
      </g>
      <ellipse cx="100" cy="168" rx="92" ry="93" fill="#fff" transform="rotate(-28 100 168)" />
      {isReverse
        ? <UnoReverse x={42} y={112} size={116} color={fill} />
        : <text x="100" y="205" textAnchor="middle" fontSize="120" fontWeight="900" letterSpacing="-6" fill={color === 'yellow' ? '#16181d' : fill} fontFamily="inherit">{value}</text>}
      {index(false)}
      {index(true)}
    </svg>
  )
}

function GameArt({ game }: { game: Game }) {
  if (game.id === 'dadi') return (
    <div className="game-symbol dadi" aria-hidden="true">
      <i className="die five">{Array.from({ length: 9 }, (_, index) => <span key={index} />)}</i>
      <i className="die three">{Array.from({ length: 9 }, (_, index) => <span key={index} />)}</i>
    </div>
  )

  if (game.id === 'briscola') return (
    <div className="game-symbol briscola" aria-hidden="true">
      <img className="card real" src={denari7} alt="" />
      <img className="card real" src={bastoni3} alt="" />
      <img className="card real" src={coppe1} alt="" />
    </div>
  )

  // Carte francesi: simboli dello sprite svg-cards (public/cards/french), una <use> per carta
  if (game.id === 'machiavelli') return (
    <div className="game-symbol machiavelli" aria-hidden="true">
      {['heart_7', 'club_8', 'diamond_9'].map((id) => (
        <svg key={id} className="card real" viewBox="0 0 169.075 244.64"><use href={`/cards/french/svg-cards.svg#${id}`} /></svg>
      ))}
    </div>
  )

  return (
    <div className="game-symbol uno" aria-hidden="true">
      <UnoFace color="red" value="5" />
      <UnoFace color="blue" value="7" />
      <UnoFace color="yellow" value="rev" />
    </div>
  )
}

function GameCard({ game, featured = false, onPlay }: { game: Game; featured?: boolean; onPlay?: (game: Game) => void }) {
  return (
    <article className={`game-card ${game.className} ${featured ? 'featured' : ''}`}>
      <GameArt game={game} />
      <div><h3>{game.name}</h3><p>{game.meta}</p></div>
      <button aria-label={`Gioca a ${game.name}`} onClick={() => onPlay?.(game)}>↗</button>
    </article>
  )
}

function Product({ recentGames, onPlay }: { recentGames: Game[]; onPlay: (game: Game) => void }) {
  return (
    <section className="mockup product">
      <Header />
      <div className="product-hero">
        <div className="hero-copy">
          <p className="status"><i /> Giochi di carte, senza distanza</p>
          <h1><span>Il tavolo</span><br />è già pronto.</h1>
          <p className="lead">Apri una stanza, scegli il gioco e condividi il link. Gli altri entrano senza account.</p>
          <div className="hero-actions"><button className="main-action">Apri un tavolo</button><button className="plain-action">Esplora i giochi</button></div>
        </div>
        <div className="product-showcase">
          <span className="live-badge"><i /> 128 tavoli aperti</span>
          <div className="product-window" aria-label="Anteprima del catalogo giochi">
            <div className="window-top"><span>CardlyHub / Giochi</span><i /><i /><i /></div>
            <div className="window-body">
              <div className="welcome"><div><small>Riprendi da dove eri rimasto</small><b>I tuoi giochi recenti</b></div><span>TS</span></div>
              <GameCard game={recentGames[0]} featured onPlay={onPlay} />
              <div className="mini-games">{recentGames.slice(1).map((game) => <GameCard key={game.id} game={game} onPlay={onPlay} />)}</div>
            </div>
          </div>
          <span className="invite-badge"><b>+3</b> amici online</span>
        </div>
      </div>
      <footer className="trust-line"><b>Nessun download</b><span>Invita con un link</span><span>Gli ospiti entrano senza account</span></footer>
    </section>
  )
}

function Night() {
  return (
    <section className="mockup night">
      <Header />
      <div className="night-hero">
        <div className="night-copy">
          <p className="status"><i /> Tutti online</p>
          <h1>Stasera<br />si gioca.</h1>
          <p className="lead">Il tavolo è già pronto. Manca solo il gruppo.</p>
          <button className="main-action">Crea una stanza</button>
        </div>
        <div className="room" aria-label="Anteprima di una stanza di gioco">
          <div className="room-head"><div><small>Stanza di Sofia</small><b>Briscola</b></div><span>CODICE <strong>7K3M</strong></span></div>
          <div className="players">
            <div className="player p1"><i>SO</i><b>Sofia</b><small>Host</small></div>
            <div className="player p2"><i>LU</i><b>Luca</b><small>Pronto</small></div>
            <div className="player p3"><i>AN</i><b>Anna</b><small>Pronta</small></div>
            <button className="invite"><i>+</i><b>Invita</b><small>Copia il link</small></button>
          </div>
          <button className="start-game">Inizia la partita <span>→</span></button>
        </div>
      </div>
      <div className="ticker"><span>BRISCOLA</span><i>◆</i><span>POKER</span><i>◆</i><span>SCALA 40</span><i>◆</i><span>BURRACO</span><i>◆</i><span>UNO</span></div>
    </section>
  )
}

function Library() {
  return (
    <section className="mockup library">
      <Header />
      <div className="library-intro">
        <div><p className="status"><i /> Scegli il prossimo tavolo</p><h1>Tutti i giochi.<br />Tutta la compagnia.</h1></div>
        <div className="library-side"><p>Dai classici alle sfide veloci: apri una stanza e gioca con chi vuoi.</p><button className="main-action">Vedi tutti i giochi</button></div>
      </div>
      <div className="library-grid" id="games">
        <GameCard game={games[0]} />
        <GameCard game={games[1]} featured />
        <GameCard game={games[2]} />
      </div>
    </section>
  )
}

function App() {
  const [concept, setConcept] = useState<Concept>(1)
  const [recentIds, setRecentIds] = useState(loadRecents)
  const [openGame, setOpenGame] = useState<Game['id'] | null>(null)
  const recentGames = recentIds.map((id) => games.find((game) => game.id === id)!)
  const play = (game: Game) => {
    const next = [game.id, ...recentIds.filter((id) => id !== game.id)]
    localStorage.setItem('recent-games', JSON.stringify(next))
    setRecentIds(next)
    // per ora si aprono solo i tavoli di dadi, Briscola e Machiavelli; gli altri giochi non hanno ancora una schermata
    if (game.id === 'dadi' || game.id === 'machiavelli' || game.id === 'briscola') setOpenGame(game.id)
  }

  if (openGame === 'dadi') return <main><DadiTable onBack={() => setOpenGame(null)} /></main>
  if (openGame === 'briscola') return <main><BriscolaTable onBack={() => setOpenGame(null)} /></main>
  if (openGame === 'machiavelli') return <main><MachiavelliTable onBack={() => setOpenGame(null)} /></main>

  return <main><Picker concept={concept} onChange={setConcept} />{concept === 1 && <Product recentGames={recentGames} onPlay={play} />}{concept === 2 && <Night />}{concept === 3 && <Library />}</main>
}

export default App
