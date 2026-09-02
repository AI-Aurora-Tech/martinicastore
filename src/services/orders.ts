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
    // O pedido é criado NO SERVIDOR (Edge Function place-order), que recalcula
    // preços, custos e frete a partir do banco. O cliente não grava direto em
    // `orders` — as RLS bloqueiam INSERT do cliente (anti-fraude de preço).
    const { data, error } = await supabase.functions.invoke('place-order', {
      body: {
        customerId: input.customerId ?? null,
        customerName: input.customerName ?? null,
        customerEmail: input.customerEmail ?? null,
        customerPhone: input.customerPhone ?? null,
        payment: input.payment,
        shippingService: input.shippingService ?? null,
        address: input.address ?? null,
        items: input.items.map((i) => ({
          productId: i.product.id,
          size: i.size ?? null,
          quantity: i.quantity,
        })),
      },
    })

    if (error) {
      let detail = error.message
      const ctx = (error as { context?: unknown }).context
      if (ctx && typeof (ctx as Response).json === 'function') {
        try {
          const body = await (ctx as Response).json()
          if (body?.error) detail = body.error
        } catch { /* ignore */ }
      }
      if (/failed to send a request|fetch/i.test(detail)) {
        detail =
          "Não foi possível alcançar a função 'place-order'. Ela provavelmente ainda não foi publicada (faça o deploy) — veja PLACE-ORDER.md."
      }
      throw new Error(detail)
    }
    const d = data as { id?: string; number?: number; error?: string } | null
    if (d?.error) throw new Error(d.error)
    if (!d?.id) throw new Error('Falha ao criar pedido.')

    return { number: (d.number ?? null) as number | null, id: d.id, error: null }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao registrar pedido.'
    console.error('[orders] erro ao gravar pedido:', err)
    return { number: null, id: null, error: message }
  }
}
