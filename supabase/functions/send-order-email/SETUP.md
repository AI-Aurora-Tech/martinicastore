# Configurar o e-mail de confirmação do pedido

A Edge Function `send-order-email` envia o e-mail. Você pode usar o **Gmail**
(mais simples se você já tem uma conta) **ou** o **Resend**. Escolha UMA opção
na Parte 1. Tempo: ~15 min.

---

## Parte 1 — Escolha o provedor de e-mail

### Opção A — Gmail (usar seu e-mail do Google)

Usa o SMTP do Gmail com uma **Senha de app** (não é a sua senha normal).

1. A conta Google precisa ter a **Verificação em duas etapas (2FA) ativada**:
   https://myaccount.google.com/security → **Verificação em duas etapas** → ative.
2. Crie uma **Senha de app**: https://myaccount.google.com/apppasswords
   - Nome do app: `Martinica Store` → **Criar**.
   - O Google mostra uma senha de **16 letras** (ex.: `abcd efgh ijkl mnop`).
     **Copie** — é ela que vai no segredo `GMAIL_APP_PASSWORD` (pode colar com
     ou sem espaços).
3. Segredos que você vai configurar na Parte 2:
   - `GMAIL_USER` = `sualoja@gmail.com`
   - `GMAIL_APP_PASSWORD` = a senha de app de 16 letras
   - `STORE_FROM_NAME` = `Martinica Store` (opcional, nome exibido)
   - `STORE_NOTIFY_EMAIL` = e-mail p/ receber cópia oculta (opcional)

> Observações do Gmail: o remetente é sempre o seu endereço `@gmail.com`
> (o Google não deixa "falsificar" outro). Limite ~500 e-mails/dia (Gmail
> gratuito) ou 2000/dia (Google Workspace) — suficiente para uma loja pequena.

### Opção B — Resend

1. Crie uma conta em **https://resend.com** (tem plano gratuito).
2. **API Keys → Create API Key** → permissão **Sending access** → **copie a
   chave** (`re_...`, aparece só uma vez).
3. Remetente (**From**):
   - **Teste:** `onboarding@resend.dev` (só envia para o e-mail dono da conta).
   - **Produção:** **Domains → Add Domain** + registros SPF/DKIM no seu DNS.
4. Segredos: `RESEND_API_KEY` e (opcional) `STORE_FROM_EMAIL`.

> Se você configurar Gmail **e** Resend, o Gmail tem preferência.

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
4. Configure os segredos — **Gmail**:
   ```bash
   supabase secrets set GMAIL_USER="sualoja@gmail.com"
   supabase secrets set GMAIL_APP_PASSWORD="abcd efgh ijkl mnop"
   supabase secrets set STORE_FROM_NAME="Martinica Store"        # opcional
   supabase secrets set STORE_NOTIFY_EMAIL="loja@gmail.com"      # opcional
   ```
   …**ou Resend**:
   ```bash
   supabase secrets set RESEND_API_KEY=re_suachave
   supabase secrets set STORE_FROM_EMAIL="Martinica Store <pedidos@seudominio.com>"
   ```
   > `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` já existem automaticamente.

### Opção B — Dashboard (sem instalar CLI)

1. No painel do Supabase: **Edge Functions → Create a function**.
2. Nome: `send-order-email`. Cole o conteúdo de
   `supabase/functions/send-order-email/index.ts` e **Deploy**.
3. Em **Edge Functions → Secrets** (ou **Project Settings → Edge Functions**),
   adicione os do seu provedor:
   - **Gmail:** `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `STORE_FROM_NAME` (opcional),
     `STORE_NOTIFY_EMAIL` (opcional)
   - **Resend:** `RESEND_API_KEY`, `STORE_FROM_EMAIL` (opcional)

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
| "Failed to send a request to the Edge Function" | função **não publicada** | faça o deploy da função |
| `Nenhum provedor configurado` | faltam os segredos | configure Gmail **ou** Resend |
| `Username and Password not accepted` (Gmail) | senha errada ou sem 2FA | use a **Senha de app** (não a senha normal) e ative a 2FA |
| `Invalid login` / `535` (Gmail) | `GMAIL_APP_PASSWORD` incorreta | gere outra senha de app e reconfigure |
| `Resend 403 / domain not verified` | remetente não verificado | verifique o domínio ou use `onboarding@resend.dev` |
| E-mail não chega (com `onboarding@resend.dev`) | só envia p/ o dono da conta | verifique um domínio próprio |
| Ver o erro exato | — | **Edge Functions → send-order-email → Logs** |

> A compra **nunca trava** por causa do e-mail: se o envio falhar, o pedido é
> gravado normalmente e a tela avisa que o e-mail não saiu.
