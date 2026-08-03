import { useState, type FormEvent } from 'react'
import { PDV } from './PDV'

interface Props {
  onExit: () => void
}

/** Operadores de demonstração autorizados a usar o caixa. */
const OPERATORS = [
  { user: 'caixa01', pass: '1234', name: 'Operador — Caixa 01' },
  { user: 'gerente', pass: 'martinica', name: 'Gerente da Loja' },
]

const SESSION_KEY = 'martinica-pdv-operator'

/**
 * "Porteiro" do PDV: exige usuário e senha antes de liberar o Ponto de Venda.
 * O componente <PDV> (com seus próprios hooks) só é montado após a autenticação,
 * evitando qualquer problema de ordem de hooks.
 */
export function PDVGate({ onExit }: Props) {
  const [operator, setOperator] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem(SESSION_KEY)
    } catch {
      return null
    }
  })
  const [user, setUser] = useState('')
  const [pass, setPass] = useState('')
  const [error, setError] = useState('')
  const [showPass, setShowPass] = useState(false)

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const found = OPERATORS.find(
      (o) => o.user === user.trim().toLowerCase() && o.pass === pass,
    )
    if (!found) {
      setError('Usuário ou senha inválidos.')
      setPass('')
      return
    }
    try {
      sessionStorage.setItem(SESSION_KEY, found.name)
    } catch {
      /* ignore */
    }
    setOperator(found.name)
    setError('')
    setUser('')
    setPass('')
  }

  function handleLogout() {
    try {
      sessionStorage.removeItem(SESSION_KEY)
    } catch {
      /* ignore */
    }
    setOperator(null)
  }

  if (operator) {
    return <PDV operator={operator} onLogout={handleLogout} onExit={onExit} />
  }

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
          <span>Usuário</span>
          <input
            type="text"
            autoFocus
            autoComplete="username"
            placeholder="ex.: caixa01"
            value={user}
            onChange={(e) => {
              setUser(e.target.value)
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
              value={pass}
              onChange={(e) => {
                setPass(e.target.value)
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

        <button type="submit" className="btn btn--primary btn--block pdvlogin__submit">
          Entrar no caixa
        </button>

        <button type="button" className="pdvlogin__back" onClick={onExit}>
          ← Voltar à loja
        </button>

        <div className="pdvlogin__demo">
          <strong>Credenciais de demonstração</strong>
          <span>caixa01 / 1234</span>
          <span>gerente / martinica</span>
        </div>
      </form>
    </div>
  )
}
