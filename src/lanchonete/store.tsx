// ---------------------------------------------------------------------------
// Estado global da Lanchonete Martinica.
//
// Tudo (produtos, insumos, pedidos, compras, contas a pagar e usuários) vive
// num único objeto persistido no localStorage. Isso mantém o app funcionando
// sem backend, mantendo as regras de negócio num só lugar.
// ---------------------------------------------------------------------------
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { seedState, STATE_VERSION } from './seed'
import {
  PURCHASE_UNIT_FACTOR,
  type AppState,
  type Ingredient,
  type Order,
  type OrderStatus,
  type Payable,
  type Product,
  type Purchase,
  type PurchaseLine,
  type User,
} from './types'

const STORAGE_KEY = 'lanchonete-martinica:v1'

/** Rascunho de despesa avulsa (vira conta a pagar). */
export interface Expense {
  description: string
  supplier?: string
  category: Payable['category']
  amount: number
  dueDate: string
  payment: Payable['payment']
  installments: number
  paid: boolean
}

function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return seedState()
    const parsed = JSON.parse(raw) as AppState
    if (!parsed || parsed.version !== STATE_VERSION) return seedState()
    // Blindagem contra estados salvos por versões incompletas.
    return {
      ...seedState(),
      ...parsed,
      counters: {
        order: parsed.counters?.order ?? 1,
        purchase: parsed.counters?.purchase ?? 1,
      },
    }
  } catch {
    return seedState()
  }
}

function saveState(state: AppState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Cota cheia ou storage bloqueado — o app segue funcionando em memória.
  }
}

export function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

/** Soma o custo dos insumos da ficha técnica de um produto. */
export function productCost(product: Product, ingredients: Ingredient[]): number {
  return product.recipe.reduce((sum, line) => {
    const ing = ingredients.find((i) => i.id === line.ingredientId)
    return sum + (ing ? ing.avgCost * line.qty : 0)
  }, 0)
}

/**
 * Quantas porções do produto o estoque atual permite vender.
 *
 * É o gargalo da ficha técnica: se uma porção de batata usa 500 g e há 5 kg em
 * estoque, saem 10 porções. Retorna `null` quando o produto não tem ficha
 * técnica (não consome estoque).
 */
export function productAvailability(
  product: Product,
  ingredients: Ingredient[],
): number | null {
  if (product.recipe.length === 0) return null
  let min = Infinity
  for (const line of product.recipe) {
    const ing = ingredients.find((i) => i.id === line.ingredientId)
    if (!ing || line.qty <= 0) continue
    min = Math.min(min, Math.floor(ing.stock / line.qty))
  }
  return Number.isFinite(min) ? Math.max(0, min) : null
}

