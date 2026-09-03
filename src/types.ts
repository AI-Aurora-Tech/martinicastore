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

// Identificador de categoria. É `string` para permitir categorias criadas pelo
// admin no painel (além das padrão: camisas, agasalhos, acessorios, calcados,
// torcedor, pet).
export type CategoryId = string

/** Variação do produto (tamanho, cor, etc.) com estoque próprio. */
export interface ProductVariant {
  /** Nome da variação exibido ao cliente (ex.: "P", "M / Azul", "40"). */
  label: string
  /** Estoque desta variação. */
  stock: number
}

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
  /**
   * Variações com estoque individual (tamanho/cor/etc.). Quando presente e não
   * vazio, o estoque é controlado por variação; `stock` passa a ser a soma e
   * `sizes` é ignorado (as variações viram as opções selecionáveis).
   */
  variants?: ProductVariant[]
  rating: number
  reviews: number
  /** Quantidade em estoque (total). `undefined` = não controlado. */
  stock?: number
  /** Produto visível na loja. `undefined`/true = ativo. */
  active?: boolean
  /** URL (ou data URL) da foto principal do produto. Sem valor = ilustração SVG. */
  image?: string
  /** Todas as fotos do produto (a 1ª é a principal). */
  images?: string[]
  /** Peso em gramas (para cálculo de frete). Padrão 300 g quando ausente. */
  weight?: number
  /** Fornecedor padrão para compra (deve estar cadastrado em Fornecedores). */
  supplierId?: string
}

export interface Address {
  cep: string
  street: string
  number: string
  complement?: string
  neighborhood: string
  city: string
  uf: string
}

export interface Customer {
  id: string
  name: string
  email: string
  phone?: string
  cpf?: string
  address?: Address
}

export interface Supplier {
  id: string
  name: string
  phone?: string
  cnpj?: string
  email?: string
  contact?: string
  notes?: string
}

export type ShippingService = 'PAC' | 'SEDEX' | 'RETIRADA'

export interface ShippingOption {
  service: ShippingService
  price: number
  days: number
  free?: boolean
}

export interface CartItem {
  product: Product
  size?: string
  quantity: number
}

export interface Category {
  id: CategoryId
  label: string
  /** Ordem de exibição no menu/coleções. */
  sort?: number
}

/** Banner principal da loja (editável no painel). Vários viram um carrossel. */
export interface Banner {
  id: string
  /** URL (ou data URL) da imagem do banner. */
  imageUrl: string
  /** Título opcional sobreposto à imagem. */
  headline?: string
  /** Texto opcional abaixo do título. */
  subtext?: string
  /** Rótulo do botão (ex.: "Comprar agora"). */
  ctaLabel?: string
  /** Destino do clique: uma categoria (id) ou uma URL. */
  link?: string
  /** Banner visível na loja. */
  active?: boolean
  /** Ordem no carrossel. */
  sort?: number
}

export interface Sponsor {
  id: string
  /** Nome do patrocinador (para acessibilidade). */
  name?: string
  /** URL (ou data URL) do logo. */
  imageUrl: string
  /** Página do patrocinador (abre em nova aba). */
  link?: string
  active?: boolean
  sort?: number
}
