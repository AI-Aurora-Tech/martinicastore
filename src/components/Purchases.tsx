import { useEffect, useMemo, useState } from 'react'
import { BRL } from '../data/products'
import type { Product } from '../types'
import { useCatalog } from '../context/CatalogContext'
import {
  createPurchase,
  listPurchases,
  type PurchaseSummary,
} from '../services/purchase'

interface Props {
  operatorEmail?: string
}

interface Line {
  product: Product
  quantity: number
  unitCost: number
}

function when(iso: string) {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('pt-BR')
}

export function Purchases({ operatorEmail }: Props) {
  const { products, upsertLocal } = useCatalog()
  const [supplier, setSupplier] = useState('')
  const [query, setQuery] = useState('')
  const [lines, setLines] = useState<Line[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [history, setHistory] = useState<PurchaseSummary[]>([])

  function loadHistory() {
    listPurchases().then(setHistory).catch(() => {})
  }
  useEffect(() => loadHistory(), [])

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    const chosen = new Set(lines.map((l) => l.product.id))
    return products
      .filter(
        (p) =>
          !chosen.has(p.id) &&
          (p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q)),
      )
      .slice(0, 6)
  }, [query, products, lines])

  const total = lines.reduce((s, l) => s + l.unitCost * l.quantity, 0)
  const totalUnits = lines.reduce((s, l) => s + l.quantity, 0)

  function addProduct(p: Product) {
    setLines((prev) => [...prev, { product: p, quantity: 1, unitCost: p.cost ?? 0 }])
    setQuery('')
    setSuccess(null)
  }
  function patchLine(id: string, patch: Partial<Line>) {
    setLines((prev) => prev.map((l) => (l.product.id === id ? { ...l, ...patch } : l)))
  }
  function removeLine(id: string) {
    setLines((prev) => prev.filter((l) => l.product.id !== id))
  }

  async function register() {
    if (saving || lines.length === 0) return
    setSaving(true)
    setError(null)
    setSuccess(null)

    const { number, error: err } = await createPurchase({
      supplier: supplier.trim() || undefined,
      operatorEmail,
      items: lines.map((l) => ({
        productId: l.product.id,
        name: l.product.name,
        quantity: l.quantity,
        unitCost: l.unitCost,
      })),
    })
    setSaving(false)
    if (err) {
      setError(err)
      return
    }

    // Reflete no catálogo local: soma estoque e atualiza custo.
    lines.forEach((l) => {
      upsertLocal({
        ...l.product,
        stock: (l.product.stock ?? 0) + l.quantity,
        cost: l.unitCost > 0 ? l.unitCost : l.product.cost,
      })
    })
    setSuccess(
      `Entrada registrada${number ? ` (compra nº ${String(number).padStart(6, '0')})` : ''}: `
        + `${totalUnits} ${totalUnits === 1 ? 'unidade' : 'unidades'} somadas ao estoque.`,
    )
    setLines([])
    setSupplier('')
    loadHistory()
  }

  return (
    <div className="purch">
      <section className="purch__new admin__tablewrap" style={{ padding: '1.1rem 1.2rem' }}>
        <h3 className="purch__title">Nova entrada de estoque</h3>

        <div className="purch__top">
          <label className="checkout__field">
            <span>Fornecedor (opcional)</span>
            <input value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="Ex.: Distribuidora Esportiva" />
          </label>
          <label className="checkout__field purch__search">
            <span>Adicionar produto</span>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por nome ou código…" />
            {results.length > 0 && (
              <div className="purch__results">
                {results.map((p) => (
                  <button key={p.id} type="button" className="purch__result" onClick={() => addProduct(p)}>
                    <span>{p.name}</span>
                    <small>estoque atual: {p.stock ?? 0}</small>
                  </button>
                ))}
              </div>
            )}
          </label>
        </div>

        {lines.length === 0 ? (
          <p className="purch__empty">Busque um produto acima para adicionar à entrada.</p>
        ) : (
          <div className="admin__tablewrap" style={{ border: 'none' }}>
            <table className="admin__table">
              <thead>
                <tr>
                  <th>Produto</th>
                  <th>Estoque</th>
                  <th>Qtd. a entrar</th>
                  <th>Custo unit.</th>
                  <th>Subtotal</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => (
                  <tr key={l.product.id}>
                    <td><strong>{l.product.name}</strong><br /><small style={{ color: 'var(--muted)' }}>{l.product.id}</small></td>
                    <td>{l.product.stock ?? 0} → <strong>{(l.product.stock ?? 0) + l.quantity}</strong></td>
                    <td>
                      <div className="admin__stock">
                        <button onClick={() => patchLine(l.product.id, { quantity: Math.max(1, l.quantity - 1) })}>−</button>
                        <input
                          inputMode="numeric"
                          value={l.quantity}
                          onChange={(e) => patchLine(l.product.id, { quantity: Math.max(1, Math.round(Number(e.target.value) || 1)) })}
                        />
                        <button onClick={() => patchLine(l.product.id, { quantity: l.quantity + 1 })}>+</button>
                      </div>
                    </td>
                    <td>
                      <div className="admin__price">
                        <span>R$</span>
                        <input
                          inputMode="decimal"
                          value={l.unitCost}
                          onChange={(e) => patchLine(l.product.id, { unitCost: Math.max(0, Number(String(e.target.value).replace(',', '.')) || 0) })}
                        />
                      </div>
                    </td>
                    <td><strong>{BRL.format(l.unitCost * l.quantity)}</strong></td>
                    <td><button className="admin__del" onClick={() => removeLine(l.product.id)} aria-label="Remover">🗑</button></td>
                  </tr>
                ))}
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
          <button className="btn btn--primary purch__register" disabled={saving || lines.length === 0} onClick={register}>
            {saving ? 'Registrando…' : '↧ Registrar entrada no estoque'}
          </button>
        </div>
      </section>

      <section className="purch__history">
        <h3 className="purch__title">Últimas compras</h3>
        {history.length === 0 ? (
          <p className="purch__empty">Nenhuma compra registrada ainda.</p>
        ) : (
          <ul className="purch__hist-list">
            {history.map((h) => (
              <li key={h.number} className="purch__hist">
                <div>
                  <strong>nº {String(h.number).padStart(6, '0')}</strong>
                  <small>{when(h.when)} · {h.supplier || 'sem fornecedor'} · {h.items.reduce((s, i) => s + i.quantity, 0)} un.</small>
                </div>
                <strong className="purch__hist-total">{BRL.format(h.total)}</strong>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
