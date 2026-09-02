import { useEffect, useMemo, useState } from 'react'
import { BRL } from '../data/products'
import type { Product, ProductVariant, Supplier } from '../types'
import { useCatalog } from '../context/CatalogContext'
import {
  createPurchase,
  listPurchases,
  markPurchasePaid,
  receivePurchase,
  type PurchaseSummary,
} from '../services/purchase'
import { hasVariants } from '../services/variants'
import { listSuppliers } from '../services/suppliers'
import { buildPurchaseText, waLink } from '../services/whatsapp'
import { SuppliersModal } from './SuppliersModal'

interface Props {
  operatorEmail?: string
}

interface Line {
  product: Product
  quantity: number
  unitCost: number
  size?: string
}

const PAYMENTS = ['Pix', 'Dinheiro', 'Cartão', 'Boleto', 'Transferência']

function when(iso: string) {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('pt-BR')
}
const lineKey = (l: { product: Product; size?: string }) => `${l.product.id}__${l.size ?? ''}`

export function Purchases({ operatorEmail }: Props) {
  const { products, upsertLocal } = useCatalog()
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [supplierId, setSupplierId] = useState('')
  const [showSuppliers, setShowSuppliers] = useState(false)
  const [query, setQuery] = useState('')
  const [lines, setLines] = useState<Line[]>([])
  const [payment, setPayment] = useState('Pix')
  const [paid, setPaid] = useState(true)
  const [pick, setPick] = useState<Product | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [history, setHistory] = useState<PurchaseSummary[]>([])

  function loadHistory() {
    listPurchases().then(setHistory).catch(() => {})
  }
  useEffect(() => loadHistory(), [])
  useEffect(() => { listSuppliers().then(setSuppliers).catch(() => {}) }, [])

  const supplier = suppliers.find((s) => s.id === supplierId) ?? null

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return products
      .filter((p) => p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q))
      .slice(0, 6)
  }, [query, products])

  const total = lines.reduce((s, l) => s + l.unitCost * l.quantity, 0)

  function addProduct(p: Product) {
    setQuery('')
    setSuccess(null)
    if (hasVariants(p)) { setPick(p); return }
    addLine(p, undefined)
  }
  function addLine(p: Product, size?: string) {
    setLines((prev) => {
      const key = lineKey({ product: p, size })
      const found = prev.find((l) => lineKey(l) === key)
      if (found) return prev.map((l) => (lineKey(l) === key ? { ...l, quantity: l.quantity + 1 } : l))
      return [...prev, { product: p, quantity: 1, unitCost: p.cost ?? 0, size }]
    })
    setPick(null)
  }
  function patchLine(key: string, patch: Partial<Line>) {
    setLines((prev) => prev.map((l) => (lineKey(l) === key ? { ...l, ...patch } : l)))
  }
  function removeLine(key: string) {
    setLines((prev) => prev.filter((l) => lineKey(l) !== key))
  }

  async function register() {
    if (saving || lines.length === 0) return
    if (!confirm(`Registrar esta compra (${BRL.format(total)})?`)) return
    setSaving(true)
    setError(null)
    setSuccess(null)

    const { number, error: err } = await createPurchase({
      supplier: supplier?.name,
      supplierId: supplier?.id,
      supplierPhone: supplier?.phone,
      operatorEmail,
      paymentMethod: payment,
      paid,
      items: lines.map((l) => ({
        productId: l.product.id, name: l.product.name, quantity: l.quantity, unitCost: l.unitCost, size: l.size,
      })),
    })
    setSaving(false)
    if (err) { setError(err); return }

    setSuccess(
      `Compra registrada${number ? ` (nº ${String(number).padStart(6, '0')})` : ''} — `
        + `${paid ? 'paga' : 'a pagar'}. O estoque será somado quando você marcar como ENTREGUE.`,
    )
    setLines([])
    loadHistory()
  }

  /** Soma o estoque local (por variação) ao dar entrada em uma compra. */
  function addStockLocal(items: PurchaseSummary['items']) {
    const byProduct = new Map<string, PurchaseSummary['items']>()
    for (const i of items) {
      const arr = byProduct.get(i.productId) ?? []
      arr.push(i)
      byProduct.set(i.productId, arr)
    }
    for (const [pid, its] of byProduct) {
      const p = products.find((x) => x.id === pid)
      if (!p) continue
      if (p.variants && p.variants.length) {
        const variants: ProductVariant[] = p.variants.map((v) => {
          const add = its.filter((i) => i.size === v.label).reduce((s, i) => s + i.quantity, 0)
          return add ? { ...v, stock: v.stock + add } : v
        })
        upsertLocal({ ...p, variants, stock: variants.reduce((s, v) => s + Math.max(0, v.stock), 0) })
      } else {
        const add = its.reduce((s, i) => s + i.quantity, 0)
        upsertLocal({ ...p, stock: (p.stock ?? 0) + add })
      }
    }
  }

  async function deliver(h: PurchaseSummary) {
    if (h.status === 'entregue' || busyId) return
    if (!confirm(`Dar entrada no estoque da compra nº ${String(h.number).padStart(6, '0')}? (marca como entregue)`)) return
    setBusyId(h.id)
    const { error: err } = await receivePurchase(h)
    setBusyId(null)
    if (err) { setError(err); return }
    addStockLocal(h.items)
    setHistory((prev) => prev.map((x) => (x.id === h.id ? { ...x, status: 'entregue' } : x)))
    setSuccess(`Entrada dada na compra nº ${String(h.number).padStart(6, '0')} — estoque atualizado.`)
  }

  async function pay(h: PurchaseSummary) {
    if (h.paid || busyId) return
    if (!confirm(`Marcar a compra nº ${String(h.number).padStart(6, '0')} como PAGA?`)) return
    setBusyId(h.id)
    const { error: err } = await markPurchasePaid(h)
    setBusyId(null)
    if (err) { setError(err); return }
    setHistory((prev) => prev.map((x) => (x.id === h.id ? { ...x, paid: true } : x)))
    setSuccess(`Compra nº ${String(h.number).padStart(6, '0')} marcada como paga.`)
  }

  function sendWhatsApp() {
    const text = buildPurchaseText(
      supplier,
      lines.map((l) => ({ name: `${l.product.name}${l.size ? ` (${l.size})` : ''}`, quantity: l.quantity, unitCost: l.unitCost })),
    )
    const link = waLink(supplier?.phone, text)
    if (!link) { setError('Selecione um fornecedor com WhatsApp cadastrado.'); return }
    window.open(link, '_blank', 'noopener')
  }

  return (
    <div className="purch">
      <section className="purch__new admin__tablewrap" style={{ padding: '1.1rem 1.2rem' }}>
        <h3 className="purch__title">Novo pedido de compra</h3>

        <div className="purch__top">
          <label className="checkout__field">
            <span>Fornecedor</span>
            <div className="purch__supplier">
              <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
                <option value="">— selecione —</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}{s.phone ? ` (📱)` : ''}</option>
                ))}
              </select>
              <button type="button" className="btn btn--ghost purch__manage" onClick={() => setShowSuppliers(true)}>
                Gerenciar
              </button>
            </div>
          </label>
          <label className="checkout__field purch__search">
            <span>Adicionar produto</span>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por nome ou código…" />
            {results.length > 0 && (
              <div className="purch__results">
                {results.map((p) => (
                  <button key={p.id} type="button" className="purch__result" onClick={() => addProduct(p)}>
                    <span>{p.name}{hasVariants(p) ? ' · variações' : ''}</span>
                    <small>estoque atual: {p.stock ?? 0}</small>
                  </button>
                ))}
              </div>
            )}
          </label>
        </div>

        <div className="purch__pay">
          <label className="checkout__field">
            <span>Forma de pagamento</span>
            <select value={payment} onChange={(e) => setPayment(e.target.value)}>
              {PAYMENTS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </label>
          <label className="purch__paid">
            <input type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} />
            Pago à vista (senão fica em <strong>contas a pagar</strong>)
          </label>
        </div>

        {lines.length === 0 ? (
          <p className="purch__empty">Busque um produto acima para adicionar ao pedido.</p>
        ) : (
          <div className="admin__tablewrap" style={{ border: 'none' }}>
            <table className="admin__table">
              <thead>
                <tr>
                  <th>Produto</th>
                  <th>Qtd.</th>
                  <th>Custo unit.</th>
                  <th>Subtotal</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => {
                  const k = lineKey(l)
                  return (
                    <tr key={k}>
                      <td><strong>{l.product.name}{l.size ? ` · ${l.size}` : ''}</strong><br /><small style={{ color: 'var(--muted)' }}>{l.product.id}</small></td>
                      <td>
                        <div className="admin__stock">
                          <button onClick={() => patchLine(k, { quantity: Math.max(1, l.quantity - 1) })}>−</button>
                          <input inputMode="numeric" value={l.quantity} onChange={(e) => patchLine(k, { quantity: Math.max(1, Math.round(Number(e.target.value) || 1)) })} />
                          <button onClick={() => patchLine(k, { quantity: l.quantity + 1 })}>+</button>
                        </div>
                      </td>
                      <td>
                        <div className="admin__price">
                          <span>R$</span>
                          <input inputMode="decimal" value={l.unitCost} onChange={(e) => patchLine(k, { unitCost: Math.max(0, Number(String(e.target.value).replace(',', '.')) || 0) })} />
                        </div>
                      </td>
                      <td><strong>{BRL.format(l.unitCost * l.quantity)}</strong></td>
                      <td><button className="admin__del" onClick={() => removeLine(k)} aria-label="Remover">🗑</button></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {error && <p className="pdvlogin__error" style={{ marginTop: '0.8rem' }}>⚠️ {error}</p>}
        {success && <p className="custauth__info" style={{ marginTop: '0.8rem' }}>✅ {success}</p>}

        <div className="purch__foot">
          <div className="purch__total">
            <span>Total da compra</span>
            <strong>{BRL.format(total)}</strong>
          </div>
          <button
            className="btn btn--wa purch__wa"
            disabled={lines.length === 0 || !supplier?.phone}
            onClick={sendWhatsApp}
            title={supplier?.phone ? 'Enviar pedido ao fornecedor pelo WhatsApp' : 'Selecione um fornecedor com WhatsApp'}
          >
            <span aria-hidden="true">💬</span> Enviar pedido (WhatsApp)
          </button>
          <button className="btn btn--primary purch__register" disabled={saving || lines.length === 0} onClick={register}>
            {saving ? 'Registrando…' : '🧾 Registrar pedido de compra'}
          </button>
        </div>
        <p className="purch__hint">O estoque só é somado quando você marca a compra como <strong>Entregue</strong> abaixo.</p>
      </section>

      {showSuppliers && (
        <SuppliersModal onClose={() => setShowSuppliers(false)} onChange={setSuppliers} />
      )}

      {pick && (
        <div className="pdv__receipt-overlay" onClick={() => setPick(null)}>
          <div className="pdv__pickvar" onClick={(e) => e.stopPropagation()}>
            <h3>{pick.name}</h3>
            <p>Comprar qual variação?</p>
            <div className="pdv__pickvar-grid">
              {pick.variants!.map((v) => (
                <button key={v.label} className="pdv__pickvar-opt" onClick={() => addLine(pick, v.label)}>
                  <strong>{v.label}</strong>
                  <small>{v.stock} em estoque</small>
                </button>
              ))}
            </div>
            <button className="btn btn--ghost" onClick={() => setPick(null)}>Cancelar</button>
          </div>
        </div>
      )}

      <section className="purch__history">
        <h3 className="purch__title">Compras</h3>
        {history.length === 0 ? (
          <p className="purch__empty">Nenhuma compra registrada ainda.</p>
        ) : (
          <ul className="purch__hist-list">
            {history.map((h) => (
              <li key={h.id} className="purch__hist">
                <div className="purch__hist-main">
                  <strong>nº {String(h.number).padStart(6, '0')}</strong>
                  <small>{when(h.when)} · {h.supplier || 'sem fornecedor'} · {h.items.reduce((s, i) => s + i.quantity, 0)} un. · {h.paymentMethod || '—'}</small>
                  <div className="purch__badges">
                    <span className={`purch__badge ${h.status === 'entregue' ? 'is-ok' : 'is-wait'}`}>
                      {h.status === 'entregue' ? '✓ Entregue' : '⏳ Pendente de entrega'}
                    </span>
                    <span className={`purch__badge ${h.paid ? 'is-ok' : 'is-danger'}`}>
                      {h.paid ? '✓ Paga' : '💰 A pagar'}
                    </span>
                  </div>
                </div>
                <div className="purch__hist-side">
                  <strong className="purch__hist-total">{BRL.format(h.total)}</strong>
                  <div className="purch__hist-actions">
                    {h.status !== 'entregue' && (
                      <button className="btn btn--primary" disabled={busyId === h.id} onClick={() => deliver(h)}>↧ Entregue</button>
                    )}
                    {!h.paid && (
                      <button className="btn btn--ghost" disabled={busyId === h.id} onClick={() => pay(h)}>Marcar pago</button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
