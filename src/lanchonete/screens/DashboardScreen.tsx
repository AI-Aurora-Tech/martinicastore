import { useMemo } from 'react'
import { dateBR, money, qty as fmtQty, todayISO } from '../format'
import { productAvailability, useStore } from '../store'
import { ORDER_STATUS_LABEL } from '../types'

/** Visão de abertura da gestão: o dia de hoje em números e o que exige ação. */
export function DashboardScreen({ onNavigate }: { onNavigate: (tab: string) => void }) {
  const { orders, payables, ingredients, products } = useStore()
  const today = todayISO()

  const todaySales = useMemo(
    () => orders.filter((o) => o.status !== 'cancelado' && o.createdAt.slice(0, 10) === today),
    [orders, today],
  )
  const revenue = todaySales.reduce((s, o) => s + o.total, 0)
  const cmv = todaySales.reduce(
    (s, o) => s + o.items.reduce((t, i) => t + i.unitCost * i.qty, 0),
    0,
  )
  const queue = orders.filter((o) => o.status === 'fila' || o.status === 'preparo' || o.status === 'pronto')

  const lowStock = ingredients.filter((i) => i.stock <= i.minStock)
  const upcoming = payables
    .filter((p) => p.status === 'aberto')
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 6)
  const late = payables.filter((p) => p.status === 'aberto' && p.dueDate < today)

  const soldOut = products.filter((p) => {
    const a = productAvailability(p, ingredients)
    return p.active && a != null && a <= 0
  })

  return (
    <div className="lm-stack">
      <div className="lm-kpis lm-kpis--4">
        <Kpi label="Vendas hoje" value={money(revenue)} tone="good" />
        <Kpi label="Pedidos hoje" value={String(todaySales.length)} />
        <Kpi label="Lucro bruto hoje" value={money(revenue - cmv)} />
        <Kpi label="Na fila agora" value={String(queue.length)} tone={queue.length > 0 ? 'bad' : undefined} />
      </div>

      <div className="lm-cols">
        <section className="lm-panel">
          <header className="lm-panel__head">
            <h2>Fila de pedidos</h2>
            <button type="button" className="lm-link" onClick={() => onNavigate('fila')}>
              Abrir fila
            </button>
          </header>
          {queue.length === 0 ? (
            <p className="lm-empty">Nenhum pedido aguardando. Cozinha em dia!</p>
          ) : (
            <ul className="lm-list">
              {queue.slice(0, 8).map((o) => (
                <li key={o.id}>
                  <span>
                    <strong>#{String(o.number).padStart(4, '0')}</strong> ·{' '}
                    {o.items.reduce((s, i) => s + i.qty, 0)} item(ns)
                  </span>
                  <span className={`lm-tag lm-tag--${o.status}`}>
                    {ORDER_STATUS_LABEL[o.status]}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="lm-panel">
          <header className="lm-panel__head">
            <h2>Contas a pagar</h2>
            <button type="button" className="lm-link" onClick={() => onNavigate('contas')}>
              Ver todas
            </button>
          </header>
          {late.length > 0 && (
            <p className="lm-alert">
              {late.length} conta(s) vencida(s), somando{' '}
              {money(late.reduce((s, p) => s + p.amount, 0))}.
            </p>
          )}
          {upcoming.length === 0 ? (
            <p className="lm-empty">Nenhuma conta em aberto.</p>
          ) : (
            <ul className="lm-list">
              {upcoming.map((p) => (
                <li key={p.id}>
                  <span>{p.description}</span>
                  <span className={p.dueDate < today ? 'lm-bad' : undefined}>
                    {dateBR(p.dueDate)} · {money(p.amount)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="lm-cols">
        <section className="lm-panel">
          <header className="lm-panel__head">
            <h2>Reposição de estoque</h2>
            <button type="button" className="lm-link" onClick={() => onNavigate('compras')}>
              Registrar compra
            </button>
          </header>
          {lowStock.length === 0 ? (
            <p className="lm-empty">Todos os insumos acima do estoque mínimo.</p>
          ) : (
            <ul className="lm-list">
              {lowStock.map((i) => (
                <li key={i.id}>
                  <span>{i.name}</span>
                  <span className="lm-bad">
                    {fmtQty(i.stock)} {i.unit} (mín. {fmtQty(i.minStock)})
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="lm-panel">
          <header className="lm-panel__head">
            <h2>Itens esgotados no PDV</h2>
            <button type="button" className="lm-link" onClick={() => onNavigate('estoque')}>
              Ver disponibilidade
            </button>
          </header>
          {soldOut.length === 0 ? (
            <p className="lm-empty">Nenhum item esgotado. Vitrine completa.</p>
          ) : (
            <ul className="lm-list">
              {soldOut.map((p) => (
                <li key={p.id}>
                  <span>{p.name}</span>
                  <span className="lm-bad">Esgotado</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: 'good' | 'bad' }) {
  return (
    <div className={`lm-kpi${tone ? ` is-${tone}` : ''}`}>
      <span className="lm-kpi__label">{label}</span>
      <strong className="lm-kpi__value">{value}</strong>
    </div>
  )
}
