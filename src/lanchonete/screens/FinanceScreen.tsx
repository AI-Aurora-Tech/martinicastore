import { useMemo, useState } from 'react'
import { dateBR, money, monthStartISO, todayISO } from '../format'
import { useStore } from '../store'
import {
  EXPENSE_CATEGORY_LABEL,
  PAYMENT_LABEL,
  type ExpenseCategory,
  type PaymentMethod,
} from '../types'

/**
 * Financeiro: junta as receitas (pedidos do PDV) com as despesas (contas a
 * pagar de compras e custos fixos).
 *
 * São dois olhares, para não contar o mesmo dinheiro duas vezes:
 *  - Caixa: o que entrou e o que foi efetivamente pago no período.
 *  - Resultado: receita − custo dos insumos consumidos (CMV) − despesas
 *    operacionais pelo vencimento.
 */
export function FinanceScreen() {
  const { orders, payables, purchases } = useStore()
  const [from, setFrom] = useState(monthStartISO())
  const [to, setTo] = useState(todayISO())

  const inRange = (iso: string) => {
    const d = iso.slice(0, 10)
    return d >= from && d <= to
  }

  const sales = useMemo(
    () => orders.filter((o) => o.status !== 'cancelado' && inRange(o.createdAt)),
    [orders, from, to],
  )

  const revenue = sales.reduce((s, o) => s + o.total, 0)
  const grossRevenue = sales.reduce((s, o) => s + o.subtotal, 0)
  const discounts = sales.reduce((s, o) => s + o.discount, 0)
  const cmv = sales.reduce(
    (s, o) => s + o.items.reduce((t, i) => t + i.unitCost * i.qty, 0),
    0,
  )
  const ticket = sales.length > 0 ? revenue / sales.length : 0

  // Despesas operacionais (aluguel, energia…) por vencimento no período.
  const opex = payables
    .filter((p) => p.origin === 'despesa' && inRange(p.dueDate))
    .reduce((s, p) => s + p.amount, 0)

  const result = revenue - cmv - opex

  // Regime de caixa: só o que foi realmente pago no período.
  const cashOut = payables
    .filter((p) => p.status === 'pago' && p.paidAt && inRange(p.paidAt))
    .reduce((s, p) => s + p.amount, 0)
  const cashIn = sales.filter((o) => o.payment !== 'prazo').reduce((s, o) => s + o.total, 0)
  const onCredit = sales.filter((o) => o.payment === 'prazo').reduce((s, o) => s + o.total, 0)

  const today = todayISO()
  const openPayables = payables.filter((p) => p.status === 'aberto')
  const latePayables = openPayables.filter((p) => p.dueDate < today)

  const byPayment = useMemo(() => {
    const map = new Map<PaymentMethod, number>()
    for (const o of sales) map.set(o.payment, (map.get(o.payment) ?? 0) + o.total)
    return [...map.entries()].sort((a, b) => b[1] - a[1])
  }, [sales])

  const byCategory = useMemo(() => {
    const map = new Map<ExpenseCategory | 'insumos', number>()
    for (const p of payables) {
      if (!inRange(p.dueDate)) continue
      map.set(p.category, (map.get(p.category) ?? 0) + p.amount)
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1])
  }, [payables, from, to])

  const topProducts = useMemo(() => {
    const map = new Map<string, { name: string; qty: number; revenue: number; cost: number }>()
    for (const o of sales) {
      for (const i of o.items) {
        const cur = map.get(i.productId) ?? { name: i.name, qty: 0, revenue: 0, cost: 0 }
        cur.qty += i.qty
        cur.revenue += i.unitPrice * i.qty
        cur.cost += i.unitCost * i.qty
        map.set(i.productId, cur)
      }
    }
    return [...map.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 8)
  }, [sales])

  const daily = useMemo(() => {
    const map = new Map<string, number>()
    for (const o of sales) {
      const d = o.createdAt.slice(0, 10)
      map.set(d, (map.get(d) ?? 0) + o.total)
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-14)
  }, [sales])
  const dailyMax = daily.reduce((m, [, v]) => Math.max(m, v), 0)

  const purchasesTotal = purchases
    .filter((p) => inRange(p.createdAt))
    .reduce((s, p) => s + p.total, 0)

  return (
    <div className="lm-stack">
      <section className="lm-panel">
        <header className="lm-panel__head">
          <h2>Período</h2>
          <div className="lm-period">
            <label>
              De
              <input
                className="lm-input lm-input--small"
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </label>
            <label>
              Até
              <input
                className="lm-input lm-input--small"
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </label>
            <button
              type="button"
              className="lm-chip"
              onClick={() => {
                setFrom(todayISO())
                setTo(todayISO())
              }}
            >
              Hoje
            </button>
            <button
              type="button"
              className="lm-chip"
              onClick={() => {
                setFrom(monthStartISO())
                setTo(todayISO())
              }}
            >
              Mês atual
            </button>
          </div>
        </header>

        <div className="lm-kpis lm-kpis--4">
          <Kpi label="Receita de vendas" value={money(revenue)} tone="good" />
          <Kpi label="Custo dos insumos (CMV)" value={money(cmv)} />
          <Kpi label="Despesas operacionais" value={money(opex)} tone="bad" />
          <Kpi
            label="Resultado do período"
            value={money(result)}
            tone={result >= 0 ? 'good' : 'bad'}
          />
        </div>
      </section>

      <div className="lm-cols">
        <section className="lm-panel">
          <header className="lm-panel__head">
            <h2>Demonstrativo do período</h2>
            <span className="lm-panel__hint">Regime de competência</span>
          </header>
          <ul className="lm-dre">
            <Line label="Vendas brutas" value={grossRevenue} />
            <Line label="(−) Descontos concedidos" value={-discounts} />
            <Line label="= Receita líquida" value={revenue} strong />
            <Line label="(−) Custo dos insumos vendidos" value={-cmv} />
            <Line label="= Lucro bruto" value={revenue - cmv} strong />
            <Line label="(−) Despesas operacionais" value={-opex} />
            <Line label="= Resultado" value={result} strong highlight />
          </ul>
          <p className="lm-note lm-note--muted">
            Ticket médio de {money(ticket)} em {sales.length} pedido(s). Margem sobre a receita:{' '}
            {revenue > 0 ? `${Math.round((result / revenue) * 100)}%` : '—'}.
          </p>
        </section>

        <section className="lm-panel">
          <header className="lm-panel__head">
            <h2>Caixa do período</h2>
            <span className="lm-panel__hint">Regime de caixa</span>
          </header>
          <ul className="lm-dre">
            <Line label="Entradas (vendas recebidas)" value={cashIn} />
            <Line label="Vendas a prazo (a receber)" value={onCredit} muted />
            <Line label="(−) Contas pagas no período" value={-cashOut} />
            <Line label="= Saldo de caixa" value={cashIn - cashOut} strong highlight />
          </ul>
          <div className="lm-miniKpis">
            <div>
              <span>Compras de insumos</span>
              <strong>{money(purchasesTotal)}</strong>
            </div>
            <div>
              <span>Contas em aberto</span>
              <strong>{money(openPayables.reduce((s, p) => s + p.amount, 0))}</strong>
            </div>
            <div>
              <span>Vencidas</span>
              <strong className={latePayables.length > 0 ? 'lm-bad' : undefined}>
                {money(latePayables.reduce((s, p) => s + p.amount, 0))}
              </strong>
            </div>
          </div>
        </section>
      </div>

      <section className="lm-panel">
        <header className="lm-panel__head">
          <h2>Receita por dia</h2>
          <span className="lm-panel__hint">Últimos 14 dias com vendas no período</span>
        </header>
        {daily.length === 0 ? (
          <p className="lm-empty">Sem vendas no período selecionado.</p>
        ) : (
          <div className="lm-chart">
            {daily.map(([d, v]) => (
              <div key={d} className="lm-chart__col" title={`${dateBR(d)} — ${money(v)}`}>
                <div
                  className="lm-chart__bar"
                  style={{ height: `${dailyMax > 0 ? Math.max(4, (v / dailyMax) * 100) : 4}%` }}
                />
                <span className="lm-chart__label">{d.slice(8)}/{d.slice(5, 7)}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="lm-cols">
        <section className="lm-panel">
          <header className="lm-panel__head">
            <h2>Receitas por forma de pagamento</h2>
          </header>
          {byPayment.length === 0 ? (
            <p className="lm-empty">Sem vendas no período.</p>
          ) : (
            <ul className="lm-bars">
              {byPayment.map(([m, v]) => (
                <li key={m}>
                  <span>{PAYMENT_LABEL[m]}</span>
                  <div className="lm-bars__track">
                    <div
                      className="lm-bars__fill"
                      style={{ width: `${revenue > 0 ? (v / revenue) * 100 : 0}%` }}
                    />
                  </div>
                  <strong>{money(v)}</strong>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="lm-panel">
          <header className="lm-panel__head">
            <h2>Despesas por categoria</h2>
            <span className="lm-panel__hint">Por vencimento no período</span>
          </header>
          {byCategory.length === 0 ? (
            <p className="lm-empty">Sem contas com vencimento no período.</p>
          ) : (
            <ul className="lm-bars">
              {byCategory.map(([c, v]) => {
                const max = byCategory[0][1] || 1
                return (
                  <li key={c}>
                    <span>{c === 'insumos' ? 'Insumos (compras)' : EXPENSE_CATEGORY_LABEL[c]}</span>
                    <div className="lm-bars__track">
                      <div className="lm-bars__fill is-expense" style={{ width: `${(v / max) * 100}%` }} />
                    </div>
                    <strong>{money(v)}</strong>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>

      <section className="lm-panel">
        <header className="lm-panel__head">
          <h2>Itens mais vendidos</h2>
        </header>
        {topProducts.length === 0 ? (
          <p className="lm-empty">Sem vendas no período.</p>
        ) : (
          <div className="lm-tableWrap">
            <table className="lm-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Qtd.</th>
                  <th>Receita</th>
                  <th>Custo</th>
                  <th>Margem</th>
                </tr>
              </thead>
              <tbody>
                {topProducts.map((p) => (
                  <tr key={p.name}>
                    <td>{p.name}</td>
                    <td>{p.qty}</td>
                    <td>{money(p.revenue)}</td>
                    <td>{money(p.cost)}</td>
                    <td>
                      {p.revenue > 0
                        ? `${Math.round(((p.revenue - p.cost) / p.revenue) * 100)}%`
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

function Line({
  label,
  value,
  strong,
  highlight,
  muted,
}: {
  label: string
  value: number
  strong?: boolean
  highlight?: boolean
  muted?: boolean
}) {
  return (
    <li
      className={`lm-dre__line${strong ? ' is-strong' : ''}${highlight ? ' is-highlight' : ''}${
        muted ? ' is-muted' : ''
      }`}
    >
      <span>{label}</span>
      <span className={value < 0 ? 'lm-bad' : undefined}>{money(value)}</span>
    </li>
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
