import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Analytics } from '@vercel/analytics/react'
import { CatalogProvider } from './context/CatalogContext'
import { CartProvider } from './context/CartContext'
import { CustomerProvider } from './context/CustomerContext'
import LanchoneteApp from './lanchonete/LanchoneteApp'
import App from './App'
import './index.css'

/**
 * O app de gestão da Lanchonete Martinica vive numa URL própria (/lanchonete)
 * e é totalmente independente da loja virtual — inclusive dos provedores de
 * catálogo/carrinho da loja.
 */
const IS_LANCHONETE = /^\/lanchonete(\/|$)/.test(window.location.pathname)

const root = createRoot(document.getElementById('root')!)

root.render(
  IS_LANCHONETE ? (
    <StrictMode>
      <LanchoneteApp />
      <Analytics />
    </StrictMode>
  ) : (
    <StrictMode>
      <CatalogProvider>
        <CustomerProvider>
          <CartProvider>
            <App />
          </CartProvider>
        </CustomerProvider>
      </CatalogProvider>
      <Analytics />
    </StrictMode>
  ),
)
