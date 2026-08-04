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
- **Conta do comprador** (Supabase Auth): cadastro/login pelo topo da loja, com
  **WhatsApp obrigatório**, endereço salvo no perfil e edição em **"Minha conta"**.
- **Checkout com entrega pelos Correios**: cadastro obrigatório, busca de
  endereço por **CEP (ViaCEP)** e cálculo de frete **PAC/SEDEX** (estimativa por
  região + peso), com prazos; escolha da forma de pagamento e resumo do pedido.
- **Design responsivo** (desktop, tablet e mobile) e acessível.

### 🚚 Entrega (Correios) e checkout

- O comprador cria conta / entra (obrigatório para finalizar).
- Informa o **CEP** → o endereço é preenchido via **ViaCEP** e o frete é
  calculado: **PAC** e **SEDEX**, com preço e prazo em dias úteis.
- Frete **grátis (PAC)** acima de R$ 299.
- O cálculo é uma **estimativa** por região (UF) + **peso do produto** (definido
  no Admin, padrão 300 g), em `src/services/shipping.ts`. Para preços exatos,
  troque `quoteShipping` pela API oficial (Correios/Melhor Envio) mantendo a
  mesma interface.
- O pedido grava endereço, serviço e prazo em `orders` (e o comprador em
  `customer_id`).

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

### 📦 Admin — Estoque & Produtos

Acessível pelo botão **"Gestão · Admin"** no topo da loja (protegido por login,
mesmas credenciais do PDV). É onde você **gerencia o estoque**:

- Painel com **resumo** (total de produtos, unidades em estoque, itens com
  estoque baixo e esgotados).
- **Tabela de produtos** com busca e filtro por categoria:
  - ajuste de **estoque** (botões −/+ ou digitando), com destaque para estoque
    baixo (≤ 5) e esgotado;
  - edição de **preço de venda** e **preço de custo** inline, com a **margem**
    calculada na hora;
  - **ativar/desativar** o produto na loja;
  - **excluir** produto.
- **Novo produto** via formulário (código, nome, categoria, tipo, preço,
  estoque, descrição) com **upload de imagem JPG/PNG** (até 3 MB) e
  pré-visualização. Também é possível **trocar a foto** de um produto existente
  clicando na miniatura da linha. Sem imagem, o produto usa a ilustração SVG.
  - No modo Supabase a imagem vai para o **Storage** (bucket público
    `product-images`) e a URL fica em `products.image_url`; no modo demo vira um
    data URL em memória.
- **Baixa automática de estoque**: cada venda no PDV e cada pedido na loja
  reduzem o estoque do produto (no banco, via *trigger*; na tela, em tempo real).
  Produtos esgotados aparecem como **"Esgotado"** na loja e no PDV.

#### 🛒 Compras (aba do Admin) — entrada/reposição de estoque

Aba **"Compras"** para comprar de fornecedores e **dar entrada no estoque**:

- Busque produtos e monte a entrada com **quantidade** e **custo unitário**
  (a tela já mostra a prévia `estoque atual → novo`).
- Informe o **fornecedor** (opcional) e clique em **Registrar entrada** — o
  estoque de cada produto é **somado** e o **custo do produto é atualizado**
  para o custo da compra (melhora o cálculo de margem/lucro).
- **Histórico de compras** com fornecedor, data e total.
- **Cadastro de fornecedores** (nome, WhatsApp, CNPJ, contato) e envio do
  **pedido de compra pelo WhatsApp** (link wa.me com a mensagem pronta).
- No modo Supabase grava em `purchases`/`purchase_items` e um *trigger* soma ao
  estoque; no modo demo, tudo fica no navegador.

> **Notificação de pedidos por WhatsApp (Z-API):** com a Z-API configurada
> (segredos na Edge Function `notify-order`), cada pedido online avisa a **loja**
> e o **cliente** por WhatsApp. Veja o SETUP.md.

#### 🧾 Pedidos (aba do Admin)

Aba **"Pedidos"** que consolida **pedidos da loja online** e **vendas do PDV**:

- Resumo (total, pedidos pendentes, enviados, vendas no PDV) e filtros por
  tipo (Loja/PDV) e status.
- Cada linha abre os detalhes: itens, subtotal, frete, total, forma de
  pagamento, cliente/operador e, para pedidos da loja, **endereço de entrega**.
- **Mudança de status** dos pedidos da loja: pendente → pago → enviado →
  entregue (ou cancelado). No modo Supabase grava em `orders.status`.

#### 📊 Relatórios (aba do Admin)

Aba **"Relatórios"** dentro do Admin, com base no **preço de custo** dos itens
vendidos (registrado em cada venda/pedido, para o lucro histórico ficar correto
mesmo se o custo mudar depois):

