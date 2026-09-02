// Registro local de vendas/pedidos usado no MODO DEMO (sem Supabase), para que
// os relatórios tenham dados mesmo sem backend. No modo Supabase, os dados reais
// vêm do banco e estas funções não são usadas.

export interface TxItem {
  productId: string
  name: string
  unitPrice: number
  unitCost: number
  quantity: number
}

export interface SaleRecord {
  number: number
  createdAt: string
  subtotal: number
  discount: number
  total: number
  payment: 'dinheiro' | 'pix' | 'credito' | 'debito' | 'fiado' | 'cartao'
  operatorEmail?: string
  status?: 'paid' | 'pending'
  customerName?: string
  customerPhone?: string
  items: TxItem[]
}

export interface OrderRecord {
  number: number
  createdAt: string
  subtotal: number
  discount: number
  shipping: number
  total: number
  payment: 'pix' | 'cartao' | 'boleto'
  items: TxItem[]
  customerName?: string
  customerEmail?: string
  status?: string
  shippingService?: string
  shippingDays?: number
  address?: string
}

export interface PurchaseItem {
  productId: string
  name: string
  quantity: number
  unitCost: number
}

export interface PurchaseRecord {
  number: number
  createdAt: string
  supplier?: string
  operatorEmail?: string
  total: number
  items: PurchaseItem[]
}

const SALES_KEY = 'martinica-sales'
const ORDERS_KEY = 'martinica-orders'
const PURCHASES_KEY = 'martinica-purchases'

function read<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T[]) : []
  } catch {
    return []
  }
}

function write<T>(key: string, value: T[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* ignore quota / privacy-mode */
  }
}

export function readSales(): SaleRecord[] {
  return read<SaleRecord>(SALES_KEY)
}

export function readOrders(): OrderRecord[] {
  return read<OrderRecord>(ORDERS_KEY)
}

export function appendSale(sale: Omit<SaleRecord, 'number'>): number {
  const all = readSales()
  const number = all.length + 1
  write(SALES_KEY, [...all, { ...sale, number }])
  return number
}

export function appendOrder(order: Omit<OrderRecord, 'number'>): number {
  const all = readOrders()
  const number = all.length + 1
  write(ORDERS_KEY, [...all, { status: 'pending', ...order, number }])
  return number
}

export function readPurchases(): PurchaseRecord[] {
  return read<PurchaseRecord>(PURCHASES_KEY)
}

export function appendPurchase(purchase: Omit<PurchaseRecord, 'number'>): number {
  const all = readPurchases()
  const number = all.length + 1
  write(PURCHASES_KEY, [...all, { ...purchase, number }])
  return number
}

/** Atualiza o status de um pedido demo (por número). */
export function updateOrderStatusLocal(number: number, status: string): void {
  const all = readOrders()
  write(
    ORDERS_KEY,
    all.map((o) => (o.number === number ? { ...o, status } : o)),
  )
}
