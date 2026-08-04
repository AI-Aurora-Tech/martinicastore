// Supabase Edge Function: send-order-email
// Envia o e-mail de confirmação do pedido, lendo os dados no banco com a
// service role — o cliente só informa o orderId.
//
// Provedor de envio (escolhido pelos segredos configurados):
//   - GMAIL:  GMAIL_USER + GMAIL_APP_PASSWORD  (Senha de app do Google)
//   - RESEND: RESEND_API_KEY
// Se ambos existirem, o Gmail tem preferência.
//
// Deploy:  supabase functions deploy send-order-email
// Segredos (Dashboard → Edge Functions → Secrets, ou CLI `supabase secrets set`):
//   # opção Gmail
//   GMAIL_USER="sualoja@gmail.com"
//   GMAIL_APP_PASSWORD="abcd efgh ijkl mnop"   # senha de app (16 letras)
//   STORE_FROM_NAME="Martinica Store"          # opcional (nome exibido)
//   STORE_NOTIFY_EMAIL="loja@gmail.com"        # opcional (cópia oculta)
// (SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY já existem no ambiente da função.)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const BRL = (n: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(n) || 0)

function itemsRows(items: Array<Record<string, unknown>>): string {
  return items
    .map(
      (i) => `<tr>
        <td style="padding:6px 0;border-bottom:1px solid #eee">${i.quantity}x ${i.name}${i.size ? ` (${i.size})` : ''}</td>
        <td style="padding:6px 0;border-bottom:1px solid #eee;text-align:right">${BRL(Number(i.line_total))}</td>
      </tr>`,
    )
    .join('')
}

function buildHtml(order: Record<string, unknown>, items: Array<Record<string, unknown>>): string {
  const num = String(order.number ?? '').padStart(6, '0')
  const addr = [
    order.ship_street,
    order.ship_number,
    order.ship_complement,
    order.ship_neighborhood,
    order.ship_city && `${order.ship_city} - ${order.ship_uf ?? ''}`,
    order.ship_cep,
  ]
    .filter(Boolean)
    .join(', ')

  return `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#111">
    <div style="background:#111;padding:18px 20px;border-radius:12px 12px 0 0">
      <span style="color:#ff6a00;font-weight:800;font-size:20px">MARTINICA STORE</span>
    </div>
    <div style="border:1px solid #eee;border-top:none;border-radius:0 0 12px 12px;padding:20px">
      <h2 style="margin:0 0 4px">Pedido confirmado! 🎉</h2>
      <p style="color:#555;margin:0 0 16px">Pedido <strong>nº ${num}</strong></p>

      <table style="width:100%;border-collapse:collapse;font-size:14px">${itemsRows(items)}</table>

      <table style="width:100%;border-collapse:collapse;font-size:14px;margin-top:10px">
        <tr><td>Subtotal</td><td style="text-align:right">${BRL(Number(order.subtotal))}</td></tr>
        <tr><td>Frete ${order.shipping_service ? `(${order.shipping_service})` : ''}</td>
            <td style="text-align:right">${Number(order.shipping) > 0 ? BRL(Number(order.shipping)) : 'Grátis'}</td></tr>
        <tr><td style="font-weight:800;font-size:16px;padding-top:6px">Total</td>
            <td style="text-align:right;font-weight:800;font-size:16px;padding-top:6px">${BRL(Number(order.total))}</td></tr>
      </table>

      <h3 style="margin:20px 0 6px;font-size:15px">Entrega</h3>
      <p style="color:#555;margin:0;font-size:14px">${addr || 'Endereço não informado'}</p>
      ${order.shipping_service ? `<p style="color:#555;margin:4px 0 0;font-size:14px">${order.shipping_service} · até ${order.shipping_days ?? '?'} dias úteis</p>` : ''}

      <p style="color:#888;font-size:12px;margin-top:24px">
        Você recebeu este e-mail porque fez um pedido na Martinica Store.
      </p>
    </div>
  </div>`
}

async function deliver(opts: { to: string; bcc?: string; subject: string; html: string }) {
  const gmailUser = Deno.env.get('GMAIL_USER')
  const gmailPass = Deno.env.get('GMAIL_APP_PASSWORD')
  const resendKey = Deno.env.get('RESEND_API_KEY')

  // --- Gmail (SMTP) ---
  if (gmailUser && gmailPass) {
    const fromName = Deno.env.get('STORE_FROM_NAME') ?? 'Martinica Store'
    const client = new SMTPClient({
      connection: {
        hostname: 'smtp.gmail.com',
        port: 465,
        tls: true,
        auth: { username: gmailUser, password: gmailPass.replace(/\s+/g, '') },
      },
    })
    try {
      await client.send({
        from: `${fromName} <${gmailUser}>`, // o Gmail exige o remetente autenticado
        to: opts.to,
        bcc: opts.bcc ? [opts.bcc] : undefined,
        subject: opts.subject,
        content: 'Confirmação do seu pedido.',
        html: opts.html,
      })
    } finally {
      await client.close()
    }
    return
  }

  // --- Resend (HTTP) ---
  if (resendKey) {
    const from = Deno.env.get('STORE_FROM_EMAIL') ?? 'Martinica Store <onboarding@resend.dev>'
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: opts.to, bcc: opts.bcc, subject: opts.subject, html: opts.html }),
    })
    if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`)
    return
  }

  throw new Error(
    'Nenhum provedor configurado. Defina GMAIL_USER + GMAIL_APP_PASSWORD (Gmail) ou RESEND_API_KEY.',
  )
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const { orderId } = await req.json()
    if (!orderId) {
      return new Response(JSON.stringify({ error: 'orderId é obrigatório.' }), {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: order, error: oErr } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single()
    if (oErr || !order) throw oErr ?? new Error('Pedido não encontrado.')

    const { data: items } = await supabase
      .from('order_items')
      .select('*')
      .eq('order_id', orderId)

    const to = order.customer_email
    if (!to) {
      return new Response(JSON.stringify({ skipped: 'pedido sem e-mail do cliente' }), {
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    await deliver({
      to,
      bcc: Deno.env.get('STORE_NOTIFY_EMAIL') ?? undefined,
      subject: `Pedido nº ${String(order.number ?? '').padStart(6, '0')} confirmado — Martinica Store`,
      html: buildHtml(order, items ?? []),
    })

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[send-order-email]', message)
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
})
