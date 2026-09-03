import { useState, type FormEvent } from 'react'
import { useCustomer } from '../context/CustomerContext'
import { formatCpf, isValidCpf } from '../services/cpf'

interface Props {
  /** Chamado após login/cadastro bem-sucedido. */
  onDone?: () => void
  compact?: boolean
}

export function CustomerAuth({ onDone, compact }: Props) {
  const { signIn, signUp } = useCustomer()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [cpf, setCpf] = useState('')
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
    if (mode === 'signup' && phone.replace(/\D/g, '').length < 10) {
      setBusy(false)
      setError('Informe um WhatsApp válido (com DDD).')
      return
    }
    if (mode === 'signup' && !isValidCpf(cpf)) {
      setBusy(false)
      setError('Informe um CPF válido.')
      return
    }
    const err =
      mode === 'login'
        ? await signIn(email, password)
        : await signUp(name, email, password, phone, cpf)
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
        <>
          <label className="custauth__field">
            <span>Nome completo</span>
            <input value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" />
          </label>
          <label className="custauth__field">
            <span>WhatsApp (para avisos do pedido)</span>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(11) 90000-0000"
              required
              autoComplete="tel"
            />
          </label>
          <label className="custauth__field">
            <span>CPF</span>
            <input
              inputMode="numeric"
              value={cpf}
              onChange={(e) => setCpf(formatCpf(e.target.value))}
              placeholder="000.000.000-00"
              required
              autoComplete="off"
            />
          </label>
        </>
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
