import { useMemo, useState } from 'react'
import { dateBR, money, todayISO } from '../format'
import { parseNumber } from './PdvScreen'
import { useStore } from '../store'
import {
  EXPENSE_CATEGORY_LABEL,
  PAYABLE_PAYMENTS,
  PAYMENT_LABEL,
  type ExpenseCategory,
  type PaymentMethod,
} from '../types'

type Filter = 'todas' | 'aberto' | 'vencidas' | 'pago'

/**
 * Contas a pagar: as geradas pelas compras de insumos e as despesas avulsas
 * (aluguel, energia, salários…). É a origem das despesas do financeiro.
 */
export function PayablesScreen() {
  const { payables, addExpense, payPayable, reopenPayable, removePayable } = useStore()
  const [filter, setFilter] = useState<Filter>('aberto')

  const today = todayISO()

  const list = useMemo(() => {
    const sorted = [...payables].sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    switch (filter) {
      case 'aberto':
        return sorted.filter((p) => p.status === 'aberto')
      case 'vencidas':
        return sorted.filter((p) => p.status === 'aberto' && p.dueDate < today)
      case 'pago':
        return sorted.filter((p) => p.status === 'pago').reverse()
      default:
        return sorted
    }
  }, [payables, filter, today])

  const openTotal = payables
    .filter((p) => p.status === 'aberto')
    .reduce((s, p) => s + p.amount, 0)
  const lateTotal = payables
    .filter((p) => p.status === 'aberto' && p.dueDate < today)
    .reduce((s, p) => s + p.amount, 0)
  const paidTotal = payables.filter((p) => p.status === 'pago').reduce((s, p) => s + p.amount, 0)

  return (
    <div className="lm-stack">
      <div className="lm-kpis">
        <Kpi label="Em aberto" value={money(openTotal)} />
        <Kpi label="Vencidas" value={money(lateTotal)} tone="bad" />
        <Kpi label="Já pagas" value={money(paidTotal)} tone="good" />
        <Kpi label="Lançamentos" value={String(payables.length)} />
      </div>

      <ExpenseForm onCreate={addExpense} />

      <section className="lm-panel">
        <header className="lm-panel__head">
          <h2>Contas a pagar</h2>
          <div className="lm-chips">
            {(['aberto', 'vencidas', 'pago', 'todas'] as Filter[]).map((f) => (
              <button
                key={f}
                type="button"
                className={`lm-chip${filter === f ? ' is-active' : ''}`}
                onClick={() => setFilter(f)}
              >
                {f === 'aberto'
                  ? 'Em aberto'
                  : f === 'vencidas'
                    ? 'Vencidas'
                    : f === 'pago'
                      ? 'Pagas'
                      : 'Todas'}
              </button>
            ))}
          </div>
        </header>

        {list.length === 0 ? (
          <p className="lm-empty">Nenhuma conta neste filtro.</p>
        ) : (
          <div className="lm-tableWrap">
            <table className="lm-table">
              <thead>
                <tr>
                  <th>Descrição</th>
                  <th>Categoria</th>
                  <th>Origem</th>
                  <th>Vencimento</th>
                  <th>Forma</th>
                  <th>Valor</th>
                  <th>Situação</th>
                  <th aria-label="Ações" />
                </tr>
              </thead>
              <tbody>
                {list.map((p) => {
                  const late = p.status === 'aberto' && p.dueDate < today
                  return (
                    <tr key={p.id} className={late ? 'is-late' : undefined}>
                      <td>
                        {p.description}
                        {p.supplier && <span className="lm-sub">{p.supplier}</span>}
                      </td>
                      <td>
                        {p.category === 'insumos'
                          ? 'Insumos'
                          : EXPENSE_CATEGORY_LABEL[p.category]}
                      </td>
                      <td>{p.origin === 'compra' ? 'Compra' : 'Despesa'}</td>
                      <td>{dateBR(p.dueDate)}</td>
                      <td>{PAYMENT_LABEL[p.payment]}</td>
                      <td>{money(p.amount)}</td>
                      <td>
                        <span
                          className={`lm-tag lm-tag--${p.status === 'pago' ? 'entregue' : late ? 'cancelado' : 'fila'}`}
                        >
                          {p.status === 'pago' ? `Pago ${dateBR(p.paidAt ?? '')}` : late ? 'Vencida' : 'Em aberto'}
                        </span>
                      </td>
                      <td className="lm-actions">
                        {p.status === 'aberto' ? (
                          <button
                            type="button"
                            className="lm-btn lm-btn--primary lm-btn--sm"
                            onClick={() => payPayable(p.id)}
                          >
                            Dar baixa
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="lm-btn lm-btn--ghost lm-btn--sm"
                            onClick={() => reopenPayable(p.id)}
                          >
                            Reabrir
                          </button>
                        )}
                        <button
                          type="button"
                          className="lm-btn lm-btn--danger lm-btn--sm"
                          onClick={() => {
                            if (confirm(`Excluir "${p.description}"?`)) removePayable(p.id)
                          }}
                        >
                          Excluir
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

function ExpenseForm({ onCreate }: { onCreate: ReturnType<typeof useStore>['addExpense'] }) {
  const [description, setDescription] = useState('')
  const [supplier, setSupplier] = useState('')
  const [category, setCategory] = useState<ExpenseCategory>('outros')
  const [amount, setAmount] = useState('')
  const [dueDate, setDueDate] = useState(todayISO())
  const [payment, setPayment] = useState<PaymentMethod>('boleto')
  const [installments, setInstallments] = useState('1')
  const [paid, setPaid] = useState(false)
  const [feedback, setFeedback] = useState('')

  function submit() {
    const value = parseNumber(amount)
    if (!description.trim() || value <= 0) {
      setFeedback('Informe a descrição e um valor maior que zero.')
      return
    }
    const created = onCreate({
      description: description.trim(),
      supplier,
      category,
      amount: value,
      dueDate,
      payment,
      installments: Math.max(1, Math.floor(parseNumber(installments) || 1)),
      paid,
    })
    setFeedback(`Despesa lançada em ${created.length} conta(s) a pagar.`)
    setDescription('')
    setSupplier('')
    setAmount('')
    setInstallments('1')
    setPaid(false)
  }

  return (
    <section className="lm-panel">
      <header className="lm-panel__head">
        <h2>Nova despesa</h2>
        <span className="lm-panel__hint">Aluguel, energia, salários e demais custos fixos</span>
      </header>
      <div className="lm-form lm-form--4">
        <label>
          Descrição
          <input
            className="lm-input"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ex.: Conta de água — setembro"
          />
        </label>
        <label>
          Fornecedor
          <input
            className="lm-input"
            value={supplier}
            onChange={(e) => setSupplier(e.target.value)}
            placeholder="Opcional"
          />
        </label>
        <label>
          Categoria
          <select
            className="lm-input"
            value={category}
            onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
          >
            {(Object.keys(EXPENSE_CATEGORY_LABEL) as ExpenseCategory[]).map((c) => (
              <option key={c} value={c}>
                {EXPENSE_CATEGORY_LABEL[c]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Valor total (R$)
          <input
            className="lm-input"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0,00"
          />
        </label>
        <label>
          Vencimento
          <input
            className="lm-input"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </label>
        <label>
          Forma de pagamento
          <select
            className="lm-input"
            value={payment}
            onChange={(e) => setPayment(e.target.value as PaymentMethod)}
          >
            {PAYABLE_PAYMENTS.map((m) => (
              <option key={m} value={m}>
                {PAYMENT_LABEL[m]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Parcelas
          <input
            className="lm-input"
            inputMode="numeric"
            value={installments}
            onChange={(e) => setInstallments(e.target.value)}
          />
        </label>
        <label className="lm-check">
          <input type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} />
          Já está paga
        </label>
      </div>
      {feedback && <p className="lm-success">{feedback}</p>}
      <button type="button" className="lm-btn lm-btn--primary" onClick={submit}>
        Lançar despesa
      </button>
    </section>
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
