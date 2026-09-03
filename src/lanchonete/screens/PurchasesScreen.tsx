import { useMemo, useState } from 'react'
import { dateBR, dateTime, money, qty as fmtQty, todayISO } from '../format'
import { parseNumber } from './PdvScreen'
import { addMonths, splitInstallments, useStore } from '../store'
import {
  PAYABLE_PAYMENTS,
  PAYMENT_LABEL,
  PURCHASE_UNITS_BY_UNIT,
  PURCHASE_UNIT_FACTOR,
  PURCHASE_UNIT_LABEL,
  type PurchaseLine,
  type PurchaseUnit,
} from '../types'

interface Draft {
  ingredientId: string
  qty: string
  unit: PurchaseUnit
  unitCost: string
}

function emptyLine(): Draft {
  return { ingredientId: '', qty: '', unit: 'kg', unitCost: '' }
}

/**
 * Compras de insumos. Cada compra dá entrada no estoque (recalculando o custo
 * médio) e gera automaticamente as contas a pagar, com vencimento e forma de
 * pagamento escolhidos aqui.
 */
export function PurchasesScreen() {
  const { ingredients, products, purchases, payables, registerPurchase } = useStore()

  const [supplier, setSupplier] = useState('')
  const [invoice, setInvoice] = useState('')
  const [lines, setLines] = useState<Draft[]>([emptyLine()])
  const [payment, setPayment] = useState(PAYABLE_PAYMENTS[0])
  const [dueDate, setDueDate] = useState(addMonths(todayISO(), 0))
  const [installments, setInstallments] = useState('1')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState<{ number: number; total: number; count: number } | null>(null)

  const parcels = Math.max(1, Math.floor(parseNumber(installments) || 1))

  const resolved = useMemo<PurchaseLine[]>(() => {
    return lines.flatMap((l) => {
      const ing = ingredients.find((i) => i.id === l.ingredientId)
      const q = parseNumber(l.qty)
      const cost = parseNumber(l.unitCost)
      if (!ing || q <= 0) return []
      return [
        {
          ingredientId: ing.id,
          name: ing.name,
          qty: q,
          unit: l.unit,
          unitCost: cost,
          baseQty: q * PURCHASE_UNIT_FACTOR[l.unit],
        },
      ]
    })
  }, [lines, ingredients])

  const total = resolved.reduce((s, l) => s + l.qty * l.unitCost, 0)
  const parcelValues = splitInstallments(Math.round(total * 100) / 100, parcels)

  function updateLine(index: number, patch: Partial<Draft>) {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)))
  }

  function pickIngredient(index: number, ingredientId: string) {
    const ing = ingredients.find((i) => i.id === ingredientId)
    const unit = ing ? PURCHASE_UNITS_BY_UNIT[ing.unit][0] : 'kg'
    updateLine(index, { ingredientId, unit })
  }

  function submit() {
    if (resolved.length === 0) {
      setError('Adicione pelo menos um insumo com quantidade maior que zero.')
      return
    }
    if (!dueDate) {
      setError('Informe a data de vencimento da conta a pagar.')
      return
    }
    if (total <= 0) {
      setError('Informe o custo dos itens comprados.')
      return
    }
    const { purchase, payables: created } = registerPurchase({
      supplier,
      invoice,
      lines: resolved,
      payment,
      dueDate,
      installments: parcels,
      notes,
    })
    setDone({ number: purchase.number, total: purchase.total, count: created.length })
    setSupplier('')
    setInvoice('')
    setLines([emptyLine()])
    setInstallments('1')
    setNotes('')
    setError('')
  }

  /** Quantas porções a mais cada produto ganha com a linha comprada. */
  function yieldFor(line: PurchaseLine) {
    return products
      .flatMap((p) => {
        const r = p.recipe.find((x) => x.ingredientId === line.ingredientId)
        if (!r || r.qty <= 0) return []
        return [{ name: p.name, portions: Math.floor(line.baseQty / r.qty) }]
      })
      .filter((x) => x.portions > 0)
      .slice(0, 3)
  }

  return (
    <div className="lm-stack">
      <section className="lm-panel">
        <header className="lm-panel__head">
          <h2>Nova compra de insumos</h2>
          <span className="lm-panel__hint">
            A entrada soma ao estoque e gera automaticamente as contas a pagar
          </span>
        </header>

        <div className="lm-form lm-form--3">
          <label>
            Fornecedor
            <input
              className="lm-input"
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
              placeholder="Ex.: Distribuidora Central"
            />
          </label>
          <label>
            Nota fiscal / documento
            <input
              className="lm-input"
              value={invoice}
              onChange={(e) => setInvoice(e.target.value)}
              placeholder="Opcional"
            />
          </label>
          <label>
            Observações
            <input
              className="lm-input"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Opcional"
            />
          </label>
        </div>

        <div className="lm-tableWrap">
          <table className="lm-table lm-table--form">
            <thead>
              <tr>
                <th>Insumo</th>
                <th>Quantidade</th>
                <th>Unidade</th>
                <th>Custo unitário</th>
                <th>Subtotal</th>
                <th aria-label="Ações" />
              </tr>
            </thead>
            <tbody>
              {lines.map((line, i) => {
                const ing = ingredients.find((x) => x.id === line.ingredientId)
                const units = ing ? PURCHASE_UNITS_BY_UNIT[ing.unit] : (['kg', 'g', 'l', 'ml', 'un'] as PurchaseUnit[])
                const sub = parseNumber(line.qty) * parseNumber(line.unitCost)
                return (
                  <tr key={i}>
                    <td>
                      <select
                        className="lm-input"
                        value={line.ingredientId}
                        onChange={(e) => pickIngredient(i, e.target.value)}
                        aria-label="Insumo"
                      >
                        <option value="">Selecione…</option>
                        {ingredients.map((x) => (
                          <option key={x.id} value={x.id}>
                            {x.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input
                        className="lm-input lm-input--small"
                        inputMode="decimal"
                        value={line.qty}
                        onChange={(e) => updateLine(i, { qty: e.target.value })}
                        placeholder="0"
                        aria-label="Quantidade"
                      />
                    </td>
                    <td>
                      <select
                        className="lm-input lm-input--small"
                        value={line.unit}
                        onChange={(e) => updateLine(i, { unit: e.target.value as PurchaseUnit })}
                        aria-label="Unidade"
                      >
                        {units.map((u) => (
                          <option key={u} value={u}>
                            {PURCHASE_UNIT_LABEL[u]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input
                        className="lm-input lm-input--small"
                        inputMode="decimal"
                        value={line.unitCost}
                        onChange={(e) => updateLine(i, { unitCost: e.target.value })}
                        placeholder="0,00"
                        aria-label="Custo unitário"
                      />
                    </td>
                    <td>{money(sub)}</td>
                    <td>
                      <button
                        type="button"
                        className="lm-btn lm-btn--ghost lm-btn--sm"
                        onClick={() => setLines((prev) => prev.filter((_, j) => j !== i))}
                        disabled={lines.length === 1}
                      >
                        Remover
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <button
          type="button"
          className="lm-btn lm-btn--ghost lm-btn--sm"
          onClick={() => setLines((prev) => [...prev, emptyLine()])}
        >
          + Adicionar insumo
        </button>

        {resolved.length > 0 && (
          <div className="lm-yield">
            <h3>Reflexo no estoque</h3>
            <ul>
              {resolved.map((l, i) => {
                const y = yieldFor(l)
                return (
                  <li key={`${l.ingredientId}-${i}`}>
                    <strong>
                      {fmtQty(l.qty)} {PURCHASE_UNIT_LABEL[l.unit]} de {l.name}
                    </strong>{' '}
                    entram como {fmtQty(l.baseQty)}{' '}
                    {ingredients.find((x) => x.id === l.ingredientId)?.unit}
                    {y.length > 0 && (
                      <span className="lm-yield__portions">
                        {' '}
                        → rende {y.map((x) => `${x.portions} × ${x.name}`).join(' · ')}
                      </span>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        )}

        <div className="lm-form lm-form--4 lm-form--tight">
          <label>
            Forma de pagamento
            <select
              className="lm-input"
              value={payment}
              onChange={(e) => setPayment(e.target.value as typeof payment)}
            >
              {PAYABLE_PAYMENTS.map((m) => (
                <option key={m} value={m}>
                  {PAYMENT_LABEL[m]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Vencimento (1ª parcela)
            <input
              className="lm-input"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
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
          <div className="lm-total">
            <span>Total da compra</span>
            <strong>{money(total)}</strong>
          </div>
        </div>

        {parcels > 1 && total > 0 && (
          <p className="lm-note">
            Serão geradas {parcels} contas a pagar de {money(parcelValues[0])} — vencimentos em{' '}
            {parcelValues
              .map((_, i) => dateBR(addMonths(dueDate, i)))
              .join(', ')}
            .
          </p>
        )}

        {error && <p className="lm-alert">{error}</p>}
        {done && (
          <p className="lm-success">
            Compra #{done.number} registrada ({money(done.total)}). Estoque atualizado e{' '}
            {done.count} conta{done.count > 1 ? 's' : ''} a pagar gerada
            {done.count > 1 ? 's' : ''}.
          </p>
        )}

        <button type="button" className="lm-btn lm-btn--primary" onClick={submit}>
          Registrar compra e gerar contas a pagar
        </button>
      </section>

      <section className="lm-panel">
        <header className="lm-panel__head">
          <h2>Compras registradas</h2>
          <span className="lm-panel__hint">{purchases.length} compra(s)</span>
        </header>
        {purchases.length === 0 ? (
          <p className="lm-empty">Nenhuma compra registrada ainda.</p>
        ) : (
          <div className="lm-tableWrap">
            <table className="lm-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Data</th>
                  <th>Fornecedor</th>
                  <th>Itens</th>
                  <th>Total</th>
                  <th>Pagamento</th>
                  <th>Contas geradas</th>
                </tr>
              </thead>
              <tbody>
                {purchases.map((p) => {
                  const linked = payables.filter((x) => x.purchaseId === p.id)
                  const paid = linked.filter((x) => x.status === 'pago').length
                  return (
                    <tr key={p.id}>
                      <td>{p.number}</td>
                      <td>{dateTime(p.createdAt)}</td>
                      <td>{p.supplier}</td>
                      <td>
                        {p.lines
                          .map((l) => `${fmtQty(l.qty)} ${PURCHASE_UNIT_LABEL[l.unit]} ${l.name}`)
                          .join(' · ')}
                      </td>
                      <td>{money(p.total)}</td>
                      <td>
                        {PAYMENT_LABEL[p.payment]} · {p.installments}x
                      </td>
                      <td>
                        {linked.length} ({paid} paga{paid === 1 ? '' : 's'})
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
