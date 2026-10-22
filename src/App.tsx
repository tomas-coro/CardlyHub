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

function CasinoHome({ selected, onSelect, onPlay, onPartner, partnerName, user, authBusy, onAuth }: {
  selected: Game
  onSelect: (game: Game) => void
  onPlay: (game: Game) => void
  onPartner: () => void
  partnerName?: string
  user: User | null
  authBusy: boolean
  onAuth: () => void
}) {
  const categories = [
    { name: 'Carte francesi', games: [games[3], games[1]] },
    { name: 'Carte da briscola', games: [games[0]] },
    { name: 'Carte UNO', games: [games[2]] },
    { name: 'Dadi', games: [games[4]] },
  ]

  return <div className="casino-rim"><section className="casino-felt">
    <header className="casino-bar">
      <a className="casino-logo" href="/" aria-label="CardlyHub, pagina iniziale">CardlyHub</a>
      <nav aria-label="Account">
        <button className="casino-line casino-pair" onClick={onPartner}>{partnerName ? `Con ${partnerName}` : 'Abbina account'}</button>
        <button className="casino-line" onClick={onAuth} disabled={authBusy}>{authBusy ? 'Attendi…' : user ? `Esci · ${user.displayName?.split(' ')[0] ?? 'Profilo'}` : 'Accedi con Google'}</button>
      </nav>
    </header>

    <div className="casino-hero">
      <p>Sala da gioco</p>
      <h1>Un tavolo per due.<br />Scegli il gioco.</h1>
      <span>Scegli un gioco, apri il tavolo e invita il tuo partner.</span>
    </div>

    <div className="casino-categories" role="group" aria-label="Scegli il gioco">
      {categories.map((category) => <section className="casino-category" data-count={category.games.length} style={{ '--count': category.games.length } as React.CSSProperties} key={category.name}>
        <h2>{category.name}</h2>
        <div>
          {category.games.map((game) => <button className="casino-spot" key={game.id} aria-pressed={selected.id === game.id} onClick={() => onSelect(game)}>
            <span className="casino-chip">Scelto</span>
            <GameArt game={game} />
            <span className="casino-game-name">{game.name}</span>
          </button>)}
        </div>
      </section>)}
    </div>

    <footer className="casino-dock">
      <div>
        <button className="casino-main" onClick={() => onPlay(selected)}>Gioca a {selected.name}</button>
        <button className="casino-line" onClick={onPartner}>{partnerName ? `Invita ${partnerName}` : 'Abbina account'}</button>
      </div>
      <p>Nessun download · Inviti diretti · Un solo abbinamento</p>
    </footer>
  </section></div>
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
  const [recentIds, setRecentIds] = useState(loadRecents)
  const [selectedGame, setSelectedGame] = useState<Game>(() => games.find((game) => game.id === loadRecents()[0]) ?? games[0])
  const [openGame, setOpenGame] = useState<Game['id'] | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [authBusy, setAuthBusy] = useState(false)
  const [deckPreference, setDeckPreference] = useState<DeckStyle>(loadDeckPreference)
  const [pairId, setPairId] = useState<string | null>(null)
  const [pair, setPair] = useState<PairSnapshot | null>(null)
  const [pairLoading, setPairLoading] = useState(true)
  const [invite, setInvite] = useState<InviteSnapshot<BriscolaState> | null>(null)
  const [partnerOpen, setPartnerOpen] = useState(() => new URLSearchParams(location.search).has('pair'))
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
    <CasinoHome
      selected={selectedGame}
      onSelect={setSelectedGame}
      onPlay={(game) => void play(game)}
      onPartner={() => setPartnerOpen(true)}
      partnerName={partner?.name}
      user={user}
      authBusy={authBusy}
      onAuth={() => void toggleAuth()}
    />
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
