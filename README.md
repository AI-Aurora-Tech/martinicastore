# Martinica Store 🛍️⚽

Loja virtual (e-commerce) da torcida do **Martinica FC**, inspirada no modelo
de lojas oficiais de clubes de futebol como a
[ShopTimão](https://www.shoptimao.com.br/). Vende camisas, agasalhos, calçados,
acessórios, produtos de torcedor e itens pet — tudo com identidade visual de
clube, preços em Real e carrinho de compras funcional.

> Projeto de demonstração. O clube, o CNPJ e os produtos são fictícios.

Identidade visual em **laranja e preto**.

## ✨ Funcionalidades

### 🏬 Loja (frente de loja / e-commerce)

- **Vitrine de produtos** com 21 itens em 6 categorias (Camisas, Agasalhos,
  Calçados, Acessórios, Torcedor e Pet).
- **Busca** por nome/descrição e **filtro por categoria**.
- **Carrinho de compras** (sacola) em drawer lateral com:
  - adicionar/remover itens e ajuste de quantidade;
  - seleção de tamanho (P/M/G… ou numeração de calçado);
  - barra de progresso de **frete grátis** (acima de R$ 299);
  - subtotal, parcelamento em 10x e desconto de 5% no Pix;
  - fluxo de finalização de compra com confirmação;
  - persistência no `localStorage` (a sacola sobrevive ao recarregar).
- **Preços** com preço "de/por", cálculo de desconto (%) e parcelamento.
- **Ilustrações vetoriais (SVG)** geradas por tipo de produto — sem dependência
  de imagens externas.
- **Design responsivo** (desktop, tablet e mobile) e acessível.

### 🧾 PDV (Ponto de Venda / caixa)

Acessível pelo botão **"Caixa · PDV"** no topo da loja. É a tela do operador
para registrar vendas presenciais:

- **Login de operador** (usuário e senha) protege o caixa: só entra quem tem
  credencial. Sessão mantida em `sessionStorage`, com botão **Sair** e o nome
  do operador exibido no topo. Credenciais de demonstração: `caixa01` / `1234`
  e `gerente` / `martinica`.
- **Catálogo de toque** com busca por nome/código e filtro por categoria —
  um clique adiciona o item à venda.
- **Cupom da venda ao vivo**: itens, ajuste de quantidade, remoção e total.
- **Desconto** manual em R$ sobre a venda.
- **Formas de pagamento**: Dinheiro (com valor recebido, atalhos de cédula e
  cálculo automático de **troco**), Cartão (seleção de **parcelas**) e Pix
  (**5% de desconto** automático).
- **Finalização** com **comprovante não fiscal** numerado (data/hora, itens,
  total, forma de pagamento e troco) e opção de **imprimir**.
- Cada venda é **gravada no banco** (`sales` + `sale_items`) com o operador.

## 🧱 Stack

- [React 18](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- [Vite 5](https://vitejs.dev/) (build e dev server)
- [Supabase](https://supabase.com/) — Postgres + Auth (backend real)
- CSS puro (sem framework), com variáveis de tema e grid responsivo

## 🗄️ Banco de dados (Supabase)

A aplicação funciona em dois modos, decididos automaticamente pela presença das
variáveis de ambiente:

| Modo | Quando | Comportamento |
|------|--------|---------------|
| **Real** | `.env` com URL + anon key preenchidos | Produtos vêm do Postgres; login do PDV via **Supabase Auth**; vendas e pedidos gravados no banco |
| **Demo** | sem `.env` (ex.: o HTML standalone) | Dados locais de exemplo + login mock; nada é persistido |

### Passo a passo para ativar o modo real

1. Crie um projeto em [supabase.com](https://supabase.com/) (gratuito).
2. Em **SQL Editor**, rode, nesta ordem:
   - `supabase/migrations/0001_init.sql` (cria tabelas + RLS)
   - `supabase/seed.sql` (popula categorias e produtos)
3. Em **Authentication → Users**, crie ao menos um operador (e-mail + senha)
   para acessar o PDV.
4. Copie `.env.example` para `.env` e preencha com os dados de
   **Project Settings → API**:
   ```bash
   VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
   VITE_SUPABASE_ANON_KEY=sua-anon-public-key
   ```
5. `npm run dev` — a loja passa a ler do banco e o PDV exige um usuário real.

> A `anon key` é pública por design (protegida por Row Level Security) e pode ir
> para o front-end. **Nunca** use a `service_role` key no cliente.

### Modelo de dados

- `categories`, `products` — catálogo (leitura pública via RLS).
- `sales`, `sale_items` — vendas do PDV (somente operador autenticado grava).
- `orders`, `order_items` — pedidos da loja (checkout da sacola).

O seed é gerado a partir de `src/data/products.ts` com `npm run gen:seed`.

## 🚀 Como rodar

Pré-requisitos: Node.js 18+ e npm.

```bash
# instalar dependências
npm install

# ambiente de desenvolvimento (http://localhost:5173)
npm run dev

# build de produção (gera a pasta dist/)
npm run build

# pré-visualizar o build de produção
npm run preview
```

## 📁 Estrutura

```
supabase/
├── migrations/0001_init.sql  # schema + Row Level Security
└── seed.sql                  # categorias + produtos (gerado)
scripts/gen-seed.ts           # gera o seed a partir de data/products.ts
src/
├── main.tsx                  # ponto de entrada + providers
├── App.tsx                   # layout, filtro e busca
├── index.css                 # estilos da loja
├── types.ts                  # tipos (Product, CartItem, Category…)
├── lib/supabase.ts           # cliente Supabase (+ isSupabaseConfigured)
├── services/
│   ├── catalog.ts            # produtos/categorias (Supabase ou seed)
│   ├── auth.ts               # login do PDV (Supabase Auth ou mock)
│   ├── sales.ts              # grava vendas do PDV
│   └── orders.ts             # grava pedidos da loja
├── data/products.ts          # seed/fallback + config do clube + BRL
├── context/
│   ├── CatalogContext.tsx    # carrega o catálogo uma vez
│   └── CartContext.tsx       # estado global do carrinho
└── components/
    ├── Header.tsx            # topo, busca, menu e botão da sacola
    ├── Hero.tsx              # banner principal
    ├── Benefits.tsx          # tira de vantagens (frete, parcelas…)
    ├── ProductCard.tsx       # card de produto
    ├── ProductImage.tsx      # ilustrações SVG por tipo de produto
    ├── StarRating.tsx        # avaliações em estrelas
    ├── CartDrawer.tsx        # sacola lateral + checkout (grava pedido)
    ├── PDVGate.tsx           # login do PDV (Supabase Auth / demo)
    ├── PDV.tsx               # Ponto de Venda (caixa) + comprovante
    └── Footer.tsx            # rodapé, newsletter e pagamentos
```

## 🎨 Personalização

Cores, nome e dados do clube ficam centralizados em
[`src/data/products.ts`](src/data/products.ts) (`CLUB`) e nas variáveis CSS no
topo de [`src/index.css`](src/index.css). Para alterar o catálogo, edite o
array `products` e rode `npm run gen:seed` para regenerar o SQL de seed.
