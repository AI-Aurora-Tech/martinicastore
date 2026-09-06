# Pedido de compra no grupo do fornecedor (Evolution API)

Em **Gestão → Compras**, depois de registrar o pedido, o botão
**"Enviar pedido (WhatsApp)"** manda a mensagem direto pela Evolution — sem
abrir o WhatsApp Web, sem nova aba, sem clicar em "enviar" de novo.

Destino, nesta ordem:

1. o **grupo de WhatsApp** cadastrado no fornecedor;
2. sem grupo, o **WhatsApp** do fornecedor.

Sem nenhum dos dois, o botão fica desabilitado e a dica explica o motivo.

---

## Parte 1 — Banco

Rode a migração `0020_supplier_whatsapp_group.sql`, que cria a coluna
`suppliers.whatsapp_group`. É aditiva e pode rodar mais de uma vez.

```bash
supabase db push
```

Ou cole o conteúdo dela no **SQL Editor** do Supabase.

---

## Parte 2 — Publicar a função

```bash
supabase functions deploy notify-purchase
```

Ou pelo Dashboard: **Edge Functions → Create a function** → nome
**`notify-purchase`** → cole o conteúdo de `index.ts` → **Deploy**.

Ela reaproveita os segredos que já existem (`EVOLUTION_API_URL`,
`EVOLUTION_API_KEY`, `EVOLUTION_INSTANCE`) — não há segredo novo.

> A função exige JWT de **admin**: só quem está logado na Gestão dispara o
> envio. Mantenha a verificação de JWT LIGADA (o padrão).

---

## Parte 3 — Achar o ID do grupo

O destino não é um telefone, é o **ID do grupo**, no formato
`120363XXXXXXXXXXXX@g.us`. Como conseguir:

1. **O WhatsApp da loja precisa estar no grupo** — a Evolution envia como a
   loja, então ela só consegue postar em grupos de que participa.
2. Liste os grupos da instância:

   ```bash
   curl "$EVOLUTION_API_URL/group/fetchAllGroups/$EVOLUTION_INSTANCE?getParticipants=false" \
     -H "apikey: $EVOLUTION_API_KEY"
   ```

   Procure o grupo pelo `subject` (nome) e copie o `id`.

> O caminho exato desse endpoint muda entre versões da Evolution. Se der 404,
> confira no Swagger da sua instância (`{EVOLUTION_API_URL}/docs`) qual é o de
> listar grupos.

---

## Parte 4 — Cadastrar no fornecedor

**Gestão → Compras → Gerenciar (fornecedores)** → campo **Grupo do WhatsApp**.
Cole o id (`120363XXXXXXXXXXXX@g.us`) e salve.

Também aceita só os dígitos, sem o `@g.us`: um telefone tem no máximo 15
dígitos, então 16 ou mais é tratado como grupo e o sufixo é adicionado.

---

## Parte 5 — Testar

1. Cadastre o grupo em um fornecedor.
2. **Compras → Novo pedido de compra**, escolha esse fornecedor, adicione itens
   e registre.
3. Clique em **"Enviar pedido (WhatsApp)"**. A mensagem cai no grupo e a tela
   diz se funcionou — nada abre no navegador.

## Problemas comuns

| Mensagem na tela | Causa | Solução |
|---|---|---|
| "não tem grupo nem WhatsApp cadastrado" | fornecedor sem os dois campos | preencha grupo ou WhatsApp em "Gerenciar" |
| "registrada sem fornecedor" | compra registrada sem escolher fornecedor | selecione o fornecedor antes de registrar |
| "Modo demo: sem backend" | rodando sem Supabase | o envio precisa das Edge Functions |
| `Evolution 400` | a loja não está no grupo, ou o id está errado | confira o id e se o WhatsApp da loja participa do grupo |
| `forbidden` | quem chamou não é admin | entre na Gestão com uma conta de admin |
| "Failed to send a request…" | função não publicada | `supabase functions deploy notify-purchase` |

> O envio é best-effort: **a compra fica registrada mesmo que o WhatsApp
> falhe**, e a tela mostra o motivo para você mandar pelo botão manual.
