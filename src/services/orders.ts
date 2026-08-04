import { isSupabaseConfigured, supabase } from '../lib/supabase'
import type { Address, CartItem, ShippingService } from '../types'
import { appendOrder } from './localStore'

export interface OrderInput {
  customerId?: string
  customerName?: string
  customerEmail?: string
  customerPhone?: string
  subtotal: number
  discount: number
  shipping: number
  total: number
  payment: 'pix' | 'cartao' | 'boleto'
  shippingService?: ShippingService
  shippingDays?: number
  address?: Address
  items: CartItem[]
}

export interface OrderResult {
  number: number | null
  id: string | null
  error: string | null
}

/**
 * Registra um pedido feito na loja (checkout da sacola). No modo Supabase grava
 * em `orders` + `order_items`. No modo demo, apenas confirma (sem persistir).
 */
export async function createOrder(input: OrderInput): Promise<OrderResult> {
  if (!isSupabaseConfigured || !supabase) {
    const addrStr = input.address
      ? [input.address.street, input.address.number, input.address.neighborhood,
         input.address.city && `${input.address.city}-${input.address.uf}`, input.address.cep]
          .filter(Boolean).join(', ')
      : undefined
    const number = appendOrder({
      createdAt: new Date().toISOString(),
      subtotal: input.subtotal,
      discount: input.discount,
      shipping: input.shipping,
      total: input.total,
      payment: input.payment,
      status: 'pending',
      customerName: input.customerName,
      customerEmail: input.customerEmail,
      shippingService: input.shippingService,
      shippingDays: input.shippingDays,
      address: addrStr,
      items: input.items.map((i) => ({
        productId: i.product.id,
        name: i.product.name,
        unitPrice: i.product.price,
        unitCost: i.product.cost ?? 0,
        quantity: i.quantity,
      })),
    })
    return { number, id: null, error: null }
  }

  try {
    const { data, error } = await supabase
      .from('orders')
      .insert({
        customer_id: input.customerId ?? null,
        customer_name: input.customerName ?? null,
        customer_email: input.customerEmail ?? null,
        customer_phone: input.customerPhone ?? null,
        subtotal: input.subtotal,
        discount: input.discount,
        shipping: input.shipping,
        total: input.total,
        payment_method: input.payment,
        status: 'pending',
        shipping_service: input.shippingService ?? null,
        shipping_days: input.shippingDays ?? null,
        ship_cep: input.address?.cep ?? null,
        ship_street: input.address?.street ?? null,
        ship_number: input.address?.number ?? null,
        ship_complement: input.address?.complement ?? null,
        ship_neighborhood: input.address?.neighborhood ?? null,
        ship_city: input.address?.city ?? null,
        ship_uf: input.address?.uf ?? null,
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
      unit_cost: i.product.cost ?? 0,
      quantity: i.quantity,
      line_total: i.product.price * i.quantity,
    }))
    const { error: itemsError } = await supabase.from('order_items').insert(items)
    if (itemsError) throw itemsError

    return { number: data.number as number, id: data.id as string, error: null }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao registrar pedido.'
    console.error('[orders] erro ao gravar pedido:', err)
    return { number: null, id: null, error: message }
  }
}
