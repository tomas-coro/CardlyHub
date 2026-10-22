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
import coppe3 from './assets/cards/napoletane/coppe-03.jpg'
import spade1 from './assets/cards/napoletane/spade-01.jpg'
import { auth, db } from './lib/firebase.ts'
import { acceptInvite, acceptPair, closeInvite, createPair, invitePartner, loadPairId, subscribeInvite, subscribePair, updateInviteState } from './lib/partner.ts'
import type { InviteSnapshot, PairSnapshot } from './lib/partner.ts'
import { partnerOf } from './lib/partner-domain.ts'
import { tournamentGame, winsNeeded, type BestOf } from './lib/tournament.ts'
import type { GameResult } from './lib/game-result.ts'
import { addResult, emptyGameStat, type GameStat } from './lib/statistics.ts'
import { catalog, families, type CatalogGame, type FamilyId } from './lib/game-catalog.ts'
import { makeOnlineState, type OnlineState } from './lib/online-state.ts'
import type { GameState as BriscolaState } from './games/briscola/engine.ts'
import type { GameState as UnoState } from './games/uno/engine.ts'
import type { GameState as BurracoState } from './games/burraco/engine.ts'
import type { GameState as MachiavelliState } from './games/machiavelli/engine.ts'
import type { GameState as DadiState } from './games/dadi/engine.ts'

const games = [
  { id: 'briscola', name: 'Briscola', meta: '2–4 giocatori', className: 'coral' },
  { id: 'machiavelli', name: 'Machiavelli', meta: '2–6 giocatori', className: 'lime' },
  { id: 'uno', name: 'UNO', meta: '2–10 giocatori', className: 'violet' },
  { id: 'burraco', name: 'Burraco', meta: '2 giocatori', className: 'lime' },
  { id: 'dadi', name: 'Yahtzee', meta: '1 giocatore', className: 'coral' },
] as const

type Game = typeof games[number]
type GameId = Game['id']
type Stats = { games: Partial<Record<GameId, GameStat>>; tournaments: number; tournamentWins: number }
type Tournament = { bestOf: BestOf; games: GameId[]; mode: 'random' | 'ordered'; round: number; current: GameId; wins: [number, number]; result: boolean }
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
    if (saved?.games) return { tournaments: 0, tournamentWins: 0, ...saved }
    if (saved?.started) {
      return {
        tournaments: saved.tournaments ?? 0,
        tournamentWins: saved.tournamentWins ?? 0,
        games: Object.fromEntries(games.map(({ id }) => [id, { ...emptyGameStat(), started: saved.started[id] ?? 0, completed: saved.completed?.[id] ?? 0 }])),
      }
    }
  } catch { /* use empty statistics */ }
  return { games: {}, tournaments: 0, tournamentWins: 0 }
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
      <img className="card real" src={coppe3} alt="" />
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

