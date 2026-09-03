import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { readOrders } from './localStore'
import type { Customer } from '../types'

export interface MyOrderItem {
  name: string
  size?: string
  quantity: number
  unitPrice: number
}

export interface MyOrder {
  id: string
  number: number
  when: string
  status: string
  paymentStatus?: string
  payment: string
  subtotal: number
  shipping: number
  total: number
  shippingService?: string
  shippingDays?: number
  address?: string
  /** Pedido com pagamento online iniciado (tem preferência do Mercado Pago). */
  online: boolean
  items: MyOrderItem[]
}

function addrString(row: Record<string, unknown>): string | undefined {
  const parts = [
    row.ship_street, row.ship_number, row.ship_neighborhood,
    row.ship_city && `${row.ship_city}-${row.ship_uf ?? ''}`, row.ship_cep,
  ].filter(Boolean)
  return parts.length ? parts.join(', ') : undefined
}

/** Lista os pedidos do cliente logado (loja online). */
export async function listMyOrders(customer: Customer): Promise<MyOrder[]> {
  if (!isSupabaseConfigured || !supabase) {
    const email = customer.email.trim().toLowerCase()
    return readOrders()
      .filter((o) => (o.customerEmail ?? '').trim().toLowerCase() === email)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((o) => ({
        id: `demo-${o.number}`,
        number: o.number,
        when: o.createdAt,
        status: o.status ?? 'pending',
        payment: o.payment,
        subtotal: o.subtotal,
        shipping: o.shipping,
        total: o.total,
        shippingService: o.shippingService,
        shippingDays: o.shippingDays,
        address: o.address,
        online: !!(o.mpPreferenceId || o.paymentStatus),
        items: o.items.map((i) => ({ name: i.name, quantity: i.quantity, unitPrice: i.unitPrice })),
      }))
  }

  // As RLS já restringem ao próprio cliente; filtramos por id por clareza.
  const { data: orders, error } = await supabase
    .from('orders')
    .select('*')
    .eq('customer_id', customer.id)
    .order('created_at', { ascending: false })
  if (error) throw error
  const ids = (orders ?? []).map((o: Record<string, unknown>) => String(o.id))
  const itemsByOrder = new Map<string, MyOrderItem[]>()
  if (ids.length) {
    const { data: items } = await supabase
      .from('order_items')
      .select('order_id, name, size, unit_price, quantity')
      .in('order_id', ids)
    for (const r of items ?? []) {
      const k = String(r.order_id)
      const arr = itemsByOrder.get(k) ?? []
      arr.push({ name: String(r.name), size: (r.size as string) ?? undefined, quantity: Number(r.quantity), unitPrice: Number(r.unit_price) })
      itemsByOrder.set(k, arr)
    }
  }

  return (orders ?? []).map((o: Record<string, unknown>) => ({
    id: String(o.id),
    number: Number(o.number),
    when: String(o.created_at),
    status: String(o.status ?? 'pending'),
    paymentStatus: (o.payment_status as string) ?? undefined,
    payment: String(o.payment_method ?? ''),
    subtotal: Number(o.subtotal),
    shipping: Number(o.shipping),
    total: Number(o.total),
    shippingService: (o.shipping_service as string) ?? undefined,
    shippingDays: (o.shipping_days as number) ?? undefined,
    address: addrString(o),
    online: !!(o.mp_preference_id || o.payment_status),
    items: itemsByOrder.get(String(o.id)) ?? [],
  }))
}
