import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { appendPurchase, readPurchases, updatePurchaseLocal, type Installment } from './localStore'

export type { Installment } from './localStore'

/** Parcela informada ao registrar a compra (sem os campos de baixa). */
export interface InstallmentInput {
  n: number
  amount: number
  dueDate: string
}

export interface PurchaseItemInput {
  productId: string
  name: string
  quantity: number
  unitCost: number
  /** Variação comprada (quando o produto tem variações). */
  size?: string
}

export interface PurchaseInput {
  supplier?: string
  supplierId?: string
  supplierPhone?: string
  operatorEmail?: string
  /** Forma de pagamento da compra. */
  paymentMethod?: string
  /** À vista (já paga) → conta paga; senão → conta(s) a pagar (parcelas). */
  paid?: boolean
  /** Parcelas com data de vencimento (quando não é à vista). */
  installments?: InstallmentInput[]
  items: PurchaseItemInput[]
}

export interface PurchaseResult {
  number: number | null
  id: string | null
  error: string | null
}

export interface PurchaseSummaryItem {
  /** id da linha no banco (usado para receber item a item). */
  itemId?: string
  productId: string
  name: string
  /** Quantidade PEDIDA. */
  quantity: number
  /** Quantidade já RECEBIDA (0 = nada; = quantity quando completo). */
  received: number
  unitCost: number
  size?: string
}

export interface PurchaseSummary {
  id: string
  number: number
  when: string
  supplier?: string
  operatorEmail?: string
  total: number
  paymentMethod?: string
  paid?: boolean
  status?: 'pendente' | 'parcial' | 'entregue' | 'cancelado'
  installments?: Installment[]
  items: PurchaseSummaryItem[]
}

/**
 * Registra uma COMPRA (pedido ao fornecedor). O estoque NÃO é somado aqui — só
 * quando a compra é marcada como ENTREGUE (receivePurchase). Se `paid` (à vista),
 * já entra como conta paga; senão fica como conta a pagar.
 */
export async function createPurchase(input: PurchaseInput): Promise<PurchaseResult> {
  const total = input.items.reduce((s, i) => s + i.unitCost * i.quantity, 0)
  // À vista => sem parcelas. Senão, guarda as parcelas com vencimento (não pagas).
  const installments: Installment[] | undefined = input.paid
    ? undefined
    : (input.installments ?? []).map((p) => ({ n: p.n, amount: p.amount, dueDate: p.dueDate, paid: false }))

  if (!isSupabaseConfigured || !supabase) {
    const number = appendPurchase({
      createdAt: new Date().toISOString(),
      supplier: input.supplier,
      operatorEmail: input.operatorEmail,
      total,
      paymentMethod: input.paymentMethod,
      paid: !!input.paid,
      status: 'pendente',
      installments,
      items: input.items.map((i) => ({
        productId: i.productId, name: i.name, quantity: i.quantity, unitCost: i.unitCost, size: i.size,
      })),
    })
    return { number, id: `demo-${number}`, error: null }
  }

  try {
    const { data, error } = await supabase
      .from('purchases')
      .insert({
        supplier: input.supplier ?? null,
        supplier_id: input.supplierId ?? null,
        supplier_phone: input.supplierPhone ?? null,
        operator_email: input.operatorEmail ?? null,
        total,
        payment_method: input.paymentMethod ?? null,
        paid: !!input.paid,
        paid_at: input.paid ? new Date().toISOString() : null,
        status: 'pendente',
        installments: installments ?? null,
      })
      .select('id, number')
      .single()
    if (error || !data) throw error ?? new Error('Falha ao registrar a compra.')

    const items = input.items.map((i) => ({
      purchase_id: data.id,
      product_id: i.productId,
      name: i.name,
      size: i.size ?? null,
      quantity: i.quantity,
      unit_cost: i.unitCost,
      line_total: i.unitCost * i.quantity,
    }))
    const { error: itemsErr } = await supabase.from('purchase_items').insert(items)
    if (itemsErr) throw itemsErr

    return { number: data.number as number, id: data.id as string, error: null }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao registrar a compra.'
    console.error('[purchase] erro:', err)
    return { number: null, id: null, error: message }
  }
}

export interface NotifyPurchaseResult {
  sent: boolean
  /** Motivo quando não enviou: 'sem-grupo', 'sem-fornecedor', 'demo' ou o erro. */
  reason: string | null
}

