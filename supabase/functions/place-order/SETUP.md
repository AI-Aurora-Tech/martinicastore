# Segurança para produção (itens 5–9)

Este guia cobre as mudanças de segurança/produção da loja. Rode a migração
`0006_security.sql` (ou o `supabase/policies.sql` re-executável) e publique as
Edge Functions.

## 1) Rodar a migração de segurança

No **SQL Editor** do Supabase, rode `supabase/migrations/0006_security.sql`
(ou `supabase/policies.sql`, que é seguro rodar várias vezes).

Isso cria:

- tabela `admins` + função `is_admin()` (papel de administrador);
- políticas RLS que dão **escrita/leitura sensível apenas a admins**;
- remove o INSERT direto do cliente em `orders`/`order_items` (agora é feito
  pela função `place-order`);
- troca a baixa de estoque para a **aprovação do pagamento** (função
  `apply_order_stock`, chamada pelo webhook).

## 2) (item 5) Tornar seu usuário ADMIN

Crie o usuário em **Authentication → Users** (ou faça login uma vez) e rode,
trocando o e-mail:

```sql
insert into public.admins (id)
select id from auth.users where email = 'seuadmin@email.com'
on conflict do nothing;
```

Só usuários nesta tabela conseguem entrar no **PDV** e no **Painel**. Clientes
comuns são bloqueados no login do painel.

## 3) (itens 6 e 7) Publicar as Edge Functions

```bash
supabase functions deploy place-order          # cria pedido no servidor (preço/frete validados)
supabase functions deploy mercadopago-webhook   # baixa estoque + WhatsApp na aprovação
```

- `place-order` e `mercadopago-webhook` são **públicas** (sem JWT) — já
  configurado em `supabase/config.toml`.
- **Item 6 (anti-fraude):** `place-order` recalcula preços, custos e frete a
  partir do banco. O navegador nunca define o valor cobrado.
- **Item 7 (estoque):** o estoque só é abatido quando o pagamento é aprovado.
  O webhook é **idempotente** (não abate duas vezes: confere `orders.paid_at`).

## 4) (itens 8 e 9) Páginas legais e dados da empresa

- As páginas **Trocas e Devoluções, Entrega, Privacidade (LGPD), Termos e
  Quem Somos** ficam no rodapé da loja (componente `LegalPage`).
- Edite os dados reais da empresa em `src/data/products.ts` → `COMPANY`
  (razão social, CNPJ, endereço, e-mail e WhatsApp do SAC) antes de ir ao ar.
