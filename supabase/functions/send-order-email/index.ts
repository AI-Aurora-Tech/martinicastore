// Supabase Edge Function: send-order-email
// Notifica o pedido por E-MAIL (Gmail/SMTP ou Resend) e por WHATSAPP (Z-API).
// Lê o pedido no banco com a service role — o cliente só informa o orderId.
// Cada canal é best-effort; se ao menos um for enviado, retorna 200.
//
// Provedores de E-MAIL (opcional):
//   - GMAIL:  GMAIL_USER + GMAIL_APP_PASSWORD  (Senha de app do Google)
//   - RESEND: RESEND_API_KEY  (+ STORE_FROM_EMAIL)
// WHATSAPP via Z-API (opcional):
//   - ZAPI_INSTANCE_ID, ZAPI_INSTANCE_TOKEN, ZAPI_CLIENT_TOKEN
//   - STORE_WHATSAPP  (número da loja p/ receber aviso de cada pedido)
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

const onlyDigits = (s: string) => (s || '').replace(/\D/g, '')

function orderAddress(o: Record<string, unknown>): string {
  return [
    o.ship_street, o.ship_number, o.ship_complement, o.ship_neighborhood,
    o.ship_city && `${o.ship_city} - ${o.ship_uf ?? ''}`, o.ship_cep,
  ].filter(Boolean).join(', ')
}

function buildHtml(order: Record<string, unknown>, items: Array<Record<string, unknown>>): string {
  const num = String(order.number ?? '').padStart(6, '0')
  const rows = items
    .map((i) => `<tr>
      <td style="padding:6px 0;border-bottom:1px solid #eee">${i.quantity}x ${i.name}${i.size ? ` (${i.size})` : ''}</td>
      <td style="padding:6px 0;border-bottom:1px solid #eee;text-align:right">${BRL(Number(i.line_total))}</td></tr>`)
    .join('')
  return `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#111">
    <div style="background:#111;padding:18px 20px;border-radius:12px 12px 0 0">
      <span style="color:#ff6a00;font-weight:800;font-size:20px">MARTINICA STORE</span></div>
    <div style="border:1px solid #eee;border-top:none;border-radius:0 0 12px 12px;padding:20px">
      <h2 style="margin:0 0 4px">Pedido confirmado! 🎉</h2>
      <p style="color:#555;margin:0 0 16px">Pedido <strong>nº ${num}</strong></p>
      <table style="width:100%;border-collapse:collapse;font-size:14px">${rows}</table>
      <table style="width:100%;border-collapse:collapse;font-size:14px;margin-top:10px">
        <tr><td>Subtotal</td><td style="text-align:right">${BRL(Number(order.subtotal))}</td></tr>
        <tr><td>Frete ${order.shipping_service ? `(${order.shipping_service})` : ''}</td>
            <td style="text-align:right">${Number(order.shipping) > 0 ? BRL(Number(order.shipping)) : 'Grátis'}</td></tr>
        <tr><td style="font-weight:800;font-size:16px;padding-top:6px">Total</td>
            <td style="text-align:right;font-weight:800;font-size:16px;padding-top:6px">${BRL(Number(order.total))}</td></tr>
      </table>
      <h3 style="margin:20px 0 6px;font-size:15px">Entrega</h3>
      <p style="color:#555;margin:0;font-size:14px">${orderAddress(order) || 'Endereço não informado'}</p>
      ${order.shipping_service ? `<p style="color:#555;margin:4px 0 0;font-size:14px">${order.shipping_service} · até ${order.shipping_days ?? '?'} dias úteis</p>` : ''}
    </div></div>`
}

