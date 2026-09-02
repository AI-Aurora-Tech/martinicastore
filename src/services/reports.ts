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
  /** Parte do faturamento efetivamente recebida (exclui fiados/pedidos pendentes). */
  receivedRevenue: number
  /** Parte do lucro bruto já recebida. */
  receivedProfit: number
  /** Lucro bruto ainda a receber (fiados/pedidos pendentes). */
  pendingProfit: number
  itemsSold: number
  salesCount: number
  ordersCount: number
  avgTicket: number
  byPayment: { method: string; count: number; revenue: number }[]
  byProduct: ProductProfit[]
  recent: { kind: 'PDV' | 'Loja'; number: number; when: string; total: number; received: boolean }[]
}

export interface Tx {
  kind: 'PDV' | 'Loja'
  number: number
  when: string
  total: number
  payment: string
  /** Dinheiro já entrou no caixa? (fiado/pedido pendente = false) */
  received: boolean
  items: { productId: string; name: string; unitPrice: number; unitCost: number; quantity: number }[]
}

export type Period = 'dia' | 'semana' | 'mes' | 'tudo'

/** Recorta as transações pelo período escolhido (baseado em `when`). */
export function filterByPeriod(txs: Tx[], period: Period): Tx[] {
  if (period === 'tudo') return txs
  const now = new Date()
  let start: Date
  if (period === 'dia') {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  } else if (period === 'semana') {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6)
  } else {
    start = new Date(now.getFullYear(), now.getMonth(), 1)
  }
  const from = start.getTime()
  return txs.filter((t) => {
    const d = new Date(t.when).getTime()
    return !Number.isNaN(d) && d >= from
  })
}

/** Um pedido/venda conta como RECEBIDO quando o dinheiro entrou no caixa. */
function isReceived(kind: 'PDV' | 'Loja', payment: string, status?: string): boolean {
  const s = (status ?? '').toLowerCase()
  if (kind === 'PDV') return !(payment === 'fiado' && s === 'pending')
  // Loja: recebido quando pago/enviado/entregue/concluído
  return s === 'paid' || s === 'shipped' || s === 'delivered' || s === 'concluida'
}

export function aggregate(txs: Tx[], source: 'supabase' | 'demo'): ReportData {
  let revenue = 0
  let cost = 0
  let receivedRevenue = 0
  let receivedProfit = 0
  let pendingProfit = 0
  let itemsSold = 0
  let totalsSum = 0
  let salesCount = 0
  let ordersCount = 0
  const prodMap = new Map<string, ProductProfit>()
  const payMap = new Map<string, { count: number; revenue: number }>()

  for (const t of txs) {
    totalsSum += t.total
    if (t.kind === 'PDV') salesCount += 1
    else ordersCount += 1

    const pay = payMap.get(t.payment) ?? { count: 0, revenue: 0 }
    pay.count += 1
    pay.revenue += t.total
    payMap.set(t.payment, pay)

    let txProfit = 0
    for (const it of t.items) {
      const rev = it.unitPrice * it.quantity
      const cst = it.unitCost * it.quantity
      revenue += rev
      cost += cst
      txProfit += rev - cst
      itemsSold += it.quantity
      const pp =
        prodMap.get(it.productId) ??
        { productId: it.productId, name: it.name, qty: 0, revenue: 0, cost: 0, profit: 0, margin: 0 }
      pp.qty += it.quantity
      pp.revenue += rev
      pp.cost += cst
      prodMap.set(it.productId, pp)
    }
    if (t.received) {
      receivedRevenue += t.total
      receivedProfit += txProfit
    } else {
      pendingProfit += txProfit
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
    .map((t) => ({ kind: t.kind, number: t.number, when: t.when, total: t.total, received: t.received }))

  return {
    source,
    revenue,
    cost,
    profit,
    margin: revenue ? profit / revenue : 0,
    receivedRevenue,
    receivedProfit,
    pendingProfit,
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

/** Busca TODAS as transações (uma vez); o período é aplicado no componente. */
export async function fetchTransactions(): Promise<{ txs: Tx[]; source: 'supabase' | 'demo' }> {
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
        received: isReceived('PDV', s.payment, s.status),
        items: s.items,
      })),
      ...orders
        .filter((o) => (o.status ?? '').toLowerCase() !== 'canceled')
        .map((o) => ({
          kind: 'Loja' as const,
          number: o.number,
          when: o.createdAt,
          total: o.total,
          payment: o.payment,
          received: isReceived('Loja', o.payment, o.status),
          items: o.items,
        })),
    ]
    return { txs, source: 'demo' }
  }

  const [sales, saleItems, orders, orderItems] = await Promise.all([
    supabase.from('sales').select('id, number, total, payment_method, status, created_at'),
    supabase.from('sale_items').select('sale_id, product_id, name, unit_price, unit_cost, quantity'),
    supabase.from('orders').select('id, number, total, payment_method, status, created_at'),
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
      received: isReceived('PDV', String(s.payment_method), s.status as string | undefined),
      items: saleItemsBySale.get(String(s.id)) ?? [],
    })),
    ...(orders.data ?? [])
      .filter((o: Record<string, unknown>) => String(o.status ?? '').toLowerCase() !== 'canceled')
      .map((o: Record<string, unknown>) => ({
        kind: 'Loja' as const,
        number: Number(o.number),
        when: String(o.created_at),
        total: Number(o.total),
        payment: String(o.payment_method),
        received: isReceived('Loja', String(o.payment_method), o.status as string | undefined),
        items: orderItemsByOrder.get(String(o.id)) ?? [],
      })),
  ]

  return { txs, source: 'supabase' }
}

/** Compatibilidade: relatório consolidado de tudo. */
export async function loadReport(): Promise<ReportData> {
  const { txs, source } = await fetchTransactions()
  return aggregate(txs, source)
}
