# Estoque por variação (tamanho/cor/etc.)

No cadastro do produto (painel → Estoque & Produtos → ✏️ Editar) há a seção
**"Variações com estoque individual"**. Ao preencher variações (ex.: `P`, `M`,
`G` ou `M / Azul`), o estoque passa a ser controlado **por variação**:

- O **total** do produto vira a soma das variações (campo Estoque fica só de leitura).
- Na **loja**, o cliente escolhe a variação e só compra se aquela opção tiver estoque.
- No **PDV**, ao adicionar um produto com variações, o operador escolhe qual.
- A **baixa de estoque** (pagamento aprovado on-line e venda no PDV) abate a
  **variação certa**; o total é recalculado automaticamente.

Produtos **sem** variações continuam como antes (estoque único + campo "Tamanhos").

## Para valer no Supabase

1. Rode a migração **`supabase/migrations/0009_variants.sql`** no SQL Editor
   (ou o `supabase/policies.sql`, que é idempotente e já inclui tudo).
   - Adiciona `products.variants` (jsonb) e `sale_items.size`.
   - Cria a função `apply_stock` e ajusta `apply_order_stock` e o gatilho do PDV
     para abater a variação.
2. Republique a função que valida o pedido no servidor:

   ```bash
   supabase functions deploy place-order
   ```

No **modo demo** (sem Supabase) nada disso é necessário — tudo funciona no
navegador.
