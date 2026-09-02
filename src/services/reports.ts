import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { readOrders, readSales } from './localStore'

export interface ProductProfit {
  productId: string
  name: string
  qty: number
  revenue: number
  cost: number
  profit: number
  margin: number
}

export interface ReportData {
  source: 'supabase' | 'demo'
  revenue: number
  cost: number
  profit: number
  margin: number
  itemsSold: number
  salesCount: number
  ordersCount: number
  avgTicket: number
  byPayment: { method: string; count: number; revenue: number }[]
  byProduct: ProductProfit[]
  recent: { kind: 'PDV' | 'Loja'; number: number; when: string; total: number }[]
}

interface Tx {
  kind: 'PDV' | 'Loja'
  number: number
  when: string
  total: number
  payment: string
  items: { productId: string; name: string; unitPrice: number; unitCost: number; quantity: number }[]
}

function aggregate(
  txs: Tx[],
  salesCount: number,
  ordersCount: number,
  source: 'supabase' | 'demo',
): ReportData {
  let revenue = 0
  let cost = 0
  let itemsSold = 0
  let totalsSum = 0
  const prodMap = new Map<string, ProductProfit>()
  const payMap = new Map<string, { count: number; revenue: number }>()

  for (const t of txs) {
    totalsSum += t.total
    const pay = payMap.get(t.payment) ?? { count: 0, revenue: 0 }
    pay.count += 1
    pay.revenue += t.total
    payMap.set(t.payment, pay)

    for (const it of t.items) {
      const rev = it.unitPrice * it.quantity
      const cst = it.unitCost * it.quantity
      revenue += rev
      cost += cst
      itemsSold += it.quantity
      const pp =
        prodMap.get(it.productId) ??
        { productId: it.productId, name: it.name, qty: 0, revenue: 0, cost: 0, profit: 0, margin: 0 }
      pp.qty += it.quantity
      pp.revenue += rev
      pp.cost += cst
      prodMap.set(it.productId, pp)
    }
  }

  const profit = revenue - cost
  const count = salesCount + ordersCount
  const byProduct = [...prodMap.values()]
    .map((p) => ({ ...p, profit: p.revenue - p.cost, margin: p.revenue ? (p.revenue - p.cost) / p.revenue : 0 }))
    .sort((a, b) => b.profit - a.profit)
  const recent = txs
    .slice()
    .sort((a, b) => b.when.localeCompare(a.when))
    .slice(0, 12)
    .map((t) => ({ kind: t.kind, number: t.number, when: t.when, total: t.total }))

  return {
    source,
    revenue,
    cost,
    profit,
    margin: revenue ? profit / revenue : 0,
    itemsSold,
    salesCount,
    ordersCount,
    avgTicket: count ? totalsSum / count : 0,
    byPayment: [...payMap.entries()]
      .map(([method, v]) => ({ method, ...v }))
      .sort((a, b) => b.revenue - a.revenue),
    byProduct,
    recent,
  }
}

export async function loadReport(): Promise<ReportData> {
  if (!isSupabaseConfigured || !supabase) {
    const sales = readSales()
    const orders = readOrders()
    const txs: Tx[] = [
      ...sales.map((s) => ({
        kind: 'PDV' as const,
        number: s.number,
        when: s.createdAt,
        total: s.total,
        payment: s.payment,
        items: s.items,
      })),
      ...orders.map((o) => ({
        kind: 'Loja' as const,
        number: o.number,
        when: o.createdAt,
        total: o.total,
        payment: o.payment,
        items: o.items,
      })),
    ]
    return aggregate(txs, sales.length, orders.length, 'demo')
  }

  const [sales, saleItems, orders, orderItems] = await Promise.all([
    supabase.from('sales').select('id, number, total, payment_method, created_at'),
    supabase.from('sale_items').select('sale_id, product_id, name, unit_price, unit_cost, quantity'),
    supabase.from('orders').select('id, number, total, payment_method, created_at'),
    supabase.from('order_items').select('order_id, product_id, name, unit_price, unit_cost, quantity'),
  ])

  const err = sales.error || saleItems.error || orders.error || orderItems.error
  if (err) throw err

  const mapItems = (rows: Record<string, unknown>[], fk: string) => {
    const m = new Map<string, Tx['items']>()
    for (const r of rows) {
      const key = String(r[fk])
      const arr = m.get(key) ?? []
      arr.push({
        productId: String(r.product_id),
        name: String(r.name),
        unitPrice: Number(r.unit_price),
        unitCost: Number(r.unit_cost),
        quantity: Number(r.quantity),
      })
      m.set(key, arr)
    }
    return m
  }

  const saleItemsBySale = mapItems(saleItems.data ?? [], 'sale_id')
  const orderItemsByOrder = mapItems(orderItems.data ?? [], 'order_id')

  const txs: Tx[] = [
    ...(sales.data ?? []).map((s: Record<string, unknown>) => ({
      kind: 'PDV' as const,
      number: Number(s.number),
      when: String(s.created_at),
      total: Number(s.total),
      payment: String(s.payment_method),
      items: saleItemsBySale.get(String(s.id)) ?? [],
    })),
    ...(orders.data ?? []).map((o: Record<string, unknown>) => ({
      kind: 'Loja' as const,
      number: Number(o.number),
      when: String(o.created_at),
      total: Number(o.total),
      payment: String(o.payment_method),
      items: orderItemsByOrder.get(String(o.id)) ?? [],
    })),
  ]

  return aggregate(txs, sales.data?.length ?? 0, orders.data?.length ?? 0, 'supabase')
}
