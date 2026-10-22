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
import spade3 from './assets/cards/napoletane/spade-03.jpg'
import spade1 from './assets/cards/napoletane/spade-01.jpg'
import { auth, db } from './lib/firebase.ts'
import { acceptInvite, acceptPair, closeInvite, createPair, invitePartner, loadPairId, subscribeInvite, subscribePair, updateInviteState } from './lib/partner.ts'
import type { InviteSnapshot, PairSnapshot } from './lib/partner.ts'
import { partnerOf } from './lib/partner-domain.ts'
import { randomTournamentGame, winsNeeded, type BestOf } from './lib/tournament.ts'
import { buildDeck as buildBriscolaDeck, newGame as newBriscolaGame, shuffle as shuffleBriscola } from './games/briscola/engine.ts'
import type { GameState as BriscolaState } from './games/briscola/engine.ts'

const games = [
  { id: 'briscola', name: 'Briscola', meta: '2–4 giocatori', className: 'coral' },
  { id: 'machiavelli', name: 'Machiavelli', meta: '2–6 giocatori', className: 'lime' },
  { id: 'uno', name: 'UNO', meta: '2–10 giocatori', className: 'violet' },
  { id: 'burraco', name: 'Burraco', meta: '2 giocatori', className: 'lime' },
  { id: 'dadi', name: 'Yahtzee', meta: '1 giocatore', className: 'coral' },
] as const

type Game = typeof games[number]
type GameId = Game['id']
type Stats = { started: Partial<Record<GameId, number>>; completed: Partial<Record<GameId, number>>; tournaments: number; tournamentWins: number }
type Tournament = { bestOf: BestOf; games: GameId[]; round: number; current: GameId; wins: [number, number]; result: boolean }
const defaultRecents = games.map(({ id }) => id)
const competitiveGames = games.filter((game) => game.id !== 'dadi')

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

function loadStats(): Stats {
  try {
    const saved = JSON.parse(localStorage.getItem('cardly-stats') ?? 'null')
    if (saved?.started && saved?.completed) return { tournaments: 0, tournamentWins: 0, ...saved }
  } catch { /* use empty statistics */ }
  return { started: {}, completed: {}, tournaments: 0, tournamentWins: 0 }
}

function GameArt({ game }: { game: Game }) {
  if (game.id === 'dadi') return (
    <div className="game-symbol dadi" aria-hidden="true">
      <i className="die three">{Array.from({ length: 9 }, (_, index) => <span key={index} />)}</i>
      <i className="die five">{Array.from({ length: 9 }, (_, index) => <span key={index} />)}</i>
    </div>
  )

  if (game.id === 'briscola') return (
    <div className="game-symbol briscola" aria-hidden="true">
      <img className="card real" src={denari7} alt="" />
      <img className="card real" src={spade3} alt="" />
      <img className="card real" src={spade1} alt="" />
    </div>
  )

  // Carte francesi: simboli dello sprite svg-cards (public/cards/french), una <use> per carta
  if (game.id === 'machiavelli' || game.id === 'burraco') return (
    <div className={`game-symbol ${game.id}`} aria-hidden="true">
      {(game.id === 'burraco' ? ['spade_2', 'heart_queen', 'joker_black'] : ['club_1', 'diamond_3', 'spade_10']).map((id) => (
        <svg key={id} className="card real" viewBox="0 0 169.075 244.64"><use href={`/cards/french/svg-cards.svg#${id}`} /></svg>
      ))}
    </div>
  )

  return (
    <div className="game-symbol uno" aria-hidden="true">
      <UnoFace className="card real" card={{ id: 1, c: 'r', v: 'rev' }} />
      <UnoFace className="card real" card={{ id: 2, c: 'b', v: 'skip' }} />
      <UnoFace className="card real" card={{ id: 3, c: 'w', v: 'w4' }} />
    </div>
  )
}

