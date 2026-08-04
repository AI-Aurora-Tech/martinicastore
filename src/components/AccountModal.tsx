import { useState } from 'react'
import { useCustomer } from '../context/CustomerContext'
import type { Address } from '../types'
import { formatCep, lookupCep, onlyDigits } from '../services/shipping'

interface Props {
  onClose: () => void
}

const EMPTY: Address = {
  cep: '', street: '', number: '', complement: '', neighborhood: '', city: '', uf: '',
}

export function AccountModal({ onClose }: Props) {
  const { customer, updateProfile } = useCustomer()
  const [name, setName] = useState(customer?.name ?? '')
  const [phone, setPhone] = useState(customer?.phone ?? '')
  const [addr, setAddr] = useState<Address>({ ...EMPTY, ...(customer?.address ?? {}) })
  const [cepBusy, setCepBusy] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [ok, setOk] = useState(false)

  function set<K extends keyof Address>(k: K, v: Address[K]) {
    setAddr((a) => ({ ...a, [k]: v }))
    setOk(false)
  }

  async function lookup() {
    if (onlyDigits(addr.cep).length !== 8) return
    setCepBusy(true)
    const { address } = await lookupCep(addr.cep)
    setCepBusy(false)
    if (address) {
      setAddr((a) => ({
        ...a,
        cep: address.cep ?? a.cep,
        street: address.street || a.street,
        neighborhood: address.neighborhood || a.neighborhood,
        city: address.city || a.city,
        uf: address.uf || a.uf,
      }))
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (saving) return
    if (phone.replace(/\D/g, '').length < 10) return setError('Informe um WhatsApp válido (com DDD).')
    setSaving(true)
    setError('')
    const hasAddr = onlyDigits(addr.cep).length === 8 && addr.street && addr.number
    const err = await updateProfile({
      name: name.trim(),
      phone: phone.trim(),
      address: hasAddr ? addr : undefined,
    })
    setSaving(false)
    if (err) return setError(err)
    setOk(true)
  }

  return (
    <div className="authmodal" onClick={onClose}>
      <form className="authmodal__card account" onClick={(e) => e.stopPropagation()} onSubmit={save}>
        <button type="button" className="authmodal__close" onClick={onClose} aria-label="Fechar">✕</button>
        <div className="authmodal__brand">
          <span className="brand__mark" aria-hidden="true">M</span>
          <div>
            <strong>Minha conta</strong>
            <small>{customer?.email}</small>
          </div>
        </div>

        <div className="account__grid">
          <label className="custauth__field account__full">
            <span>Nome completo</span>
            <input value={name} onChange={(e) => { setName(e.target.value); setOk(false) }} required />
          </label>
          <label className="custauth__field account__full">
            <span>WhatsApp</span>
            <input type="tel" value={phone} onChange={(e) => { setPhone(e.target.value); setOk(false) }} placeholder="(11) 90000-0000" required />
          </label>

          <div className="account__sep">Endereço de entrega</div>

          <label className="custauth__field">
            <span>CEP</span>
            <input inputMode="numeric" value={addr.cep} onChange={(e) => set('cep', formatCep(e.target.value))} onBlur={lookup} placeholder="00000-000" />
          </label>
          <label className="custauth__field">
            <span>Número</span>
            <input value={addr.number} onChange={(e) => set('number', e.target.value)} />
          </label>
          <label className="custauth__field account__full">
            <span>Endereço {cepBusy && '· buscando…'}</span>
            <input value={addr.street} onChange={(e) => set('street', e.target.value)} />
          </label>
          <label className="custauth__field">
            <span>Bairro</span>
            <input value={addr.neighborhood} onChange={(e) => set('neighborhood', e.target.value)} />
          </label>
          <label className="custauth__field">
            <span>Complemento</span>
            <input value={addr.complement} onChange={(e) => set('complement', e.target.value)} />
          </label>
          <label className="custauth__field">
            <span>Cidade</span>
            <input value={addr.city} onChange={(e) => set('city', e.target.value)} />
          </label>
          <label className="custauth__field">
            <span>UF</span>
            <input maxLength={2} value={addr.uf} onChange={(e) => set('uf', e.target.value.toUpperCase())} />
          </label>
        </div>

        {error && <p className="custauth__error">⚠️ {error}</p>}
        {ok && <p className="custauth__info">✅ Cadastro atualizado!</p>}

        <button type="submit" className="btn btn--primary btn--block" disabled={saving}>
          {saving ? 'Salvando…' : 'Salvar cadastro'}
        </button>
      </form>
    </div>
  )
}
