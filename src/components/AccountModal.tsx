import { useEffect, useState } from 'react'
import { useCustomer } from '../context/CustomerContext'
import type { Address } from '../types'
import { BRL } from '../data/products'
import { formatCep, lookupCep, onlyDigits } from '../services/shipping'
import { formatCpf, isValidCpf } from '../services/cpf'
import { listMyOrders, type MyOrder } from '../services/myOrders'

interface Props {
  onClose: () => void
}

const EMPTY: Address = {
  cep: '', street: '', number: '', complement: '', neighborhood: '', city: '', uf: '',
}

const STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: 'Aguardando pagamento', cls: 'wait' },
  paid: { label: 'Pago', cls: 'ok' },
  shipped: { label: 'Enviado', cls: 'ok' },
  delivered: { label: 'Entregue', cls: 'ok' },
  canceled: { label: 'Cancelado', cls: 'danger' },
  concluida: { label: 'Concluída', cls: 'ok' },
}

function when(iso: string) {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('pt-BR')
}

export function AccountModal({ onClose }: Props) {
  const { customer, updateProfile } = useCustomer()
  const [tab, setTab] = useState<'pedidos' | 'cadastro'>('pedidos')

  // ---- Meus pedidos ----
  const [orders, setOrders] = useState<MyOrder[]>([])
  const [loadingOrders, setLoadingOrders] = useState(true)
  const [ordersErr, setOrdersErr] = useState<string | null>(null)
  const [openOrder, setOpenOrder] = useState<string | null>(null)

  useEffect(() => {
    if (!customer) return
    setLoadingOrders(true)
    setOrdersErr(null)
    listMyOrders(customer)
      .then(setOrders)
      .catch((e) => setOrdersErr(e instanceof Error ? e.message : 'Falha ao carregar pedidos.'))
      .finally(() => setLoadingOrders(false))
  }, [customer])

  // ---- Cadastro ----
  const [name, setName] = useState(customer?.name ?? '')
  const [phone, setPhone] = useState(customer?.phone ?? '')
  const [cpf, setCpf] = useState(customer?.cpf ? formatCpf(customer.cpf) : '')
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
    if (!isValidCpf(cpf)) return setError('Informe um CPF válido.')
    setSaving(true)
    setError('')
    const hasAddr = onlyDigits(addr.cep).length === 8 && addr.street && addr.number
    const err = await updateProfile({
      name: name.trim(),
      phone: phone.trim(),
      cpf: cpf.replace(/\D/g, ''),
      address: hasAddr ? addr : undefined,
    })
    setSaving(false)
    if (err) return setError(err)
    setOk(true)
  }

  return (
    <div className="authmodal" onClick={onClose}>
      <div className="authmodal__card account" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="authmodal__close" onClick={onClose} aria-label="Fechar">✕</button>
        <div className="authmodal__brand">
          <span className="brand__mark" aria-hidden="true">M</span>
          <div>
            <strong>Minha conta</strong>
            <small>{customer?.email}</small>
          </div>
        </div>

        <div className="custauth__tabs account__tabs">
          <button type="button" className={tab === 'pedidos' ? 'is-active' : ''} onClick={() => setTab('pedidos')}>
            Meus pedidos
          </button>
          <button type="button" className={tab === 'cadastro' ? 'is-active' : ''} onClick={() => setTab('cadastro')}>
            Meu cadastro
          </button>
        </div>

        {tab === 'pedidos' ? (
          <div className="myorders">
            {loadingOrders ? (
              <p className="myorders__empty">Carregando seus pedidos…</p>
            ) : ordersErr ? (
              <p className="custauth__error">⚠️ {ordersErr}</p>
            ) : orders.length === 0 ? (
              <div className="myorders__empty">
                <span aria-hidden="true">🛍️</span>
                <p>Você ainda não fez nenhum pedido.</p>
              </div>
            ) : (
              <ul className="myorders__list">
                {orders.map((o) => {
                  const st = STATUS[o.status] ?? { label: o.status, cls: 'wait' }
                  const isOpen = openOrder === o.id
                  const units = o.items.reduce((s, i) => s + i.quantity, 0)
                  return (
                    <li key={o.id} className="myorders__item">
                      <button className="myorders__row" onClick={() => setOpenOrder(isOpen ? null : o.id)}>
                        <div className="myorders__main">
                          <strong>Pedido nº {String(o.number).padStart(6, '0')}</strong>
                          <small>{when(o.when)} · {units} {units === 1 ? 'item' : 'itens'}</small>
                        </div>
                        <span className={`myorders__badge is-${st.cls}`}>{st.label}</span>
                        <strong className="myorders__total">{BRL.format(o.total)}</strong>
                        <span className="myorders__chev">{isOpen ? '▲' : '▼'}</span>
                      </button>
                      {isOpen && (
                        <div className="myorders__detail">
                          <ul className="myorders__items">
                            {o.items.map((i, idx) => (
                              <li key={idx}>
                                <span>{i.quantity}x {i.name}{i.size ? ` · ${i.size}` : ''}</span>
                                <span>{BRL.format(i.unitPrice * i.quantity)}</span>
                              </li>
                            ))}
                          </ul>
                          <div className="myorders__totrow"><span>Subtotal</span><span>{BRL.format(o.subtotal)}</span></div>
                          <div className="myorders__totrow">
                            <span>Frete{o.shippingService ? ` (${o.shippingService})` : ''}</span>
                            <span>{o.shipping > 0 ? BRL.format(o.shipping) : 'Grátis'}</span>
                          </div>
                          <div className="myorders__totrow myorders__totrow--grand"><span>Total</span><span>{BRL.format(o.total)}</span></div>
                          {o.address && <p className="myorders__addr">📍 {o.address}</p>}
                          {o.shippingService === 'RETIRADA' && (
                            <p className="myorders__addr">🏪 Retirada na loja (Sáb. e Dom., 8h–15h)</p>
                          )}
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        ) : (
          <form className="account__form" onSubmit={save}>
            <div className="account__grid">
              <label className="custauth__field account__full">
                <span>Nome completo</span>
                <input value={name} onChange={(e) => { setName(e.target.value); setOk(false) }} required />
              </label>
              <label className="custauth__field">
                <span>WhatsApp</span>
                <input type="tel" value={phone} onChange={(e) => { setPhone(e.target.value); setOk(false) }} placeholder="(11) 90000-0000" required />
              </label>
              <label className="custauth__field">
                <span>CPF</span>
                <input inputMode="numeric" value={cpf} onChange={(e) => { setCpf(formatCpf(e.target.value)); setOk(false) }} placeholder="000.000.000-00" required />
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
        )}
      </div>
    </div>
  )
}
