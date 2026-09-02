import { useEffect, useMemo, useState } from 'react'
import { BRL } from '../data/products'
import {
  createExpense,
  listContas,
  listExpenses,
  postRecurringThisMonth,
  removeExpense,
  setContaPaid,
  type Conta,
  type Expense,
} from '../services/expenses'
import { pdfKpis, pdfSection, pdfTable, printReport } from '../services/exportPdf'

interface Props {
  operatorEmail?: string
}

const CATEGORIES = ['Aluguel', 'Energia', 'Água', 'Internet', 'Salários', 'Impostos', 'Marketing', 'Manutenção', 'Fornecedores', 'Outros']

function when(iso: string) {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('pt-BR')
}
function todayISO() {
  const n = new Date()
  return new Date(n.getFullYear(), n.getMonth(), n.getDate()).toISOString().slice(0, 10)
}
function isThisMonth(iso: string) {
  const d = new Date(iso)
  const n = new Date()
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth()
}

export function Despesas({ operatorEmail }: Props) {
  const [contas, setContas] = useState<Conta[]>([])
  const [recurring, setRecurring] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  // filtros
  const [scope, setScope] = useState<'mes' | 'tudo'>('mes')
  const [statusF, setStatusF] = useState<'todas' | 'aberto' | 'pagas'>('todas')

  // formulário
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('Outros')
  const [amount, setAmount] = useState('')
  const [dueDate, setDueDate] = useState(todayISO())
  const [recorrente, setRecorrente] = useState(false)
  const [recurrence, setRecurrence] = useState<'mensal' | 'semanal'>('mensal')
  const [paid, setPaid] = useState(false)
  const [saving, setSaving] = useState(false)

  function load() {
    setLoading(true)
    setError(null)
    Promise.all([listContas(), listExpenses()])
      .then(([c, e]) => { setContas(c); setRecurring(e.filter((x) => x.recurring)) })
      .catch((err) => setError(err instanceof Error ? err.message : 'Falha ao carregar despesas.'))
      .finally(() => setLoading(false))
  }
  useEffect(() => load(), [])

  const filtered = useMemo(() => {
    return contas.filter(
      (c) =>
        (scope === 'tudo' || isThisMonth(c.when)) &&
        (statusF === 'todas' || (statusF === 'aberto' ? !c.paid : c.paid)),
    )
  }, [contas, scope, statusF])

  const totals = useMemo(() => {
    const base = contas.filter((c) => scope === 'tudo' || isThisMonth(c.when))
    return {
      aPagar: base.filter((c) => !c.paid).reduce((s, c) => s + c.amount, 0),
      pago: base.filter((c) => c.paid).reduce((s, c) => s + c.amount, 0),
      abertas: base.filter((c) => !c.paid).length,
    }
  }, [contas, scope])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (saving) return
    const value = Number(String(amount).replace(',', '.'))
    if (!description.trim() || !(value > 0)) { setError('Informe descrição e valor.'); return }
    if (!confirm(`Lançar a despesa "${description.trim()}" (${BRL.format(value)})?`)) return
    setSaving(true); setError(null); setSuccess(null)
    const { error: err } = await createExpense({
      description: description.trim(),
      category,
      amount: value,
      dueDate,
      paid,
      recurring: recorrente,
      recurrence: recorrente ? recurrence : undefined,
      operatorEmail,
    })
    setSaving(false)
    if (err) { setError(err); return }
    setSuccess('Despesa lançada.')
    setDescription(''); setAmount(''); setPaid(false); setRecorrente(false)
    load()
  }

  async function togglePaid(c: Conta) {
    if (busy) return
    const next = !c.paid
    const label = next ? 'PAGA' : 'em aberto'
    if (!confirm(`Marcar "${c.description}" como ${label}?`)) return
    setBusy(c.key)
    const { error: err } = await setContaPaid(c, next)
    setBusy(null)
    if (err) { setError(err); return }
    setContas((prev) => prev.map((x) => (x.key === c.key ? { ...x, paid: next } : x)))
  }

  async function del(c: Conta) {
    if (busy || c.source !== 'despesa') return
    if (!confirm(`Excluir a despesa "${c.description}"? Esta ação não pode ser desfeita.`)) return
    setBusy(c.key)
    const { error: err } = await removeExpense(c.refId)
    setBusy(null)
    if (err) { setError(err); return }
    setContas((prev) => prev.filter((x) => x.key !== c.key))
    setRecurring((prev) => prev.filter((x) => x.id !== c.refId))
  }

  function exportPdf() {
    const rows = filtered.map((c) => [
      when(c.when),
      c.description,
      c.category ?? '—',
      c.source === 'compra' ? 'Compra' : c.recurring ? 'Recorrente' : 'Avulsa',
      BRL.format(c.amount),
      c.paid ? 'Paga' : 'A pagar',
    ])
    const body =
      pdfSection(undefined, pdfKpis([
        { label: 'A pagar', value: BRL.format(totals.aPagar) },
        { label: 'Já pago', value: BRL.format(totals.pago) },
        { label: `Total ${scope === 'mes' ? 'do mês' : 'geral'}`, value: BRL.format(totals.aPagar + totals.pago) },
      ])) +
      pdfTable(
        ['Vencimento', 'Descrição', 'Categoria', 'Tipo', 'Valor', 'Situação'],
        rows,
        ['l', 'l', 'l', 'l', 'r', 'c'],
      )
    const sub = `${scope === 'mes' ? 'Este mês' : 'Todas as datas'} · ${statusF === 'todas' ? 'todas' : statusF === 'aberto' ? 'a pagar' : 'pagas'}`
    printReport('Despesas (contas da loja)', body, sub)
  }

  async function postRecurring(exp: Expense) {
    if (busy) return
    if (!confirm(`Lançar "${exp.description}" (${BRL.format(exp.amount)}) como conta a pagar deste mês?`)) return
    setBusy(`r-${exp.id}`)
    const { error: err } = await postRecurringThisMonth(exp)
    setBusy(null)
    if (err) { setError(err); return }
    setSuccess(`"${exp.description}" lançada como conta deste mês.`)
    load()
  }

  if (loading) return <div className="reports__loading">Carregando despesas…</div>

  return (
    <div className="despesas">
      <section className="despesas__new admin__tablewrap" style={{ padding: '1.1rem 1.2rem' }}>
        <h3 className="purch__title">Nova despesa</h3>
        <form className="despesas__form" onSubmit={submit}>
          <label className="checkout__field despesas__desc">
            <span>Descrição</span>
            <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ex.: Aluguel, energia, internet…" />
          </label>
          <label className="checkout__field">
            <span>Categoria</span>
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label className="checkout__field">
            <span>Valor</span>
            <div className="admin__price">
              <span>R$</span>
              <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" />
            </div>
          </label>
          <label className="checkout__field">
            <span>Vencimento</span>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </label>
          <label className="checkout__field">
            <span>Tipo</span>
            <select value={recorrente ? 'rec' : 'avulsa'} onChange={(e) => setRecorrente(e.target.value === 'rec')}>
              <option value="avulsa">Avulsa</option>
              <option value="rec">Recorrente</option>
            </select>
          </label>
          {recorrente && (
            <label className="checkout__field">
              <span>Recorrência</span>
              <select value={recurrence} onChange={(e) => setRecurrence(e.target.value as 'mensal' | 'semanal')}>
                <option value="mensal">Mensal</option>
                <option value="semanal">Semanal</option>
              </select>
            </label>
          )}
          <label className="purch__paid despesas__paidchk">
            <input type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} />
            Já paga
          </label>
          <button className="btn btn--primary despesas__submit" disabled={saving}>
            {saving ? 'Lançando…' : '＋ Lançar despesa'}
          </button>
        </form>
        {error && <p className="pdvlogin__error" style={{ marginTop: '0.6rem' }}>⚠️ {error}</p>}
        {success && <p className="custauth__info" style={{ marginTop: '0.6rem' }}>✅ {success}</p>}
      </section>

      <section className="admin__stats">
        <div className="admin__stat admin__stat--danger"><strong>{BRL.format(totals.aPagar)}</strong><span>a pagar ({totals.abertas})</span></div>
        <div className="admin__stat"><strong>{BRL.format(totals.pago)}</strong><span>já pago</span></div>
        <div className="admin__stat"><strong>{BRL.format(totals.aPagar + totals.pago)}</strong><span>total {scope === 'mes' ? 'do mês' : 'geral'}</span></div>
      </section>

      {recurring.length > 0 && (
        <section className="despesas__rec">
          <h3 className="purch__title">Despesas recorrentes</h3>
          <ul className="despesas__rec-list">
            {recurring.map((r) => (
              <li key={r.id} className="despesas__rec-item">
                <div>
                  <strong>{r.description}</strong>
                  <small>{r.category ?? 'Despesa'} · {r.recurrence === 'semanal' ? 'semanal' : 'mensal'} · {BRL.format(r.amount)}</small>
                </div>
                <button className="btn btn--ghost" disabled={busy === `r-${r.id}`} onClick={() => postRecurring(r)}>
                  ↻ Lançar deste mês
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="admin__toolbar">
        <div className="reports__periods">
          <button className={`chip ${scope === 'mes' ? 'chip--active' : ''}`} onClick={() => setScope('mes')}>Este mês</button>
          <button className={`chip ${scope === 'tudo' ? 'chip--active' : ''}`} onClick={() => setScope('tudo')}>Tudo</button>
        </div>
        <div className="reports__periods">
          {(['todas', 'aberto', 'pagas'] as const).map((s) => (
            <button key={s} className={`chip ${statusF === s ? 'chip--active' : ''}`} onClick={() => setStatusF(s)}>
              {s === 'todas' ? 'Todas' : s === 'aberto' ? 'A pagar' : 'Pagas'}
            </button>
          ))}
        </div>
        <button className="reports__refresh" onClick={exportPdf} disabled={filtered.length === 0} style={{ marginLeft: 'auto' }}>⤓ Exportar PDF</button>
        <button className="reports__refresh" onClick={load}>↻ Atualizar</button>
      </div>

      {filtered.length === 0 ? (
        <div className="reports__empty"><span>🧾</span><p>Nenhuma conta neste filtro.</p></div>
      ) : (
        <div className="admin__tablewrap">
          <table className="admin__table despesas__table">
            <thead>
              <tr><th>Vencimento</th><th>Descrição</th><th>Categoria</th><th>Valor</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.key}>
                  <td>{when(c.when)}</td>
                  <td>
                    <strong>{c.description}</strong>
                    {c.source === 'compra' && <span className="despesas__src">compra</span>}
                    {c.recurring && <span className="despesas__src despesas__src--rec">recorrente</span>}
                  </td>
                  <td>{c.category}</td>
                  <td><strong>{BRL.format(c.amount)}</strong></td>
                  <td>
                    <span className={`purch__badge ${c.paid ? 'is-ok' : 'is-danger'}`}>
                      {c.paid ? '✓ Paga' : '💰 A pagar'}
                    </span>
                  </td>
                  <td className="despesas__actions">
                    {c.paid
                      ? c.source === 'despesa' && (
                          <button className="btn btn--ghost" disabled={busy === c.key} onClick={() => togglePaid(c)}>Reabrir</button>
                        )
                      : <button className="btn btn--primary" disabled={busy === c.key} onClick={() => togglePaid(c)}>Marcar paga</button>}
                    {c.source === 'despesa' && (
                      <button className="admin__del" disabled={busy === c.key} onClick={() => del(c)} aria-label="Excluir">🗑</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="purch__hint">As <strong>compras a pagar</strong> aparecem aqui automaticamente. A entrada de estoque continua no módulo <strong>Compras</strong>.</p>
    </div>
  )
}
