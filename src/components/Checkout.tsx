import { useEffect, useMemo, useState } from 'react'
import { useCart } from '../context/CartContext'
import { useCustomer } from '../context/CustomerContext'
import { useCatalog } from '../context/CatalogContext'
import { BRL } from '../data/products'
import type { Address, ShippingOption } from '../types'
import { ProductImage } from './ProductImage'
import { CustomerAuth } from './CustomerAuth'
import {
  cartWeight,
  formatCep,
  lookupCep,
  onlyDigits,
  quoteShipping,
} from '../services/shipping'
import { createOrder } from '../services/orders'
import { sendOrderEmail } from '../services/email'
import { isSupabaseConfigured } from '../lib/supabase'

interface Props {
  onExit: () => void
}

const EMPTY_ADDR: Address = {
  cep: '', street: '', number: '', complement: '', neighborhood: '', city: '', uf: '',
}

const PAYMENTS = [
  { id: 'pix', label: 'Pix', icon: '⚡', note: '5% de desconto' },
  { id: 'cartao', label: 'Cartão', icon: '💳', note: 'até 10x sem juros' },
  { id: 'boleto', label: 'Boleto', icon: '🧾', note: 'aprovação em 1-2 dias' },
] as const

export function Checkout({ onExit }: Props) {
  const { items, subtotal, clear, count } = useCart()
  const { customer, signOut, saveAddress } = useCustomer()
  const { decrementStockLocal } = useCatalog()

  const [addr, setAddr] = useState<Address>(EMPTY_ADDR)
  const [phone, setPhone] = useState('')
  const [cepBusy, setCepBusy] = useState(false)
  const [cepError, setCepError] = useState('')
  const [options, setOptions] = useState<ShippingOption[] | null>(null)
  const [service, setService] = useState<'PAC' | 'SEDEX' | null>(null)
  const [payment, setPayment] = useState<'pix' | 'cartao' | 'boleto'>('pix')
  const [placing, setPlacing] = useState(false)
  const [error, setError] = useState('')
  const [orderNumber, setOrderNumber] = useState<number | null>(null)
  const [emailSent, setEmailSent] = useState(false)
  const [emailError, setEmailError] = useState<string | null>(null)

  const weight = useMemo(() => cartWeight(items), [items])

  useEffect(() => {
    if (customer?.address) setAddr({ ...EMPTY_ADDR, ...customer.address })
    if (customer?.phone) setPhone(customer.phone)
  }, [customer])

  const selected = options?.find((o) => o.service === service) ?? null
  const shippingPrice = selected?.price ?? 0
  const total = subtotal + shippingPrice

  function set<K extends keyof Address>(key: K, value: Address[K]) {
    setAddr((a) => ({ ...a, [key]: value }))
    setOptions(null)
    setService(null)
  }

  async function calcFrete() {
    setCepError('')
    if (onlyDigits(addr.cep).length !== 8) {
      setCepError('Informe um CEP válido (8 dígitos).')
      return
    }
    setCepBusy(true)
    const { address, error: cepErr } = await lookupCep(addr.cep)
    let uf = addr.uf
    if (address) {
      setAddr((a) => ({
        ...a,
        cep: address.cep ?? a.cep,
        street: address.street || a.street,
        neighborhood: address.neighborhood || a.neighborhood,
        city: address.city || a.city,
        uf: address.uf || a.uf,
      }))
      uf = address.uf || uf
    } else if (cepErr) {
      setCepError(cepErr)
    }
    setCepBusy(false)

    if (!uf) {
      setCepError((e) => e || 'Não foi possível obter o estado. Preencha a UF e calcule de novo.')
      return
    }
    const opts = quoteShipping(uf, weight, subtotal)
    setOptions(opts)
    setService('PAC')
  }

  async function confirm() {
    setError('')
    if (!selected) return setError('Calcule e escolha o frete.')
    const required: (keyof Address)[] = ['cep', 'street', 'number', 'neighborhood', 'city', 'uf']
    if (required.some((k) => !String(addr[k]).trim())) {
      return setError('Preencha o endereço completo (incluindo número).')
    }
    setPlacing(true)
    await saveAddress(addr, phone.trim() ? { phone: phone.trim() } : undefined)
    const { number, id, error: err } = await createOrder({
      customerId: customer?.id,
      customerName: customer?.name,
      customerEmail: customer?.email,
      customerPhone: phone.trim() || undefined,
      subtotal,
      discount: 0,
      shipping: shippingPrice,
      total,
      payment,
      shippingService: selected.service,
      shippingDays: selected.days,
      address: addr,
      items,
    })
    if (err) {
      setPlacing(false)
      return setError(err)
    }
    decrementStockLocal(items.map((i) => ({ id: i.product.id, quantity: i.quantity })))
    // Dispara o e-mail de confirmação (best-effort — não bloqueia a compra).
    const { sent, error: mailErr } = await sendOrderEmail(id)
    setEmailSent(sent)
    setEmailError(mailErr)
    setPlacing(false)
    setOrderNumber(number)
    clear()
  }

  // ---- Estados de tela ----

  if (orderNumber !== null) {
    return (
      <div className="checkout">
        <CheckoutHeader onExit={onExit} customerName={customer?.name} onLogout={signOut} />
        <div className="checkout__done">
          <span>🎉</span>
          <h2>Pedido confirmado!</h2>
          {orderNumber > 0 && <p>Pedido nº <strong>{String(orderNumber).padStart(6, '0')}</strong></p>}
          <p className="checkout__done-sub">
            {emailSent ? (
              <>Enviamos a confirmação do seu pedido (e-mail/WhatsApp). </>
            ) : isSupabaseConfigured ? (
              <>Seu pedido foi registrado (a notificação não pôde ser enviada agora). </>
            ) : (
              <>Seu pedido foi registrado. </>
            )}
            Entrega via <strong>{selected?.service}</strong> em até {selected?.days} dias úteis.
          </p>
          {!emailSent && isSupabaseConfigured && emailError && (
            <p className="checkout__mailerr">Diagnóstico do e-mail: {emailError}</p>
          )}
          <button className="btn btn--primary" onClick={onExit}>Voltar à loja</button>
        </div>
      </div>
    )
  }

  if (count === 0) {
    return (
      <div className="checkout">
        <CheckoutHeader onExit={onExit} customerName={customer?.name} onLogout={signOut} />
        <div className="checkout__done">
          <span>🛍️</span>
          <h2>Sua sacola está vazia</h2>
          <button className="btn btn--primary" onClick={onExit}>Ver produtos</button>
        </div>
      </div>
    )
  }

  return (
    <div className="checkout">
      <CheckoutHeader onExit={onExit} customerName={customer?.name} onLogout={signOut} />

      <div className="checkout__body">
        <div className="checkout__main">
          {/* 1. Identificação */}
          <section className="checkout__card">
            <h3><span className="checkout__step">1</span> Identificação</h3>
            {customer ? (
              <p className="checkout__ident">
                Olá, <strong>{customer.name}</strong> ({customer.email}).{' '}
                <button className="checkout__link" onClick={signOut}>trocar</button>
              </p>
            ) : (
              <>
                <p className="checkout__req">É necessário entrar ou criar uma conta para finalizar.</p>
                <CustomerAuth compact />
              </>
            )}
          </section>

          {/* 2. Entrega */}
          <section className={`checkout__card ${!customer ? 'checkout__card--disabled' : ''}`}>
            <h3><span className="checkout__step">2</span> Entrega (Correios)</h3>
            <div className="checkout__cep">
              <label className="checkout__field checkout__field--cep">
                <span>CEP</span>
                <input
                  inputMode="numeric"
                  placeholder="00000-000"
                  value={addr.cep}
                  onChange={(e) => set('cep', formatCep(e.target.value))}
                  disabled={!customer}
                />
              </label>
              <button type="button" className="btn btn--primary checkout__calc" onClick={calcFrete} disabled={!customer || cepBusy}>
                {cepBusy ? 'Buscando…' : 'Calcular frete'}
              </button>
              <a className="checkout__link checkout__cep-help" href="https://buscacepinter.correios.com.br/app/endereco/index.php" target="_blank" rel="noreferrer">não sei meu CEP</a>
            </div>
            {cepError && <p className="checkout__error">⚠️ {cepError}</p>}

            <div className="checkout__addr">
              <label className="checkout__field checkout__field--street">
                <span>Endereço</span>
                <input value={addr.street} onChange={(e) => set('street', e.target.value)} disabled={!customer} />
              </label>
              <label className="checkout__field checkout__field--num">
                <span>Número</span>
                <input value={addr.number} onChange={(e) => set('number', e.target.value)} disabled={!customer} />
              </label>
              <label className="checkout__field">
                <span>Complemento</span>
                <input value={addr.complement} onChange={(e) => set('complement', e.target.value)} disabled={!customer} />
              </label>
              <label className="checkout__field">
                <span>Bairro</span>
                <input value={addr.neighborhood} onChange={(e) => set('neighborhood', e.target.value)} disabled={!customer} />
              </label>
              <label className="checkout__field checkout__field--city">
                <span>Cidade</span>
                <input value={addr.city} onChange={(e) => set('city', e.target.value)} disabled={!customer} />
              </label>
              <label className="checkout__field checkout__field--uf">
                <span>UF</span>
                <input maxLength={2} value={addr.uf} onChange={(e) => set('uf', e.target.value.toUpperCase())} disabled={!customer} />
              </label>
              <label className="checkout__field checkout__field--street">
                <span>WhatsApp (para avisos do pedido)</span>
                <input
                  inputMode="tel"
                  placeholder="(11) 90000-0000"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={!customer}
                />
              </label>
            </div>

            {options && (
              <div className="checkout__ship">
                {options.map((o) => (
                  <label key={o.service} className={`checkout__ship-opt ${service === o.service ? 'is-active' : ''}`}>
                    <input type="radio" name="frete" checked={service === o.service} onChange={() => setService(o.service)} />
                    <span className="checkout__ship-name">{o.service}</span>
                    <span className="checkout__ship-days">{o.days} dias úteis</span>
                    <strong className="checkout__ship-price">{o.free ? 'Grátis' : BRL.format(o.price)}</strong>
                  </label>
                ))}
                <p className="checkout__ship-note">Peso estimado do pedido: {(weight / 1000).toFixed(2)} kg</p>
              </div>
            )}
          </section>

          {/* 3. Pagamento */}
          <section className={`checkout__card ${!customer ? 'checkout__card--disabled' : ''}`}>
            <h3><span className="checkout__step">3</span> Pagamento</h3>
            <div className="checkout__pay">
              {PAYMENTS.map((pm) => (
                <button
                  key={pm.id}
                  type="button"
                  className={`checkout__pay-opt ${payment === pm.id ? 'is-active' : ''}`}
                  onClick={() => setPayment(pm.id)}
                  disabled={!customer}
                >
                  <span aria-hidden="true">{pm.icon}</span>
                  <strong>{pm.label}</strong>
                  <small>{pm.note}</small>
                </button>
              ))}
            </div>
          </section>
        </div>

        {/* Resumo */}
        <aside className="checkout__summary">
          <h3>Resumo do pedido</h3>
          <ul className="checkout__items">
            {items.map((i) => (
              <li key={`${i.product.id}-${i.size ?? ''}`}>
                <div className="checkout__item-img" style={{ background: `${i.product.colors[0]}14` }}>
                  <ProductImage kind={i.product.kind} colors={i.product.colors} image={i.product.image} alt={i.product.name} />
                </div>
                <div className="checkout__item-info">
                  <span>{i.product.name}</span>
                  <small>{i.quantity}x {i.size ? `· ${i.size}` : ''}</small>
                </div>
                <strong>{BRL.format(i.product.price * i.quantity)}</strong>
              </li>
            ))}
          </ul>
          <dl className="checkout__totals">
            <div><dt>Subtotal</dt><dd>{BRL.format(subtotal)}</dd></div>
            <div>
              <dt>Frete {selected ? `(${selected.service})` : ''}</dt>
              <dd>{selected ? (selected.free ? 'Grátis' : BRL.format(shippingPrice)) : '—'}</dd>
            </div>
            <div className="checkout__grand"><dt>Total</dt><dd>{BRL.format(total)}</dd></div>
          </dl>
          {error && <p className="checkout__error" role="alert">⚠️ {error}</p>}
          <button
            className="btn btn--primary btn--block checkout__confirm"
            onClick={confirm}
            disabled={!customer || !selected || placing}
          >
            {placing ? 'Processando…' : 'Confirmar pedido'}
          </button>
          {!customer && <p className="checkout__hint">Entre na etapa 1 para continuar.</p>}
          {customer && !selected && <p className="checkout__hint">Calcule o frete na etapa 2.</p>}
        </aside>
      </div>
    </div>
  )
}

function CheckoutHeader({
  onExit, customerName, onLogout,
}: { onExit: () => void; customerName?: string; onLogout: () => void }) {
  return (
    <header className="checkout__top">
      <button className="checkout__back" onClick={onExit}>← Continuar comprando</button>
      <div className="checkout__brand">
        <span className="brand__mark" aria-hidden="true">M</span>
        <strong>Finalizar compra</strong>
      </div>
      {customerName ? (
        <div className="checkout__user">
          <span>👤 {customerName}</span>
          <button className="checkout__link" onClick={onLogout}>sair</button>
        </div>
      ) : <span />}
    </header>
  )
}
