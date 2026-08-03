import { isSupabaseConfigured, supabase } from '../lib/supabase'
import type { CartItem } from '../types'

export interface OrderInput {
  customerName?: string
  customerEmail?: string
  subtotal: number
  discount: number
  shipping: number
  total: number
  payment: 'pix' | 'cartao' | 'boleto'
  items: CartItem[]
}

export interface OrderResult {
  number: number | null
  error: string | null
}

/**
 * Registra um pedido feito na loja (checkout da sacola). No modo Supabase grava
 * em `orders` + `order_items`. No modo demo, apenas confirma (sem persistir).
 */
export async function createOrder(input: OrderInput): Promise<OrderResult> {
  if (!isSupabaseConfigured || !supabase) {
    return { number: null, error: null }
  }

  try {
    const { data, error } = await supabase
      .from('orders')
      .insert({
        customer_name: input.customerName ?? null,
        customer_email: input.customerEmail ?? null,
        subtotal: input.subtotal,
        discount: input.discount,
        shipping: input.shipping,
        total: input.total,
        payment_method: input.payment,
        status: 'pending',
      })
      .select('id, number')
      .single()

    if (error || !data) throw error ?? new Error('Falha ao criar pedido.')

    const items = input.items.map((i) => ({
      order_id: data.id,
      product_id: i.product.id,
      name: i.product.name,
      size: i.size ?? null,
      unit_price: i.product.price,
      quantity: i.quantity,
      line_total: i.product.price * i.quantity,
    }))
    const { error: itemsError } = await supabase.from('order_items').insert(items)
    if (itemsError) throw itemsError

    return { number: data.number as number, error: null }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao registrar pedido.'
    console.error('[orders] erro ao gravar pedido:', err)
    return { number: null, error: message }
  }
}
