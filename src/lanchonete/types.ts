// ---------------------------------------------------------------------------
// Lanchonete Martinica — modelo de domínio
//
// O app é autocontido: todo o estado vive em `src/lanchonete/store.tsx` e é
// persistido no localStorage do navegador. Nada aqui depende da loja virtual
// que também mora neste repositório.
// ---------------------------------------------------------------------------

/** Unidade de estoque de um insumo. */
export type Unit = 'kg' | 'l' | 'un'

export const UNIT_LABEL: Record<Unit, string> = {
  kg: 'Quilo (kg)',
  l: 'Litro (L)',
  un: 'Unidade',
}

/** Unidade usada na compra — pode ser menor que a unidade de estoque. */
export type PurchaseUnit = 'kg' | 'g' | 'l' | 'ml' | 'un'

/** Quanto vale 1 unidade de compra na unidade base do insumo. */
export const PURCHASE_UNIT_FACTOR: Record<PurchaseUnit, number> = {
  kg: 1,
  g: 0.001,
  l: 1,
  ml: 0.001,
  un: 1,
}

export const PURCHASE_UNIT_LABEL: Record<PurchaseUnit, string> = {
  kg: 'kg',
  g: 'g',
  l: 'L',
  ml: 'ml',
  un: 'un',
}

/** Unidades de compra aceitas para cada unidade de estoque. */
export const PURCHASE_UNITS_BY_UNIT: Record<Unit, PurchaseUnit[]> = {
  kg: ['kg', 'g'],
  l: ['l', 'ml'],
  un: ['un'],
}

/** Insumo de estoque (batata, hambúrguer, refrigerante em lata…). */
export interface Ingredient {
  id: string
  name: string
  /** Unidade em que o saldo é controlado. */
  unit: Unit
  /** Saldo atual na unidade base (kg, L ou un). */
  stock: number
  /** Estoque mínimo para alerta de reposição. */
  minStock: number
  /** Custo médio ponderado por unidade base. */
  avgCost: number
}

/** Linha da ficha técnica: quanto do insumo sai a cada porção vendida. */
export interface RecipeItem {
  ingredientId: string
  /** Quantidade consumida por porção, na unidade base do insumo. */
  qty: number
}

export type ProductCategory =
  | 'lanches'
  | 'porcoes'
  | 'bebidas'
  | 'sobremesas'
  | 'combos'

export const CATEGORY_LABEL: Record<ProductCategory, string> = {
  lanches: 'Lanches',
  porcoes: 'Porções',
  bebidas: 'Bebidas',
  sobremesas: 'Sobremesas',
  combos: 'Combos',
}

/** Ilustração usada quando o produto não tem foto cadastrada. */
export type FoodKind =
  | 'burger'
  | 'hotdog'
  | 'fries'
  | 'pastel'
  | 'pizza'
  | 'soda'
  | 'juice'
  | 'coffee'
  | 'beer'
  | 'water'
  | 'icecream'
  | 'cake'
  | 'combo'
  | 'snack'

export const FOOD_KIND_LABEL: Record<FoodKind, string> = {
  burger: 'Hambúrguer',
  hotdog: 'Cachorro-quente',
  fries: 'Batata frita',
  pastel: 'Pastel / salgado frito',
  pizza: 'Pizza',
  soda: 'Refrigerante',
  juice: 'Suco',
  coffee: 'Café',
  beer: 'Cerveja',
  water: 'Água',
  icecream: 'Sorvete / açaí',
  cake: 'Bolo / doce',
  combo: 'Combo',
  snack: 'Salgado / outros',
}

/** Item vendido no PDV. */
export interface Product {
  id: string
  name: string
  description: string
  category: ProductCategory
  /** Preço de venda em R$. */
  price: number
  kind: FoodKind
  /** Foto (URL ou data URL). Sem foto, usamos a ilustração de `kind`. */
  image?: string
  active: boolean
  /** Ficha técnica — define o consumo de estoque por porção vendida. */
  recipe: RecipeItem[]
}

export type PaymentMethod =
  | 'dinheiro'
  | 'pix'
  | 'credito'
  | 'debito'
  | 'vale'
  | 'boleto'
  | 'transferencia'
  | 'prazo'

