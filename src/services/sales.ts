import { isSupabaseConfigured, supabase } from '../lib/supabase'
import type { Operator } from './auth'

export interface SaleItemInput {
  productId: string
  name: string
  unitPrice: number
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

const DEMO_SEQ = 'martinica-pdv-seq'

function demoNextNumber(): number {
  try {
    const n = (Number(localStorage.getItem(DEMO_SEQ)) || 0) + 1
    localStorage.setItem(DEMO_SEQ, String(n))
    return n
  } catch {
    return 1
  }
}

/**
 * Registra uma venda do PDV. No modo Supabase grava em `sales` + `sale_items`
 * e retorna o número sequencial gerado pelo banco. No modo demo, gera o número
 * localmente.
 */
export async function createSale(input: SaleInput): Promise<SaleResult> {
  if (!isSupabaseConfigured || !supabase) {
    return { number: demoNextNumber(), error: null }
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