function CasinoHome({ onPlay, onPlayLocal, onRules, onTournament, onStats, onProfile, onPartner, partnerName, user, authBusy, onAuth }: {
  onPlay: (game: Game) => void
  onPlayLocal: (game: Game) => void
  onRules: (game: CatalogGame) => void
  onTournament: () => void
  onStats: () => void
  onProfile: () => void
  onPartner: () => void
  partnerName?: string
  user: User | null
  authBusy: boolean
  onAuth: () => void
}) {
  // null = sala con i 4 tavoli; altrimenti la categoria aperta
  const [openFamily, setOpenFamily] = useState<FamilyId | null>(null)
  const family = families.find((item) => item.id === openFamily)
  const playable = (entry: CatalogGame) => games.find((item) => item.id === entry.playId)!

  return <div className="casino-rim"><section className="casino-felt">
    <header className="casino-bar">
      <a className="casino-logo" href="/" aria-label="CardlyHub, pagina iniziale">CardlyHub</a>
      <nav aria-label="Account">
        <button className="casino-line" onClick={onStats}>Statistiche</button>
        <button className="casino-line casino-pair" onClick={onPartner}>{partnerName ? `Con ${partnerName}` : 'Abbina account'}</button>
        <button className="casino-line" onClick={user ? onProfile : onAuth} disabled={authBusy}>{authBusy ? 'Attendi…' : user ? `Profilo · ${user.displayName?.split(' ')[0] ?? 'Account'}` : 'Accedi con Google'}</button>
      </nav>
    </header>

    {!family && <>
      <div className="casino-hero">
        <p>Sala da gioco</p>
        <h1>Scegli un mazzo.</h1>
      </div>
      <div className="casino-tiles" aria-label="Categorie di giochi">
        {families.map((item) => {
          const ready = catalog.filter((game) => game.family === item.id && game.primary)
          const soon = catalog.filter((game) => game.family === item.id && !game.primary)
          return <button key={item.id} className="casino-spot casino-tile" onClick={() => setOpenFamily(item.id)}>
            <GameArt game={playable(ready[0])} />
            <span className="casino-game-name">{item.name}</span>
            <span className="catalog-kind">{ready.length} {ready.length === 1 ? 'pronto' : 'pronti'} · {soon.length} presto</span>
          </button>
        })}
      </div>
      <footer className="casino-dock">
        <div><button className="casino-main" onClick={onTournament}>Crea torneo</button></div>
        <p>Regole sempre consultabili · Tornei personalizzati · Due account, due schermi</p>
      </footer>
    </>}

    {family && <section className="casino-category" aria-label={family.name}>
      <div className="casino-cat-head">
        <button className="casino-line" onClick={() => setOpenFamily(null)}>← Sala</button>
        <h2>{family.name}</h2>
        <p>{family.note}</p>
      </div>
      <div className="catalog-primary">
        {catalog.filter((game) => game.family === family.id && game.primary).map((entry) => <div className="catalog-main-card" key={entry.id}>
          <button className="casino-spot" onClick={() => onPlay(playable(entry))} aria-label={`Gioca a ${entry.name} online`}>
            <GameArt game={playable(entry)} /><span className="casino-game-name">{entry.name}</span><span className="casino-play">Gioca online</span>
          </button>
          <button className="casino-line casino-local" onClick={() => onPlayLocal(playable(entry))}>Sullo stesso schermo</button>
          <button className="rule-help" onClick={() => onRules(entry)} aria-label={`Regole di ${entry.name}`}>?</button>
        </div>)}
      </div>
      <div className="catalog-soon">
        <h3>Prossimamente · {catalog.filter((game) => game.family === family.id && !game.primary).length}</h3>
        <div className="catalog-derived" aria-label={`Altri giochi con ${family.name}`}>
          {catalog.filter((game) => game.family === family.id && !game.primary).map((entry) => <button key={entry.id} onClick={() => onRules(entry)}><span>{entry.name}</span><i aria-hidden="true">?</i></button>)}
        </div>
      </div>
    </section>}
  </section></div>
}

