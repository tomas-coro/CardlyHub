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
          <span className="live-badge"><i /> Partner online</span>
          <div className="product-window" aria-label="Anteprima del catalogo giochi">
            <div className="window-top"><span>CardlyHub / Giochi</span><i /><i /><i /></div>
            <div className="window-body">
              <div className="welcome"><div><small>Riprendi da dove eri rimasto</small><b>I tuoi giochi recenti</b></div><span>TS</span></div>
              <GameCard game={recentGames[0]} featured onPlay={onPlay} />
              <div className="mini-games">{recentGames.slice(1).map((game) => <GameCard key={game.id} game={game} onPlay={onPlay} />)}</div>
            </div>
          </div>
          <span className="invite-badge"><b>2</b> account abbinati</span>
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
        <div className="room" aria-label="Anteprima di un invito diretto">
          <div className="room-head"><div><small>Sofia e Luca</small><b>Briscola</b></div><span><strong>ABBINATI</strong></span></div>
          <div className="players">
            <div className="player p1"><i>SO</i><b>Sofia</b><small>Ti invita</small></div>
            <div className="player p2"><i>LU</i><b>Luca</b><small>Online</small></div>
          </div>
          <button className="start-game">Accetta e gioca <span>→</span></button>
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
        <div className="library-side"><p>Dai classici alle sfide veloci: scegli un gioco e invita direttamente il tuo partner.</p><button className="main-action">Vedi tutti i giochi</button></div>
      </div>
      <div className="library-grid" id="games">
        <GameCard game={games[0]} />
        <GameCard game={games[1]} featured />
        <GameCard game={games[2]} />
      </div>
    </section>
  )
}

function PartnerModal({ user, pair, pairLoading, invite, onClose, onLogin, onCreatePair, onAcceptInvite }: {
  user: User | null
  pair: PairSnapshot | null
  pairLoading: boolean
  invite: InviteSnapshot<BriscolaState> | null
  onClose: () => void
  onLogin: () => void
  onCreatePair: () => Promise<void>
  onAcceptInvite: () => Promise<void>
}) {
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')
  const partner = user && pair ? partnerOf(pair, user.uid) : null
  const pairingLink = pair ? `${location.origin}${location.pathname}?pair=${encodeURIComponent(pair.id)}` : ''
  const run = async (action: () => Promise<void>) => {
    setBusy(true); setError('')
    try { await action() } catch (reason) { setError(reason instanceof Error ? reason.message : 'Qualcosa è andato storto.') }
    finally { setBusy(false) }
  }
  const copyLink = async () => {
    await navigator.clipboard.writeText(pairingLink)
    setCopied(true)
  }
  const incoming = user && invite?.status === 'pending' && invite.guest_id === user.uid
  const outgoing = user && invite?.status === 'pending' && invite.host_id === user.uid

  return <div className="room-overlay" role="dialog" aria-modal="true" aria-labelledby="partner-title">
    <section className="room-modal">
      <button className="room-close" onClick={onClose} aria-label="Chiudi">×</button>
      <p className="status"><i /> Solo voi due</p>
      {!user ? <>
        <h2 id="partner-title">Accedi per giocare insieme</h2>
        <p>Usate entrambi il vostro account Google.</p>
        <button className="main-action partner-action" onClick={onLogin}>Accedi con Google</button>
      </> : pairLoading ? <>
        <h2 id="partner-title">Caricamento…</h2>
        <p>Controlliamo il vostro abbinamento.</p>
      </> : !pair ? <>
        <h2 id="partner-title">Abbina la tua compagna</h2>
        <p>Creeremo un link monouso. Dopo che lo avrà aperto, non serviranno più codici.</p>
        <button className="main-action partner-action" disabled={busy} onClick={() => void run(onCreatePair)}>{busy ? 'Creazione…' : 'Crea link di abbinamento'}</button>
      </> : !partner ? <>
        <h2 id="partner-title">Mandale questo link</h2>
        <p>Deve aprirlo e accedere con il suo account Google.</p>
        <button className="room-code-live partner-link" onClick={() => void copyLink()}><span>{copied ? 'Link copiato' : 'Copia link'}</span><small>{copied ? 'Pronto da inviare' : 'Monouso'}</small></button>
      </> : incoming ? <>
        <h2 id="partner-title">{pair.names[invite.host_id]} ti invita</h2>
        <p>Vuole iniziare una partita a {games.find((game) => game.id === invite.game)?.name ?? invite.game}.</p>
        <button className="main-action partner-action" disabled={busy} onClick={() => void run(onAcceptInvite)}>{busy ? 'Apro…' : 'Accetta e gioca'}</button>
      </> : outgoing ? <>
        <h2 id="partner-title">Invito inviato</h2>
        <p>Stiamo aspettando che {partner.name} accetti.</p>
        <p className="room-note" aria-live="polite">La partita si aprirà automaticamente per entrambi.</p>
      </> : <>
        <h2 id="partner-title">Tu e {partner.name}</h2>
        <p>Abbinamento attivo. Scegliete un gioco: l'invito arriverà direttamente nell'app.</p>
      </>}
      {error && <p className="room-error" role="alert">{error}</p>}
    </section>
  </div>
}

