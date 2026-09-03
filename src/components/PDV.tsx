import { useEffect, useMemo, useState } from 'react'
import { BRL } from '../data/products'
import type { CategoryId, Product } from '../types'
import { ProductImage } from './ProductImage'
import { useCatalog } from '../context/CatalogContext'
import { createSale, notifySale } from '../services/sales'
import { availableFor, hasVariants } from '../services/variants'
import type { Operator } from '../services/auth'

interface Props {
  onExit: () => void
  operator: Operator
  onLogout: () => void
}

interface SaleLine {
  product: Product
  quantity: number
  /** Variação escolhida (quando o produto tem variações). */
  size?: string
}

const lineKey = (l: { product: Product; size?: string }) => `${l.product.id}__${l.size ?? ''}`

type Payment = 'dinheiro' | 'pix' | 'credito' | 'debito' | 'fiado'

const PAYMENTS: { id: Payment; label: string; icon: string }[] = [
  { id: 'dinheiro', label: 'Dinheiro', icon: '💵' },
  { id: 'pix', label: 'Pix', icon: '⚡' },
  { id: 'credito', label: 'Crédito', icon: '💳' },
  { id: 'debito', label: 'Débito', icon: '🏧' },
  { id: 'fiado', label: 'Fiado', icon: '🤝' },
]

interface Receipt {
  number: number
  when: string
  lines: SaleLine[]
  subtotal: number
  discount: number
  total: number
  payment: Payment
  received: number
  change: number
  installments: number
  pending?: boolean
  customerName?: string
  customerPhone?: string
}