/**
 * Envia o pedido de compra para o GRUPO de WhatsApp do fornecedor, via Edge
 * Function `notify-purchase` (Evolution API). É best-effort: a compra já está
 * registrada e nada é desfeito se o envio falhar. No modo demo (sem Supabase)
 * não há backend — devolve sent:false.
 */
export async function notifyPurchase(purchaseId: string | null): Promise<NotifyPurchaseResult> {
  if (!isSupabaseConfigured || !supabase || !purchaseId) return { sent: false, reason: 'demo' }
  try {
    const { data, error } = await supabase.functions.invoke('notify-purchase', {
      body: { purchaseId },
    })
    if (error) {
      let detail = error.message
      // FunctionsHttpError guarda a resposta em `context`; lê o {error} do corpo.
      const ctx = (error as { context?: unknown }).context
      if (ctx && typeof (ctx as Response).json === 'function') {
        try {
          const body = await (ctx as Response).json()
          if (body?.error) detail = body.error
        } catch {
          /* corpo não-JSON */
        }
      }
      console.warn('[purchase] envio ao grupo falhou:', detail)
      return { sent: false, reason: detail }
    }
    const d = data as { sent?: boolean; error?: string } | null
    return { sent: Boolean(d?.sent), reason: d?.sent ? null : (d?.error ?? 'falha ao enviar') }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Falha ao enviar o pedido ao grupo.'
    console.warn('[purchase] envio ao grupo falhou:', err)
    return { sent: false, reason: message }
  }
}

/**
 * Editar e receber valem enquanto a compra está ABERTA — pendente ou
 * parcialmente recebida. Depois de 100% recebida ela fecha e não muda mais.
 */
export function isPurchaseOpen(p: Pick<PurchaseSummary, 'status'>): boolean {
  const st = p.status ?? 'pendente'
  return st === 'pendente' || st === 'parcial'
}
export const canEditPurchase = isPurchaseOpen
export const canReceivePurchase = isPurchaseOpen

/** Quanto ainda falta receber de um item. */
export function faltaReceber(i: Pick<PurchaseSummaryItem, 'quantity' | 'received'>): number {
  return Math.max(0, i.quantity - (i.received ?? 0))
}

/**
 * CANCELA a compra. Se ela já estava ENTREGUE, o estoque que entrou é devolvido
 * (RPC `cancel_purchase`, migração 0021). A compra continua no histórico,
 * marcada como cancelada, e sai das contas a pagar e do relatório financeiro.
 */
export async function cancelPurchase(p: PurchaseSummary): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured || !supabase) {
    updatePurchaseLocal(p.number, { status: 'cancelado' })
    return { error: null }
  }
  const { error } = await supabase.rpc('cancel_purchase', { p_purchase_id: p.id })
  return { error: error?.message ?? null }
}

/**
 * EDITA uma compra ABERTA: fornecedor, pagamento, parcelas e itens (regravados
 * por inteiro). Não mexe em estoque — o estoque reflete o que foi RECEBIDO, e
 * editar não recebe nada. A RPC preserva o já recebido de cada linha e recusa
 * deixar uma quantidade abaixo do que já entrou.
 */
