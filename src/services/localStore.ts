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
  size?: string
}

export interface PurchaseRecord {
  number: number
  createdAt: string
  supplier?: string
  operatorEmail?: string
  total: number
  paymentMethod?: string
  paid?: boolean
  status?: 'pendente' | 'entregue'
  items: PurchaseItem[]
}

export interface ExpenseRecord {
  id: string
  description: string
  category?: string
  amount: number
  dueDate?: string
  paid: boolean
  paidAt?: string
  recurring: boolean
  recurrence?: 'mensal' | 'semanal'
  createdAt: string
}

const SALES_KEY = 'martinica-sales'
const ORDERS_KEY = 'martinica-orders'
const PURCHASES_KEY = 'martinica-purchases'
const EXPENSES_KEY = 'martinica-expenses'

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

/** Atualiza campos de uma compra demo (por número). */
export function updatePurchaseLocal(number: number, patch: Partial<PurchaseRecord>): void {
  const all = readPurchases()
  write(PURCHASES_KEY, all.map((p) => (p.number === number ? { ...p, ...patch } : p)))
}

export function readExpenses(): ExpenseRecord[] {
  return read<ExpenseRecord>(EXPENSES_KEY)
}

export function appendExpense(exp: Omit<ExpenseRecord, 'id'>): ExpenseRecord {
  const all = readExpenses()
  const rec: ExpenseRecord = { ...exp, id: `exp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}` }
  write(EXPENSES_KEY, [...all, rec])
  return rec
}

export function updateExpenseLocal(id: string, patch: Partial<ExpenseRecord>): void {
  const all = readExpenses()
  write(EXPENSES_KEY, all.map((e) => (e.id === id ? { ...e, ...patch } : e)))
}

export function removeExpenseLocal(id: string): void {
  write(EXPENSES_KEY, readExpenses().filter((e) => e.id !== id))
}

/** Atualiza o status de um pedido demo (por número). */
export function updateOrderStatusLocal(number: number, status: string): void {
  const all = readOrders()
  write(
    ORDERS_KEY,
    all.map((o) => (o.number === number ? { ...o, status } : o)),
  )
}

/** Atualiza o status de uma venda do PDV demo (por número). */
export function updateSaleStatusLocal(number: number, status: string): void {
  const all = readSales()
  write(
    SALES_KEY,
    all.map((s) => (s.number === number ? { ...s, status: status as SaleRecord['status'] } : s)),
  )
}
