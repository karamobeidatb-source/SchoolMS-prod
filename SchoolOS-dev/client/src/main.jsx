import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AppSettingsProvider } from './contexts/AppSettingsContext'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AppSettingsProvider>
        <App />
      </AppSettingsProvider>
    </BrowserRouter>
  </StrictMode>,
)
