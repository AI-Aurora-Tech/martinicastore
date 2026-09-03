// ---------------------------------------------------------------------------
// Dados iniciais da Lanchonete Martinica.
//
// Carregados apenas na primeira execução (quando não há nada no localStorage)
// ou quando o administrador usa "Restaurar dados de demonstração".
// ---------------------------------------------------------------------------
import type { AppState, Ingredient, Payable, Product, User } from './types'

export const STATE_VERSION = 1

/** Data ISO (YYYY-MM-DD) deslocada em dias a partir de hoje. */
function day(offset: number): string {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return d.toISOString().slice(0, 10)
}

const ingredients: Ingredient[] = [
  // nome                          unidade  saldo   mínimo  custo médio
  ing('pao-burger', 'Pão de hambúrguer', 'un', 120, 40, 1.2),
  ing('pao-hotdog', 'Pão de cachorro-quente', 'un', 80, 30, 1.1),
  ing('pao-forma', 'Pão de forma (fatia)', 'un', 100, 40, 0.45),
  ing('carne-moida', 'Carne bovina moída', 'kg', 8, 3, 34.9),
  ing('frango', 'Coxinha da asa de frango', 'kg', 6, 2, 18.9),
  ing('calabresa', 'Linguiça calabresa', 'kg', 4, 1.5, 27.5),
  ing('bacon', 'Bacon em cubos', 'kg', 3, 1, 39.9),
  ing('salsicha', 'Salsicha', 'un', 90, 30, 1.35),
  ing('batata', 'Batata congelada palito', 'kg', 10, 4, 12.9),
  ing('mussarela', 'Queijo mussarela', 'kg', 3, 1, 42.9),
  ing('cheddar', 'Cheddar cremoso', 'kg', 2, 0.8, 28.9),
  ing('presunto', 'Presunto fatiado', 'kg', 2, 0.8, 31.5),
  ing('alface', 'Alface', 'kg', 1.5, 0.5, 9.9),
  ing('tomate', 'Tomate', 'kg', 2, 0.8, 7.9),
  ing('cebola', 'Cebola', 'kg', 2, 0.8, 5.9),
  ing('molho', 'Molho especial da casa', 'l', 3, 1, 18.0),
  ing('oleo', 'Óleo de soja', 'l', 12, 4, 8.9),
  ing('massa-pastel', 'Disco de massa de pastel', 'un', 100, 40, 0.85),
  ing('refri-lata', 'Refrigerante lata 350 ml', 'un', 96, 36, 3.2),
  ing('agua-500', 'Água mineral 500 ml', 'un', 60, 24, 1.4),
  ing('cerveja', 'Cerveja long neck 355 ml', 'un', 72, 24, 4.6),
  ing('suco-laranja', 'Suco de laranja', 'l', 8, 3, 9.5),
  ing('cafe', 'Café em pó', 'kg', 2, 0.5, 39.9),
  ing('leite', 'Leite integral', 'l', 10, 4, 5.4),
  ing('sorvete', 'Sorvete de creme', 'l', 6, 2, 16.9),
  ing('acai', 'Polpa de açaí', 'kg', 5, 2, 24.9),
  ing('bolo', 'Bolo de chocolate (fatia)', 'un', 24, 8, 3.9),
  ing('embalagem', 'Embalagem para viagem', 'un', 200, 60, 0.6),
]

function ing(
  id: string,
  name: string,
  unit: Ingredient['unit'],
  stock: number,
  minStock: number,
  avgCost: number,
): Ingredient {
  return { id, name, unit, stock, minStock, avgCost }
}