export async function updatePurchase(
  p: PurchaseSummary,
  input: PurchaseInput,
): Promise<{ error: string | null }> {
  if (!canEditPurchase(p)) {
    return {
      error: p.status === 'entregue'
        ? 'Esta compra já foi recebida por completo e não pode mais ser alterada.'
        : 'Uma compra cancelada não pode ser editada.',
    }
  }
  const total = input.items.reduce((s, i) => s + i.unitCost * i.quantity, 0)
  const installments: Installment[] | undefined = input.paid
    ? undefined
    : (input.installments ?? []).map((x) => ({ n: x.n, amount: x.amount, dueDate: x.dueDate, paid: false }))

  // Nada que já foi recebido pode sumir nem encolher abaixo do que entrou. A
  // RPC também barra isso, mas conferir aqui dá o aviso na hora — e é o único
  // guarda no modo demo, que não passa pelo banco.
  const chave = (i: { productId: string; size?: string }) => `${i.productId}|${i.size ?? ''}`
  const novaQtd = new Map<string, number>()
  for (const i of input.items) novaQtd.set(chave(i), (novaQtd.get(chave(i)) ?? 0) + i.quantity)
  for (const antigo of p.items) {
    const recebido = Math.min(antigo.received ?? 0, antigo.quantity)
    if (recebido <= 0) continue
    const agora = novaQtd.get(chave(antigo)) ?? 0
    if (agora < recebido) {
      return {
        error: `"${antigo.name}" já teve ${recebido} un. recebidas — a quantidade não pode ficar abaixo disso`
          + (agora === 0 ? ' (o item não pode ser removido).' : `. Você tentou deixar ${agora}.`),
      }
    }
  }

  if (!isSupabaseConfigured || !supabase) {
    // Preserva o já recebido de cada linha (casando produto + variação).
    const recebidoPor = new Map<string, number>()
    for (const it of p.items) {
      const r = Math.min(it.received ?? 0, it.quantity)
      if (r > 0) recebidoPor.set(chave(it), (recebidoPor.get(chave(it)) ?? 0) + r)
    }
    const items = input.items.map((i) => ({
      productId: i.productId, name: i.name, quantity: i.quantity, unitCost: i.unitCost, size: i.size,
      received: Math.min(recebidoPor.get(chave(i)) ?? 0, i.quantity),
    }))
    const recebeuAlgo = items.some((i) => (i.received ?? 0) > 0)
    const completo = items.every((i) => (i.received ?? 0) >= i.quantity)
    updatePurchaseLocal(p.number, {
      supplier: input.supplier,
      total,
      paymentMethod: input.paymentMethod,
      paid: !!input.paid,
      installments,
      items,
      status: completo ? 'entregue' : recebeuAlgo ? 'parcial' : 'pendente',
    })
    return { error: null }
  }

  try {
    const { error: upErr } = await supabase
      .from('purchases')
      .update({
        supplier: input.supplier ?? null,
        supplier_id: input.supplierId ?? null,
        supplier_phone: input.supplierPhone ?? null,
        total,
        payment_method: input.paymentMethod ?? null,
        paid: !!input.paid,
        paid_at: input.paid ? new Date().toISOString() : null,
        installments: installments ?? null,
      })
      .eq('id', p.id)
    if (upErr) throw upErr

    // Itens + estoque numa transação só (a RPC também recalcula o total).
    const { error: itemsErr } = await supabase.rpc('update_purchase_items', {
      p_purchase_id: p.id,
      p_items: input.items.map((i) => ({
        product_id: i.productId,
        name: i.name,
        size: i.size ?? '',
        quantity: i.quantity,
        unit_cost: i.unitCost,
      })),
    })
    if (itemsErr) throw itemsErr
    return { error: null }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao salvar as alterações.'
    console.error('[purchase] erro ao editar:', err)
    return { error: message }
  }
}

export interface ReceiveLine {
  /** id da linha (Supabase). No modo demo, o índice do item. */
  itemId?: string
  index: number
  quantity: number
}

/**
 * RECEBE quantidades de uma compra — parcial ou total. Soma ao estoque só o que
 * foi recebido e recalcula o status: pendente → parcial → entregue. Depois de
 * 100% recebida a compra fecha.
 */
export async function receivePurchaseItems(
  p: PurchaseSummary,
  linhas: ReceiveLine[],
): Promise<{ error: string | null; status?: PurchaseSummary['status'] }> {
  const validas = linhas.filter((l) => l.quantity > 0)
  if (!validas.length) return { error: 'Informe ao menos uma quantidade para receber.' }
  if (!canReceivePurchase(p)) {
    return {
      error: p.status === 'entregue'
        ? 'Esta compra já foi recebida por completo.'
        : 'Uma compra cancelada não recebe itens.',
    }
  }
  for (const l of validas) {
    const item = p.items[l.index]
    if (!item) return { error: 'Item não encontrado na compra.' }
    if (l.quantity > faltaReceber(item)) {
      return { error: `"${item.name}": faltam ${faltaReceber(item)} un. — não dá para receber ${l.quantity}.` }
    }
  }

  if (!isSupabaseConfigured || !supabase) {
    const rec = readPurchases().find((r) => r.number === p.number)
    if (!rec) return { error: 'Compra não encontrada.' }
    const items = rec.items.map((it, idx) => {
      const add = validas.filter((l) => l.index === idx).reduce((s, l) => s + l.quantity, 0)
      return add ? { ...it, received: (it.received ?? 0) + add } : it
    })
    const recebeuAlgo = items.some((it) => (it.received ?? 0) > 0)
    const completo = items.every((it) => (it.received ?? 0) >= it.quantity)
    const status = completo ? 'entregue' : recebeuAlgo ? 'parcial' : 'pendente'
    updatePurchaseLocal(p.number, { items, status })
    return { error: null, status }
  }

  const { data, error } = await supabase.rpc('receive_purchase_items', {
    p_purchase_id: p.id,
    p_items: validas.map((l) => ({ item_id: l.itemId ?? p.items[l.index]?.itemId, quantity: l.quantity })),
  })
  if (error) return { error: error.message }
  return { error: null, status: (data as PurchaseSummary['status']) ?? undefined }
}

