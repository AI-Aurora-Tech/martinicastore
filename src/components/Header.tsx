import { useState } from 'react'
import { CLUB } from '../data/products'
import type { CategoryId } from '../types'
import { useCart } from '../context/CartContext'
import { useCatalog } from '../context/CatalogContext'
import { useCustomer } from '../context/CustomerContext'
import { CustomerAuth } from './CustomerAuth'
import { AccountModal } from './AccountModal'

interface Props {
  active: CategoryId | 'todos'
  onSelect: (id: CategoryId | 'todos') => void
  query: string
  onQuery: (q: string) => void
}

export function Header({ active, onSelect, query, onQuery }: Props) {
  const { count, openCart } = useCart()
  const { categories } = useCatalog()
  const { customer, signOut } = useCustomer()
  const [showAuth, setShowAuth] = useState(false)
  const [showAccount, setShowAccount] = useState(false)

  return (
    <header className="header">
      <div className="header__topbar">
        <span>🚚 Frete grátis acima de R$ 299</span>
        <span className="header__topbar-sep">•</span>
        <span>Até 10x sem juros</span>
        <span className="header__topbar-sep">•</span>
        <span>Loja 100% oficial e segura</span>
      </div>

      <div className="header__main">
        <a href="#topo" className="brand" aria-label={`${CLUB.store} — página inicial`}>
          <span className="brand__mark" aria-hidden="true">M</span>
          <span className="brand__text">
            <strong>MARTINICA</strong>
            <small>STORE OFICIAL</small>
          </span>
        </a>

        <form
          className="search"
          role="search"
          onSubmit={(e) => e.preventDefault()}
        >
          <input
            type="search"
            placeholder="Busque por camisa, boné, chuteira…"
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            aria-label="Buscar produtos"
          />
          <button type="submit" aria-label="Buscar">
            🔍
          </button>
        </form>

        <div className="header__actions">
          {customer ? (
            <div className="header__account header__account--in">
              <button className="header__account-btn" onClick={() => setShowAccount(true)} title="Minha conta">
                <span aria-hidden="true">👤</span>
                <span className="header__account-text">
                  <small>Olá,</small>
                  <strong>{customer.name.split(' ')[0]}</strong>
                </span>
              </button>
              <button className="header__logout" onClick={() => signOut()} title="Sair da conta">
                Sair
              </button>
            </div>
          ) : (
            <button className="header__account" onClick={() => setShowAuth(true)}>
              <span aria-hidden="true">👤</span>
              <span className="header__account-text">
                <small>Bem-vindo</small>
                <strong>Entrar / Cadastrar</strong>
              </span>
            </button>
          )}
          <button type="button" className="header__cart" onClick={openCart}>
            <span aria-hidden="true">🛍️</span>
            <span>Sacola</span>
            {count > 0 && <span className="header__cart-count">{count}</span>}
          </button>
        </div>
      </div>

      <nav className="nav" aria-label="Categorias">
        <button
          className={`nav__link ${active === 'todos' ? 'nav__link--active' : ''}`}
          onClick={() => onSelect('todos')}
        >
          Início
        </button>
        {categories.map((c) => (
          <button
            key={c.id}
            className={`nav__link ${active === c.id ? 'nav__link--active' : ''}`}
            onClick={() => onSelect(c.id)}
          >
            {c.label}
          </button>
        ))}
        <span className="nav__promo">🔥 Ofertas da Semana</span>
      </nav>

      {showAuth && (
        <div className="authmodal" onClick={() => setShowAuth(false)}>
          <div className="authmodal__card" onClick={(e) => e.stopPropagation()}>
            <button className="authmodal__close" onClick={() => setShowAuth(false)} aria-label="Fechar">✕</button>
            <div className="authmodal__brand">
              <span className="brand__mark" aria-hidden="true">M</span>
              <div>
                <strong>Minha conta</strong>
                <small>Entre ou cadastre-se</small>
              </div>
            </div>
            <CustomerAuth onDone={() => setShowAuth(false)} />
          </div>
        </div>
      )}

      {showAccount && <AccountModal onClose={() => setShowAccount(false)} />}
    </header>
  )
}
