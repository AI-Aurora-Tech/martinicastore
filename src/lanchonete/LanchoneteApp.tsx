import { useEffect, useMemo, useState } from 'react'
import { LanchoneteStoreProvider, useStore } from './store'
import { DashboardScreen } from './screens/DashboardScreen'
import { FinanceScreen } from './screens/FinanceScreen'
import { PayablesScreen } from './screens/PayablesScreen'
import { PdvScreen } from './screens/PdvScreen'
import { ProductsScreen } from './screens/ProductsScreen'
import { PurchasesScreen } from './screens/PurchasesScreen'
import { QueueScreen } from './screens/QueueScreen'
import { StockScreen } from './screens/StockScreen'
import { UsersScreen } from './screens/UsersScreen'
import { ROLE_LABEL, type Role, type User } from './types'
import './lanchonete.css'

const SESSION_KEY = 'lanchonete-martinica:session'

type TabId =
  | 'pdv'
  | 'fila'
  | 'painel'
  | 'produtos'
  | 'estoque'
  | 'compras'
  | 'contas'
  | 'financeiro'
  | 'usuarios'

interface Tab {
  id: TabId
  label: string
  /** Perfis que enxergam a aba. */
  roles: Role[]
  /** Abas de operação (PDV) usam o tema escuro de caixa. */
  area: 'operacao' | 'gestao'
}

const TABS: Tab[] = [
  { id: 'pdv', label: 'PDV · Vender', roles: ['admin', 'pdv'], area: 'operacao' },
  { id: 'fila', label: 'Fila de pedidos', roles: ['admin', 'pdv'], area: 'operacao' },
  { id: 'painel', label: 'Painel', roles: ['admin'], area: 'gestao' },
  { id: 'produtos', label: 'Produtos', roles: ['admin'], area: 'gestao' },
  { id: 'estoque', label: 'Estoque', roles: ['admin'], area: 'gestao' },
  { id: 'compras', label: 'Compras', roles: ['admin'], area: 'gestao' },
  { id: 'contas', label: 'Contas a pagar', roles: ['admin'], area: 'gestao' },
  { id: 'financeiro', label: 'Financeiro', roles: ['admin'], area: 'gestao' },
  { id: 'usuarios', label: 'Usuários', roles: ['admin'], area: 'gestao' },
]

/** Raiz do app — injeta o estado e decide entre login e área logada. */
export default function LanchoneteApp() {
  return (
    <LanchoneteStoreProvider>
      <Shell />
    </LanchoneteStoreProvider>
  )
}

