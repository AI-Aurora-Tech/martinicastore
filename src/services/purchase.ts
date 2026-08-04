import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { appendPurchase, readPurchases } from './localStore'

export interface PurchaseItemInput {
  productId: string
  name: string
  quantity: number
  unitCost: number
}

export interface PurchaseInput {
  supplier?: string
  supplierId?: string
  supplierPhone?: string
  operatorEmail?: string
  items: PurchaseItemInput[]
}

export interface PurchaseResult {
  number: number | null
  error: string | null
}

export interface PurchaseSummary {
  number: number
  when: string
  supplier?: string
  operatorEmail?: string
  total: number
  items: { name: string; quantity: number; unitCost: number }[]
}

/**
 * Registra uma entrada de estoque (compra de fornecedor). No modo Supabase grava
 * em `purchases` + `purchase_items` (um trigger soma ao estoque) e atualiza o
 * custo do produto. No modo demo, registra localmente. Em ambos, o chamador
 * atualiza o estoque/custo em memória para refletir na hora.
 */
export async function createPurchase(input: PurchaseInput): Promise<PurchaseResult> {
  const total = input.items.reduce((s, i) => s + i.unitCost * i.quantity, 0)

  if (!isSupabaseConfigured || !supabase) {
    const number = appendPurchase({
      createdAt: new Date().toISOString(),
      supplier: input.supplier,
      operatorEmail: input.operatorEmail,
      total,
      items: input.items.map((i) => ({
        productId: i.productId,
        name: i.name,
        quantity: i.quantity,
        unitCost: i.unitCost,
      })),
    })
    return { number, error: null }
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
      })
      .select('id, number')
      .single()
    if (error || !data) throw error ?? new Error('Falha ao registrar a compra.')

    const items = input.items.map((i) => ({
      purchase_id: data.id,
      product_id: i.productId,
      name: i.name,
      quantity: i.quantity,
      unit_cost: i.unitCost,
      line_total: i.unitCost * i.quantity,
    }))
    const { error: itemsErr } = await supabase.from('purchase_items').insert(items)
    if (itemsErr) throw itemsErr

    // Atualiza o custo do produto para o custo da compra (apenas custo — o
    // estoque é somado pelo trigger no banco).
    for (const i of input.items) {
      if (i.unitCost > 0) {
        await supabase.from('products').update({ cost: i.unitCost }).eq('id', i.productId)
      }
    }

    return { number: data.number as number, error: null }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao registrar a compra.'
    console.error('[purchase] erro:', err)
    return { number: null, error: message }
  }
}

export async function listPurchases(): Promise<PurchaseSummary[]> {
  if (!isSupabaseConfigured || !supabase) {
    return readPurchases()
      .map((p) => ({
        number: p.number,
        when: p.createdAt,
        supplier: p.supplier,
        operatorEmail: p.operatorEmail,
        total: p.total,
        items: p.items.map((i) => ({ name: i.name, quantity: i.quantity, unitCost: i.unitCost })),
      }))
      .sort((a, b) => b.when.localeCompare(a.when))
  }

  const [purchases, items] = await Promise.all([
    supabase.from('purchases').select('*').order('created_at', { ascending: false }),
    supabase.from('purchase_items').select('purchase_id, name, quantity, unit_cost'),
  ])
  if (purchases.error) throw purchases.error
  if (items.error) throw items.error

  const byPurchase = new Map<string, PurchaseSummary['items']>()
  for (const r of items.data ?? []) {
    const k = String(r.purchase_id)
    const arr = byPurchase.get(k) ?? []
    arr.push({ name: String(r.name), quantity: Number(r.quantity), unitCost: Number(r.unit_cost) })
    byPurchase.set(k, arr)
  }

  return (purchases.data ?? []).map((p) => ({
    number: Number(p.number),
    when: String(p.created_at),
    supplier: (p.supplier as string) ?? undefined,
    operatorEmail: (p.operator_email as string) ?? undefined,
    total: Number(p.total),
    items: byPurchase.get(String(p.id)) ?? [],
  }))
}
