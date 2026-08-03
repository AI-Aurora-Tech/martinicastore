import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import {
  authMode,
  getCurrentOperator,
  signIn,
  signOut,
  type Operator,
} from '../services/auth'

interface Props {
  /** Texto pequeno no cartão de login (ex.: "Acesso ao Ponto de Venda"). */
  subtitle: string
  onExit: () => void
  children: (operator: Operator, logout: () => Promise<void>) => ReactNode
}

/**
 * Porteiro de autenticação reutilizável. Exige login (Supabase Auth quando
 * configurado, ou credenciais mock no modo demo) e só então renderiza o
 * conteúdo protegido — que recebe o operador e a função de logout.
 */
export function AuthGate({ subtitle, onExit, children }: Props) {
  const [operator, setOperator] = useState<Operator | null>(null)
  const [checking, setChecking] = useState(true)
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let alive = true
    getCurrentOperator().then((op) => {
      if (!alive) return
      setOperator(op)
      setChecking(false)
    })
    return () => {
      alive = false
    }
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (submitting) return
    setSubmitting(true)
    setError('')
    const { operator: op, error: err } = await signIn(login, password)
    setSubmitting(false)
    if (err || !op) {
      setError(err ?? 'Falha na autenticação.')
      setPassword('')
      return
    }
    setOperator(op)
    setLogin('')
    setPassword('')
  }

  async function handleLogout() {
    await signOut()
    setOperator(null)
  }

  if (checking) {
    return (
      <div className="pdvlogin">
        <div className="pdvlogin__loading">Carregando…</div>
      </div>
    )
  }

  if (operator) {
    return <>{children(operator, handleLogout)}</>
  }

  const isSupabase = authMode === 'supabase'

  return (
    <div className="pdvlogin">
      <form className="pdvlogin__card" onSubmit={handleSubmit}>
        <div className="pdvlogin__brand">
          <span className="brand__mark" aria-hidden="true">M</span>
          <div>
            <strong>MARTINICA</strong>
            <small>{subtitle}</small>
          </div>
        </div>

        <p className="pdvlogin__hint">
          Informe suas credenciais para continuar.
        </p>

        <label className="pdvlogin__field">
          <span>{isSupabase ? 'E-mail' : 'Usuário'}</span>
          <input
            type={isSupabase ? 'email' : 'text'}
            autoFocus
            autoComplete="username"
            placeholder={isSupabase ? 'operador@martinica.com' : 'ex.: caixa01'}
            value={login}
            onChange={(e) => {
              setLogin(e.target.value)
              setError('')
            }}
            required
          />
        </label>

        <label className="pdvlogin__field">
          <span>Senha</span>
          <div className="pdvlogin__pass">
            <input
              type={showPass ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="••••••"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                setError('')
              }}
              required
            />
            <button
              type="button"
              onClick={() => setShowPass((s) => !s)}
              aria-label={showPass ? 'Ocultar senha' : 'Mostrar senha'}
            >
              {showPass ? '🙈' : '👁️'}
            </button>
          </div>
        </label>

        {error && <p className="pdvlogin__error" role="alert">⚠️ {error}</p>}

        <button
          type="submit"
          className="btn btn--primary btn--block pdvlogin__submit"
          disabled={submitting}
        >
          {submitting ? 'Entrando…' : 'Entrar'}
        </button>

        <button type="button" className="pdvlogin__back" onClick={onExit}>
          ← Voltar à loja
        </button>

        {isSupabase ? (
          <div className="pdvlogin__demo">
            <strong>Conectado ao Supabase</strong>
            <span>Use um operador criado em Authentication → Users.</span>
          </div>
        ) : (
          <div className="pdvlogin__demo">
            <strong>Modo demo — credenciais de teste</strong>
            <span>caixa01 / 1234</span>
            <span>gerente / martinica</span>
          </div>
        )}
      </form>
    </div>
  )
}