const products: Product[] = [
  // ------------------------------- Lanches --------------------------------
  {
    id: 'x-burger',
    name: 'X-Burger',
    description: 'Pão, hambúrguer artesanal 180 g, mussarela e molho da casa.',
    category: 'lanches',
    price: 18.9,
    kind: 'burger',
    active: true,
    recipe: [
      { ingredientId: 'pao-burger', qty: 1 },
      { ingredientId: 'carne-moida', qty: 0.18 },
      { ingredientId: 'mussarela', qty: 0.04 },
      { ingredientId: 'molho', qty: 0.02 },
    ],
  },
  {
    id: 'x-salada',
    name: 'X-Salada',
    description: 'X-Burger com alface crocante e tomate.',
    category: 'lanches',
    price: 21.9,
    kind: 'burger',
    active: true,
    recipe: [
      { ingredientId: 'pao-burger', qty: 1 },
      { ingredientId: 'carne-moida', qty: 0.18 },
      { ingredientId: 'mussarela', qty: 0.04 },
      { ingredientId: 'alface', qty: 0.015 },
      { ingredientId: 'tomate', qty: 0.03 },
      { ingredientId: 'molho', qty: 0.02 },
    ],
  },
  {
    id: 'x-bacon',
    name: 'X-Bacon',
    description: 'Hambúrguer 180 g, cheddar cremoso e bacon crocante.',
    category: 'lanches',
    price: 24.9,
    kind: 'burger',
    active: true,
    recipe: [
      { ingredientId: 'pao-burger', qty: 1 },
      { ingredientId: 'carne-moida', qty: 0.18 },
      { ingredientId: 'cheddar', qty: 0.05 },
      { ingredientId: 'bacon', qty: 0.04 },
      { ingredientId: 'molho', qty: 0.02 },
    ],
  },
  {
    id: 'x-tudo',
    name: 'X-Tudo do Timão',
    description: 'Dois hambúrgueres, bacon, presunto, mussarela, salada e ovo.',
    category: 'lanches',
    price: 32.9,
    kind: 'burger',
    active: true,
    recipe: [
      { ingredientId: 'pao-burger', qty: 1 },
      { ingredientId: 'carne-moida', qty: 0.36 },
      { ingredientId: 'bacon', qty: 0.04 },
      { ingredientId: 'presunto', qty: 0.04 },
      { ingredientId: 'mussarela', qty: 0.05 },
      { ingredientId: 'alface', qty: 0.015 },
      { ingredientId: 'tomate', qty: 0.03 },
      { ingredientId: 'molho', qty: 0.03 },
    ],
  },
  {
    id: 'hotdog',
    name: 'Cachorro-quente completo',
    description: 'Duas salsichas, molho da casa, batata palha e queijo ralado.',
    category: 'lanches',
    price: 14.9,
    kind: 'hotdog',
    active: true,
    recipe: [
      { ingredientId: 'pao-hotdog', qty: 1 },
      { ingredientId: 'salsicha', qty: 2 },
      { ingredientId: 'molho', qty: 0.03 },
      { ingredientId: 'mussarela', qty: 0.02 },
    ],
  },
  {
    id: 'misto',
    name: 'Misto quente',
    description: 'Presunto e mussarela na chapa, no pão de forma.',
    category: 'lanches',
    price: 11.9,
    kind: 'snack',
    active: true,
    recipe: [
      { ingredientId: 'pao-forma', qty: 2 },
      { ingredientId: 'presunto', qty: 0.04 },
      { ingredientId: 'mussarela', qty: 0.04 },
    ],
  },

  // ------------------------------- Porções --------------------------------
  {
    id: 'porcao-batata',
    name: 'Porção de batata frita (500 g)',
    description: 'Meio quilo de batata frita crocante com sal e orégano.',
    category: 'porcoes',
    price: 24.9,
    kind: 'fries',
    active: true,
    recipe: [
      { ingredientId: 'batata', qty: 0.5 },
      { ingredientId: 'oleo', qty: 0.05 },
    ],
  },
  {
    id: 'porcao-batata-cheddar',
    name: 'Batata com cheddar e bacon (500 g)',
    description: 'Batata frita coberta com cheddar cremoso e bacon.',
    category: 'porcoes',
    price: 34.9,
    kind: 'fries',
    active: true,
    recipe: [
      { ingredientId: 'batata', qty: 0.5 },
      { ingredientId: 'oleo', qty: 0.05 },
      { ingredientId: 'cheddar', qty: 0.08 },
      { ingredientId: 'bacon', qty: 0.06 },
    ],
  },
  {
    id: 'porcao-calabresa',
    name: 'Calabresa acebolada (400 g)',
    description: 'Linguiça calabresa fatiada na chapa com cebola.',
    category: 'porcoes',
    price: 29.9,
    kind: 'snack',
    active: true,
    recipe: [
      { ingredientId: 'calabresa', qty: 0.4 },
      { ingredientId: 'cebola', qty: 0.12 },
    ],
  },
  {
    id: 'porcao-frango',
    name: 'Frango a passarinho (500 g)',
    description: 'Coxinha da asa frita na hora, com alho e limão.',
    category: 'porcoes',
    price: 36.9,
    kind: 'snack',
    active: true,
    recipe: [
      { ingredientId: 'frango', qty: 0.5 },
      { ingredientId: 'oleo', qty: 0.08 },
    ],
  },
  {
    id: 'pastel-carne',
    name: 'Pastel de carne',
    description: 'Pastel frito na hora, recheado com carne temperada.',
    category: 'porcoes',
    price: 9.9,
    kind: 'pastel',
    active: true,
    recipe: [
      { ingredientId: 'massa-pastel', qty: 1 },
      { ingredientId: 'carne-moida', qty: 0.06 },
      { ingredientId: 'oleo', qty: 0.03 },
    ],
  },
  {
    id: 'pastel-queijo',
    name: 'Pastel de queijo',
    description: 'Pastel frito na hora, recheado com mussarela.',
    category: 'porcoes',
    price: 9.9,
    kind: 'pastel',
    active: true,
    recipe: [
      { ingredientId: 'massa-pastel', qty: 1 },
      { ingredientId: 'mussarela', qty: 0.06 },
      { ingredientId: 'oleo', qty: 0.03 },
    ],
  },

  // ------------------------------- Bebidas --------------------------------
  {
    id: 'refri',
    name: 'Refrigerante lata 350 ml',
    description: 'Coca-Cola, Guaraná ou Fanta gelados.',
    category: 'bebidas',
    price: 7.0,
    kind: 'soda',
    active: true,
    recipe: [{ ingredientId: 'refri-lata', qty: 1 }],
  },
  {
    id: 'suco',
    name: 'Suco de laranja 300 ml',
    description: 'Suco natural feito na hora.',
    category: 'bebidas',
    price: 9.9,
    kind: 'juice',
    active: true,
    recipe: [{ ingredientId: 'suco-laranja', qty: 0.3 }],
  },
  {
    id: 'agua',
    name: 'Água mineral 500 ml',
    description: 'Com ou sem gás.',
    category: 'bebidas',
    price: 4.0,
    kind: 'water',
    active: true,
    recipe: [{ ingredientId: 'agua-500', qty: 1 }],
  },
  {
    id: 'cerveja',
    name: 'Cerveja long neck',
    description: 'Long neck 355 ml estupidamente gelada.',
    category: 'bebidas',
    price: 12.0,
    kind: 'beer',
    active: true,
    recipe: [{ ingredientId: 'cerveja', qty: 1 }],
  },
  {
    id: 'cafe',
    name: 'Café expresso',
    description: 'Café coado na hora, xícara 80 ml.',
    category: 'bebidas',
    price: 5.0,
    kind: 'coffee',
    active: true,
    recipe: [{ ingredientId: 'cafe', qty: 0.012 }],
  },

  // ------------------------------ Sobremesas ------------------------------
  {
    id: 'sorvete',
    name: 'Taça de sorvete',
    description: 'Duas bolas de sorvete de creme com calda.',
    category: 'sobremesas',
    price: 12.9,
    kind: 'icecream',
    active: true,
    recipe: [{ ingredientId: 'sorvete', qty: 0.2 }],
  },
  {
    id: 'acai',
    name: 'Açaí 300 ml',
    description: 'Açaí batido com acompanhamentos.',
    category: 'sobremesas',
    price: 16.9,
    kind: 'icecream',
    active: true,
    recipe: [
      { ingredientId: 'acai', qty: 0.3 },
      { ingredientId: 'embalagem', qty: 1 },
    ],
  },
  {
    id: 'bolo',
    name: 'Fatia de bolo de chocolate',
    description: 'Bolo caseiro com cobertura de brigadeiro.',
    category: 'sobremesas',
    price: 9.9,
    kind: 'cake',
    active: true,
    recipe: [{ ingredientId: 'bolo', qty: 1 }],
  },

  // -------------------------------- Combos --------------------------------
  {
    id: 'combo-classico',
    name: 'Combo Clássico',
    description: 'X-Burger + porção de batata (500 g) + refrigerante lata.',
    category: 'combos',
    price: 44.9,
    kind: 'combo',
    active: true,
    recipe: [
      { ingredientId: 'pao-burger', qty: 1 },
      { ingredientId: 'carne-moida', qty: 0.18 },
      { ingredientId: 'mussarela', qty: 0.04 },
      { ingredientId: 'molho', qty: 0.02 },
      { ingredientId: 'batata', qty: 0.5 },
      { ingredientId: 'oleo', qty: 0.05 },
      { ingredientId: 'refri-lata', qty: 1 },
    ],
  },
  {
    id: 'combo-bacon',
    name: 'Combo Bacon',
    description: 'X-Bacon + batata com cheddar + cerveja long neck.',
    category: 'combos',
    price: 62.9,
    kind: 'combo',
    active: true,
    recipe: [
      { ingredientId: 'pao-burger', qty: 1 },
      { ingredientId: 'carne-moida', qty: 0.18 },
      { ingredientId: 'cheddar', qty: 0.13 },
      { ingredientId: 'bacon', qty: 0.1 },
      { ingredientId: 'molho', qty: 0.02 },
      { ingredientId: 'batata', qty: 0.5 },
      { ingredientId: 'oleo', qty: 0.05 },
      { ingredientId: 'cerveja', qty: 1 },
    ],
  },
]

