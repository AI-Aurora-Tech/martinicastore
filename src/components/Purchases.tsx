import { useEffect, useMemo, useState } from 'react'
import { BRL } from '../data/products'
import type { Product, ProductVariant, Supplier } from '../types'
import { useCatalog } from '../context/CatalogContext'
import {
  canEditPurchase,
  canReceivePurchase,
  cancelPurchase,
  createPurchase,
  faltaReceber,
  listPurchases,
  markPurchasePaid,
  notifyPurchase,
  receivePurchaseItems,
  updatePurchase,
  type PurchaseSummary,
} from '../services/purchase'
import { hasVariants } from '../services/variants'
import { listSuppliers } from '../services/suppliers'
import { pdfTable, printReport } from '../services/exportPdf'
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
const MAX_PARCELAS = 24

function when(iso: string) {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('pt-BR')
}
function whenDate(iso: string) {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('pt-BR')
}
function todayISO() {
  const n = new Date()
  return new Date(n.getFullYear(), n.getMonth(), n.getDate()).toISOString().slice(0, 10)
}
/** Soma `m` meses a uma data ISO (yyyy-mm-dd), preservando o dia quando possível. */
function addMonthsISO(iso: string, m: number) {
  const [y, mo, d] = iso.split('-').map(Number)
  const base = new Date(y, (mo - 1) + m, d)
  return new Date(base.getFullYear(), base.getMonth(), base.getDate()).toISOString().slice(0, 10)
}
/** Divide `total` em `n` parcelas (centavos ajustados na última). */
function splitAmounts(total: number, n: number): number[] {
  if (n <= 1) return [Math.round(total * 100) / 100]
  const base = Math.floor((total / n) * 100) / 100
  const arr = Array(n).fill(base)
  arr[n - 1] = Math.round((total - base * (n - 1)) * 100) / 100
  return arr
}
const lineKey = (l: { product: Product; size?: string }) => `${l.product.id}__${l.size ?? ''}`

/** Traduz os motivos que a Edge Function devolve. */
const MOTIVO: Record<string, string> = {
  demo: 'Modo demo: sem backend para enviar o WhatsApp. Configure o Supabase.',
  'sem-destino': 'O fornecedor não tem grupo nem WhatsApp cadastrado. Preencha em "Gerenciar".',
  'sem-fornecedor': 'Esta compra foi registrada sem fornecedor, então não há para quem enviar.',
  'sem-grupo': 'O fornecedor não tem grupo de WhatsApp cadastrado.',
  forbidden: 'Sua conta não tem permissão para enviar. Entre com um usuário admin.',
  unauthorized: 'Sessão expirada. Entre novamente na Gestão.',
}

