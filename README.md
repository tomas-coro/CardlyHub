# CardlyHub

Una piattaforma web per scoprire e giocare online a giochi di carte, da soli o in compagnia.

## Sviluppo

```bash
npm install
npm run dev
```

## Firebase

L'app usa Google Authentication, accesso anonimo per gli ospiti e Firestore per profili, preferenze e stanze. Copia `.env.example` in `.env.local` e inserisci la configurazione dell'app Web Firebase. Nella Firebase Console abilita i provider **Google** e **Anonimo**.

Crea il database Firestore dalla Firebase Console, poi pubblica le regole:

```bash
npx firebase-tools login
npx firebase-tools deploy --only firestore:rules
```

## Verifiche

```bash
npm run lint
npm run build
```