- **Faturamento**, **Custo (CMV)**, **Lucro bruto** e **Margem** consolidados.
- Nº de vendas (PDV) e pedidos (loja), itens vendidos e **ticket médio**.
- **Lucro por produto** (faturamento, custo, lucro e margem).
- Quebra **por forma de pagamento** e lista das **últimas transações**.
- No modo Supabase lê de `sales`/`orders`; no modo demo, das vendas guardadas no
  navegador (para o relatório funcionar mesmo sem backend).

### 💳 Pagamento online (Mercado Pago)

As vendas online são pagas com **Pix ou Cartão de crédito** via **Mercado Pago
(Checkout Pro)**. No checkout, o cliente clica em **"Confirmar e pagar"**, o
pedido é gravado (status *pending*) e ele é redirecionado ao Mercado Pago.
Quando o pagamento é **aprovado**, um **webhook** marca o pedido como **Pago**
e dispara um **WhatsApp automático** de "pagamento aprovado" ao cliente.

Duas Edge Functions: `create-payment` (cria a preferência) e
`mercadopago-webhook` (confirma o pagamento). Passo a passo em
[`supabase/functions/MERCADOPAGO.md`](supabase/functions/MERCADOPAGO.md). Sem o
`MP_ACCESS_TOKEN` configurado, a loja segue no fluxo sem pagamento online (nada
quebra).

### 📲 Notificação do pedido por WhatsApp (Z-API)

