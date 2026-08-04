# Pagamento online com Mercado Pago (Pix + Cartão)

Recebe os pagamentos das vendas online via **Mercado Pago (Checkout Pro)** e,
quando o pagamento é **aprovado**, envia automaticamente um **WhatsApp** ao
cliente. Usa duas Edge Functions:

- `create-payment` — cria a preferência de pagamento e devolve a URL de checkout.
- `mercadopago-webhook` — recebe a confirmação do Mercado Pago, marca o pedido
  como **pago** e dispara o WhatsApp de "pagamento aprovado".

---

## Parte 1 — Credenciais do Mercado Pago

1. Acesse o [Painel de Desenvolvedores](https://www.mercadopago.com.br/developers/panel)
   e crie uma **aplicação**.
2. Em **Credenciais**, copie o **Access Token**:
   - **Teste** (`TEST-...`) para homologar com cartões/Pix de teste.
   - **Produção** (`APP_USR-...`) para receber de verdade.

---

## Parte 2 — Publicar as funções

### CLI

```bash
supabase functions deploy create-payment
supabase functions deploy mercadopago-webhook   # já vai como pública (config.toml)

supabase secrets set MP_ACCESS_TOKEN=APP_USR_ou_TEST_xxx
# (o webhook reaproveita os segredos da Z-API para o WhatsApp)
```

### Dashboard (sem CLI)

1. **Edge Functions → Create a function** → `create-payment` → cole o
   `create-payment/index.ts` → Deploy.
2. **Create a function** → `mercadopago-webhook` → cole o
   `mercadopago-webhook/index.ts` → Deploy. Depois abra a função →
   **Details** → **desmarque "Enforce JWT verification"** (o Mercado Pago
   chama sem token).
3. **Edge Functions → Secrets** → adicione `MP_ACCESS_TOKEN`
   (e os `ZAPI_*` + `STORE_WHATSAPP`, se ainda não tiver, para o WhatsApp).

---

## Parte 3 — Configurar o Webhook no Mercado Pago

No painel do Mercado Pago → sua aplicação → **Webhooks / Notificações**, cadastre
a URL:

```
https://SEU_PROJECT_REF.supabase.co/functions/v1/mercadopago-webhook
```

Selecione o evento **Pagamentos (payment)**. (A `create-payment` também já envia
essa `notification_url` em cada preferência, então funciona mesmo sem cadastrar —
mas cadastrar é o recomendado.)

---

## Parte 4 — Testar

1. Faça um pedido na loja e clique **Confirmar e pagar** → você é redirecionado
   ao Mercado Pago.
2. Pague com Pix (QR de teste) ou um
   [cartão de teste](https://www.mercadopago.com.br/developers/pt/docs/checkout-pro/additional-content/your-integrations/test/cards).
3. Ao aprovar, você volta para a loja (banner "Pagamento aprovado") e o cliente
   recebe o WhatsApp "🎉 Pagamento aprovado!". O pedido fica com status **Pago**
   na aba **Pedidos** do Admin.

## Como funciona (resumo)

1. `Confirmar e pagar` grava o pedido (status *pending*) e chama `create-payment`.
2. O cliente paga no Mercado Pago.
3. O Mercado Pago chama `mercadopago-webhook` → a função confirma o pagamento na
   API do MP; se **approved**, marca `orders.status='paid'` e manda o WhatsApp.

> **Observações**
> - Sem `MP_ACCESS_TOKEN`, a loja segue no fluxo antigo (pedido confirmado sem
>   pagamento online) — nada quebra.
> - O `mercadopago-webhook` **precisa** estar público (sem JWT), senão o MP não
>   consegue chamá-lo.
> - Para produção, use o Access Token de produção e valide o pagamento pela API
>   (a função já faz isso — não confia no dado do navegador).