async function sendEmail(opts: { to: string; bcc?: string; subject: string; html: string }) {
  const gmailUser = Deno.env.get('GMAIL_USER')
  const gmailPass = Deno.env.get('GMAIL_APP_PASSWORD')
  const resendKey = Deno.env.get('RESEND_API_KEY')
  if (gmailUser && gmailPass) {
    const fromName = Deno.env.get('STORE_FROM_NAME') ?? 'Martinica Store'
    const client = new SMTPClient({
      connection: { hostname: 'smtp.gmail.com', port: 465, tls: true, auth: { username: gmailUser, password: gmailPass.replace(/\s+/g, '') } },
    })
    try {
      await client.send({ from: `${fromName} <${gmailUser}>`, to: opts.to, bcc: opts.bcc ? [opts.bcc] : undefined, subject: opts.subject, content: 'Confirmação do seu pedido.', html: opts.html })
    } finally { await client.close() }
    return
  }
  if (resendKey) {
    const from = Deno.env.get('STORE_FROM_EMAIL') ?? 'Martinica Store <onboarding@resend.dev>'
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST', headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: opts.to, bcc: opts.bcc, subject: opts.subject, html: opts.html }),
    })
    if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`)
    return
  }
  throw new Error('no-email-provider')
}

async function sendWhatsApp(phone: string, message: string) {
  const inst = Deno.env.get('ZAPI_INSTANCE_ID')
  const token = Deno.env.get('ZAPI_INSTANCE_TOKEN')
  const clientToken = Deno.env.get('ZAPI_CLIENT_TOKEN')
  const to = onlyDigits(phone)
  if (!inst || !token || !to) throw new Error('zapi-not-configured')
  const url = `https://api.z-api.io/instances/${inst}/token/${token}/send-text`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(clientToken ? { 'Client-Token': clientToken } : {}) },
    body: JSON.stringify({ phone: to, message }),
  })
  if (!res.ok) throw new Error(`Z-API ${res.status}: ${await res.text()}`)
}

function whatsappForStore(order: Record<string, unknown>, items: Array<Record<string, unknown>>): string {
  const num = String(order.number ?? '').padStart(6, '0')
  const list = items.map((i) => `• ${i.quantity}x ${i.name}`).join('\n')
  return `🛒 *Novo pedido nº ${num}*\nCliente: ${order.customer_name ?? '—'}\n${list}\n*Total:* ${BRL(Number(order.total))}\nEntrega: ${order.shipping_service ?? '—'}\n📍 ${orderAddress(order) || '—'}`
}
function whatsappForCustomer(order: Record<string, unknown>): string {
  const num = String(order.number ?? '').padStart(6, '0')
  return `✅ *Martinica Store*\nRecebemos seu pedido *nº ${num}*!\nTotal: ${BRL(Number(order.total))}\nEntrega: ${order.shipping_service ?? '—'} (até ${order.shipping_days ?? '?'} dias úteis).\nObrigado pela compra! 🧡`
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const { orderId } = await req.json()
    if (!orderId) {
      return new Response(JSON.stringify({ error: 'orderId é obrigatório.' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })
    }
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data: order, error: oErr } = await supabase.from('orders').select('*').eq('id', orderId).single()
    if (oErr || !order) throw oErr ?? new Error('Pedido não encontrado.')
    const { data: items } = await supabase.from('order_items').select('*').eq('order_id', orderId)
    const list = items ?? []

    let emailSent = false
    let whatsappSent = false
    let lastError: string | null = null

    // E-mail (best-effort)
    if (order.customer_email) {
      try {
        await sendEmail({
          to: order.customer_email,
          bcc: Deno.env.get('STORE_NOTIFY_EMAIL') ?? undefined,
          subject: `Pedido nº ${String(order.number ?? '').padStart(6, '0')} confirmado — Martinica Store`,
          html: buildHtml(order, list),
        })
        emailSent = true
      } catch (e) {
        if (String((e as Error).message) !== 'no-email-provider') lastError = (e as Error).message
      }
    }

    // WhatsApp via Z-API (best-effort): loja + cliente
    const storeWa = Deno.env.get('STORE_WHATSAPP')
    try {
      if (storeWa) { await sendWhatsApp(storeWa, whatsappForStore(order, list)); whatsappSent = true }
    } catch (e) {
      if (String((e as Error).message) !== 'zapi-not-configured') lastError = (e as Error).message
    }
    if (order.customer_phone) {
      try { await sendWhatsApp(String(order.customer_phone), whatsappForCustomer(order)); whatsappSent = true } catch { /* ignore */ }
    }

    if (!emailSent && !whatsappSent) {
      return new Response(
        JSON.stringify({ error: lastError ?? 'Nenhum canal configurado (e-mail ou Z-API/WhatsApp).' }),
        { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } },
      )
    }
    return new Response(JSON.stringify({ ok: true, emailSent, whatsappSent }), { headers: { ...cors, 'Content-Type': 'application/json' } })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[send-order-email]', message)
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } })
  }
})
