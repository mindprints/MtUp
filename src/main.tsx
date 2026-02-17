import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { runtimeConfig } from '@/lib/runtimeConfig'
import { assertSupabaseEnv } from '@/lib/supabase'

if (runtimeConfig.dataSource === 'supabase') {
  assertSupabaseEnv()
}

console.info(`[mtUp] data source: ${runtimeConfig.dataSource}`)

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