export function PDV({ onExit, operator, onLogout }: Props) {
  const { products, categories, decrementStockLocal } = useCatalog()
  const [lines, setLines] = useState<SaleLine[]>([])
  const [query, setQuery] = useState('')
  const [cat, setCat] = useState<CategoryId | 'todos'>('todos')
  const [discountInput, setDiscountInput] = useState('')
  const [payment, setPayment] = useState<Payment>('dinheiro')
  const [receivedInput, setReceivedInput] = useState('')
  const [installments, setInstallments] = useState(1)
  const [fiadoName, setFiadoName] = useState('')
  const [fiadoPhone, setFiadoPhone] = useState('')
  const [clock, setClock] = useState(() => new Date())
  const [receipt, setReceipt] = useState<Receipt | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [pick, setPick] = useState<Product | null>(null)

  useEffect(() => {
    const t = window.setInterval(() => setClock(new Date()), 1000)
    return () => window.clearInterval(t)
  }, [])

  const catalog = useMemo(() => {
    const q = query.trim().toLowerCase()
    return products.filter((p) => {
      const okCat = cat === 'todos' || p.category === cat
      const okText =
        q === '' ||
        p.name.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q)
      return okCat && okText
    })
  }, [products, query, cat])

  const subtotal = useMemo(
    () => lines.reduce((s, l) => s + l.product.price * l.quantity, 0),
    [lines],
  )
  const itemCount = lines.reduce((s, l) => s + l.quantity, 0)

  const manualDiscount = Math.max(0, Number(discountInput.replace(',', '.')) || 0)
  const discount = Math.min(subtotal, manualDiscount)
  const total = Math.max(0, subtotal - discount)

  const received = Number(receivedInput.replace(',', '.')) || 0
  // Dinheiro: se o valor recebido não for informado, assume pagamento exato
  // (troco 0). Só calcula troco quando o operador digita quanto recebeu.
  const change = payment === 'dinheiro' && received > 0 ? received - total : 0
  const isFiado = payment === 'fiado'
  // Fiado exige apenas o nome; telefone é opcional.
  const fiadoOk = !isFiado || fiadoName.trim().length > 1
  const canFinish =
    lines.length > 0 &&
    (payment !== 'dinheiro' || received === 0 || received >= total) &&
    fiadoOk

  function addProduct(p: Product) {
    if (p.stock != null && p.stock <= 0) return
    // Produto com variações: escolher qual antes de adicionar.
    if (hasVariants(p)) {
      setPick(p)
      return
    }
    addLine(p, undefined)
  }

  function addLine(p: Product, size?: string) {
    const avail = availableFor(p, size)
    if (avail <= 0) return
    setLines((prev) => {
      const key = lineKey({ product: p, size })
      const found = prev.find((l) => lineKey(l) === key)
      if (found) {
        return prev.map((l) =>
          lineKey(l) === key ? { ...l, quantity: Math.min(avail, l.quantity + 1) } : l,
        )
      }
      return [...prev, { product: p, quantity: 1, size }]
    })
    setPick(null)
  }

  function setQty(key: string, qty: number) {
    setLines((prev) =>
      prev
        .map((l) => {
          if (lineKey(l) !== key) return l
          const max = availableFor(l.product, l.size)
          const capped = l.product.stock != null ? Math.min(qty, max) : qty
          return { ...l, quantity: Math.max(0, capped) }
        })
        .filter((l) => l.quantity > 0),
    )
  }

  function resetSale() {
    setLines([])
    setDiscountInput('')
    setReceivedInput('')
    setInstallments(1)
    setPayment('dinheiro')
    setFiadoName('')
    setFiadoPhone('')
  }

  async function finishSale() {
    if (!canFinish || saving) return
    setSaving(true)
    setSaveError(null)

    const { number, id, error } = await createSale({
      operator,
      subtotal,
      discount,
      total,
      payment,
      received: payment === 'dinheiro' ? (received > 0 ? received : total) : 0,
      change: payment === 'dinheiro' ? Math.max(0, change) : 0,
      installments: payment === 'credito' ? installments : 1,
      // Fiado: venda fica pendente de recebimento, com nome/telefone do comprador.
      status: isFiado ? 'pending' : 'paid',
      customerName: isFiado ? fiadoName.trim() : undefined,
      customerPhone: isFiado ? fiadoPhone.trim() : undefined,
      items: lines.map((l) => ({
        productId: l.product.id,
        name: l.product.name,
        unitPrice: l.product.price,
        unitCost: l.product.cost ?? 0,
        quantity: l.quantity,
        size: l.size,
      })),
    })

    setSaving(false)

    if (error) {
      setSaveError(error)
      return
    }

    // Avisa a loja pelo WhatsApp (best-effort, não bloqueia o caixa).
    notifySale(id)

    decrementStockLocal(
      lines.map((l) => ({ id: l.product.id, quantity: l.quantity, size: l.size })),
    )

    setReceipt({
      number: number ?? 0,
      when: new Date().toLocaleString('pt-BR'),
      lines,
      subtotal,
      discount,
      total,
      payment,
      received,
      change: Math.max(0, change),
      installments,
      pending: isFiado,
      customerName: isFiado ? fiadoName.trim() : undefined,
      customerPhone: isFiado ? fiadoPhone.trim() : undefined,
    })
    resetSale()
  }

  return (
    <div className="pdv">
      <header className="pdv__top">
        <div className="pdv__brand">
          <span className="brand__mark" aria-hidden="true">M</span>
          <div>
            <strong>MARTINICA · PDV</strong>
            <small>Ponto de Venda — Caixa 01</small>
          </div>
        </div>
        <div className="pdv__operator" title="Operador conectado">
          <span aria-hidden="true">👤</span>
          <div>
            <small>Operador</small>
            <strong>{operator.name}</strong>
          </div>
        </div>
        <div className="pdv__clock">
          <span>{clock.toLocaleDateString('pt-BR')}</span>
          <strong>{clock.toLocaleTimeString('pt-BR')}</strong>
        </div>
        <button className="pdv__exit" onClick={onExit}>
          ← Voltar à loja
        </button>
        <button className="pdv__logout" onClick={onLogout} title="Encerrar sessão do operador">
          ⎋ Sair
        </button>
      </header>

      <div className="pdv__body">
        {/* --- Catálogo / seleção de itens --- */}
        <section className="pdv__catalog">
          <div className="pdv__search">
            <input
              type="search"
              autoFocus
              placeholder="Buscar produto por nome ou código…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Buscar produto"
            />
          </div>
          <div className="pdv__cats">
            <button
              className={`chip ${cat === 'todos' ? 'chip--active' : ''}`}
              onClick={() => setCat('todos')}
            >
              Todos
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                className={`chip ${cat === c.id ? 'chip--active' : ''}`}
                onClick={() => setCat(c.id)}
              >
                {c.label}
              </button>
            ))}
          </div>

          <div className="pdv__products">
            {catalog.map((p) => {
              const soldOut = p.stock != null && p.stock <= 0
              const low = p.stock != null && p.stock > 0 && p.stock <= 5
              return (
                <button
                  key={p.id}
                  className={`pdv__product ${soldOut ? 'pdv__product--out' : ''}`}
                  onClick={() => addProduct(p)}
                  disabled={soldOut}
                >
                  <span
                    className="pdv__product-img"
                    style={{ background: `${p.colors[0]}18` }}
                  >
                    <ProductImage kind={p.kind} colors={p.colors} image={p.image} alt={p.name} />
                  </span>
                  <span className="pdv__product-name">{p.name}</span>
                  <span className="pdv__product-price">{BRL.format(p.price)}</span>
                  {p.stock != null && (
                    <span
                      className={`pdv__product-stock ${soldOut ? 'is-out' : low ? 'is-low' : ''}`}
                    >
                      {soldOut ? 'Esgotado' : `${p.stock} em estoque`}
                    </span>
                  )}
                  <span className="pdv__product-add">
                    {soldOut ? 'Indisponível' : '+ Adicionar'}
                  </span>
                </button>
              )
            })}
            {catalog.length === 0 && (
              <p className="pdv__noresult">Nenhum produto encontrado.</p>
            )}
          </div>
        </section>

        {/* --- Cupom da venda atual --- */}
        <aside className="pdv__sale">
          <div className="pdv__sale-head">
            <h2>Venda atual</h2>
            <span>{itemCount} {itemCount === 1 ? 'item' : 'itens'}</span>
          </div>

          <div className="pdv__lines">
            {lines.length === 0 ? (
              <div className="pdv__lines-empty">
                <span>🧾</span>
                <p>Nenhum item. Selecione produtos ao lado para iniciar a venda.</p>
              </div>
            ) : (
              lines.map((l) => (
                <div key={lineKey(l)} className="pdv__line">
                  <div className="pdv__line-info">
                    <strong>{l.product.name}{l.size ? ` · ${l.size}` : ''}</strong>
                    <span>{BRL.format(l.product.price)} / un</span>
                  </div>
                  <div className="pdv__line-qty">
                    <button onClick={() => setQty(lineKey(l), l.quantity - 1)} aria-label="Menos">
                      −
                    </button>
                    <span>{l.quantity}</span>
                    <button onClick={() => setQty(lineKey(l), l.quantity + 1)} aria-label="Mais">
                      +
                    </button>
                  </div>
                  <strong className="pdv__line-total">
                    {BRL.format(l.product.price * l.quantity)}
                  </strong>
                  <button
                    className="pdv__line-del"
                    onClick={() => setQty(lineKey(l), 0)}
                    aria-label={`Remover ${l.product.name}`}
                  >
                    ✕
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="pdv__pay">
            <div className="pdv__discount">
              <label htmlFor="pdv-desc">Desconto (R$)</label>
              <input
                id="pdv-desc"
                inputMode="decimal"
                placeholder="0,00"
                value={discountInput}
                onChange={(e) => setDiscountInput(e.target.value)}
              />
            </div>

            <div className="pdv__methods" role="group" aria-label="Forma de pagamento">
              {PAYMENTS.map((m) => (
                <button
                  key={m.id}
                  className={`pdv__method ${payment === m.id ? 'pdv__method--active' : ''}`}
                  onClick={() => setPayment(m.id)}
                >
                  <span aria-hidden="true">{m.icon}</span>
                  {m.label}
                </button>
              ))}
            </div>

            {payment === 'dinheiro' && (
              <div className="pdv__cash">
                <label htmlFor="pdv-rec">Valor recebido (R$) <small style={{ color: 'var(--muted)', fontWeight: 400 }}>— opcional (em branco = valor exato)</small></label>
                <input
                  id="pdv-rec"
                  inputMode="decimal"
                  placeholder="em branco = valor exato"
                  value={receivedInput}
                  onChange={(e) => setReceivedInput(e.target.value)}
                />
                <div className="pdv__quickcash">
                  {[50, 100, 200].map((v) => (
                    <button key={v} onClick={() => setReceivedInput(String(v))}>
                      {BRL.format(v)}
                    </button>
                  ))}
                  <button onClick={() => setReceivedInput(total.toFixed(2))}>Exato</button>
                </div>
              </div>
            )}

            {payment === 'credito' && (
              <div className="pdv__cash">
                <label htmlFor="pdv-parc">Parcelas</label>
                <select
                  id="pdv-parc"
                  value={installments}
                  onChange={(e) => setInstallments(Number(e.target.value))}
                >
                  {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>
                      {n}x de {BRL.format(total / n)} sem juros
                    </option>
                  ))}
                </select>
              </div>
            )}

            {payment === 'fiado' && (
              <div className="pdv__fiado">
                <p className="pdv__fiado-note">🤝 Venda no <strong>fiado</strong> — ficará <strong>pendente de recebimento</strong>. Informe o comprador:</p>
                <label htmlFor="pdv-fiado-nome">Nome do comprador</label>
                <input
                  id="pdv-fiado-nome"
                  type="text"
                  placeholder="Nome completo"
                  value={fiadoName}
                  onChange={(e) => setFiadoName(e.target.value)}
                />
                <label htmlFor="pdv-fiado-tel">Telefone / WhatsApp (opcional)</label>
                <input
                  id="pdv-fiado-tel"
                  inputMode="tel"
                  placeholder="(11) 90000-0000"
                  value={fiadoPhone}
                  onChange={(e) => setFiadoPhone(e.target.value)}
                />
                {!fiadoOk && <p className="pdv__fiado-req">Informe o nome do comprador para registrar o fiado.</p>}
              </div>
            )}


            <dl className="pdv__totals">
              <div>
                <dt>Subtotal</dt>
                <dd>{BRL.format(subtotal)}</dd>
              </div>
              {discount > 0 && (
                <div className="pdv__totals-disc">
                  <dt>Desconto</dt>
                  <dd>− {BRL.format(discount)}</dd>
                </div>
              )}
              <div className="pdv__totals-grand">
                <dt>Total</dt>
                <dd>{BRL.format(total)}</dd>
              </div>
              {payment === 'dinheiro' && received > 0 && (
                <div className="pdv__totals-change">
                  <dt>Troco</dt>
                  <dd>{BRL.format(Math.max(0, change))}</dd>
                </div>
              )}
            </dl>

            {saveError && (
              <p className="pdv__saveerror" role="alert">
                ⚠️ {saveError}
              </p>
            )}
            <button
              className="btn btn--primary btn--block pdv__finish"
              disabled={!canFinish || saving}
              onClick={finishSale}
            >
              {saving ? 'Registrando…' : `${isFiado ? 'Registrar fiado' : 'Finalizar venda'} · ${BRL.format(total)}`}
            </button>
            {lines.length > 0 && !saving && (
              <button className="pdv__cancel" onClick={resetSale}>
                Cancelar venda
              </button>
            )}
          </div>
        </aside>
      </div>

      {/* --- Comprovante --- */}
      {receipt && (
        <div className="pdv__receipt-overlay" onClick={() => setReceipt(null)}>
          <div className="pdv__receipt" onClick={(e) => e.stopPropagation()}>
            <div className="pdv__receipt-head">
              <span className="brand__mark" aria-hidden="true">M</span>
              <strong>MARTINICA STORE</strong>
              <small>Comprovante não fiscal</small>
            </div>
            <div className="pdv__receipt-meta">
              <span>Venda nº {String(receipt.number).padStart(6, '0')}</span>
              <span>{receipt.when}</span>
            </div>
            <ul className="pdv__receipt-lines">
              {receipt.lines.map((l) => (
                <li key={lineKey(l)}>
                  <span>{l.quantity}x {l.product.name}{l.size ? ` · ${l.size}` : ''}</span>
                  <span>{BRL.format(l.product.price * l.quantity)}</span>
                </li>
              ))}
            </ul>
            <div className="pdv__receipt-tot">
              <span>Subtotal</span>
              <span>{BRL.format(receipt.subtotal)}</span>
            </div>
            {receipt.discount > 0 && (
              <div className="pdv__receipt-tot">
                <span>Desconto</span>
                <span>− {BRL.format(receipt.discount)}</span>
              </div>
            )}
            <div className="pdv__receipt-tot pdv__receipt-grand">
              <span>Total</span>
              <span>{BRL.format(receipt.total)}</span>
            </div>
            <div className="pdv__receipt-pay">
              <span>
                Pagamento:{' '}
                {receipt.payment === 'dinheiro'
                  ? 'Dinheiro'
                  : receipt.payment === 'pix'
                    ? 'Pix'
                    : receipt.payment === 'debito'
                      ? 'Cartão de débito'
                      : receipt.payment === 'fiado'
                        ? 'Fiado'
                        : `Cartão de crédito ${receipt.installments}x`}
              </span>
              {receipt.payment === 'dinheiro' && (
                <>
                  <span>Recebido: {BRL.format(receipt.received)}</span>
                  <span>Troco: {BRL.format(receipt.change)}</span>
                </>
              )}
            </div>
            {receipt.pending && (
              <div className="pdv__receipt-pending">
                <strong>⚠️ PENDENTE DE RECEBIMENTO (FIADO)</strong>
                <span>Comprador: {receipt.customerName}</span>
                <span>Telefone: {receipt.customerPhone}</span>
              </div>
            )}
            <p className="pdv__receipt-thanks">Obrigado e volte sempre! 🧡</p>
            <div className="pdv__receipt-actions">
              <button className="btn btn--ghost" onClick={() => window.print()}>
                Imprimir
              </button>
              <button className="btn btn--primary" onClick={() => setReceipt(null)}>
                Nova venda
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- Escolha da variação (produtos com estoque por variação) --- */}
      {pick && (
        <div className="pdv__receipt-overlay" onClick={() => setPick(null)}>
          <div className="pdv__pickvar" onClick={(e) => e.stopPropagation()}>
            <h3>{pick.name}</h3>
            <p>Escolha a variação:</p>
            <div className="pdv__pickvar-grid">
              {pick.variants!.map((v) => {
                const out = v.stock <= 0
                return (
                  <button
                    key={v.label}
                    className="pdv__pickvar-opt"
                    onClick={() => addLine(pick, v.label)}
                    disabled={out}
                  >
                    <strong>{v.label}</strong>
                    <small>{out ? 'Esgotado' : `${v.stock} un`}</small>
                  </button>
                )
              })}
            </div>
            <button className="btn btn--ghost" onClick={() => setPick(null)}>Cancelar</button>
          </div>
        </div>
      )}
    </div>
  )
}
