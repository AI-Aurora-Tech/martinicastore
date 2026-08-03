import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { CatalogProvider } from './context/CatalogContext'
import { CartProvider } from './context/CartContext'
import App from './App'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CatalogProvider>
      <CartProvider>
        <App />
      </CartProvider>
    </CatalogProvider>
  </StrictMode>,
)
