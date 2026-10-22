# CardlyHub

Una piattaforma web per scoprire e giocare online a giochi di carte, da soli o in compagnia.

## Sviluppo

```bash
npm install
npm run dev
```

## Firebase

L'app usa Google Authentication e salva profilo e preferenza del mazzo in Firestore con le variabili `VITE_FIREBASE_*`. Copia `.env.example` in `.env.local` e inserisci la configurazione dell'app Web Firebase.

Crea il database Firestore dalla Firebase Console, poi pubblica le regole che limitano ogni profilo al suo proprietario:

```bash
npx firebase-tools login
npx firebase-tools deploy --only firestore:rules
```

## Supabase (temporaneo)

Le stanze usano ancora Auth anonimo, Postgres e Realtime. Per avviare lo stack locale serve Docker:

```bash
supabase start
supabase db reset
cp .env.example .env.local
```

Dopo `supabase start`, copia la **publishable key** mostrata dal comando in `.env.local`. Per un progetto remoto, collega il progetto con `supabase link`, esegui `supabase db push`, imposta URL e publishable key in `.env.local` e abilita **Anonymous Sign-Ins** nella dashboard.

## Verifiche

```bash
npm run lint
npm run build
```
