import { useMemo, useState } from 'react'
import { FoodImage } from '../components/FoodImage'
import { Receipt, printReceipt } from '../components/Receipt'
import { money } from '../format'
import { productAvailability, productCost, useStore } from '../store'
import {
  CATEGORY_LABEL,
  CHANNEL_LABEL,
  PAYMENT_LABEL,
  SALE_PAYMENTS,
  type Order,
  type OrderChannel,
  type OrderItem,
  type PaymentMethod,
  type Product,
  type ProductCategory,
} from '../types'

const CATEGORIES: (ProductCategory | 'todos')[] = [
  'todos',
  'lanches',
  'porcoes',
  'bebidas',
  'sobremesas',
  'combos',
]

const CASH_SHORTCUTS = [5, 10, 20, 50, 100]

interface Props {
  operator: string
}

/**
 * Tela inicial do operador: vitrine com foto e preço de todos os itens de
 * venda, carrinho, forma de pagamento e finalização com impressão opcional.
 */
export function PdvScreen({ operator }: Props) {
  const { products, ingredients, placeOrder } = useStore()

  const [category, setCategory] = useState<ProductCategory | 'todos'>('todos')
  const [query, setQuery] = useState('')
  const [cart, setCart] = useState<OrderItem[]>([])
  const [channel, setChannel] = useState<OrderChannel>('balcao')
  const [customer, setCustomer] = useState('')
  const [table, setTable] = useState('')
  const [discount, setDiscount] = useState('')
  const [payment, setPayment] = useState<PaymentMethod>('dinheiro')
  const [cashReceived, setCashReceived] = useState('')
  const [error, setError] = useState('')
  const [placed, setPlaced] = useState<Order | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  const availability = useMemo(() => {
    const map = new Map<string, number | null>()
    for (const p of products) map.set(p.id, productAvailability(p, ingredients))
    return map
  }, [products, ingredients])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return products
      .filter((p) => p.active)
      .filter((p) => category === 'todos' || p.category === category)
      .filter(
        (p) =>
          q === '' ||
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q),
      )
      .sort((a, b) => {
        const av = availability.get(a.id)
        const bv = availability.get(b.id)
        const aOut = av != null && av <= 0 ? 1 : 0
        const bOut = bv != null && bv <= 0 ? 1 : 0
        return aOut - bOut || a.name.localeCompare(b.name, 'pt-BR')
      })
  }, [products, category, query, availability])

  const subtotal = cart.reduce((s, i) => s + i.unitPrice * i.qty, 0)
  const discountValue = Math.min(Math.max(0, parseNumber(discount)), subtotal)
  const total = Math.max(0, subtotal - discountValue)
  const received = parseNumber(cashReceived)
  const change = payment === 'dinheiro' ? Math.max(0, received - total) : 0
  const missingCash = payment === 'dinheiro' && cashReceived !== '' && received < total

  /** Quanto do produto ainda pode entrar no carrinho (estoque − já lançado). */
  function remaining(product: Product): number | null {
    const stock = availability.get(product.id)
    if (stock == null) return null
    const inCart = cart.find((i) => i.productId === product.id)?.qty ?? 0
    return stock - inCart
  }

  function addToCart(product: Product) {
    const left = remaining(product)
    if (left != null && left <= 0) {
      setError(`Sem estoque para "${product.name}". Registre uma compra de insumos.`)
      return
    }
    setError('')
    setCart((prev) => {
      const found = prev.find((i) => i.productId === product.id)
      if (found) {
        return prev.map((i) => (i.productId === product.id ? { ...i, qty: i.qty + 1 } : i))
      }
      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          qty: 1,
          unitPrice: product.price,
          unitCost: productCost(product, ingredients),
        },
      ]
    })
  }

  function changeQty(productId: string, delta: number) {
    const product = products.find((p) => p.id === productId)
    if (delta > 0 && product) {
      const left = remaining(product)
      if (left != null && left <= 0) {
        setError(`Sem estoque para "${product.name}".`)
        return
      }
    }
    setCart((prev) =>
      prev
        .map((i) => (i.productId === productId ? { ...i, qty: i.qty + delta } : i))
        .filter((i) => i.qty > 0),
    )
  }

  function setNotes(productId: string, notes: string) {
    setCart((prev) => prev.map((i) => (i.productId === productId ? { ...i, notes } : i)))
  }

  function clearCart() {
    setCart([])
    setDiscount('')
    setCashReceived('')
    setCustomer('')
    setTable('')
    setError('')
  }

  function finish() {
    if (cart.length === 0) {
      setError('Adicione pelo menos um item ao pedido.')
      return
    }
    if (channel === 'mesa' && !table.trim()) {
      setError('Informe o número da mesa.')
      return
    }
    if (payment === 'dinheiro' && cashReceived !== '' && received < total) {
      setError('O valor recebido é menor que o total do pedido.')
      return
    }
    const order = placeOrder({
      channel,
      customer,
      table,
      items: cart,
      discount: discountValue,
      payment,
      cashReceived: payment === 'dinheiro' && cashReceived !== '' ? received : undefined,
      operator,
    })
    setPlaced(order)
    setDialogOpen(true)
    clearCart()
  }

  return (
    <div className="lm-pdv">
      <section className="lm-pdv__catalog">
        <div className="lm-pdv__filters">
          <input
            className="lm-input lm-pdv__search"
            type="search"
            placeholder="Buscar item…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Buscar item"
          />
          <div className="lm-chips" role="tablist" aria-label="Categorias">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                role="tab"
                aria-selected={category === c}
                className={`lm-chip${category === c ? ' is-active' : ''}`}
                onClick={() => setCategory(c)}
              >
                {c === 'todos' ? 'Todos' : CATEGORY_LABEL[c]}
              </button>
            ))}
          </div>
        </div>

        <div className="lm-grid">
          {visible.map((p) => {
            const stock = availability.get(p.id) ?? null
            const soldOut = stock != null && stock <= 0
            return (
              <button
                key={p.id}
                type="button"
                className={`lm-card${soldOut ? ' is-out' : ''}`}
                onClick={() => addToCart(p)}
                disabled={soldOut}
                title={soldOut ? 'Sem estoque' : `Adicionar ${p.name}`}
              >
                <span className="lm-card__media">
                  <FoodImage kind={p.kind} image={p.image} alt={p.name} />
                  <span className={`lm-badge${soldOut ? ' is-out' : ''}`}>
                    {stock == null ? 'Sob demanda' : soldOut ? 'Esgotado' : `${stock} disp.`}
                  </span>
                </span>
                <span className="lm-card__body">
                  <span className="lm-card__name">{p.name}</span>
                  <span className="lm-card__desc">{p.description}</span>
                  <span className="lm-card__price">{money(p.price)}</span>
                </span>
              </button>
            )
          })}
          {visible.length === 0 && (
            <p className="lm-empty">Nenhum item encontrado para esse filtro.</p>
          )}
        </div>
      </section>

      <aside className="lm-pdv__cart">
        <header className="lm-cart__head">
          <h2>Pedido atual</h2>
          {cart.length > 0 && (
            <button type="button" className="lm-link" onClick={clearCart}>
              Limpar
            </button>
          )}
        </header>

        <div className="lm-cart__channel">
          {(Object.keys(CHANNEL_LABEL) as OrderChannel[]).map((c) => (
            <button
              key={c}
              type="button"
              className={`lm-chip${channel === c ? ' is-active' : ''}`}
              onClick={() => setChannel(c)}
            >
              {CHANNEL_LABEL[c]}
            </button>
          ))}
        </div>

        <div className="lm-cart__who">
          <input
            className="lm-input"
            placeholder="Nome do cliente (opcional)"
            value={customer}
            onChange={(e) => setCustomer(e.target.value)}
            aria-label="Nome do cliente"
          />
          {channel === 'mesa' && (
            <input
              className="lm-input lm-input--small"
              placeholder="Mesa"
              value={table}
              onChange={(e) => setTable(e.target.value)}
              aria-label="Número da mesa"
            />
          )}
        </div>

        <ul className="lm-cart__items">
          {cart.length === 0 && (
            <li className="lm-cart__empty">
              Toque nos itens da vitrine para montar o pedido.
            </li>
          )}
          {cart.map((item) => (
            <li key={item.productId} className="lm-cart__item">
              <div className="lm-cart__itemTop">
                <span className="lm-cart__itemName">{item.name}</span>
                <span className="lm-cart__itemTotal">{money(item.unitPrice * item.qty)}</span>
              </div>
              <div className="lm-cart__itemBottom">
                <div className="lm-stepper">
                  <button type="button" onClick={() => changeQty(item.productId, -1)} aria-label="Diminuir">
                    −
                  </button>
                  <span>{item.qty}</span>
                  <button type="button" onClick={() => changeQty(item.productId, 1)} aria-label="Aumentar">
                    +
                  </button>
                </div>
                <input
                  className="lm-input lm-input--ghost"
                  placeholder="Observação (ex.: sem cebola)"
                  value={item.notes ?? ''}
                  onChange={(e) => setNotes(item.productId, e.target.value)}
                  aria-label={`Observação para ${item.name}`}
                />
              </div>
            </li>
          ))}
        </ul>

        <div className="lm-cart__totals">
          <div>
            <span>Subtotal</span>
            <span>{money(subtotal)}</span>
          </div>
          <div>
            <label htmlFor="lm-desc">Desconto (R$)</label>
            <input
              id="lm-desc"
              className="lm-input lm-input--small"
              inputMode="decimal"
              value={discount}
              onChange={(e) => setDiscount(e.target.value)}
              placeholder="0,00"
            />
          </div>
          <div className="lm-cart__grand">
            <span>Total</span>
            <strong>{money(total)}</strong>
          </div>
        </div>

        <fieldset className="lm-cart__payment">
          <legend>Forma de pagamento</legend>
          <div className="lm-chips">
            {SALE_PAYMENTS.map((m) => (
              <button
                key={m}
                type="button"
                className={`lm-chip${payment === m ? ' is-active' : ''}`}
                onClick={() => setPayment(m)}
              >
                {PAYMENT_LABEL[m]}
              </button>
            ))}
          </div>
          {payment === 'dinheiro' && (
            <div className="lm-cash">
              <label htmlFor="lm-cash">Valor recebido</label>
              <input
                id="lm-cash"
                className="lm-input"
                inputMode="decimal"
                value={cashReceived}
                onChange={(e) => setCashReceived(e.target.value)}
                placeholder="0,00"
              />
              <div className="lm-chips">
                {CASH_SHORTCUTS.map((v) => (
                  <button
                    key={v}
                    type="button"
                    className="lm-chip"
                    onClick={() => setCashReceived(String((received || 0) + v))}
                  >
                    +{v}
                  </button>
                ))}
                <button type="button" className="lm-chip" onClick={() => setCashReceived(total.toFixed(2))}>
                  Valor exato
                </button>
              </div>
              <p className={`lm-change${missingCash ? ' is-bad' : ''}`}>
                {missingCash ? 'Valor insuficiente' : `Troco: ${money(change)}`}
              </p>
            </div>
          )}
        </fieldset>

        {error && <p className="lm-alert">{error}</p>}

        <button type="button" className="lm-btn lm-btn--primary lm-btn--block" onClick={finish}>
          Finalizar pedido · {money(total)}
        </button>
      </aside>

      {placed && dialogOpen && (
        <FinishDialog
          order={placed}
          onClose={() => {
            setDialogOpen(false)
            setPlaced(null)
          }}
          onPrint={() => {
            // O comprovante precisa continuar montado enquanto o diálogo de
            // impressão do navegador estiver aberto.
            setDialogOpen(false)
            printReceipt()
          }}
        />
      )}
      {placed && <Receipt order={placed} />}
    </div>
  )
}

