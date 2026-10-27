import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { registerPwa } from './services/pwa.ts'
import { applyStoredAppearance } from './services/appearance.ts'

applyStoredAppearance()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

void registerPwa().catch(() => undefined)
