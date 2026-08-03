import { useEffect, useState, type FormEvent } from 'react'
import { PDV } from './PDV'
import {
  authMode,
  getCurrentOperator,
  signIn,
  signOut,
  type Operator,
} from '../services/auth'

interface Props {
  onExit: () => void
}

/**
 * "Porteiro" do PDV: exige login antes de liberar o Ponto de Venda. Usa o
 * Supabase Auth quando configurado (e-mail/senha) ou credenciais mock no modo
 * demo. O componente <PDV> (com seus próprios hooks) só é montado após a
 * autenticação, evitando qualquer problema de ordem de hooks.
 */
export function PDVGate({ onExit }: Props) {
  const [operator, setOperator] = useState<Operator | null>(null)
  const [checking, setChecking] = useState(true)
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Recupera sessão existente ao montar.
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
        <div className="pdvlogin__loading">Carregando caixa…</div>
      </div>
    )
  }

  if (operator) {
    return <PDV operator={operator} onLogout={handleLogout} onExit={onExit} />
  }

  const isSupabase = authMode === 'supabase'

  return (
    <div className="pdvlogin">
      <form className="pdvlogin__card" onSubmit={handleSubmit}>
        <div className="pdvlogin__brand">
          <span className="brand__mark" aria-hidden="true">M</span>
          <div>
            <strong>MARTINICA · PDV</strong>
            <small>Acesso ao Ponto de Venda</small>
          </div>
        </div>

        <p className="pdvlogin__hint">
          Informe suas credenciais de operador para abrir o caixa.
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
          {submitting ? 'Entrando…' : 'Entrar no caixa'}
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
