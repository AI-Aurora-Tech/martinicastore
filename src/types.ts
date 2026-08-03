export type ProductKind =
  | 'jersey'
  | 'jacket'
  | 'cap'
  | 'ball'
  | 'scarf'
  | 'mug'
  | 'backpack'
  | 'shoe'
  | 'shorts'
  | 'pet'

export type CategoryId =
  | 'camisas'
  | 'agasalhos'
  | 'acessorios'
  | 'calcados'
  | 'torcedor'
  | 'pet'

export interface Product {
  id: string
  name: string
  category: CategoryId
  kind: ProductKind
  price: number
  /** Preço "de" (antes do desconto). Opcional. */
  oldPrice?: number
  /** Preço de custo (para relatórios de lucro/margem). */
  cost?: number
  colors: [string, string]
  badge?: string
  description: string
  sizes?: string[]
  rating: number
  reviews: number
  /** Quantidade em estoque. `undefined` = não controlado. */
  stock?: number
  /** Produto visível na loja. `undefined`/true = ativo. */
  active?: boolean
  /** URL (ou data URL) da foto do produto. Sem valor = usa a ilustração SVG. */
  image?: string
}

export interface CartItem {
  product: Product
  size?: string
  quantity: number
}

export interface Category {
  id: CategoryId
  label: string
}
