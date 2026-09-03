import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Analytics } from '@vercel/analytics/react'
import { CatalogProvider } from './context/CatalogContext'
import { CartProvider } from './context/CartContext'
import { CustomerProvider } from './context/CustomerContext'
import App from './App'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CatalogProvider>
      <CustomerProvider>
        <CartProvider>
          <App />
        </CartProvider>
      </CustomerProvider>
    </CatalogProvider>
    <Analytics />
  </StrictMode>,
)