function CasinoHome({ selected, onSelect, onPlay, onTournament, onStats, onProfile, onPartner, partnerName, user, authBusy, onAuth }: {
  selected: Game
  onSelect: (game: Game) => void
  onPlay: (game: Game) => void
  onTournament: () => void
  onStats: () => void
  onProfile: () => void
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
        <button className="casino-line" onClick={onStats}>Statistiche</button>
        <button className="casino-line casino-pair" onClick={onPartner}>{partnerName ? `Con ${partnerName}` : 'Abbina account'}</button>
        <button className="casino-line" onClick={user ? onProfile : onAuth} disabled={authBusy}>{authBusy ? 'Attendi…' : user ? `Profilo · ${user.displayName?.split(' ')[0] ?? 'Account'}` : 'Accedi con Google'}</button>
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
        <button className="casino-line" onClick={onTournament}>Crea torneo</button>
      </div>
      <p>Statistiche attive · Tornei al meglio di 3, 5 o 7 · Inviti diretti</p>
    </footer>
  </section></div>
}

function ProfileModal({ user, deck, onDeck, onClose, onSignOut }: { user: User; deck: DeckStyle; onDeck: (deck: DeckStyle) => void; onClose: () => void; onSignOut: () => void }) {
  return <div className="room-overlay" role="dialog" aria-modal="true" aria-labelledby="profile-title">
    <section className="room-modal setup-modal">
      <button className="room-close" onClick={onClose} aria-label="Chiudi">×</button>
      <p className="status"><i /> Impostazioni profilo</p>
      <h2 id="profile-title">{user.displayName?.split(' ')[0] ?? 'Profilo'}</h2>
      <fieldset className="setup-options">
        <legend>Carte per Briscola</legend>
        {(['napoletane', 'trevigiane'] as const).map((style) => <button key={style} aria-pressed={deck === style} onClick={() => onDeck(style)}>{style === 'napoletane' ? 'Napoletane' : 'Trevigiane'}</button>)}
      </fieldset>
      <p>Questa scelta è solo tua: durante la stessa partita puoi vedere le Napoletane mentre il tuo partner vede le Trevigiane.</p>
      <button className="profile-signout" onClick={onSignOut}>Esci dall’account</button>
    </section>
  </div>
}

function TournamentSetup({ onClose, onStart }: { onClose: () => void; onStart: (bestOf: BestOf, selected: GameId[]) => void }) {
  const [bestOf, setBestOf] = useState<BestOf>(3)
  const [selected, setSelected] = useState<GameId[]>(competitiveGames.map((game) => game.id))
  const toggle = (id: GameId) => setSelected((current) => current.includes(id) ? current.filter((game) => game !== id) : [...current, id])
  return <div className="room-overlay" role="dialog" aria-modal="true" aria-labelledby="tournament-title">
    <section className="room-modal setup-modal">
      <button className="room-close" onClick={onClose} aria-label="Chiudi">×</button>
      <p className="status"><i /> Modalità torneo</p>
      <h2 id="tournament-title">Crea il torneo</h2>
      <fieldset className="setup-options"><legend>Formula</legend>{([3, 5, 7] as BestOf[]).map((n) => <button key={n} aria-pressed={bestOf === n} onClick={() => setBestOf(n)}>Meglio di {n}</button>)}</fieldset>
      <fieldset className="setup-options"><legend>Giochi casuali tra</legend>{competitiveGames.map((game) => <button key={game.id} aria-pressed={selected.includes(game.id)} onClick={() => toggle(game.id)}>{game.name}</button>)}</fieldset>
      <p>Ogni round sceglie casualmente uno dei giochi selezionati. Vince chi arriva per primo a {winsNeeded(bestOf)} vittorie.</p>
      <button className="main-action partner-action" disabled={!selected.length} onClick={() => onStart(bestOf, selected)}>Crea torneo</button>
    </section>
  </div>
}

function StatsModal({ stats, onClose }: { stats: Stats; onClose: () => void }) {
  const total = Object.values(stats.started).reduce((sum, count) => sum + (count ?? 0), 0)
  return <div className="room-overlay" role="dialog" aria-modal="true" aria-labelledby="stats-title">
    <section className="room-modal setup-modal">
      <button className="room-close" onClick={onClose} aria-label="Chiudi">×</button>
      <p className="status"><i /> Statistiche attive</p>
      <h2 id="stats-title">Le vostre partite</h2>
      <div className="stats-total"><b>{total}</b><span>partite avviate</span></div>
      <div className="stats-list">{games.map((game) => <div key={game.id}><span>{game.name}</span><b>{stats.started[game.id] ?? 0}</b><small>{stats.completed[game.id] ?? 0} concluse</small></div>)}</div>
      <div className="stats-tournaments"><span>Tornei giocati <b>{stats.tournaments}</b></span><span>Vinti da Tomas <b>{stats.tournamentWins}</b></span></div>
    </section>
  </div>
}

function TournamentPanel({ tournament, onPlay, onStop }: { tournament: Tournament; onPlay: () => void; onStop: () => void }) {
  const target = winsNeeded(tournament.bestOf)
  const champion = tournament.wins.findIndex((score) => score >= target)
  const game = games.find((item) => item.id === tournament.current)!
  return <div className="casino-rim"><section className="casino-felt tournament-panel">
    <button className="casino-line tournament-exit" onClick={onStop}>Termina torneo</button>
    <p className="tournament-kicker">Al meglio di {tournament.bestOf}</p>
    <h1>{champion < 0 ? `Round ${tournament.round}` : 'Torneo concluso'}</h1>
    <div className="tournament-score"><div><span>Tomas</span><b>{tournament.wins[0]}</b></div><i>—</i><div><b>{tournament.wins[1]}</b><span>Lei</span></div></div>
    {champion < 0 ? <><p>Gioco estratto</p><h2>{game.name}</h2><button className="casino-main" onClick={onPlay}>Gioca il round</button></> : <><h2>Vince {champion === 0 ? 'Tomas' : 'Lei'}!</h2><button className="casino-main" onClick={onStop}>Torna alla sala</button></>}
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
  const [stats, setStats] = useState<Stats>(loadStats)
  const [profileOpen, setProfileOpen] = useState(false)
  const [statsOpen, setStatsOpen] = useState(false)
  const [tournamentSetupOpen, setTournamentSetupOpen] = useState(false)
  const [tournament, setTournament] = useState<Tournament | null>(null)
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

  function saveStats(update: (current: Stats) => Stats) {
    setStats((current) => {
      const next = update(current)
      localStorage.setItem('cardly-stats', JSON.stringify(next))
      return next
    })
  }

  function countStarted(id: GameId) {
    saveStats((current) => ({ ...current, started: { ...current.started, [id]: (current.started[id] ?? 0) + 1 } }))
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
    if (game.id !== 'briscola') { countStarted(game.id); setOpenGame(game.id); return }
    if (!user || !pair || !partner) { setPartnerOpen(true); return }
    countStarted(game.id)
    const state = newBriscolaGame(
      { names: [user.displayName?.split(' ')[0] || 'Tu', partner.name.split(' ')[0],], first: Math.random() < 0.5 ? 0 : 1 },
      shuffleBriscola(buildBriscolaDeck()),
    )
    await invitePartner(pair, user.uid, game.id, state)
    setPartnerOpen(true)
  }

  function createTournament(bestOf: BestOf, selected: GameId[]) {
    setTournament({ bestOf, games: selected, round: 1, current: randomTournamentGame(selected), wins: [0, 0], result: false })
    setTournamentSetupOpen(false)
  }

  function playTournamentRound() {
    if (!tournament) return
    countStarted(tournament.current)
    setOpenGame(tournament.current)
  }

  function recordResult(id: GameId, winner: number | null) {
    saveStats((current) => ({ ...current, completed: { ...current.completed, [id]: (current.completed[id] ?? 0) + 1 } }))
    if (!tournament || tournament.result || tournament.current !== id) return
    const wins: [number, number] = [...tournament.wins]
    if (winner !== null) wins[winner]++
    const finished = wins.some((score) => score >= winsNeeded(tournament.bestOf))
    setTournament({ ...tournament, wins, result: true })
    if (finished) saveStats((current) => ({ ...current, tournaments: current.tournaments + 1, tournamentWins: current.tournamentWins + (wins[0] >= winsNeeded(tournament.bestOf) ? 1 : 0) }))
  }

  function leaveGame() {
    setOpenGame(null)
    if (tournament?.result && !tournament.wins.some((score) => score >= winsNeeded(tournament.bestOf))) {
      setTournament({ ...tournament, round: tournament.round + 1, current: randomTournamentGame(tournament.games), result: false })
    }
  }

  async function leaveOnlineGame() {
    if (pairId && invite?.status === 'accepted') await closeInvite(pairId)
    setOpenGame(null)
  }

  if (openGame === 'dadi') return <main><DadiTable onBack={leaveGame} /></main>
  if (openGame === 'briscola' && !tournament && user && pairId && invite?.status === 'accepted') return <main><BriscolaTable
    onBack={() => void leaveOnlineGame()}
    onResult={(winner) => recordResult('briscola', winner)}
    deck={deckPreference}
    online={{ userId: user.uid, hostId: invite.host_id, state: invite.state, onState: (state) => void updateInviteState(pairId, state) }}
  /></main>
  if (openGame === 'briscola') return <main><BriscolaTable onBack={leaveGame} onResult={(winner) => recordResult('briscola', winner)} deck={deckPreference} /></main>
  if (openGame === 'uno') return <main><UnoTable onBack={leaveGame} onResult={(winner) => recordResult('uno', winner)} /></main>
  if (openGame === 'burraco') return <main><BurracoTable onBack={leaveGame} onResult={(winner) => recordResult('burraco', winner)} /></main>
  if (openGame === 'machiavelli') return <main><MachiavelliTable onBack={leaveGame} onResult={(winner) => recordResult('machiavelli', winner)} /></main>
  if (tournament) return <main><TournamentPanel tournament={tournament} onPlay={playTournamentRound} onStop={() => setTournament(null)} /></main>

  const incoming = Boolean(user && invite?.status === 'pending' && invite.guest_id === user.uid)
  return <main>
    <CasinoHome
      selected={selectedGame}
      onSelect={setSelectedGame}
      onPlay={(game) => void play(game)}
      onTournament={() => setTournamentSetupOpen(true)}
      onStats={() => setStatsOpen(true)}
      onProfile={() => setProfileOpen(true)}
      onPartner={() => setPartnerOpen(true)}
      partnerName={partner?.name}
      user={user}
      authBusy={authBusy}
      onAuth={() => void toggleAuth()}
    />
    {profileOpen && user && <ProfileModal user={user} deck={deckPreference} onDeck={changeDeckPreference} onClose={() => setProfileOpen(false)} onSignOut={() => { setProfileOpen(false); void toggleAuth() }} />}
    {tournamentSetupOpen && <TournamentSetup onClose={() => setTournamentSetupOpen(false)} onStart={createTournament} />}
    {statsOpen && <StatsModal stats={stats} onClose={() => setStatsOpen(false)} />}
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