export const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  dinheiro: 'Dinheiro',
  pix: 'Pix',
  credito: 'Cartão de crédito',
  debito: 'Cartão de débito',
  vale: 'Vale-refeição',
  boleto: 'Boleto',
  transferencia: 'Transferência',
  prazo: 'A prazo (fiado)',
}

/** Formas aceitas na venda (PDV). */
export const SALE_PAYMENTS: PaymentMethod[] = [
  'dinheiro',
  'pix',
  'debito',
  'credito',
  'vale',
  'prazo',
]

/** Formas aceitas nas compras / contas a pagar. */
export const PAYABLE_PAYMENTS: PaymentMethod[] = [
  'boleto',
  'pix',
  'dinheiro',
  'transferencia',
  'credito',
  'debito',
  'prazo',
]

/** Fila de produção: pedido entra em `fila` e sai em `entregue`. */
export type OrderStatus = 'fila' | 'preparo' | 'pronto' | 'entregue' | 'cancelado'

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  fila: 'Na fila',
  preparo: 'Em preparo',
  pronto: 'Pronto',
  entregue: 'Entregue',
  cancelado: 'Cancelado',
}

export type OrderChannel = 'balcao' | 'mesa' | 'entrega'

export const CHANNEL_LABEL: Record<OrderChannel, string> = {
  balcao: 'Balcão',
  mesa: 'Mesa',
  entrega: 'Entrega',
}

export interface OrderItem {
  productId: string
  name: string
  qty: number
  unitPrice: number
  /** Custo do insumo no momento da venda (para o CMV do financeiro). */
  unitCost: number
  notes?: string
}

export interface Order {
  id: string
  number: number
  createdAt: string
  channel: OrderChannel
  customer?: string
  table?: string
  items: OrderItem[]
  subtotal: number
  discount: number
  total: number
  payment: PaymentMethod
  /** Dinheiro recebido e troco, quando pago em espécie. */
  cashReceived?: number
  change?: number
  status: OrderStatus
  operator: string
  deliveredAt?: string
  canceledAt?: string
}

export interface PurchaseLine {
  ingredientId: string
  name: string
  /** Quantidade na unidade de compra. */
  qty: number
  unit: PurchaseUnit
  /** Custo por unidade de compra. */
  unitCost: number
  /** Quantidade convertida para a unidade base do insumo. */
  baseQty: number
}

export interface Purchase {
  id: string
  number: number
  createdAt: string
  supplier: string
  invoice?: string
  lines: PurchaseLine[]
  total: number
  payment: PaymentMethod
  /** Vencimento da 1ª parcela. */
  dueDate: string
  installments: number
  notes?: string
}

export type PayableOrigin = 'compra' | 'despesa'

export type ExpenseCategory =
  | 'aluguel'
  | 'energia'
  | 'agua'
  | 'gas'
  | 'internet'
  | 'salarios'
  | 'impostos'
  | 'manutencao'
  | 'marketing'
  | 'outros'

export const EXPENSE_CATEGORY_LABEL: Record<ExpenseCategory, string> = {
  aluguel: 'Aluguel',
  energia: 'Energia elétrica',
  agua: 'Água',
  gas: 'Gás',
  internet: 'Internet / telefone',
  salarios: 'Salários e encargos',
  impostos: 'Impostos e taxas',
  manutencao: 'Manutenção',
  marketing: 'Marketing',
  outros: 'Outros',
}

/** Conta a pagar — gerada por compra de insumo ou por despesa avulsa. */
export interface Payable {
  id: string
  description: string
  supplier?: string
  origin: PayableOrigin
  /** Categoria contábil (compras usam 'insumos'). */
  category: ExpenseCategory | 'insumos'
  purchaseId?: string
  amount: number
  dueDate: string
  payment: PaymentMethod
  status: 'aberto' | 'pago'
  paidAt?: string
  installment?: { n: number; of: number }
  createdAt: string
}

export type Role = 'admin' | 'pdv'

export const ROLE_LABEL: Record<Role, string> = {
  admin: 'Administrador',
  pdv: 'Operador de PDV',
}

export interface User {
  id: string
  name: string
  username: string
  password: string
  role: Role
  active: boolean
}

/** Estado completo persistido no localStorage. */
export interface AppState {
  version: number
  ingredients: Ingredient[]
  products: Product[]
  orders: Order[]
  purchases: Purchase[]
  payables: Payable[]
  users: User[]
  counters: { order: number; purchase: number }
}
