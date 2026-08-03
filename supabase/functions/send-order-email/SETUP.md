# Configurar o e-mail de confirmação do pedido

Passo a passo para ativar o envio do e-mail (Edge Function `send-order-email`
+ Resend). Tempo: ~15 min.

---

## Parte 1 — Resend (serviço de e-mail)

1. Crie uma conta em **https://resend.com** (tem plano gratuito).
2. No painel do Resend, vá em **API Keys → Create API Key**.
   - Nome: `martinica-store` · Permission: **Sending access**.
   - **Copie a chave** (começa com `re_...`). Ela só aparece uma vez.
3. Remetente (**From**) — escolha uma opção:
   - **Teste rápido (sem domínio):** use `onboarding@resend.dev`. Limitação:
     só envia para **o e-mail dono da conta Resend**. Ótimo para testar.
   - **Produção (recomendado):** **Domains → Add Domain**, informe seu domínio
     (ex.: `seudominio.com`) e adicione no seu provedor de DNS os registros
     **SPF/DKIM** que o Resend mostrar. Depois de "Verified", você pode enviar
     de `pedidos@seudominio.com` para qualquer cliente.

---

## Parte 2 — Deploy da função no Supabase

Você pode fazer pela **CLI** (recomendado) **ou** pelo **Dashboard**.

### Opção A — CLI (recomendada)

1. Instale a CLI: https://supabase.com/docs/guides/cli (ex.: `npm i -g supabase`).
2. No terminal, dentro da pasta do projeto:
   ```bash
   supabase login
   supabase link --project-ref SEU_PROJECT_REF
   ```
   > `SEU_PROJECT_REF` está na URL do painel: `app.supabase.com/project/<REF>`
   > (ou em **Project Settings → General → Reference ID**).
3. Deploy da função:
   ```bash
   supabase functions deploy send-order-email
   ```
4. Configure os segredos:
   ```bash
   supabase secrets set RESEND_API_KEY=re_suachave
   supabase secrets set STORE_FROM_EMAIL="Martinica Store <pedidos@seudominio.com>"
   # opcional: cópia de cada pedido para a loja
   supabase secrets set STORE_NOTIFY_EMAIL="loja@seudominio.com"
   ```
   > Para teste sem domínio, use:
   > `STORE_FROM_EMAIL="Martinica Store <onboarding@resend.dev>"`
   > `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` já existem automaticamente.

### Opção B — Dashboard (sem instalar CLI)

1. No painel do Supabase: **Edge Functions → Create a function**.
2. Nome: `send-order-email`. Cole o conteúdo de
   `supabase/functions/send-order-email/index.ts` e **Deploy**.
3. Em **Edge Functions → Secrets** (ou **Project Settings → Edge Functions**),
   adicione:
   - `RESEND_API_KEY` = `re_suachave`
   - `STORE_FROM_EMAIL` = `Martinica Store <pedidos@seudominio.com>`
   - `STORE_NOTIFY_EMAIL` = `loja@seudominio.com` (opcional)

---

## Parte 3 — Testar

1. Na loja, **faça um pedido** (cadastre-se com um e-mail que você consiga abrir
   — se estiver usando `onboarding@resend.dev`, use o e-mail dono da conta
   Resend).
2. O e-mail de confirmação deve chegar em segundos.
3. Acompanhe os envios em **Resend → Emails** (status entregue/erro).

### Testar a função direto (opcional)

Pegue o `id` de um pedido em **Table Editor → orders** e rode:

```bash
curl -X POST 'https://SEU_PROJECT_REF.functions.supabase.co/send-order-email' \
  -H 'Authorization: Bearer SUA_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{"orderId":"COLE_O_ID_DO_PEDIDO"}'
```

Resposta esperada: `{"ok":true}`.

---

## Problemas comuns

| Sintoma | Causa provável | Solução |
|--------|----------------|---------|
| Tela diz "e-mail não pôde ser enviado" | função não deployada ou segredo faltando | confira o deploy e `RESEND_API_KEY` |
| `Resend 403 / domain not verified` | remetente de domínio não verificado | verifique o domínio no Resend ou use `onboarding@resend.dev` |
| E-mail não chega (com `onboarding@resend.dev`) | esse remetente só envia p/ o dono da conta | verifique um domínio próprio |
| `RESEND_API_KEY não configurada` | segredo ausente | `supabase secrets set RESEND_API_KEY=...` |
| Logs da função | — | **Edge Functions → send-order-email → Logs** |

> A compra **nunca trava** por causa do e-mail: se o envio falhar, o pedido é
> gravado normalmente e a tela avisa que o e-mail não saiu.
