# Martinica Store 🛍️⚽

Loja virtual (e-commerce) da torcida do **Martinica FC**, inspirada no modelo
de lojas oficiais de clubes de futebol como a
[ShopTimão](https://www.shoptimao.com.br/). Vende camisas, agasalhos, calçados,
acessórios, produtos de torcedor e itens pet — tudo com identidade visual de
clube, preços em Real e carrinho de compras funcional.

> Projeto de demonstração. O clube, o CNPJ e os produtos são fictícios.

## ✨ Funcionalidades

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

## 🧱 Stack

- [React 18](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- [Vite 5](https://vitejs.dev/) (build e dev server)
- CSS puro (sem framework), com variáveis de tema e grid responsivo

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
src/
├── main.tsx                # ponto de entrada
├── App.tsx                 # layout, filtro e busca
├── index.css               # estilos da loja
├── types.ts                # tipos (Product, CartItem, Category…)
├── data/products.ts        # catálogo de produtos + config do clube
├── context/CartContext.tsx # estado global do carrinho (Context API)
└── components/
    ├── Header.tsx          # topo, busca, menu e botão da sacola
    ├── Hero.tsx            # banner principal
    ├── Benefits.tsx        # tira de vantagens (frete, parcelas…)
    ├── ProductCard.tsx     # card de produto
    ├── ProductImage.tsx    # ilustrações SVG por tipo de produto
    ├── StarRating.tsx      # avaliações em estrelas
    ├── CartDrawer.tsx      # sacola lateral
    └── Footer.tsx          # rodapé, newsletter e pagamentos
```

## 🎨 Personalização

Cores, nome e dados do clube ficam centralizados em
[`src/data/products.ts`](src/data/products.ts) (`CLUB`) e nas variáveis CSS no
topo de [`src/index.css`](src/index.css). Novos produtos são adicionados ao
array `products` do mesmo arquivo.
