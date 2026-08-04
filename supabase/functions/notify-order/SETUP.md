# Notificação de pedido por WhatsApp (Z-API)

A Edge Function `notify-order` avisa, a cada pedido online, a **loja** e o
**cliente** por WhatsApp usando a [Z-API](https://www.z-api.io/). (As
notificações por e-mail foram removidas.)

---

## Parte 1 — Z-API

1. Crie uma conta na **Z-API** e uma **instância**.
2. **Conecte o WhatsApp** da loja: no painel da instância, leia o **QR Code**
   com o celular (WhatsApp → Aparelhos conectados).
3. No painel da instância, anote:
   - **ID da instância** (`ZAPI_INSTANCE_ID`)
   - **Token da instância** (`ZAPI_INSTANCE_TOKEN`)
   - **Client-Token** / Token de segurança da conta (`ZAPI_CLIENT_TOKEN`)

---

## Parte 2 — Publicar a função

### Opção A — CLI

```bash
supabase functions deploy notify-order
supabase secrets set ZAPI_INSTANCE_ID=xxxxxxxx
supabase secrets set ZAPI_INSTANCE_TOKEN=xxxxxxxx
supabase secrets set ZAPI_CLIENT_TOKEN=xxxxxxxx
supabase secrets set STORE_WHATSAPP=5511988887777   # número da loja (só dígitos, DDI+DDD)
```

### Opção B — Dashboard (sem CLI)

1. **Edge Functions → Create a function** → nome **`notify-order`** → cole o
   conteúdo de `supabase/functions/notify-order/index.ts` → **Deploy**.
2. **Edge Functions → Secrets** → adicione `ZAPI_INSTANCE_ID`,
   `ZAPI_INSTANCE_TOKEN`, `ZAPI_CLIENT_TOKEN` e `STORE_WHATSAPP`.

> `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` já existem automaticamente.
> Se você havia publicado a função antiga `send-order-email`, pode **excluí-la**
> (não é mais usada).

---

## Parte 3 — Testar

1. Faça um pedido na loja informando um **WhatsApp** válido no cadastro.
2. A loja (`STORE_WHATSAPP`) recebe o aviso do pedido e o cliente recebe a
   confirmação.
3. Logs/erros: **Edge Functions → notify-order → Logs**. Envios: painel da Z-API.

## Problemas comuns

| Sintoma | Causa | Solução |
|--------|-------|---------|
| "Failed to send a request to the Edge Function" | função não publicada | faça o deploy de `notify-order` |
| `WhatsApp (Z-API) não configurado` | faltam segredos | configure `ZAPI_*` e `STORE_WHATSAPP` |
| `Z-API 4xx` nos logs | instância desconectada ou token errado | reconecte o QR Code / confira os tokens |
| Cliente não recebe | pedido sem telefone | o WhatsApp é obrigatório no cadastro; confira o número |

> A compra nunca trava por causa da notificação: o pedido é gravado mesmo que o
> WhatsApp falhe, e a tela avisa o motivo.