A confirmação do pedido é enviada por **WhatsApp** (não por e-mail). Quem envia
é uma **Supabase Edge Function** (`supabase/functions/notify-order`) que lê o
pedido no banco (service role) e envia via **[Z-API](https://www.z-api.io/)**
para a **loja** e para o **cliente**. O checkout chama a função depois de gravar
o pedido (best-effort: se falhar, a compra continua e a tela avisa o motivo).

O **WhatsApp é obrigatório no cadastro** do cliente, e ele pode editar os dados
em **"Minha conta"** (nome, WhatsApp e endereço).

Resumo (passo a passo completo em
[`supabase/functions/notify-order/SETUP.md`](supabase/functions/notify-order/SETUP.md)):

1. Crie uma instância na **Z-API** e **conecte o WhatsApp** (QR Code).
2. Publique a função — CLI `supabase functions deploy notify-order` **ou** pelo
   Dashboard (Edge Functions → Create → colar o `index.ts`).
3. Configure os segredos: `ZAPI_INSTANCE_ID`, `ZAPI_INSTANCE_TOKEN`,
   `ZAPI_CLIENT_TOKEN` e `STORE_WHATSAPP` (número da loja).
   `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` já existem no ambiente da função.

> No **modo demo** (sem Supabase) não há backend — o pedido é só registrado
> localmente e a tela não promete envio de notificação.

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
   - `supabase/migrations/0002_customers_shipping.sql` (clientes, endereço no
     pedido e peso do produto) — aditiva e re-executável.
   - `supabase/migrations/0003_purchases.sql` (compras/entrada de estoque, com
     trigger que soma ao estoque) — aditiva e re-executável.
   - `supabase/migrations/0004_suppliers_whatsapp.sql` (fornecedores + telefones
     de WhatsApp) — aditiva e re-executável.
   - `supabase/migrations/0005_payments.sql` (status/ids do pagamento Mercado
     Pago no pedido) — aditiva e re-executável.
   - **Para começar com seus produtos reais (recomendado):**
     `supabase/seed_categories.sql` — cria só as categorias, catálogo vazio.
   - **Ou, para começar com os produtos de exemplo:**
     `supabase/seed.sql` — categorias + 21 produtos de demonstração.
3. Em **Authentication → Users**, crie ao menos um operador (e-mail + senha)
   para acessar o PDV/Admin.
   - **Compradores** se cadastram sozinhos pela loja. Para o cadastro entrar
     direto (sem confirmação por e-mail), desative em **Authentication →
     Providers → Email → Confirm email** (ou o comprador confirma pelo e-mail).
4. Copie `.env.example` para `.env` e preencha com os dados de
   **Project Settings → API**:
   ```bash
   VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
   VITE_SUPABASE_ANON_KEY=sua-anon-public-key
   ```
5. `npm run dev` — a loja passa a ler do banco e o PDV exige um usuário real.

> A `anon key` é pública por design (protegida por Row Level Security) e pode ir
> para o front-end. **Nunca** use a `service_role` key no cliente.

#### Começar a cadastrar os produtos reais

Com o Supabase conectado, a loja usa **sempre os dados do banco** — mesmo vazio.
Entre em **Gestão · Admin** (o topo mostra "✅ Conectado ao Supabase") e use
**+ Novo produto** para cadastrar. Se você já tinha rodado o `seed.sql` e quer
remover os produtos de exemplo, rode uma vez no SQL Editor:

```sql
delete from public.products;   -- mantém as categorias
```

> Se o Admin mostrar "Supabase configurado, mas a leitura falhou", confira se a
> migração `0001_init.sql` foi executada (tabelas + policies de RLS) e se a
> `VITE_SUPABASE_URL`/`ANON_KEY` no `.env` estão corretas.

#### RLS ligado mas nada funciona?

RLS **ligado sem policies bloqueia tudo** (leitura volta vazia, escrita dá erro).
Checklist:

1. Rode **`supabase/policies.sql`** — recria todas as policies (é seguro rodar
   várias vezes). Isso cobre leitura pública do catálogo, escrita do admin,
   vendas/pedidos e o Storage de imagens.
2. Rode **`supabase/seed_categories.sql`** (as categorias precisam existir).
3. Crie um **usuário** em **Authentication → Users → Add user** (marque
   *Auto Confirm User*) — é com ele que você loga no Admin/PDV.
4. Confirme `.env` e **reinicie** o `npm run dev` (o Vite só lê o `.env` ao subir).
5. Dúvida se está tudo certo? Rode **`supabase/check_setup.sql`** para um
   diagnóstico (tabelas, policies, categorias, produtos e usuários).

Se o erro mencionar **coluna inexistente** (ex.: `column products.cost does not
exist`, código `42703`), suas tabelas foram criadas por uma versão antiga do
schema. Rode **`supabase/fix_columns.sql`** — ele adiciona as colunas que
faltam (`cost`, `stock`, `active`, `image_url`, `unit_cost`…) sem apagar dados.

### Modelo de dados

- `categories`, `products` — catálogo (leitura pública; escrita pelo Admin
  autenticado). `products.stock` guarda o estoque.
- `sales`, `sale_items` — vendas do PDV (somente operador autenticado grava).
- `orders`, `order_items` — pedidos da loja (checkout da sacola).
- *Triggers* em `sale_items` e `order_items` **abatem o estoque** de
  `products` automaticamente a cada item vendido.

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
│   ├── auth.ts               # login (Supabase Auth ou mock)
│   ├── sales.ts              # grava vendas do PDV
│   ├── orders.ts             # grava pedidos da loja
│   ├── admin.ts              # CRUD de produtos + estoque + upload de imagem
│   ├── reports.ts            # agrega faturamento/custo/lucro
│   ├── management.ts         # lista pedidos (loja) + vendas (PDV) e status
│   ├── purchase.ts           # compras/entrada de estoque (fornecedor)
│   ├── suppliers.ts          # cadastro de fornecedores (CRUD)
│   ├── whatsapp.ts           # links wa.me + texto do pedido de compra
│   ├── customer.ts           # cadastro/login do comprador (Supabase Auth)
│   ├── shipping.ts           # frete Correios (PAC/SEDEX) + CEP (ViaCEP)
│   ├── notify.ts             # chama a Edge Function notify-order (WhatsApp)
│   ├── payment.ts            # cria pagamento Mercado Pago (create-payment)
│   └── localStore.ts         # log de vendas/pedidos no modo demo
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
    ├── CartDrawer.tsx        # sacola lateral (abre o checkout)
    ├── Checkout.tsx          # checkout: conta + endereço + frete + pagamento
    ├── CustomerAuth.tsx      # form de cadastro/login do comprador (com WhatsApp)
    ├── AccountModal.tsx      # "Minha conta" — editar cadastro do cliente
    ├── AuthGate.tsx          # login reutilizável (PDV e Admin)
    ├── PDV.tsx               # Ponto de Venda (caixa) + comprovante
    ├── Admin.tsx             # painel de estoque e produtos (custo/margem)
    ├── Orders.tsx            # aba de pedidos (loja + PDV) com status
    ├── Purchases.tsx         # aba de compras / entrada de estoque
    ├── SuppliersModal.tsx    # cadastro de fornecedores
    ├── Reports.tsx           # aba de relatórios de venda e lucro
    └── Footer.tsx            # rodapé, newsletter e pagamentos
```

## 🎨 Personalização

Cores, nome e dados do clube ficam centralizados em
[`src/data/products.ts`](src/data/products.ts) (`CLUB`) e nas variáveis CSS no
topo de [`src/index.css`](src/index.css). Para alterar o catálogo, edite o
array `products` e rode `npm run gen:seed` para regenerar o SQL de seed.
