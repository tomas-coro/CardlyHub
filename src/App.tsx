import { useEffect, useState } from 'react'
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth'
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import './App.css'
import DadiTable from './games/dadi/DadiTable'
import MachiavelliTable from './games/machiavelli/MachiavelliTable'
import BriscolaTable from './games/briscola/BriscolaTable'
import type { DeckStyle } from './games/briscola/BriscolaTable'
import UnoTable from './games/uno/UnoTable'
import BurracoTable from './games/burraco/BurracoTable'
import { UnoFace } from './games/uno/UnoFace.tsx'
import denari7 from './assets/cards/napoletane/denari-07.jpg'
import bastoni3 from './assets/cards/napoletane/bastoni-03.jpg'
import coppe1 from './assets/cards/napoletane/coppe-01.jpg'
import { auth, db } from './lib/firebase.ts'
import { acceptInvite, acceptPair, closeInvite, createPair, invitePartner, loadPairId, subscribeInvite, subscribePair, updateInviteState } from './lib/partner.ts'
import type { InviteSnapshot, PairSnapshot } from './lib/partner.ts'
import { partnerOf } from './lib/partner-domain.ts'
import { buildDeck as buildBriscolaDeck, newGame as newBriscolaGame, shuffle as shuffleBriscola } from './games/briscola/engine.ts'
import type { GameState as BriscolaState } from './games/briscola/engine.ts'

type Concept = 1 | 2 | 3

const games = [
  { id: 'briscola', name: 'Briscola', meta: '2–4 giocatori', className: 'coral' },
  { id: 'machiavelli', name: 'Machiavelli', meta: '2–6 giocatori', className: 'lime' },
  { id: 'uno', name: 'UNO', meta: '2–10 giocatori', className: 'violet' },
  { id: 'burraco', name: 'Burraco', meta: '2 giocatori', className: 'lime' },
  { id: 'dadi', name: 'Dadi', meta: '2–6 giocatori', className: 'coral' },
] as const

type Game = typeof games[number]
const defaultRecents = games.map(({ id }) => id)

function loadDeckPreference(): DeckStyle {
  return localStorage.getItem('briscola-deck') === 'trevigiane' ? 'trevigiane' : 'napoletane'
}

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