/** Confirmação da venda com a pergunta de impressão. */
function FinishDialog({
  order,
  onClose,
  onPrint,
}: {
  order: Order
  onClose: () => void
  onPrint: () => void
}) {
  return (
    <div className="lm-modal" role="dialog" aria-modal="true" aria-label="Pedido finalizado">
      <div className="lm-modal__box lm-modal__box--narrow">
        <span className="lm-modal__check" aria-hidden="true">
          ✓
        </span>
        <h2>Pedido #{String(order.number).padStart(4, '0')} registrado</h2>
        <p>
          Total de <strong>{money(order.total)}</strong> em {PAYMENT_LABEL[order.payment]}
          {order.payment === 'dinheiro' && order.change != null
            ? ` · troco de ${money(order.change)}`
            : ''}
          .
        </p>
        <p className="lm-modal__muted">
          O pedido entrou na <strong>fila de espera</strong> da cozinha. Dê baixa quando for
          entregue.
        </p>
        <p className="lm-modal__question">Deseja imprimir o pedido?</p>
        <div className="lm-modal__actions">
          <button type="button" className="lm-btn lm-btn--ghost" onClick={onClose}>
            Não, obrigado
          </button>
          <button
            type="button"
            className="lm-btn lm-btn--primary"
            onClick={onPrint}
          >
            Imprimir pedido
          </button>
        </div>
      </div>
    </div>
  )
}

/** Aceita "12,50" e "12.50". */
export function parseNumber(v: string): number {
  const n = Number(String(v).replace(/\s/g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}
