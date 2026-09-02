# Banners da loja — cadastro sem erro de RLS

Se ao cadastrar um banner aparecer **"new row violates row-level security
policy"**, é porque a gravação estava indo direto do navegador para a tabela
`banners`, e isso depende da sessão do Supabase estar como **admin** (o que
falha se a sessão expira ou se você entrou como cliente na loja no mesmo
navegador).

A partir de agora os banners são gravados por uma **Edge Function com service
role** (`manage-banner`), que confere se você é admin e grava sem depender do
RLS. Também é ela que faz o upload da imagem.

## Publicar a função

```bash
supabase functions deploy manage-banner
```

- A função usa `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` (já existem no
  ambiente das funções — não precisa configurar segredo).
- Ela exige **JWT** (padrão). O painel envia automaticamente o token do usuário
  logado; a função confirma que esse usuário está em `public.admins`.

## Requisitos

- Ter rodado as migrações `0006`/`0007` (admins + `is_admin`) e `0008` (tabela
  `banners`). Se preferir, rode o `supabase/policies.sql` (idempotente).
- O bucket `product-images` deve existir (as imagens dos banners ficam nele,
  na pasta `banners/`). Ele já é criado pelas policies.

## Como funciona

- **Ler** os banners (loja e painel): direto do banco (leitura é pública).
- **Criar / editar / excluir / reordenar**: sempre pela função `manage-banner`.
- No **modo demo** (sem Supabase) nada disso é necessário — os banners ficam no
  navegador (localStorage).
