import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { EnvErrorScreen } from './app/EnvErrorScreen'
import { ErrorBoundary } from './app/ErrorBoundary'
import { Providers } from './app/providers'
import { router } from './app/router'
import { parseEnv } from './lib/env'
import './index.css'

const rootEl = document.getElementById('root')
if (!rootEl) throw new Error('Root element #root not found')

const envResult = parseEnv(import.meta.env)

createRoot(rootEl).render(
  <StrictMode>
    <ErrorBoundary>
      {envResult.ok ? (
        <Providers>
          <RouterProvider router={router} />
        </Providers>
      ) : (
        <EnvErrorScreen problems={envResult.problems} />
      )}
    </ErrorBoundary>
  </StrictMode>,
)