function Shell() {
  const { users, orders, ingredients } = useStore()
  const [userId, setUserId] = useState<string | null>(() => sessionStorage.getItem(SESSION_KEY))

  const user = useMemo(
    () => users.find((u) => u.id === userId && u.active) ?? null,
    [users, userId],
  )

  const tabs = useMemo(() => (user ? TABS.filter((t) => t.roles.includes(user.role)) : []), [user])
  const [tab, setTab] = useState<TabId>('pdv')

  useEffect(() => {
    if (user && !tabs.some((t) => t.id === tab)) {
      setTab(user.role === 'admin' ? 'painel' : 'pdv')
    }
  }, [user, tabs, tab])

  useEffect(() => {
    document.title = 'Lanchonete Martinica'
  }, [])

  function login(u: User) {
    sessionStorage.setItem(SESSION_KEY, u.id)
    setUserId(u.id)
    setTab(u.role === 'admin' ? 'painel' : 'pdv')
  }

  function logout() {
    sessionStorage.removeItem(SESSION_KEY)
    setUserId(null)
  }

  if (!user) return <Login onLogin={login} />

  const area = TABS.find((t) => t.id === tab)?.area ?? 'gestao'
  const queueCount = orders.filter(
    (o) => o.status === 'fila' || o.status === 'preparo' || o.status === 'pronto',
  ).length
  const lowStock = ingredients.filter((i) => i.stock <= i.minStock).length

  return (
    <div className={`lm-app lm-app--${area}`}>
      <header className="lm-header">
        <div className="lm-header__brand">
          <Logo />
          <div>
            <strong>Lanchonete Martinica</strong>
            <span>{area === 'operacao' ? 'Frente de caixa' : 'Gestão'}</span>
          </div>
        </div>

        <nav className="lm-nav" aria-label="Seções">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`lm-nav__item${tab === t.id ? ' is-active' : ''}`}
              onClick={() => setTab(t.id)}
              aria-current={tab === t.id ? 'page' : undefined}
            >
              {t.label}
              {t.id === 'fila' && queueCount > 0 && <span className="lm-dot">{queueCount}</span>}
              {t.id === 'estoque' && lowStock > 0 && <span className="lm-dot is-warn">{lowStock}</span>}
            </button>
          ))}
        </nav>

        <div className="lm-header__user">
          <span>
            <strong>{user.name}</strong>
            <em>{ROLE_LABEL[user.role]}</em>
          </span>
          <button type="button" className="lm-btn lm-btn--ghost lm-btn--sm" onClick={logout}>
            Sair
          </button>
        </div>
      </header>

      <main className="lm-main">
        {tab === 'pdv' && <PdvScreen operator={user.name} />}
        {tab === 'fila' && <QueueScreen />}
        {tab === 'painel' && <DashboardScreen onNavigate={(t) => setTab(t as TabId)} />}
        {tab === 'produtos' && <ProductsScreen />}
        {tab === 'estoque' && <StockScreen />}
        {tab === 'compras' && <PurchasesScreen />}
        {tab === 'contas' && <PayablesScreen />}
        {tab === 'financeiro' && <FinanceScreen />}
        {tab === 'usuarios' && <UsersScreen currentUserId={user.id} />}
      </main>
    </div>
  )
}

function Login({ onLogin }: { onLogin: (u: User) => void }) {
  const { users } = useStore()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const found = users.find(
      (u) => u.username.toLowerCase() === username.trim().toLowerCase() && u.password === password,
    )
    if (!found) {
      setError('Usuário ou senha inválidos.')
      return
    }
    if (!found.active) {
      setError('Este usuário está inativo. Fale com o administrador.')
      return
    }
    onLogin(found)
  }

  return (
    <div className="lm-login">
      <form className="lm-login__box" onSubmit={submit}>
        <Logo large />
        <h1>Lanchonete Martinica</h1>
        <p>Gestão de pedidos, estoque, compras e financeiro.</p>

        <label>
          Usuário
          <input
            className="lm-input"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoCapitalize="none"
            autoFocus
          />
        </label>
        <label>
          Senha
          <input
            className="lm-input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>

        {error && <p className="lm-alert">{error}</p>}

        <button type="submit" className="lm-btn lm-btn--primary lm-btn--block">
          Entrar
        </button>

        <div className="lm-login__hint">
          <strong>Acessos de demonstração</strong>
          <span>
            Administrador — <code>admin</code> / <code>martinica</code>
          </span>
          <span>
            Operador de PDV — <code>caixa</code> / <code>1234</code>
          </span>
        </div>
      </form>
    </div>
  )
}

function Logo({ large }: { large?: boolean }) {
  return (
    <svg
      className={`lm-logo${large ? ' lm-logo--lg' : ''}`}
      viewBox="0 0 64 64"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Lanchonete Martinica"
    >
      <rect width="64" height="64" rx="16" fill="#141414" />
      <path d="M14 34c0-9 8-16 18-16s18 7 18 16z" fill="#ff6a00" />
      <rect x="12" y="34" width="40" height="6" rx="3" fill="#ffffff" />
      <path d="M14 40h36c0 7-8 12-18 12s-18-5-18-12z" fill="#ff6a00" />
      <circle cx="26" cy="26" r="2" fill="#ffffff" />
      <circle cx="34" cy="23" r="2" fill="#ffffff" />
      <circle cx="41" cy="27" r="2" fill="#ffffff" />
    </svg>
  )
}
