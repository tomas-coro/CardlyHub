import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './lib/firebase.ts'
import App from './App.tsx'

// Solo in sviluppo: /?sim=dadi apre il banco di prova a due tavoli (vedi src/dev/OnlineSim.tsx).
const Sim = import.meta.env.DEV && new URLSearchParams(location.search).has('sim') ? lazy(() => import('./dev/OnlineSim.tsx')) : null

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {Sim ? <Suspense fallback={null}><Sim /></Suspense> : <App />}
  </StrictMode>,
)