/** Adiciona (ou subtrai, com sinal negativo) as quantidades da ficha técnica. */
function applyRecipe(
  ingredients: Ingredient[],
  product: Product | undefined,
  qty: number,
  sign: 1 | -1,
): Ingredient[] {
  if (!product) return ingredients
  return ingredients.map((ing) => {
    const line = product.recipe.find((r) => r.ingredientId === ing.id)
    if (!line) return ing
    const next = round3(ing.stock + sign * line.qty * qty)
    return { ...ing, stock: Math.max(0, next) }
  })
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/** Soma `months` meses a uma data ISO (YYYY-MM-DD). */
export function addMonths(iso: string, months: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, (m ?? 1) - 1 + months, d ?? 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`
}

/** Divide um valor em N parcelas, jogando a diferença de centavos na última. */
export function splitInstallments(total: number, n: number): number[] {
  const count = Math.max(1, Math.floor(n))
  const base = Math.floor((total * 100) / count) / 100
  const parts = Array.from({ length: count }, () => base)
  parts[count - 1] = round2(total - base * (count - 1))
  return parts
}

export interface OrderDraft {
  channel: Order['channel']
  customer?: string
  table?: string
  items: Order['items']
  discount: number
  payment: Order['payment']
  cashReceived?: number
  operator: string
}

export interface PurchaseDraft {
  supplier: string
  invoice?: string
  lines: PurchaseLine[]
  payment: Purchase['payment']
  dueDate: string
  installments: number
  notes?: string
}

interface StoreValue extends AppState {
  /** Registra a venda, baixa o estoque e coloca o pedido na fila. */
  placeOrder: (draft: OrderDraft) => Order
  setOrderStatus: (id: string, status: OrderStatus) => void
  cancelOrder: (id: string) => void
  /** Entrada de mercadoria: soma estoque, recalcula custo médio e gera contas. */
  registerPurchase: (draft: PurchaseDraft) => { purchase: Purchase; payables: Payable[] }
  addExpense: (draft: Expense) => Payable[]
  payPayable: (id: string, date?: string) => void
  reopenPayable: (id: string) => void
  removePayable: (id: string) => void
  saveProduct: (product: Product) => void
  removeProduct: (id: string) => void
  saveIngredient: (ingredient: Ingredient) => void
  removeIngredient: (id: string) => void
  adjustStock: (id: string, newStock: number) => void
  saveUser: (user: User) => void
  removeUser: (id: string) => void
  resetDemo: () => void
}

const StoreContext = createContext<StoreValue | null>(null)

export function LanchoneteStoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(loadState)

  // Espelho do estado para as ações que precisam LER o estado atual e devolver
  // o objeto criado na mesma chamada (número do pedido, contas geradas etc.).
  const ref = useRef(state)
  ref.current = state

  useEffect(() => {
    saveState(state)
  }, [state])

  const placeOrder = useCallback((draft: OrderDraft): Order => {
    const current = ref.current
    const subtotal = round2(draft.items.reduce((s, i) => s + i.unitPrice * i.qty, 0))
    const discount = round2(Math.max(0, Math.min(draft.discount, subtotal)))
    const total = round2(subtotal - discount)

    const order: Order = {
      id: uid('ord'),
      number: current.counters.order,
      createdAt: new Date().toISOString(),
      channel: draft.channel,
      customer: draft.customer?.trim() || undefined,
      table: draft.table?.trim() || undefined,
      items: draft.items.map((i) => ({ ...i })),
      subtotal,
      discount,
      total,
      payment: draft.payment,
      cashReceived: draft.payment === 'dinheiro' ? draft.cashReceived : undefined,
      change:
        draft.payment === 'dinheiro' && draft.cashReceived != null
          ? round2(Math.max(0, draft.cashReceived - total))
          : undefined,
      status: 'fila',
      operator: draft.operator,
    }

    setState((prev) => {
      // Baixa de estoque no momento em que a venda é registrada.
      let ingredients = prev.ingredients
      for (const item of order.items) {
        const product = prev.products.find((p) => p.id === item.productId)
        ingredients = applyRecipe(ingredients, product, item.qty, -1)
      }
      return {
        ...prev,
        ingredients,
        orders: [order, ...prev.orders],
        counters: { ...prev.counters, order: Math.max(prev.counters.order + 1, order.number + 1) },
      }
    })

    return order
  }, [])

  const setOrderStatus = useCallback((id: string, status: OrderStatus) => {
    setState((prev) => ({
      ...prev,
      orders: prev.orders.map((o) =>
        o.id === id
          ? {
              ...o,
              status,
              deliveredAt: status === 'entregue' ? new Date().toISOString() : o.deliveredAt,
            }
          : o,
      ),
    }))
  }, [])

  const cancelOrder = useCallback((id: string) => {
    setState((prev) => {
      const order = prev.orders.find((o) => o.id === id)
      if (!order || order.status === 'cancelado') return prev
      // Cancelou: devolve os insumos ao estoque.
      let ingredients = prev.ingredients
      for (const item of order.items) {
        const product = prev.products.find((p) => p.id === item.productId)
        ingredients = applyRecipe(ingredients, product, item.qty, 1)
      }
      return {
        ...prev,
        ingredients,
        orders: prev.orders.map((o) =>
          o.id === id
            ? { ...o, status: 'cancelado' as OrderStatus, canceledAt: new Date().toISOString() }
            : o,
        ),
      }
    })
  }, [])

  const registerPurchase = useCallback((draft: PurchaseDraft) => {
    const current = ref.current
    const total = round2(draft.lines.reduce((s, l) => s + l.qty * l.unitCost, 0))
    const installments = Math.max(1, Math.floor(draft.installments))

    const purchase: Purchase = {
      id: uid('cmp'),
      number: current.counters.purchase,
      createdAt: new Date().toISOString(),
      supplier: draft.supplier.trim() || 'Fornecedor não informado',
      invoice: draft.invoice?.trim() || undefined,
      lines: draft.lines.map((l) => ({ ...l })),
      total,
      payment: draft.payment,
      dueDate: draft.dueDate,
      installments,
      notes: draft.notes?.trim() || undefined,
    }

    // Uma conta a pagar por parcela, com vencimento mês a mês.
    const payables: Payable[] = splitInstallments(total, installments).map((amount, i) => ({
      id: uid('pag'),
      description:
        installments > 1
          ? `Compra #${purchase.number} — ${purchase.supplier} (${i + 1}/${installments})`
          : `Compra #${purchase.number} — ${purchase.supplier}`,
      supplier: purchase.supplier,
      origin: 'compra',
      category: 'insumos',
      purchaseId: purchase.id,
      amount,
      dueDate: addMonths(purchase.dueDate, i),
      payment: purchase.payment,
      status: 'aberto',
      installment: { n: i + 1, of: installments },
      createdAt: new Date().toISOString(),
    }))

    setState((prev) => {
      // Entrada no estoque com recálculo do custo médio ponderado.
      const ingredients = prev.ingredients.map((ing) => {
        const lines = purchase.lines.filter((l) => l.ingredientId === ing.id)
        if (lines.length === 0) return ing
        let stock = ing.stock
        let avgCost = ing.avgCost
        for (const line of lines) {
          if (line.baseQty <= 0) continue
          const costPerBase = (line.qty * line.unitCost) / line.baseQty
          const nextStock = stock + line.baseQty
          avgCost =
            nextStock > 0
              ? round2((stock * avgCost + line.baseQty * costPerBase) / nextStock)
              : round2(costPerBase)
          stock = round3(nextStock)
        }
        return { ...ing, stock, avgCost }
      })

      return {
        ...prev,
        ingredients,
        purchases: [purchase, ...prev.purchases],
        payables: [...payables, ...prev.payables],
        counters: {
          ...prev.counters,
          purchase: Math.max(prev.counters.purchase + 1, purchase.number + 1),
        },
      }
    })

    return { purchase, payables }
  }, [])

  const addExpense = useCallback((draft: Expense) => {
    const amounts = splitInstallments(round2(draft.amount), draft.installments)
    const created: Payable[] = amounts.map((amount, i) => ({
      id: uid('pag'),
      description:
        draft.installments > 1
          ? `${draft.description} (${i + 1}/${draft.installments})`
          : draft.description,
      supplier: draft.supplier?.trim() || undefined,
      origin: 'despesa' as const,
      category: draft.category,
      amount,
      dueDate: addMonths(draft.dueDate, i),
      payment: draft.payment,
      status: draft.paid && i === 0 ? ('pago' as const) : ('aberto' as const),
      paidAt: draft.paid && i === 0 ? draft.dueDate : undefined,
      createdAt: new Date().toISOString(),
    }))
    setState((prev) => ({ ...prev, payables: [...created, ...prev.payables] }))
    return created
  }, [])

  const payPayable = useCallback((id: string, date?: string) => {
    setState((prev) => ({
      ...prev,
      payables: prev.payables.map((p) =>
        p.id === id
          ? { ...p, status: 'pago', paidAt: date ?? new Date().toISOString().slice(0, 10) }
          : p,
      ),
    }))
  }, [])

  const reopenPayable = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      payables: prev.payables.map((p) =>
        p.id === id ? { ...p, status: 'aberto', paidAt: undefined } : p,
      ),
    }))
  }, [])

  const removePayable = useCallback((id: string) => {
    setState((prev) => ({ ...prev, payables: prev.payables.filter((p) => p.id !== id) }))
  }, [])

  const saveProduct = useCallback((product: Product) => {
    setState((prev) => {
      const exists = prev.products.some((p) => p.id === product.id)
      return {
        ...prev,
        products: exists
          ? prev.products.map((p) => (p.id === product.id ? product : p))
          : [...prev.products, product],
      }
    })
  }, [])

  const removeProduct = useCallback((id: string) => {
    setState((prev) => ({ ...prev, products: prev.products.filter((p) => p.id !== id) }))
  }, [])

  const saveIngredient = useCallback((ingredient: Ingredient) => {
    setState((prev) => {
      const exists = prev.ingredients.some((i) => i.id === ingredient.id)
      return {
        ...prev,
        ingredients: exists
          ? prev.ingredients.map((i) => (i.id === ingredient.id ? ingredient : i))
          : [...prev.ingredients, ingredient],
      }
    })
  }, [])

  const removeIngredient = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      ingredients: prev.ingredients.filter((i) => i.id !== id),
      products: prev.products.map((p) => ({
        ...p,
        recipe: p.recipe.filter((r) => r.ingredientId !== id),
      })),
    }))
  }, [])

  const adjustStock = useCallback((id: string, newStock: number) => {
    setState((prev) => ({
      ...prev,
      ingredients: prev.ingredients.map((i) =>
        i.id === id ? { ...i, stock: round3(Math.max(0, newStock)) } : i,
      ),
    }))
  }, [])

  const saveUser = useCallback((user: User) => {
    setState((prev) => {
      const exists = prev.users.some((u) => u.id === user.id)
      return {
        ...prev,
        users: exists ? prev.users.map((u) => (u.id === user.id ? user : u)) : [...prev.users, user],
      }
    })
  }, [])

  const removeUser = useCallback((id: string) => {
    setState((prev) => ({ ...prev, users: prev.users.filter((u) => u.id !== id) }))
  }, [])

  const resetDemo = useCallback(() => {
    setState(seedState())
  }, [])

  const value = useMemo<StoreValue>(
    () => ({
      ...state,
      placeOrder,
      setOrderStatus,
      cancelOrder,
      registerPurchase,
      addExpense,
      payPayable,
      reopenPayable,
      removePayable,
      saveProduct,
      removeProduct,
      saveIngredient,
      removeIngredient,
      adjustStock,
      saveUser,
      removeUser,
      resetDemo,
    }),
    [
      state,
      placeOrder,
      setOrderStatus,
      cancelOrder,
      registerPurchase,
      addExpense,
      payPayable,
      reopenPayable,
      removePayable,
      saveProduct,
      removeProduct,
      saveIngredient,
      removeIngredient,
      adjustStock,
      saveUser,
      removeUser,
      resetDemo,
    ],
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore precisa estar dentro de <LanchoneteStoreProvider>')
  return ctx
}

export { PURCHASE_UNIT_FACTOR }
