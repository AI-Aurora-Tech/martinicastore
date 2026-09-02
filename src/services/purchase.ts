import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { appendPurchase, readPurchases, updatePurchaseLocal } from './localStore'

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
  /** À vista (já paga) → conta paga; senão → conta a pagar. */
  paid?: boolean
  items: PurchaseItemInput[]
}

export interface PurchaseResult {
  number: number | null
  id: string | null
  error: string | null
}

export interface PurchaseSummaryItem {
  productId: string
  name: string
  quantity: number
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
  status?: 'pendente' | 'entregue'
  items: PurchaseSummaryItem[]
}

/**
 * Registra uma COMPRA (pedido ao fornecedor). O estoque NÃO é somado aqui — só
 * quando a compra é marcada como ENTREGUE (receivePurchase). Se `paid` (à vista),
 * já entra como conta paga; senão fica como conta a pagar.
 */
export async function createPurchase(input: PurchaseInput): Promise<PurchaseResult> {
  const total = input.items.reduce((s, i) => s + i.unitCost * i.quantity, 0)

  if (!isSupabaseConfigured || !supabase) {
    const number = appendPurchase({
      createdAt: new Date().toISOString(),
      supplier: input.supplier,
      operatorEmail: input.operatorEmail,
      total,
      paymentMethod: input.paymentMethod,
      paid: !!input.paid,
      status: 'pendente',
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

/** Marca a compra como ENTREGUE e dá entrada no estoque (por variação). */
export async function receivePurchase(p: PurchaseSummary): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured || !supabase) {
    updatePurchaseLocal(p.number, { status: 'entregue' })
    return { error: null }
  }
  const { error } = await supabase.rpc('receive_purchase', { p_purchase_id: p.id })
  return { error: error?.message ?? null }
}

/** Marca a compra como PAGA (conta paga). */
export async function markPurchasePaid(p: PurchaseSummary): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured || !supabase) {
    updatePurchaseLocal(p.number, { paid: true })
    return { error: null }
  }
  const { error } = await supabase
    .from('purchases')
    .update({ paid: true, paid_at: new Date().toISOString() })
    .eq('id', p.id)
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
        items: p.items.map((i) => ({ productId: i.productId, name: i.name, quantity: i.quantity, unitCost: i.unitCost, size: i.size })),
      }))
      .sort((a, b) => b.when.localeCompare(a.when))
  }

  const [purchases, items] = await Promise.all([
    supabase.from('purchases').select('*').order('created_at', { ascending: false }),
    supabase.from('purchase_items').select('purchase_id, product_id, name, quantity, unit_cost, size'),
  ])
  if (purchases.error) throw purchases.error
  if (items.error) throw items.error

  const byPurchase = new Map<string, PurchaseSummaryItem[]>()
  for (const r of items.data ?? []) {
    const k = String(r.purchase_id)
    const arr = byPurchase.get(k) ?? []
    arr.push({ productId: String(r.product_id), name: String(r.name), quantity: Number(r.quantity), unitCost: Number(r.unit_cost), size: (r.size as string) ?? undefined })
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
    status: ((p.status as string) ?? 'pendente') as 'pendente' | 'entregue',
    items: byPurchase.get(String(p.id)) ?? [],
  }))
}
