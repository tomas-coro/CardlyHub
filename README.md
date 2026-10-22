# CardlyHub

Una piattaforma web per scoprire e giocare online a giochi di carte, da soli o in compagnia.

## Sviluppo

```bash
npm install
npm run dev
```

## Firebase

L'app usa Google Authentication e Firestore per profili, abbinamento dei due account, inviti e partite online. Copia `.env.example` in `.env.local` e inserisci la configurazione dell'app Web Firebase. Nella Firebase Console abilita il provider **Google**.

Crea il database Firestore dalla Firebase Console, poi pubblica le regole:

```bash
npx firebase-tools login
npx firebase-tools deploy --only firestore:rules
```

## Verifiche

```bash
npm test
npm run lint
npm run build
```

## Pubblicazione

```bash
npm run build
npx firebase-tools deploy --only hosting,firestore:rules
```