const users: User[] = [
  {
    id: 'u-admin',
    name: 'Gerente Martinica',
    username: 'admin',
    password: 'martinica',
    role: 'admin',
    active: true,
  },
  {
    id: 'u-pdv',
    name: 'Operador de Caixa',
    username: 'caixa',
    password: '1234',
    role: 'pdv',
    active: true,
  },
]

const payables: Payable[] = [
  {
    id: 'p-aluguel',
    description: 'Aluguel do ponto comercial',
    supplier: 'Imobiliária Central',
    origin: 'despesa',
    category: 'aluguel',
    amount: 2800,
    dueDate: day(7),
    payment: 'boleto',
    status: 'aberto',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'p-energia',
    description: 'Conta de energia elétrica',
    supplier: 'Concessionária de Energia',
    origin: 'despesa',
    category: 'energia',
    amount: 940.35,
    dueDate: day(12),
    payment: 'boleto',
    status: 'aberto',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'p-gas',
    description: 'Recarga de botijão de gás (2 un)',
    supplier: 'Distribuidora de Gás',
    origin: 'despesa',
    category: 'gas',
    amount: 260,
    dueDate: day(-3),
    payment: 'pix',
    status: 'pago',
    paidAt: day(-3),
    createdAt: new Date().toISOString(),
  },
]

export function seedState(): AppState {
  return {
    version: STATE_VERSION,
    ingredients: ingredients.map((i) => ({ ...i })),
    products: products.map((p) => ({ ...p, recipe: p.recipe.map((r) => ({ ...r })) })),
    orders: [],
    purchases: [],
    payables: payables.map((p) => ({ ...p })),
    users: users.map((u) => ({ ...u })),
    counters: { order: 1, purchase: 1 },
  }
}
