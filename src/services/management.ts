import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { readOrders, readSales, updateOrderStatusLocal } from './localStore'

export type OrderStatus = 'pending' | 'paid' | 'shipped' | 'delivered' | 'canceled'

export interface TxLine {
  name: string
  quantity: number
  unitPrice: number
  size?: string | null
}

export interface Transaction {
  kind: 'Loja' | 'PDV'
  id: string
  number: number
  when: string
  who: string
  email?: string
  subtotal: number
  shipping: number
  total: number
  payment: string
  status: OrderStatus | 'concluida'
  shippingService?: string
  shippingDays?: number
  address?: string
  items: TxLine[]
}

export interface TransactionsResult {
  txs: Transaction[]
  source: 'supabase' | 'demo'
}

function addrFromOrder(o: Record<string, unknown>): string | undefined {
  const parts = [
    o.ship_street,
    o.ship_number,
    o.ship_complement,
    o.ship_neighborhood,
    o.ship_city && `${o.ship_city} - ${o.ship_uf ?? ''}`,
    o.ship_cep,
  ].filter(Boolean)
  return parts.length ? parts.join(', ') : undefined
}

export async function listTransactions(): Promise<TransactionsResult> {
  if (!isSupabaseConfigured || !supabase) {
    const orders = readOrders()
    const sales = readSales()
    const txs: Transaction[] = [
      ...orders.map((o) => ({
        kind: 'Loja' as const,
        id: `demo-order-${o.number}`,
        number: o.number,
        when: o.createdAt,
        who: o.customerName || 'Cliente',
        email: o.customerEmail,
        subtotal: o.subtotal,
        shipping: o.shipping,
        total: o.total,
        payment: o.payment,
        status: (o.status as OrderStatus) ?? 'pending',
        shippingService: o.shippingService,
        shippingDays: o.shippingDays,
        address: o.address,
        items: o.items.map((i) => ({ name: i.name, quantity: i.quantity, unitPrice: i.unitPrice })),
      })),
      ...sales.map((s) => ({
        kind: 'PDV' as const,
        id: `demo-sale-${s.number}`,
        number: s.number,
        when: s.createdAt,
        who: s.operatorEmail || 'Operador',
        subtotal: s.subtotal,
        shipping: 0,
        total: s.total,
        payment: s.payment,
        status: 'concluida' as const,
        items: s.items.map((i) => ({ name: i.name, quantity: i.quantity, unitPrice: i.unitPrice })),
      })),
    ]
    txs.sort((a, b) => b.when.localeCompare(a.when))
    return { txs, source: 'demo' }
  }

  const [orders, orderItems, sales, saleItems] = await Promise.all([
    supabase.from('orders').select('*').order('created_at', { ascending: false }),
    supabase.from('order_items').select('order_id, name, quantity, unit_price, size'),
    supabase.from('sales').select('*').order('created_at', { ascending: false }),
    supabase.from('sale_items').select('sale_id, name, quantity, unit_price'),
  ])
  const err = orders.error || orderItems.error || sales.error || saleItems.error
  if (err) throw err

  const byOrder = new Map<string, TxLine[]>()
  for (const r of orderItems.data ?? []) {
    const k = String(r.order_id)
    const arr = byOrder.get(k) ?? []
    arr.push({ name: String(r.name), quantity: Number(r.quantity), unitPrice: Number(r.unit_price), size: r.size as string | null })
    byOrder.set(k, arr)
  }
  const bySale = new Map<string, TxLine[]>()
  for (const r of saleItems.data ?? []) {
    const k = String(r.sale_id)
    const arr = bySale.get(k) ?? []
    arr.push({ name: String(r.name), quantity: Number(r.quantity), unitPrice: Number(r.unit_price) })
    bySale.set(k, arr)
  }

  const txs: Transaction[] = [
    ...(orders.data ?? []).map((o) => ({
      kind: 'Loja' as const,
      id: String(o.id),
      number: Number(o.number),
      when: String(o.created_at),
      who: (o.customer_name as string) || (o.customer_email as string) || 'Cliente',
      email: (o.customer_email as string) ?? undefined,
      subtotal: Number(o.subtotal),
      shipping: Number(o.shipping),
      total: Number(o.total),
      payment: String(o.payment_method),
      status: ((o.status as OrderStatus) ?? 'pending'),
      shippingService: (o.shipping_service as string) ?? undefined,
      shippingDays: (o.shipping_days as number) ?? undefined,
      address: addrFromOrder(o),
      items: byOrder.get(String(o.id)) ?? [],
    })),
    ...(sales.data ?? []).map((s) => ({
      kind: 'PDV' as const,
      id: String(s.id),
      number: Number(s.number),
      when: String(s.created_at),
      who: (s.operator_email as string) || 'Operador',
      subtotal: Number(s.subtotal),
      shipping: 0,
      total: Number(s.total),
      payment: String(s.payment_method),
      status: 'concluida' as const,
      items: bySale.get(String(s.id)) ?? [],
    })),
  ]
  txs.sort((a, b) => b.when.localeCompare(a.when))
  return { txs, source: 'supabase' }
}

export async function updateOrderStatus(
  tx: Transaction,
  status: OrderStatus,
): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured || !supabase) {
    updateOrderStatusLocal(tx.number, status)
    return { error: null }
  }
  const { error } = await supabase.from('orders').update({ status }).eq('id', tx.id)
  return { error: error?.message ?? null }
}