function Header({ onPartner, partnerName, user, authBusy, onAuth }: { onPartner: () => void; partnerName?: string; user: User | null; authBusy: boolean; onAuth: () => void }) {
  return (
    <header className="site-header">
      <Logo />
      <nav aria-label="Navigazione principale"><a href="#games">Giochi</a><a href="#how">Come funziona</a></nav>
      <div className="header-actions">
        <button className="auth-action" onClick={onAuth} disabled={authBusy}>{authBusy ? 'Attendi…' : user ? `Esci · ${user.displayName?.split(' ')[0] ?? 'Profilo'}` : 'Accedi con Google'}</button>
        <button className="outline-action" onClick={onPartner}>{partnerName ? `Con ${partnerName}` : 'Abbina account'}</button>
      </div>
    </header>
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
  if (game.id === 'machiavelli' || game.id === 'burraco') return (
    <div className={`game-symbol ${game.id}`} aria-hidden="true">
      {(game.id === 'burraco' ? ['club_9', 'heart_10', 'joker_red'] : ['heart_7', 'club_8', 'diamond_9']).map((id) => (
        <svg key={id} className="card real" viewBox="0 0 169.075 244.64"><use href={`/cards/french/svg-cards.svg#${id}`} /></svg>
      ))}
    </div>
  )

  return (
    <div className="game-symbol uno" aria-hidden="true">
      <UnoFace className="card real" card={{ id: 1, c: 'r', v: '5' }} />
      <UnoFace className="card real" card={{ id: 2, c: 'b', v: '7' }} />
      <UnoFace className="card real" card={{ id: 3, c: 'y', v: 'rev' }} />
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

function Product({ recentGames, onPlay, onPartner, partnerName, user, authBusy, onAuth }: { recentGames: Game[]; onPlay: (game: Game) => void; onPartner: () => void; partnerName?: string; user: User | null; authBusy: boolean; onAuth: () => void }) {
  return (
    <section className="mockup product">
      <Header onPartner={onPartner} partnerName={partnerName} user={user} authBusy={authBusy} onAuth={onAuth} />
      <div className="product-hero">
        <div className="hero-copy">
          <p className="status"><i /> Giochi di carte, senza distanza</p>
          <h1><span>Il tavolo</span><br />è già pronto.</h1>
          <p className="lead">Abbina una volta i vostri account, scegli il gioco e invita direttamente la tua compagna.</p>
          <div className="hero-actions"><button className="main-action" onClick={onPartner}>{partnerName ? `Gioca con ${partnerName}` : 'Abbina i vostri account'}</button><button className="plain-action">Esplora i giochi</button></div>
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
      <footer className="trust-line"><b>Nessun download</b><span>Un solo abbinamento</span><span>Inviti diretti tra voi due</span></footer>
    </section>
  )
}

function Night({ onPartner, partnerName, user, authBusy, onAuth }: { onPartner: () => void; partnerName?: string; user: User | null; authBusy: boolean; onAuth: () => void }) {
  return (
    <section className="mockup night">
      <Header onPartner={onPartner} partnerName={partnerName} user={user} authBusy={authBusy} onAuth={onAuth} />
      <div className="night-hero">
        <div className="night-copy">
          <p className="status"><i /> Tutti online</p>
          <h1>Stasera<br />si gioca.</h1>
          <p className="lead">Il tavolo è già pronto. Manca solo il gruppo.</p>
          <button className="main-action" onClick={onPartner}>{partnerName ? `Gioca con ${partnerName}` : 'Abbina account'}</button>
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

function Library({ onPartner, partnerName, user, authBusy, onAuth }: { onPartner: () => void; partnerName?: string; user: User | null; authBusy: boolean; onAuth: () => void }) {
  return (
    <section className="mockup library">
      <Header onPartner={onPartner} partnerName={partnerName} user={user} authBusy={authBusy} onAuth={onAuth} />
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
  const [roomMode, setRoomMode] = useState<'create' | 'join' | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [authBusy, setAuthBusy] = useState(false)
  const [deckPreference, setDeckPreference] = useState<DeckStyle>(loadDeckPreference)
  const recentGames = recentIds.map((id) => games.find((game) => game.id === id)!)

  useEffect(() => onAuthStateChanged(auth, (nextUser) => {
    setUser(nextUser?.isAnonymous ? null : nextUser)
    if (!nextUser || nextUser.isAnonymous) return
    const profile = doc(db, 'users', nextUser.uid)
    void getDoc(profile).then(async (snapshot) => {
      const savedDeck = snapshot.get('preferences.briscolaDeck')
      const deck = savedDeck === 'trevigiane' || savedDeck === 'napoletane' ? savedDeck : loadDeckPreference()
      localStorage.setItem('briscola-deck', deck)
      setDeckPreference(deck)
      await setDoc(profile, {
        displayName: nextUser.displayName,
        email: nextUser.email,
        photoURL: nextUser.photoURL,
        preferences: { briscolaDeck: deck },
        lastLoginAt: serverTimestamp(),
        ...(!snapshot.exists() && { createdAt: serverTimestamp() }),
      }, { merge: true })
    }).catch((error: unknown) => {
      console.error('Profilo Firebase:', error)
      window.alert('Accesso riuscito, ma non è stato possibile sincronizzare il profilo.')
    })
  }), [])

  async function toggleAuth() {
    setAuthBusy(true)
    try {
      if (user) await signOut(auth)
      else await signInWithPopup(auth, new GoogleAuthProvider())
    } catch (error) {
      console.error('Accesso Google:', error)
      window.alert('Accesso con Google non riuscito. Riprova.')
    } finally {
      setAuthBusy(false)
    }
  }

  function changeDeckPreference(deck: DeckStyle) {
    localStorage.setItem('briscola-deck', deck)
    setDeckPreference(deck)
    if (user) void setDoc(doc(db, 'users', user.uid), { preferences: { briscolaDeck: deck } }, { merge: true }).catch((error: unknown) => console.error('Preferenza mazzo:', error))
  }

  const play = (game: Game) => {
    const next = [game.id, ...recentIds.filter((id) => id !== game.id)]
    localStorage.setItem('recent-games', JSON.stringify(next))
    setRecentIds(next)
    // per ora si aprono solo i tavoli di dadi, Briscola, UNO e Machiavelli; gli altri giochi non hanno ancora una schermata
    if (game.id === 'dadi' || game.id === 'machiavelli' || game.id === 'briscola' || game.id === 'uno' || game.id === 'burraco') setOpenGame(game.id)
  }

  if (openGame === 'dadi') return <main><DadiTable onBack={() => setOpenGame(null)} /></main>
  if (openGame === 'briscola') return <main><BriscolaTable onBack={() => setOpenGame(null)} deck={deckPreference} onDeckChange={changeDeckPreference} /></main>
  if (openGame === 'uno') return <main><UnoTable onBack={() => setOpenGame(null)} /></main>
  if (openGame === 'burraco') return <main><BurracoTable onBack={() => setOpenGame(null)} /></main>
  if (openGame === 'machiavelli') return <main><MachiavelliTable onBack={() => setOpenGame(null)} /></main>

  return <main>
    <Picker concept={concept} onChange={setConcept} />
    {concept === 1 && <Product recentGames={recentGames} onPlay={play} onCreate={() => setRoomMode('create')} onJoin={() => setRoomMode('join')} user={user} authBusy={authBusy} onAuth={toggleAuth} />}
    {concept === 2 && <Night onCreate={() => setRoomMode('create')} onJoin={() => setRoomMode('join')} user={user} authBusy={authBusy} onAuth={toggleAuth} />}
    {concept === 3 && <Library onJoin={() => setRoomMode('join')} user={user} authBusy={authBusy} onAuth={toggleAuth} />}
    {roomMode && <RoomLobby initialMode={roomMode} onClose={() => setRoomMode(null)} />}
  </main>
}

export default App
