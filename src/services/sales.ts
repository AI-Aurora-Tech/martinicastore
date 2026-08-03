import { isSupabaseConfigured, supabase } from '../lib/supabase'
import type { Operator } from './auth'
import { appendSale } from './localStore'

export interface SaleItemInput {
  productId: string
  name: string
  unitPrice: number
  unitCost: number
  quantity: number
}

export interface SaleInput {
  operator: Operator
  subtotal: number
  discount: number
  total: number
  payment: 'dinheiro' | 'cartao' | 'pix'
  received: number
  change: number
  installments: number
  items: SaleItemInput[]
}

export interface SaleResult {
  number: number | null
  error: string | null
}

/**
 * Registra uma venda do PDV. No modo Supabase grava em `sales` + `sale_items`
 * e retorna o número sequencial gerado pelo banco. No modo demo, registra a
 * venda localmente (para os relatórios) e gera o número.
 */
export async function createSale(input: SaleInput): Promise<SaleResult> {
  if (!isSupabaseConfigured || !supabase) {
    const number = appendSale({
      createdAt: new Date().toISOString(),
      subtotal: input.subtotal,
      discount: input.discount,
      total: input.total,
      payment: input.payment,
      operatorEmail: input.operator.email,
      items: input.items.map((i) => ({
        productId: i.productId,
        name: i.name,
        unitPrice: i.unitPrice,
        unitCost: i.unitCost,
        quantity: i.quantity,
      })),
    })
    return { number, error: null }
  }

  try {
    const { data, error } = await supabase
      .from('sales')
      .insert({
        operator_id: input.operator.id,
        operator_email: input.operator.email,
        subtotal: input.subtotal,
        discount: input.discount,
        total: input.total,
        payment_method: input.payment,
        received: input.received,
        change: input.change,
        installments: input.installments,
      })
      .select('id, number')
      .single()

    if (error || !data) throw error ?? new Error('Falha ao criar venda.')

    const items = input.items.map((i) => ({
      sale_id: data.id,
      product_id: i.productId,
      name: i.name,
      unit_price: i.unitPrice,
      unit_cost: i.unitCost,
      quantity: i.quantity,
      line_total: i.unitPrice * i.quantity,
    }))
    const { error: itemsError } = await supabase.from('sale_items').insert(items)
    if (itemsError) throw itemsError

    return { number: data.number as number, error: null }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao registrar venda.'
    console.error('[sales] erro ao gravar venda:', err)
    return { number: null, error: message }
  }
}
