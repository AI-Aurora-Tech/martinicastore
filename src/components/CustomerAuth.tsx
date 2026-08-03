import { useState, type FormEvent } from 'react'
import { useCustomer } from '../context/CustomerContext'

interface Props {
  /** Chamado após login/cadastro bem-sucedido. */
  onDone?: () => void
  compact?: boolean
}

export function CustomerAuth({ onDone, compact }: Props) {
  const { signIn, signUp } = useCustomer()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    setInfo('')
    const err =
      mode === 'login'
        ? await signIn(email, password)
        : await signUp(name, email, password)
    setBusy(false)
    if (err) {
      // Mensagem de "confirme o e-mail" é informativa, não erro fatal.
      if (/confirm/i.test(err)) setInfo(err)
      else setError(err)
      return
    }
    onDone?.()
  }

  return (
    <form className={`custauth ${compact ? 'custauth--compact' : ''}`} onSubmit={submit}>
      <div className="custauth__tabs">
        <button
          type="button"
          className={mode === 'login' ? 'is-active' : ''}
          onClick={() => { setMode('login'); setError(''); setInfo('') }}
        >
          Entrar
        </button>
        <button
          type="button"
          className={mode === 'signup' ? 'is-active' : ''}
          onClick={() => { setMode('signup'); setError(''); setInfo('') }}
        >
          Criar conta
        </button>
      </div>

      {mode === 'signup' && (
        <label className="custauth__field">
          <span>Nome completo</span>
          <input value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" />
        </label>
      )}
      <label className="custauth__field">
        <span>E-mail</span>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
      </label>
      <label className="custauth__field">
        <span>Senha</span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
        />
      </label>

      {error && <p className="custauth__error" role="alert">⚠️ {error}</p>}
      {info && <p className="custauth__info">✅ {info}</p>}

      <button type="submit" className="btn btn--primary btn--block" disabled={busy}>
        {busy ? 'Aguarde…' : mode === 'login' ? 'Entrar' : 'Criar conta'}
      </button>
    </form>
  )
}
