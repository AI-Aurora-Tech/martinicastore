import { useMemo, useState } from 'react'
import { Receipt, printReceipt } from '../components/Receipt'
import { minutesSince, money, timeOnly } from '../format'
import { useStore } from '../store'
import {
  CHANNEL_LABEL,
  ORDER_STATUS_LABEL,
  PAYMENT_LABEL,
  type Order,
  type OrderStatus,
} from '../types'

/** Colunas da esteira de produção. */
const LANES: { status: OrderStatus; hint: string }[] = [
  { status: 'fila', hint: 'Aguardando produção' },
  { status: 'preparo', hint: 'Na chapa / fritadeira' },
  { status: 'pronto', hint: 'Aguardando retirada' },
]

const NEXT: Partial<Record<OrderStatus, { to: OrderStatus; label: string }>> = {
  fila: { to: 'preparo', label: 'Iniciar preparo' },
  preparo: { to: 'pronto', label: 'Marcar como pronto' },
  pronto: { to: 'entregue', label: 'Dar baixa (entregue)' },
}

/**
 * Fila de espera: todo pedido nasce em "Na fila" e só sai quando é entregue
 * (baixa) ou cancelado — o cancelamento devolve os insumos ao estoque.
 */
export function QueueScreen() {
  const { orders, setOrderStatus, cancelOrder } = useStore()
  const [reprint, setReprint] = useState<Order | null>(null)

  const open = useMemo(
    () => orders.filter((o) => o.status !== 'entregue' && o.status !== 'cancelado'),
    [orders],
  )

  const closedToday = useMemo(() => {
    const today = new Date().toDateString()
    return orders
      .filter((o) => o.status === 'entregue' || o.status === 'cancelado')
      .filter((o) => new Date(o.deliveredAt ?? o.canceledAt ?? o.createdAt).toDateString() === today)
      .slice(0, 30)
  }, [orders])

  function doReprint(order: Order) {
    setReprint(order)
    printReceipt()
  }

  return (
    <div className="lm-queue">
      <div className="lm-queue__summary">
        <Kpi label="Na fila" value={open.filter((o) => o.status === 'fila').length} />
        <Kpi label="Em preparo" value={open.filter((o) => o.status === 'preparo').length} />
        <Kpi label="Prontos" value={open.filter((o) => o.status === 'pronto').length} />
        <Kpi
          label="Entregues hoje"
          value={closedToday.filter((o) => o.status === 'entregue').length}
        />
      </div>

      <div className="lm-lanes">
        {LANES.map((lane) => {
          const list = open.filter((o) => o.status === lane.status)
          return (
            <section key={lane.status} className={`lm-lane lm-lane--${lane.status}`}>
              <header>
                <h2>{ORDER_STATUS_LABEL[lane.status]}</h2>
                <span className="lm-lane__count">{list.length}</span>
              </header>
              <p className="lm-lane__hint">{lane.hint}</p>
              <ul>
                {list.length === 0 && <li className="lm-lane__empty">Nada por aqui.</li>}
                {list.map((order) => {
                  const next = NEXT[order.status]
                  const waiting = minutesSince(order.createdAt)
                  return (
                    <li key={order.id} className="lm-ticket">
                      <div className="lm-ticket__head">
                        <strong>#{String(order.number).padStart(4, '0')}</strong>
                        <span className={`lm-ticket__time${waiting >= 15 ? ' is-late' : ''}`}>
                          {waiting} min
                        </span>
                      </div>
                      <p className="lm-ticket__meta">
                        {CHANNEL_LABEL[order.channel]}
                        {order.table ? ` · Mesa ${order.table}` : ''}
                        {order.customer ? ` · ${order.customer}` : ''} · {timeOnly(order.createdAt)}
                      </p>
                      <ul className="lm-ticket__items">
                        {order.items.map((item, i) => (
                          <li key={`${item.productId}-${i}`}>
                            <span className="lm-ticket__qty">{item.qty}×</span> {item.name}
                            {item.notes ? <em> — {item.notes}</em> : null}
                          </li>
                        ))}
                      </ul>
                      <p className="lm-ticket__total">
                        {money(order.total)} · {PAYMENT_LABEL[order.payment]}
                      </p>
                      <div className="lm-ticket__actions">
                        {next && (
                          <button
                            type="button"
                            className="lm-btn lm-btn--primary lm-btn--sm"
                            onClick={() => setOrderStatus(order.id, next.to)}
                          >
                            {next.label}
                          </button>
                        )}
                        <button
                          type="button"
                          className="lm-btn lm-btn--ghost lm-btn--sm"
                          onClick={() => doReprint(order)}
                        >
                          Imprimir
                        </button>
                        <button
                          type="button"
                          className="lm-btn lm-btn--danger lm-btn--sm"
                          onClick={() => {
                            if (confirm(`Cancelar o pedido #${order.number}? Os insumos voltam ao estoque.`)) {
                              cancelOrder(order.id)
                            }
                          }}
                        >
                          Cancelar
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </section>
          )
        })}
      </div>

      <section className="lm-panel">
        <header className="lm-panel__head">
          <h2>Baixas de hoje</h2>
          <span className="lm-panel__hint">Pedidos entregues ou cancelados nas últimas horas</span>
        </header>
        {closedToday.length === 0 ? (
          <p className="lm-empty">Nenhum pedido finalizado hoje ainda.</p>
        ) : (
          <div className="lm-tableWrap">
            <table className="lm-table">
              <thead>
                <tr>
                  <th>Pedido</th>
                  <th>Atendimento</th>
                  <th>Itens</th>
                  <th>Total</th>
                  <th>Pagamento</th>
                  <th>Situação</th>
                  <th>Baixa</th>
                </tr>
              </thead>
              <tbody>
                {closedToday.map((o) => (
                  <tr key={o.id}>
                    <td>#{String(o.number).padStart(4, '0')}</td>
                    <td>
                      {CHANNEL_LABEL[o.channel]}
                      {o.table ? ` · Mesa ${o.table}` : ''}
                    </td>
                    <td>{o.items.reduce((s, i) => s + i.qty, 0)}</td>
                    <td>{money(o.total)}</td>
                    <td>{PAYMENT_LABEL[o.payment]}</td>
                    <td>
                      <span className={`lm-tag lm-tag--${o.status}`}>
                        {ORDER_STATUS_LABEL[o.status]}
                      </span>
                    </td>
                    <td>{timeOnly(o.deliveredAt ?? o.canceledAt ?? o.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {reprint && <Receipt order={reprint} />}
    </div>
  )
}

function Kpi({ label, value }: { label: string; value: number }) {
  return (
    <div className="lm-kpi">
      <span className="lm-kpi__label">{label}</span>
      <strong className="lm-kpi__value">{value}</strong>
    </div>
  )
}