function App() {
  const [concept, setConcept] = useState<Concept>(1)
  const [recentIds, setRecentIds] = useState(loadRecents)
  const [openGame, setOpenGame] = useState<Game['id'] | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [authBusy, setAuthBusy] = useState(false)
  const [deckPreference, setDeckPreference] = useState<DeckStyle>(loadDeckPreference)
  const [pairId, setPairId] = useState<string | null>(null)
  const [pair, setPair] = useState<PairSnapshot | null>(null)
  const [pairLoading, setPairLoading] = useState(true)
  const [invite, setInvite] = useState<InviteSnapshot<BriscolaState> | null>(null)
  const [partnerOpen, setPartnerOpen] = useState(() => new URLSearchParams(location.search).has('pair'))
  const recentGames = recentIds.map((id) => games.find((game) => game.id === id)!)
  const partner = user && pair ? partnerOf(pair, user.uid) : null

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

  useEffect(() => {
    if (!user) return
    let active = true
    void (async () => {
      let id = await loadPairId(user.uid)
      const requested = new URLSearchParams(location.search).get('pair')
      if (requested && id && requested !== id) throw new Error('Questo account è già abbinato.')
      if (requested && requested !== id) {
        await acceptPair(requested, user)
        id = requested
        history.replaceState(null, '', location.pathname)
      }
      if (active) {
        setPairId(id ?? null)
        if (!id) setPairLoading(false)
      }
    })().catch((error: unknown) => window.alert(error instanceof Error ? error.message : 'Abbinamento non riuscito.'))
    return () => { active = false }
  }, [user])

  useEffect(() => {
    if (!pairId) return
    return subscribePair(pairId, (next) => { setPair(next); setPairLoading(false) }, (error) => console.error('Abbinamento:', error))
  }, [pairId])

  useEffect(() => {
    if (!pairId) return
    return subscribeInvite<BriscolaState>(pairId, (next) => {
      setInvite(next)
      if (next?.status === 'accepted' && next.game === 'briscola') setOpenGame('briscola')
    }, (error) => console.error('Invito:', error))
  }, [pairId])

  async function toggleAuth() {
    setAuthBusy(true)
    try {
      if (user) {
        await signOut(auth)
        setPairId(null); setPair(null); setPairLoading(true); setInvite(null); setOpenGame(null)
      } else await signInWithPopup(auth, new GoogleAuthProvider())
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

  async function makePair() {
    if (!user) return
    setPairLoading(true)
    setPairId(await createPair(user))
  }

  async function play(game: Game) {
    const next = [game.id, ...recentIds.filter((id) => id !== game.id)]
    localStorage.setItem('recent-games', JSON.stringify(next))
    setRecentIds(next)
    if (game.id !== 'briscola') { setOpenGame(game.id); return }
    if (!user || !pair || !partner) { setPartnerOpen(true); return }
    const state = newBriscolaGame(
      { names: [user.displayName?.split(' ')[0] || 'Tu', partner.name.split(' ')[0],], first: Math.random() < 0.5 ? 0 : 1 },
      shuffleBriscola(buildBriscolaDeck()),
    )
    await invitePartner(pair, user.uid, game.id, state)
    setPartnerOpen(true)
  }

  async function leaveOnlineGame() {
    if (pairId && invite?.status === 'accepted') await closeInvite(pairId)
    setOpenGame(null)
  }

  if (openGame === 'dadi') return <main><DadiTable onBack={() => setOpenGame(null)} /></main>
  if (openGame === 'briscola' && user && pairId && invite?.status === 'accepted') return <main><BriscolaTable
    onBack={() => void leaveOnlineGame()}
    deck={deckPreference}
    onDeckChange={changeDeckPreference}
    online={{ userId: user.uid, hostId: invite.host_id, state: invite.state, onState: (state) => void updateInviteState(pairId, state) }}
  /></main>
  if (openGame === 'uno') return <main><UnoTable onBack={() => setOpenGame(null)} /></main>
  if (openGame === 'burraco') return <main><BurracoTable onBack={() => setOpenGame(null)} /></main>
  if (openGame === 'machiavelli') return <main><MachiavelliTable onBack={() => setOpenGame(null)} /></main>

  const incoming = Boolean(user && invite?.status === 'pending' && invite.guest_id === user.uid)
  return <main>
    <Picker concept={concept} onChange={setConcept} />
    {concept === 1 && <Product recentGames={recentGames} onPlay={(game) => void play(game)} onPartner={() => setPartnerOpen(true)} partnerName={partner?.name} user={user} authBusy={authBusy} onAuth={() => void toggleAuth()} />}
    {concept === 2 && <Night onPartner={() => setPartnerOpen(true)} partnerName={partner?.name} user={user} authBusy={authBusy} onAuth={() => void toggleAuth()} />}
    {concept === 3 && <Library onPartner={() => setPartnerOpen(true)} partnerName={partner?.name} user={user} authBusy={authBusy} onAuth={() => void toggleAuth()} />}
    {(partnerOpen || incoming) && <PartnerModal
      user={user}
      pair={pair}
      pairLoading={pairLoading}
      invite={invite}
      onClose={() => setPartnerOpen(false)}
      onLogin={() => void toggleAuth()}
      onCreatePair={makePair}
      onAcceptInvite={() => pairId ? acceptInvite(pairId) : Promise.resolve()}
    />}
  </main>
}

export default App