/** Atalho: recebe tudo o que ainda falta. */
export async function receivePurchase(p: PurchaseSummary) {
  return receivePurchaseItems(
    p,
    p.items.map((it, index) => ({ itemId: it.itemId, index, quantity: faltaReceber(it) })),
  )
}

/** Marca a compra INTEIRA como PAGA (todas as parcelas, se houver). */
export async function markPurchasePaid(p: PurchaseSummary): Promise<{ error: string | null }> {
  const now = new Date().toISOString()
  if (!isSupabaseConfigured || !supabase) {
    const all = readPurchases().find((r) => r.number === p.number)
    const installments = all?.installments?.map((i) => ({ ...i, paid: true, paidAt: i.paidAt ?? now }))
    updatePurchaseLocal(p.number, { paid: true, ...(installments ? { installments } : {}) })
    return { error: null }
  }
  const installments = p.installments?.map((i) => ({ ...i, paid: true, paidAt: i.paidAt ?? now }))
  const { error } = await supabase
    .from('purchases')
    .update({ paid: true, paid_at: now, ...(installments ? { installments } : {}) })
    .eq('id', p.id)
  return { error: error?.message ?? null }
}

/** Baixa UMA parcela de uma compra parcelada. */
export async function payPurchaseInstallment(
  p: { id: string; number?: number },
  n: number,
): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured || !supabase) {
    if (p.number == null) return { error: null }
    const rec = readPurchases().find((r) => r.number === p.number)
    if (!rec?.installments) return { error: null }
    const now = new Date().toISOString()
    const installments = rec.installments.map((i) => (i.n === n ? { ...i, paid: true, paidAt: now } : i))
    const allPaid = installments.every((i) => i.paid)
    updatePurchaseLocal(p.number, { installments, paid: allPaid })
    return { error: null }
  }
  const { error } = await supabase.rpc('pay_purchase_installment', { p_purchase_id: p.id, p_n: n })
  return { error: error?.message ?? null }
}

export async function listPurchases(): Promise<PurchaseSummary[]> {
  if (!isSupabaseConfigured || !supabase) {
    return readPurchases()
      .map((p) => ({
        id: `demo-${p.number}`,
        number: p.number,
        when: p.createdAt,
        supplier: p.supplier,
        operatorEmail: p.operatorEmail,
        total: p.total,
        paymentMethod: p.paymentMethod,
        paid: p.paid,
        status: p.status ?? 'pendente',
        installments: p.installments,
        items: p.items.map((i) => ({ productId: i.productId, name: i.name, quantity: i.quantity, received: i.received ?? 0, unitCost: i.unitCost, size: i.size })),
      }))
      .sort((a, b) => b.when.localeCompare(a.when))
  }

  const [purchases, items] = await Promise.all([
    supabase.from('purchases').select('*').order('created_at', { ascending: false }),
    supabase.from('purchase_items').select('id, purchase_id, product_id, name, quantity, received, unit_cost, size'),
  ])
  if (purchases.error) throw purchases.error
  if (items.error) throw items.error

  const byPurchase = new Map<string, PurchaseSummaryItem[]>()
  for (const r of items.data ?? []) {
    const k = String(r.purchase_id)
    const arr = byPurchase.get(k) ?? []
    arr.push({ itemId: String(r.id), productId: String(r.product_id), name: String(r.name), quantity: Number(r.quantity), received: Number(r.received ?? 0), unitCost: Number(r.unit_cost), size: (r.size as string) ?? undefined })
    byPurchase.set(k, arr)
  }

  return (purchases.data ?? []).map((p: Record<string, unknown>) => ({
    id: String(p.id),
    number: Number(p.number),
    when: String(p.created_at),
    supplier: (p.supplier as string) ?? undefined,
    operatorEmail: (p.operator_email as string) ?? undefined,
    total: Number(p.total),
    paymentMethod: (p.payment_method as string) ?? undefined,
    paid: Boolean(p.paid),
    status: ((p.status as string) ?? 'pendente') as PurchaseSummary['status'],
    installments: (p.installments as Installment[] | null) ?? undefined,
    items: byPurchase.get(String(p.id)) ?? [],
  }))
}
