import { useEffect, useMemo, useState } from 'react'
import { BRL } from '../data/products'
import {
  listTransactions,
  updateOrderStatus,
  type OrderStatus,
  type Transaction,
} from '../services/management'

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pendente',
  paid: 'Pago',
  shipped: 'Enviado',
  delivered: 'Entregue',
  canceled: 'Cancelado',
  concluida: 'Concluída',
}

const STATUS_FLOW: OrderStatus[] = ['pending', 'paid', 'shipped', 'delivered', 'canceled']

const PAYMENT_LABEL: Record<string, string> = {
  dinheiro: 'Dinheiro', cartao: 'Cartão', pix: 'Pix', boleto: 'Boleto',
}

function when(iso: string) {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('pt-BR')
}

export function Orders() {
  const [txs, setTxs] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [kind, setKind] = useState<'todos' | 'Loja' | 'PDV'>('todos')
  const [status, setStatus] = useState<'todos' | OrderStatus>('todos')
  const [open, setOpen] = useState<string | null>(null)

  function load() {
    setLoading(true)
    setError(null)
    listTransactions()
      .then((r) => setTxs(r.txs))
      .catch((e) => setError(e instanceof Error ? e.message : 'Falha ao carregar pedidos.'))
      .finally(() => setLoading(false))
  }
  useEffect(() => load(), [])

  const filtered = useMemo(
    () =>
      txs.filter(
        (t) =>
          (kind === 'todos' || t.kind === kind) &&
          (status === 'todos' || t.status === status),
      ),
    [txs, kind, status],
  )

  const stats = useMemo(() => {
    const loja = txs.filter((t) => t.kind === 'Loja')
    return {
      total: txs.length,
      pendentes: loja.filter((t) => t.status === 'pending').length,
      enviados: loja.filter((t) => t.status === 'shipped').length,
      entregues: loja.filter((t) => t.status === 'delivered').length,
      pdv: txs.filter((t) => t.kind === 'PDV').length,
    }
  }, [txs])

  async function changeStatus(tx: Transaction, next: OrderStatus) {
    setTxs((prev) => prev.map((t) => (t.id === tx.id ? { ...t, status: next } : t)))
    const { error: err } = await updateOrderStatus(tx, next)
    if (err) setError(err)
  }

  if (loading) return <div className="reports__loading">Carregando pedidos…</div>
  if (error) {
    return (
      <div className="admin__banner admin__banner--error">
        ⚠️ {error} <button onClick={load}>tentar de novo</button>
      </div>
    )
  }

  return (
    <div className="orders">
      <section className="admin__stats">
        <div className="admin__stat"><strong>{stats.total}</strong><span>transações</span></div>
        <div className="admin__stat admin__stat--warn"><strong>{stats.pendentes}</strong><span>pedidos pendentes</span></div>
        <div className="admin__stat"><strong>{stats.enviados}</strong><span>enviados</span></div>
        <div className="admin__stat"><strong>{stats.pdv}</strong><span>vendas no PDV</span></div>
      </section>

      <div className="admin__toolbar">
        <div className="orders__filters">
          {(['todos', 'Loja', 'PDV'] as const).map((k) => (
            <button key={k} className={`chip ${kind === k ? 'chip--active' : ''}`} onClick={() => setKind(k)}>
              {k === 'todos' ? 'Todos' : k === 'Loja' ? '🛍️ Loja' : '🧾 PDV'}
            </button>
          ))}
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value as 'todos' | OrderStatus)}>
          <option value="todos">Todos os status</option>
          {STATUS_FLOW.map((s) => (
            <option key={s} value={s}>{STATUS_LABEL[s]}</option>
          ))}
        </select>
        <button className="reports__refresh" onClick={load} style={{ marginLeft: 'auto' }}>↻ Atualizar</button>
      </div>

      {filtered.length === 0 ? (
        <div className="reports__empty"><span>🧾</span><p>Nenhum pedido/venda por aqui ainda.</p></div>
      ) : (
        <div className="orders__list">
          {filtered.map((t) => {
            const isOpen = open === t.id
            const itemsCount = t.items.reduce((s, i) => s + i.quantity, 0)
            return (
              <div key={t.id} className="orders__card">
                <button className="orders__row" onClick={() => setOpen(isOpen ? null : t.id)}>
                  <span className={`orders__tag orders__tag--${t.kind === 'PDV' ? 'pdv' : 'loja'}`}>{t.kind}</span>
                  <span className="orders__num">nº {String(t.number).padStart(6, '0')}</span>
                  <span className="orders__who">
                    <strong>{t.who}</strong>
                    <small>{when(t.when)} · {itemsCount} {itemsCount === 1 ? 'item' : 'itens'}</small>
                  </span>
                  <span className={`orders__status orders__status--${t.status}`}>{STATUS_LABEL[t.status] ?? t.status}</span>
                  <strong className="orders__total">{BRL.format(t.total)}</strong>
                  <span className="orders__chevron">{isOpen ? '▲' : '▼'}</span>
                </button>

                {isOpen && (
                  <div className="orders__detail">
                    <div className="orders__detail-grid">
                      <div>
                        <h4>Itens</h4>
                        <ul className="orders__items">
                          {t.items.map((i, idx) => (
                            <li key={idx}>
                              <span>{i.quantity}x {i.name}{i.size ? ` (${i.size})` : ''}</span>
                              <span>{BRL.format(i.unitPrice * i.quantity)}</span>
                            </li>
                          ))}
                        </ul>
                        <div className="orders__totrow"><span>Subtotal</span><span>{BRL.format(t.subtotal)}</span></div>
                        {t.kind === 'Loja' && (
                          <div className="orders__totrow">
                            <span>Frete {t.shippingService ? `(${t.shippingService})` : ''}</span>
                            <span>{t.shipping > 0 ? BRL.format(t.shipping) : 'Grátis'}</span>
                          </div>
                        )}
                        <div className="orders__totrow orders__totrow--grand"><span>Total</span><span>{BRL.format(t.total)}</span></div>
                      </div>
                      <div>
                        <h4>{t.kind === 'Loja' ? 'Cliente & entrega' : 'Operador'}</h4>
                        <p className="orders__meta">
                          <strong>{t.who}</strong>
                          {t.email && <><br />{t.email}</>}
                        </p>
                        <p className="orders__meta">Pagamento: {PAYMENT_LABEL[t.payment] ?? t.payment}</p>
                        {t.kind === 'Loja' && (
                          <>
                            <p className="orders__meta">
                              Entrega: {t.shippingService ?? '—'}
                              {t.shippingDays ? ` · até ${t.shippingDays} dias úteis` : ''}
                            </p>
                            <p className="orders__meta">📍 {t.address ?? 'Endereço não informado'}</p>
                            <label className="orders__statuschg">
                              <span>Status do pedido</span>
                              <select
                                value={STATUS_FLOW.includes(t.status as OrderStatus) ? t.status : 'pending'}
                                onChange={(e) => changeStatus(t, e.target.value as OrderStatus)}
                              >
                                {STATUS_FLOW.map((s) => (
                                  <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                                ))}
                              </select>
                            </label>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
