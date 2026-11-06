import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// ── Test-only hook: expose DB for QA harnesses (dev only) ─────────────────
// Uncomment to enable test harness access (dev only) - remove to prevent runtime exposure
// if (import.meta.env?.DEV) {
//   window.__db = db;
// }
