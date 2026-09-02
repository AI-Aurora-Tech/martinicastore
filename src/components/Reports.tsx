import { useEffect, useMemo, useState } from 'react'
import { BRL } from '../data/products'
import {
  aggregate,
  fetchContas,
  fetchTransactions,
  filterByPeriod,
  type Conta,
  type Period,
  type ReportData,
  type Tx,
} from '../services/reports'

const PAYMENT_LABELS: Record<string, string> = {
  dinheiro: 'Dinheiro',
  cartao: 'Cartão',
  credito: 'Crédito',
  debito: 'Débito',
  fiado: 'Fiado',
  pix: 'Pix',
  boleto: 'Boleto',
}

const PERIODS: { id: Period; label: string }[] = [
  { id: 'dia', label: 'Hoje' },
  { id: 'semana', label: '7 dias' },
  { id: 'mes', label: 'Mês' },
  { id: 'tudo', label: 'Tudo' },
]

function pct(v: number) {
  return `${(v * 100).toFixed(1)}%`
}

function when(iso: string) {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('pt-BR')
}
function currentMonth() {
  const n = new Date()
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`
}
function monthLabel(m: string) {
  const [y, mo] = m.split('-').map(Number)
  const d = new Date(y, (mo || 1) - 1, 1)
  return d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
}

export function Reports() {
  const [txs, setTxs] = useState<Tx[]>([])
  const [contas, setContas] = useState<Conta[]>([])
  const [source, setSource] = useState<'supabase' | 'demo'>('demo')
  const [period, setPeriod] = useState<Period>('mes')
  const [month, setMonth] = useState<string>(currentMonth())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  function load() {
    setLoading(true)
    setError(null)
    Promise.all([fetchTransactions(), fetchContas()])
      .then(([r, c]) => { setTxs(r.txs); setSource(r.source); setContas(c) })
      .catch((e) => setError(e instanceof Error ? e.message : 'Falha ao carregar relatório.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => load(), [])

  const data: ReportData = useMemo(
    () => aggregate(
      filterByPeriod(txs, period, month),
      filterByPeriod(contas, period, month),
      source,
    ),
    [txs, contas, period, month, source],
  )

  if (loading) {
    return <div className="reports__loading">Calculando relatórios…</div>
  }
  if (error) {
    return (
      <div className="admin__banner admin__banner--error">
        ⚠️ {error} <button onClick={load}>tentar de novo</button>
      </div>
    )
  }

  const empty = data.salesCount + data.ordersCount === 0

  return (
    <div className="reports">
      <div className="reports__head">
        <div className="reports__periods">
          {PERIODS.map((pd) => (
            <button
              key={pd.id}
              className={`chip ${period === pd.id ? 'chip--active' : ''}`}
              onClick={() => setPeriod(pd.id)}
            >
              {pd.label}
            </button>
          ))}
          {period === 'mes' && (
            <input
              type="month"
              className="reports__month"
              value={month}
              onChange={(e) => setMonth(e.target.value || currentMonth())}
            />
          )}
        </div>
        <button className="reports__refresh" onClick={load}>↻ Atualizar</button>
      </div>
      <p className="reports__hint">
        {period === 'mes' ? <>Mês de <strong>{monthLabel(month)}</strong>. </> : null}
        Consolida <strong>vendas</strong>, <strong>pedidos</strong> e <strong>despesas</strong>.
        Lucro bruto = faturamento − custo. Lucro líquido = faturamento − despesas
        (contas da loja + compras). <strong>Recebido</strong> exclui fiados/pedidos pendentes.
      </p>

      {empty ? (
        <div className="reports__empty">
          <span>📊</span>
          <p>Nenhuma venda no período selecionado.</p>
          <small>Troque o período acima ou registre uma venda no PDV / pedido na loja.</small>
        </div>
      ) : (
        <>
          <section className="reports__kpis">
            <div className="reports__kpi reports__kpi--primary">
              <span>Faturamento</span>
              <strong>{BRL.format(data.revenue)}</strong>
            </div>
            <div className="reports__kpi">
              <span>Custo (CMV)</span>
              <strong>{BRL.format(data.cost)}</strong>
            </div>
            <div className="reports__kpi reports__kpi--profit">
              <span>Lucro bruto</span>
              <strong>{BRL.format(data.profit)}</strong>
            </div>
            <div className="reports__kpi">
              <span>Margem</span>
              <strong>{pct(data.margin)}</strong>
            </div>
          </section>

          <section className="reports__kpis reports__kpis--received">
            <div className="reports__kpi reports__kpi--received">
              <span>Lucro bruto já recebido</span>
              <strong>{BRL.format(data.receivedProfit)}</strong>
            </div>
            <div className="reports__kpi reports__kpi--pending">
              <span>Lucro a receber (fiado/pendente)</span>
              <strong>{BRL.format(data.pendingProfit)}</strong>
            </div>
            <div className="reports__kpi">
              <span>Faturamento recebido</span>
              <strong>{BRL.format(data.receivedRevenue)}</strong>
            </div>
          </section>

          <section className="reports__kpis reports__kpis--net">
            <div className="reports__kpi">
              <span>Receita bruta</span>
              <strong>{BRL.format(data.revenue)}</strong>
            </div>
            <div className="reports__kpi reports__kpi--expense">
              <span>Despesas (contas + compras)</span>
              <strong>{BRL.format(data.expensesTotal)}</strong>
            </div>
            <div className={`reports__kpi reports__kpi--net ${data.netProfit >= 0 ? 'is-pos' : 'is-neg'}`}>
              <span>Lucro líquido (receita − despesas)</span>
              <strong>{BRL.format(data.netProfit)}</strong>
            </div>
          </section>

          <section className="reports__subkpis">
            <div><strong>{data.salesCount}</strong><span>vendas (PDV)</span></div>
            <div><strong>{data.ordersCount}</strong><span>pedidos (loja)</span></div>
            <div><strong>{data.itemsSold}</strong><span>itens vendidos</span></div>
            <div><strong>{BRL.format(data.avgTicket)}</strong><span>ticket médio</span></div>
          </section>

          <div className="reports__grid">
            <section className="reports__card">
              <h3>Lucro por produto</h3>
              <div className="reports__tablewrap">
                <table className="reports__table">
                  <thead>
                    <tr>
                      <th>Produto</th>
                      <th>Qtd</th>
                      <th>Faturamento</th>
                      <th>Custo</th>
                      <th>Lucro</th>
                      <th>Margem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.byProduct.map((p) => (
                      <tr key={p.productId}>
                        <td>{p.name}</td>
                        <td>{p.qty}</td>
                        <td>{BRL.format(p.revenue)}</td>
                        <td>{BRL.format(p.cost)}</td>
                        <td className={p.profit >= 0 ? 'reports__pos' : 'reports__neg'}>
                          {BRL.format(p.profit)}
                        </td>
                        <td>{pct(p.margin)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <div className="reports__col">
              <section className="reports__card">
                <h3>Por forma de pagamento</h3>
                <ul className="reports__pay">
                  {data.byPayment.map((p) => (
                    <li key={p.method}>
                      <span>{PAYMENT_LABELS[p.method] ?? p.method}</span>
                      <span className="reports__pay-count">{p.count}x</span>
                      <strong>{BRL.format(p.revenue)}</strong>
                    </li>
                  ))}
                </ul>
              </section>

              <section className="reports__card">
                <h3>Últimas transações</h3>
                <ul className="reports__recent">
                  {data.recent.map((t) => (
                    <li key={`${t.kind}-${t.number}`}>
                      <span className={`reports__tag reports__tag--${t.kind === 'PDV' ? 'pdv' : 'loja'}`}>
                        {t.kind}
                      </span>
                      <span className="reports__recent-num">nº {String(t.number).padStart(4, '0')}</span>
                      <span className="reports__recent-when">{when(t.when)}</span>
                      {!t.received && <span className="reports__badge-wait">a receber</span>}
                      <strong>{BRL.format(t.total)}</strong>
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