export function Purchases({ operatorEmail }: Props) {
  const { products, upsertLocal } = useCatalog()
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [supplierId, setSupplierId] = useState('')
  const [showSuppliers, setShowSuppliers] = useState(false)
  const [query, setQuery] = useState('')
  const [lines, setLines] = useState<Line[]>([])
  const [payment, setPayment] = useState('Pix')
  const [paid, setPaid] = useState(false)
  const [parcelas, setParcelas] = useState(1)
  const [dueDates, setDueDates] = useState<string[]>([todayISO()])
  const [lastOrder, setLastOrder] = useState<
    { id: string | null; supplierName?: string; hasDestino: boolean } | null
  >(null)
  const [sendingWa, setSendingWa] = useState(false)
  /** Compra sendo editada (null = registrando uma nova). */
  const [editing, setEditing] = useState<PurchaseSummary | null>(null)
  /** Compra com o painel de recebimento aberto, e o que foi digitado por item. */
  const [receiving, setReceiving] = useState<PurchaseSummary | null>(null)
  const [recQty, setRecQty] = useState<number[]>([])
  const [pick, setPick] = useState<Product | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
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
  const amounts = splitAmounts(total, parcelas)

  function setParcelasCount(nRaw: number) {
    const n = Math.max(1, Math.min(MAX_PARCELAS, Math.round(nRaw || 1)))
    setParcelas(n)
    setDueDates((prev) => {
      const next = prev.slice(0, n)
      const start = prev[0] || todayISO()
      while (next.length < n) next.push(addMonthsISO(start, next.length))
      return next
    })
  }

  function addProduct(p: Product) {
    setQuery('')
    setSuccess(null)
    setLastOrder(null)
    // Se o produto tem fornecedor cadastrado e nenhum foi escolhido, usa o dele.
    if (!supplierId && p.supplierId && suppliers.some((s) => s.id === p.supplierId)) {
      setSupplierId(p.supplierId)
    }
    if (hasVariants(p)) { setPick(p); return }
    addLine(p, undefined)
  }
  function addLine(p: Product, size?: string) {
    setLastOrder(null)
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
    // Não à vista: exige uma data de vencimento por parcela.
    const installments = paid
      ? undefined
      : dueDates.map((d, i) => ({ n: i + 1, amount: amounts[i], dueDate: d }))
    if (!paid && installments!.some((p) => !p.dueDate)) {
      setError('Informe a data de vencimento de cada parcela.')
      return
    }
    const pergunta = editing
      ? `Salvar as alterações da compra nº ${String(editing.number).padStart(6, '0')} (${BRL.format(total)})?`
      : `Registrar esta compra (${BRL.format(total)})?`
    if (!confirm(pergunta)) return
    setSaving(true)
    setError(null)
    setSuccess(null)

    const payload = {
      supplier: supplier?.name,
      supplierId: supplier?.id,
      supplierPhone: supplier?.phone,
      operatorEmail,
      paymentMethod: payment,
      paid,
      installments,
      items: lines.map((l) => ({
        productId: l.product.id, name: l.product.name, quantity: l.quantity, unitCost: l.unitCost, size: l.size,
      })),
    }

    // Editando: salva por cima e volta ao modo "nova compra".
    if (editing) {
      const { error: upErr } = await updatePurchase(editing, payload)
      setSaving(false)
      if (upErr) { setError(upErr); return }
      const num = String(editing.number).padStart(6, '0')
      cancelEdit()
      setSuccess(`Compra nº ${num} atualizada.`)
      loadHistory()
      return
    }

    const { number, id, error: err } = await createPurchase(payload)
    setSaving(false)
    if (err) { setError(err); return }

    // Guarda o pedido registrado: só agora o botão de WhatsApp fica ativo.
    setLastOrder({
      id,
      supplierName: supplier?.name,
      hasDestino: Boolean(supplier?.whatsappGroup?.trim() || supplier?.phone?.trim()),
    })
    const parcelaMsg = paid
      ? 'paga (à vista)'
      : `a pagar em ${parcelas}x`
    setSuccess(
      `Compra registrada${number ? ` (nº ${String(number).padStart(6, '0')})` : ''} — ${parcelaMsg}. `
        + 'Agora clique em "Enviar pedido (WhatsApp)". O estoque será somado quando marcar como ENTREGUE.',
    )
    setLines([])
    setPaid(false)
    setParcelas(1)
    setDueDates([todayISO()])
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

  /** Carrega a compra no formulário de cima para edição. */
  function startEdit(h: PurchaseSummary) {
    if (!canEditPurchase(h)) return
    const carregadas: Line[] = []
    const faltando: string[] = []
    for (const it of h.items) {
      const prod = products.find((p) => p.id === it.productId)
      if (prod) carregadas.push({ product: prod, quantity: it.quantity, unitCost: it.unitCost, size: it.size })
      else faltando.push(it.name)
    }
    setEditing(h)
    setLines(carregadas)
    setSupplierId(suppliers.find((s) => s.name === h.supplier)?.id ?? '')
    setPayment(h.paymentMethod || 'Pix')
    setPaid(!!h.paid)
    const parc = h.installments?.length ?? 1
    setParcelas(Math.max(1, parc))
    setDueDates(h.installments?.length ? h.installments.map((i) => i.dueDate) : [todayISO()])
    setLastOrder(null)
    setError(
      faltando.length
        ? `Itens que não estão mais no catálogo foram deixados de fora: ${faltando.join(', ')}.`
        : null,
    )
    setSuccess(
      h.status === 'parcial'
        ? 'Esta compra tem itens já recebidos: eles não podem ser reduzidos abaixo do que entrou.'
        : null,
    )
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function cancelEdit() {
    setEditing(null)
    setLines([])
    setPaid(false)
    setParcelas(1)
    setDueDates([todayISO()])
    setError(null)
    setSuccess(null)
  }

  async function cancel(h: PurchaseSummary) {
    if (busyId || h.status === 'cancelado') return
    const jaRecebeu = h.items.reduce((acc, i) => acc + Math.min(i.received ?? 0, i.quantity), 0)
    const devolve = jaRecebeu > 0
      ? `\n\nAs ${jaRecebeu} un. já recebidas serão DEVOLVIDAS (retiradas do estoque).`
      : ''
    if (!confirm(
      `Cancelar a compra nº ${String(h.number).padStart(6, '0')}?${devolve}`
      + '\n\nEla sai das contas a pagar e do relatório financeiro, mas continua no histórico.'
    )) return
    setBusyId(h.id)
    setError(null)
    const { error: err } = await cancelPurchase(h)
    setBusyId(null)
    if (err) { setError(err); return }
    if (editing?.id === h.id) cancelEdit()
    // Sai do estoque só o que realmente entrou (recebimento parcial incluído).
    const recebidos = h.items.filter((i) => (i.received ?? 0) > 0)
      .map((i) => ({ ...i, quantity: Math.min(i.received ?? 0, i.quantity) }))
    if (recebidos.length) removeStockLocal(recebidos)
    setHistory((prev) => prev.map((x) => (x.id === h.id ? { ...x, status: 'cancelado' } : x)))
    setSuccess(`Compra nº ${String(h.number).padStart(6, '0')} cancelada.`)
    loadHistory()
  }

  /** Espelha no catálogo em memória a devolução de estoque do cancelamento. */
  function removeStockLocal(items: PurchaseSummary['items']) {
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
          const sub = its.filter((i) => i.size === v.label).reduce((s, i) => s + i.quantity, 0)
          return sub ? { ...v, stock: Math.max(0, v.stock - sub) } : v
        })
        upsertLocal({ ...p, variants, stock: variants.reduce((s, v) => s + Math.max(0, v.stock), 0) })
      } else {
        const sub = its.reduce((s, i) => s + i.quantity, 0)
        upsertLocal({ ...p, stock: Math.max(0, (p.stock ?? 0) - sub) })
      }
    }
  }

  /** Abre o painel de recebimento já preenchido com o que falta de cada item. */
  function startReceive(h: PurchaseSummary) {
    if (!canReceivePurchase(h) || busyId) return
    setReceiving(h)
    setRecQty(h.items.map((i) => faltaReceber(i)))
    setError(null)
    setSuccess(null)
  }

  async function confirmReceive() {
    const h = receiving
    if (!h || busyId) return
    const linhas = h.items.map((it, index) => ({
      itemId: it.itemId,
      index,
      quantity: Math.max(0, Math.min(recQty[index] ?? 0, faltaReceber(it))),
    }))
    const total = linhas.reduce((s, l) => s + l.quantity, 0)
    if (total === 0) { setError('Informe ao menos uma quantidade para receber.'); return }

    setBusyId(h.id)
    setError(null)
    const { error: err, status } = await receivePurchaseItems(h, linhas)
    setBusyId(null)
    if (err) { setError(err); return }

    // Espelha no catálogo em memória só o que entrou agora.
    addStockLocal(
      linhas.filter((l) => l.quantity > 0).map((l) => ({ ...h.items[l.index], quantity: l.quantity })),
    )
    const novoStatus = status ?? (h.items.every((it, i) => (it.received ?? 0) + linhas[i].quantity >= it.quantity)
      ? 'entregue' : 'parcial')
    setHistory((prev) => prev.map((x) => (x.id === h.id
      ? {
          ...x,
          status: novoStatus,
          items: x.items.map((it, i) => ({ ...it, received: (it.received ?? 0) + linhas[i].quantity })),
        }
      : x)))
    setReceiving(null)
    setSuccess(
      novoStatus === 'entregue'
        ? `Compra nº ${String(h.number).padStart(6, '0')} recebida por completo — pedido fechado.`
        : `Recebimento parcial registrado na compra nº ${String(h.number).padStart(6, '0')} — ${total} un. no estoque.`,
    )
    loadHistory()
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

  function exportPdf() {
    const rows = history.map((h) => {
      const itens = h.items.map((i) => `${i.quantity}x ${i.name}${i.size ? ` (${i.size})` : ''}`).join('; ')
      const pag = `${h.paymentMethod || '—'}${h.installments && h.installments.length > 1 ? ` ${h.installments.length}x` : ''}`
      return [
        String(h.number).padStart(6, '0'),
        whenDate(h.when),
        h.supplier || '—',
        pag,
        h.status === 'entregue' ? 'Entregue' : 'Pendente',
        h.paid ? 'Paga' : 'A pagar',
        itens,
        BRL.format(h.total),
      ]
    })
    const totalGeral = history.reduce((s, h) => s + h.total, 0)
    const body =
      pdfTable(
        ['Nº', 'Data', 'Fornecedor', 'Pagamento', 'Entrega', 'Situação', 'Itens', 'Total'],
        rows,
        ['l', 'l', 'l', 'l', 'c', 'c', 'l', 'r'],
      ) +
      `<p style="text-align:right;font-weight:700;margin-top:4px">Total das compras: ${BRL.format(totalGeral)}</p>`
    printReport('Compras (pedidos)', body)
  }

  /** Envia o pedido pela Evolution — direto, sem abrir o WhatsApp no navegador. */
  async function sendWhatsApp() {
    if (!lastOrder) { setError('Registre o pedido antes de enviar pelo WhatsApp.'); return }
    setError(null)
    setSendingWa(true)
    const { sent, reason } = await notifyPurchase(lastOrder.id)
    setSendingWa(false)
    const quem = lastOrder.supplierName ? `"${lastOrder.supplierName}"` : 'o fornecedor'
    if (sent) {
      setSuccess(`Pedido enviado para ${quem} no WhatsApp.`)
      return
    }
    setError(MOTIVO[reason ?? ''] ?? `Não consegui enviar o pedido: ${reason ?? 'motivo desconhecido'}.`)
  }

  return (
    <div className="purch">
      <section className="purch__new admin__tablewrap" style={{ padding: '1.1rem 1.2rem' }}>
        <h3 className="purch__title">
          {editing
            ? `Editando a compra nº ${String(editing.number).padStart(6, '0')}`
            : 'Novo pedido de compra'}
        </h3>
        {editing && (
          <p className="purch__hint" style={{ marginTop: 0 }}>
            Alterando itens, fornecedor, pagamento e parcelas.{' '}
            <button type="button" className="checkout__link" onClick={cancelEdit}>
              cancelar edição
            </button>
          </p>
        )}

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

        {!paid && (
          <div className="purch__parcelas">
            <label className="checkout__field purch__parcelas-n">
              <span>Parcelas</span>
              <input
                type="number" min={1} max={MAX_PARCELAS} value={parcelas}
                onChange={(e) => setParcelasCount(Number(e.target.value))}
              />
            </label>
            <div className="purch__vencs">
              {dueDates.map((d, i) => (
                <label key={i} className="checkout__field purch__venc">
                  <span>{parcelas > 1 ? `Parcela ${i + 1}` : 'Vencimento'} · {BRL.format(amounts[i] ?? 0)}</span>
                  <input
                    type="date" value={d}
                    onChange={(e) => setDueDates((prev) => prev.map((x, ix) => (ix === i ? e.target.value : x)))}
                  />
                </label>
              ))}
            </div>
          </div>
        )}

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
            disabled={!lastOrder || !lastOrder.hasDestino || sendingWa}
            onClick={sendWhatsApp}
            title={
              !lastOrder
                ? 'Registre o pedido de compra primeiro'
                : lastOrder.hasDestino
                  ? 'Envia o pedido pelo WhatsApp da loja, sem abrir o navegador'
                  : 'O fornecedor não tem grupo nem WhatsApp cadastrado'
            }
          >
            <span aria-hidden="true">💬</span>{' '}
            {sendingWa ? 'Enviando…' : 'Enviar pedido (WhatsApp)'}
          </button>
          <button className="btn btn--primary purch__register" disabled={saving || lines.length === 0} onClick={register}>
            {saving
              ? 'Salvando…'
              : editing
                ? '💾 Salvar alterações'
                : '🧾 Registrar pedido de compra'}
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
        <div className="purch__hist-head">
          <h3 className="purch__title">Compras</h3>
          <button className="reports__refresh" onClick={exportPdf} disabled={history.length === 0}>⤓ Exportar PDF</button>
        </div>
        {history.length === 0 ? (
          <p className="purch__empty">Nenhuma compra registrada ainda.</p>
        ) : (
          <ul className="purch__hist-list">
            {history.map((h) => (
              <li key={h.id} className="purch__hist">
                <div className="purch__hist-row">
                <div className="purch__hist-main">
                  <strong>nº {String(h.number).padStart(6, '0')}</strong>
                  <small>
                    {when(h.when)} · {h.supplier || 'sem fornecedor'} · {h.items.reduce((s, i) => s + i.quantity, 0)} un. · {h.paymentMethod || '—'}
                    {h.installments && h.installments.length > 1 ? ` · ${h.installments.length}x` : ''}
                  </small>
                  <div className="purch__badges">
                    {h.status === 'cancelado' ? (
                      <span className="purch__badge is-danger">✖ Cancelada</span>
                    ) : h.status === 'entregue' ? (
                      <span className="purch__badge is-ok">✓ Recebida por completo</span>
                    ) : (() => {
                      const pedido = h.items.reduce((s2, i) => s2 + i.quantity, 0)
                      const recebido = h.items.reduce((s2, i) => s2 + Math.min(i.received ?? 0, i.quantity), 0)
                      return (
                        <span className="purch__badge is-wait">
                          {recebido > 0
                            ? `◑ Parcial — ${recebido} de ${pedido} un.`
                            : '⏳ Pendente de entrega'}
                        </span>
                      )
                    })()}
                    {h.status !== 'cancelado' && (
                      <span className={`purch__badge ${h.paid ? 'is-ok' : 'is-danger'}`}>
                        {h.paid ? '✓ Paga' : '💰 A pagar'}
                      </span>
                    )}
                    {h.status !== 'cancelado' && h.installments && h.installments.length > 1 && !h.paid && (
                      <span className="purch__badge is-wait">
                        {h.installments.filter((i) => i.paid).length}/{h.installments.length} parcelas pagas
                      </span>
                    )}
                  </div>
                  {h.installments && h.installments.length > 1 && !h.paid && (
                    <small className="purch__next-venc">
                      Próx. venc.: {(() => {
                        const nxt = h.installments.filter((i) => !i.paid).sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0]
                        return nxt ? `${whenDate(nxt.dueDate)} (${BRL.format(nxt.amount)})` : '—'
                      })()}
                    </small>
                  )}
                </div>
                <div className="purch__hist-side">
                  <strong className="purch__hist-total">{BRL.format(h.total)}</strong>
                  <div className="purch__hist-actions">
                    {h.status === 'cancelado' ? (
                      <span className="purch__meta-cancel">Compra cancelada — fora do financeiro.</span>
                    ) : (
                      <>
                        {canReceivePurchase(h) && (
                          <button
                            className="btn btn--primary"
                            disabled={busyId === h.id}
                            onClick={() => startReceive(h)}
                            title="Registrar o que chegou — pode ser só uma parte"
                          >
                            ↧ Receber
                          </button>
                        )}
                        {!h.paid && (
                          <button className="btn btn--ghost" disabled={busyId === h.id} onClick={() => pay(h)}>Marcar pago</button>
                        )}
                        {canEditPurchase(h) && (
                          <button
                            className="btn btn--ghost"
                            disabled={busyId === h.id || saving}
                            onClick={() => startEdit(h)}
                            title={h.status === 'entregue'
                              ? 'Alterar a compra — o estoque é ajustado pela diferença'
                              : 'Alterar itens, fornecedor, pagamento e parcelas'}
                          >
                            ✎ Editar
                          </button>
                        )}
                        <button
                          className="btn btn--ghost purch__cancelbtn"
                          disabled={busyId === h.id}
                          onClick={() => cancel(h)}
                          title={h.status === 'entregue'
                            ? 'Cancelar e devolver o estoque que entrou'
                            : 'Cancelar esta compra'}
                        >
                          ✖ Cancelar
                        </button>
                      </>
                    )}
                  </div>
                </div>
                </div>

                {receiving?.id === h.id && (
                  <div className="purch__receive">
                    <h4>Receber itens da compra nº {String(h.number).padStart(6, '0')}</h4>
                    <p>Informe quanto chegou de cada item. Já vem preenchido com o que falta — ajuste para receber só uma parte.</p>
                    <table className="purch__receive-table">
                      <thead>
                        <tr><th>Item</th><th>Pedido</th><th>Já recebido</th><th>Falta</th><th>Recebendo agora</th></tr>
                      </thead>
                      <tbody>
                        {h.items.map((it, idx) => {
                          const falta = faltaReceber(it)
                          return (
                            <tr key={`${it.productId}-${it.size ?? ''}-${idx}`}>
                              <td><strong>{it.name}{it.size ? ` · ${it.size}` : ''}</strong></td>
                              <td>{it.quantity}</td>
                              <td>{Math.min(it.received ?? 0, it.quantity)}</td>
                              <td>{falta}</td>
                              <td>
                                <input
                                  className="purch__receive-qty"
                                  inputMode="numeric"
                                  disabled={falta === 0}
                                  value={recQty[idx] ?? 0}
                                  onChange={(e) => {
                                    const v = Math.max(0, Math.min(falta, Math.round(Number(e.target.value) || 0)))
                                    setRecQty((prev) => prev.map((x, i) => (i === idx ? v : x)))
                                  }}
                                />
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                    <div className="purch__receive-actions">
                      <button type="button" className="checkout__link" onClick={() => setRecQty(h.items.map((i) => faltaReceber(i)))}>
                        receber tudo o que falta
                      </button>
                      <button type="button" className="btn btn--ghost" onClick={() => setReceiving(null)}>Cancelar</button>
                      <button
                        type="button"
                        className="btn btn--primary"
                        disabled={busyId === h.id}
                        onClick={confirmReceive}
                      >
                        {busyId === h.id ? 'Registrando…' : '↧ Confirmar recebimento'}
                      </button>
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  className="purch__hist-toggle"
                  onClick={() => setOpenId(openId === h.id ? null : h.id)}
                >
                  {openId === h.id
                    ? '▲ ocultar itens'
                    : `▼ ver ${h.items.length} ${h.items.length === 1 ? 'item comprado' : 'itens comprados'}`}
                </button>
                {openId === h.id && (
                  <ul className="purch__hist-items">
                    {h.items.map((it, idx) => (
                      <li key={idx}>
                        <span>{it.quantity}x {it.name}{it.size ? ` · ${it.size}` : ''}</span>
                        <span className="purch__hist-itemcost">
                          {BRL.format(it.unitCost)}/un · {BRL.format(it.unitCost * it.quantity)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