function RulesModal({ game, onClose }: { game: CatalogGame; onClose: () => void }) {
  const family = families.find((item) => item.id === game.family)!
  return <div className="room-overlay" role="dialog" aria-modal="true" aria-labelledby="rules-title">
    <section className="room-modal rules-modal">
      <button className="room-close" onClick={onClose} aria-label="Chiudi">×</button>
      <p className="status"><i /> Regole · {family.name}</p>
      <h2 id="rules-title">{game.name}</h2>
      <ol>{game.rules.map((rule) => <li key={rule}>{rule}</li>)}</ol>
      {game.options?.map((option) => <section className="rules-option" key={option.key}>
        <h3>{option.label}</h3>
        <div>{option.values.map((value) => <span className={value === option.defaultValue ? 'is-default' : ''} key={value}>{value}</span>)}</div>
        <p>Predefinita: <b>{option.defaultValue}</b></p>
      </section>)}
      {!game.primary && <p className="rules-coming">Questo gioco verrà aggiunto nei prossimi blocchi del catalogo.</p>}
    </section>
  </div>
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

function TournamentSetup({ onClose, onStart }: { onClose: () => void; onStart: (bestOf: BestOf, selected: GameId[], mode: Tournament['mode']) => void }) {
  const [bestOf, setBestOf] = useState<BestOf>(3)
  const [mode, setMode] = useState<Tournament['mode']>('random')
  const [selected, setSelected] = useState<GameId[]>(competitiveGames.map((game) => game.id))
  const toggle = (id: GameId) => setSelected((current) => current.includes(id) ? current.filter((game) => game !== id) : [...current, id])
  const move = (index: number, by: -1 | 1) => setSelected((current) => {
    const next = [...current], target = index + by
    if (target < 0 || target >= next.length) return current
    ;[next[index], next[target]] = [next[target], next[index]]
    return next
  })
  return <div className="room-overlay" role="dialog" aria-modal="true" aria-labelledby="tournament-title">
    <section className="room-modal setup-modal">
      <button className="room-close" onClick={onClose} aria-label="Chiudi">×</button>
      <p className="status"><i /> Modalità torneo</p>
      <h2 id="tournament-title">Crea il torneo</h2>
      <fieldset className="setup-options"><legend>Formula</legend>{([3, 5, 7] as BestOf[]).map((n) => <button key={n} aria-pressed={bestOf === n} onClick={() => setBestOf(n)}>Meglio di {n}</button>)}</fieldset>
      <fieldset className="setup-options"><legend>Scelta dei giochi</legend><button aria-pressed={mode === 'random'} onClick={() => setMode('random')}>Casuali</button><button aria-pressed={mode === 'ordered'} onClick={() => setMode('ordered')}>Scelgo io l’ordine</button></fieldset>
      {mode === 'random'
        ? <fieldset className="setup-options"><legend>Estrai tra</legend>{competitiveGames.map((game) => <button key={game.id} aria-pressed={selected.includes(game.id)} onClick={() => toggle(game.id)}>{game.name}</button>)}</fieldset>
        : <fieldset className="setup-options tournament-games"><legend>Ordine dei round</legend>
          {selected.map((id, index) => <div key={id}><b>{index + 1}. {games.find((game) => game.id === id)?.name}</b><span><button disabled={index === 0} onClick={() => move(index, -1)} aria-label="Sposta su">↑</button><button disabled={index === selected.length - 1} onClick={() => move(index, 1)} aria-label="Sposta giù">↓</button><button onClick={() => toggle(id)} aria-label="Rimuovi">×</button></span></div>)}
          {competitiveGames.filter((game) => !selected.includes(game.id)).map((game) => <button key={game.id} onClick={() => toggle(game.id)}>+ {game.name}</button>)}
        </fieldset>}
      <p>{mode === 'random' ? 'Ogni round estrae uno dei giochi selezionati.' : 'I giochi seguono questo ordine e ricominciano dal primo se servono altri round.'} Vince chi arriva per primo a {winsNeeded(bestOf)} vittorie.</p>
      <button className="main-action partner-action" disabled={!selected.length} onClick={() => onStart(bestOf, selected, mode)}>Crea torneo</button>
    </section>
  </div>
}

function StatsModal({ stats, names, onClose }: { stats: Stats; names: [string, string]; onClose: () => void }) {
  const all = games.map(({ id }) => stats.games[id] ?? emptyGameStat())
  const total = all.reduce((sum, item) => sum + item.started, 0)
  const wins = all.reduce<[number, number]>((sum, item) => [sum[0] + item.wins[0], sum[1] + item.wins[1]], [0, 0])
  return <div className="room-overlay" role="dialog" aria-modal="true" aria-labelledby="stats-title">
    <section className="room-modal setup-modal stats-modal">
      <button className="room-close" onClick={onClose} aria-label="Chiudi">×</button>
      <p className="status"><i /> Statistiche attive</p>
      <h2 id="stats-title">{names[0]} vs {names[1]}</h2>
      <div className="stats-total"><b>{wins[0]}–{wins[1]}</b><span>vittorie totali · {total} partite avviate</span></div>
      <div className="stats-head"><span>Gioco</span><span>Partite</span><span>Vittorie</span><span>Media punti</span></div>
      <div className="stats-list">{games.map((game) => {
        const item = stats.games[game.id] ?? emptyGameStat()
        const average = item.pointGames ? `${Math.round(item.points[0] / item.pointGames)}–${Math.round(item.points[1] / item.pointGames)}` : '—'
        return <div key={game.id}><b>{game.name}</b><span>{item.completed}/{item.started}</span><span>{item.wins[0]}–{item.wins[1]}{item.draws ? ` · ${item.draws} pari` : ''}</span><span>{average}</span></div>
      })}</div>
      <div className="stats-tournaments"><span>Tornei giocati <b>{stats.tournaments}</b></span><span>Vinti da {names[0]} <b>{stats.tournamentWins}</b></span></div>
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
    <div className="tournament-score"><div><span>Tomas</span><b>{tournament.wins[0]}</b></div><i>—</i><div><b>{tournament.wins[1]}</b><span>Giulia</span></div></div>
    {champion < 0 ? <><p>{tournament.mode === 'random' ? 'Gioco estratto' : 'Gioco scelto'}</p><h2>{game.name}</h2><button className="casino-main" onClick={onPlay}>Gioca il round</button></> : <><h2>Vince {champion === 0 ? 'Tomas' : 'Giulia'}!</h2><button className="casino-main" onClick={onStop}>Torna alla sala</button></>}
  </section></div>
}

function PartnerModal({ user, pair, pairLoading, invite, onClose, onLogin, onCreatePair, onAcceptInvite }: {
  user: User | null
  pair: PairSnapshot | null
  pairLoading: boolean
  invite: InviteSnapshot<OnlineState> | null
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

function AppBody({ onError }: { onError: (message: string) => void }) {
  const [recentIds, setRecentIds] = useState(loadRecents)
  const [openGame, setOpenGame] = useState<Game['id'] | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [authBusy, setAuthBusy] = useState(false)
  const [deckPreference, setDeckPreference] = useState<DeckStyle>(loadDeckPreference)
  const [stats, setStats] = useState<Stats>(loadStats)
  const [profileOpen, setProfileOpen] = useState(false)
  const [statsOpen, setStatsOpen] = useState(false)
  const [rulesGame, setRulesGame] = useState<CatalogGame | null>(null)
  const [tournamentSetupOpen, setTournamentSetupOpen] = useState(false)
  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [pairId, setPairId] = useState<string | null>(null)
  const [pair, setPair] = useState<PairSnapshot | null>(null)
  const [pairLoading, setPairLoading] = useState(true)
  const [invite, setInvite] = useState<InviteSnapshot<OnlineState> | null>(null)
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
    return subscribeInvite<OnlineState>(pairId, (next) => {
      setInvite(next)
      if (next?.status === 'accepted' && games.some((game) => game.id === next.game)) setOpenGame(next.game as GameId)
      if (next?.status === 'closed') setOpenGame(null)
    }, (error) => { console.error('Invito:', error); onError(`Invito non leggibile: ${error.message}`) })
  }, [pairId, onError])

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
    saveStats((current) => {
      const item = current.games[id] ?? emptyGameStat()
      return { ...current, games: { ...current.games, [id]: { ...item, started: item.started + 1 } } }
    })
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
    if (!user || !pair || !partner) { setPartnerOpen(true); return }
    countStarted(game.id)
    const names: [string, string] = [user.displayName?.split(' ')[0] || 'Tu', partner.name.split(' ')[0]]
    const state = makeOnlineState(game.id, names)
    try {
      await invitePartner(pair, user.uid, game.id, state)
    } catch (error) {
      console.error('Invio invito:', error)
      onError(`Invito non inviato: ${error instanceof Error ? error.message : 'errore sconosciuto'}`)
      return
    }
    setPartnerOpen(true)
  }

  // Partita sullo stesso schermo: niente account, niente invito, due giocatori alternati sul tavolo locale
  function playLocal(game: Game) {
    const next = [game.id, ...recentIds.filter((id) => id !== game.id)]
    localStorage.setItem('recent-games', JSON.stringify(next))
    setRecentIds(next)
    countStarted(game.id)
    setOpenGame(game.id)
  }

  // Rivincita: stesso gioco e stesse regole, mazzo nuovo e primo giocatore a caso. Può premerla chiunque dei due.
  function rematch() {
    if (!pairId || !invite) return
    const old = invite.state as OnlineState & { rules?: never }
    const state = makeOnlineState(invite.game as GameId, [old.names[0], old.names[1]], 'rules' in old ? old.rules : undefined)
    updateInviteState(pairId, state, user?.uid ?? '').catch((error: unknown) => {
      console.error('Rivincita:', error)
      onError(`Rivincita non avviata: ${error instanceof Error ? error.message : 'errore sconosciuto'}`)
    })
  }

  function createTournament(bestOf: BestOf, selected: GameId[], mode: Tournament['mode']) {
    setTournament({ bestOf, games: selected, mode, round: 1, current: tournamentGame(selected, 1, mode), wins: [0, 0], result: false })
    setTournamentSetupOpen(false)
  }

  function playTournamentRound() {
    if (!tournament) return
    countStarted(tournament.current)
    setOpenGame(tournament.current)
  }

  function recordResult(id: GameId, result: GameResult) {
    saveStats((current) => {
      const item = current.games[id] ?? emptyGameStat()
      return { ...current, games: { ...current.games, [id]: addResult(item, result) } }
    })
    if (!tournament || tournament.result || tournament.current !== id) return
    const wins: [number, number] = [...tournament.wins]
    if (result.winner !== null) wins[result.winner]++
    const finished = wins.some((score) => score >= winsNeeded(tournament.bestOf))
    setTournament({ ...tournament, wins, result: true })
    if (finished) saveStats((current) => ({ ...current, tournaments: current.tournaments + 1, tournamentWins: current.tournamentWins + (wins[0] >= winsNeeded(tournament.bestOf) ? 1 : 0) }))
  }

  function leaveGame() {
    setOpenGame(null)
    if (tournament?.result && !tournament.wins.some((score) => score >= winsNeeded(tournament.bestOf))) {
      const nextRound = tournament.round + 1
      const current = tournamentGame(tournament.games, nextRound, tournament.mode)
      setTournament({ ...tournament, round: nextRound, current, result: false })
    }
  }

  async function leaveOnlineGame() {
    try {
      if (pairId && invite?.status === 'accepted') await closeInvite(pairId)
    } catch (error) {
      console.error('Chiusura partita:', error)
      onError(`Partita non chiusa: ${error instanceof Error ? error.message : 'errore sconosciuto'}`)
    }
    setOpenGame(null)
  }

  const online = !tournament && user && pairId && invite?.status === 'accepted' && invite.game === openGame
    ? { userId: user.uid, hostId: invite.host_id, state: invite.state, lastBy: invite.last_by, onState: (state: OnlineState) => void updateInviteState(pairId, state, user.uid).catch((error: unknown) => { console.error('Mossa non salvata:', error); onError(`Mossa non salvata: ${error instanceof Error ? error.message : 'errore sconosciuto'}`) }) }
    : null
  const resultForMe = (result: GameResult): GameResult => !online || online.userId === online.hostId || result.winner === null
    ? result
    : { winner: 1 - result.winner, scores: result.scores && [result.scores[1], result.scores[0]] }

  if (openGame === 'dadi') return <main><DadiTable onBack={online ? () => void leaveOnlineGame() : leaveGame} onResult={(result) => recordResult('dadi', resultForMe(result))}
    online={online ? { ...online, state: online.state as DadiState } : undefined} onRematch={rematch} /></main>
  if (openGame === 'briscola') return <main><BriscolaTable onBack={online ? () => void leaveOnlineGame() : leaveGame} onResult={(result) => recordResult('briscola', resultForMe(result))} deck={deckPreference}
    online={online ? { ...online, state: online.state as BriscolaState } : undefined} /></main>
  if (openGame === 'uno') return <main><UnoTable onBack={online ? () => void leaveOnlineGame() : leaveGame} onResult={(result) => recordResult('uno', resultForMe(result))}
    online={online ? { ...online, state: online.state as UnoState } : undefined} onRematch={rematch} /></main>
  if (openGame === 'burraco') return <main><BurracoTable onBack={online ? () => void leaveOnlineGame() : leaveGame} onResult={(result) => recordResult('burraco', resultForMe(result))}
    online={online ? { ...online, state: online.state as BurracoState } : undefined} onRematch={rematch} /></main>
  if (openGame === 'machiavelli') return <main><MachiavelliTable onBack={online ? () => void leaveOnlineGame() : leaveGame} onResult={(result) => recordResult('machiavelli', resultForMe(result))}
    online={online ? { ...online, state: online.state as MachiavelliState } : undefined} onRematch={rematch} /></main>
  if (tournament) return <main><TournamentPanel tournament={tournament} onPlay={playTournamentRound} onStop={() => setTournament(null)} /></main>

  const incoming = Boolean(user && invite?.status === 'pending' && invite.guest_id === user.uid)
  return <main>
    <CasinoHome
      onPlay={(game) => void play(game)}
      onPlayLocal={playLocal}
      onRules={setRulesGame}
      onTournament={() => setTournamentSetupOpen(true)}
      onStats={() => setStatsOpen(true)}
      onProfile={() => setProfileOpen(true)}
      onPartner={() => setPartnerOpen(true)}
      partnerName={partner?.name}
      user={user}
      authBusy={authBusy}
      onAuth={() => void toggleAuth()}
    />
    {rulesGame && <RulesModal game={rulesGame} onClose={() => setRulesGame(null)} />}
    {profileOpen && user && <ProfileModal user={user} deck={deckPreference} onDeck={changeDeckPreference} onClose={() => setProfileOpen(false)} onSignOut={() => { setProfileOpen(false); void toggleAuth() }} />}
    {tournamentSetupOpen && <TournamentSetup onClose={() => setTournamentSetupOpen(false)} onStart={createTournament} />}
    {statsOpen && <StatsModal stats={stats} names={[user?.displayName?.split(' ')[0] || 'Tomas', partner?.name.split(' ')[0] || 'Giulia']} onClose={() => setStatsOpen(false)} />}
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

// Errori di rete/scrittura dell'online: mai silenziosi, un avviso rosso in alto su ogni schermata.
function App() {
  const [onlineError, setOnlineError] = useState('')
  return <>
    <AppBody onError={setOnlineError} />
    {onlineError && <p className="online-error" role="alert">{onlineError}<button onClick={() => setOnlineError('')}>Chiudi</button></p>}
  </>
}

export default App
