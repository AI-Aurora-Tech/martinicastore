// Gera o PDF de um pedido de compra NO NAVEGADOR (pdf-lib) e dispara o
// download do arquivo. Mesmo layout do PDF enviado pelo WhatsApp (Edge
// Function notify-purchase), mas aqui o arquivo fica pronto para baixar.
import { BRL } from '../data/products'
import { faltaReceber, fetchPurchasePdf, type PurchaseSummary } from './purchase'

/** Monta os bytes do PDF de um pedido de compra. */
export async function buildPurchasePdfBytes(
  p: PurchaseSummary,
  storeName = 'Martinica Store',
): Promise<Uint8Array> {
  // Carrega o pdf-lib só quando realmente vai gerar um PDF (chunk separado).
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib')
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const ink = rgb(0.1, 0.1, 0.12)
  const muted = rgb(0.4, 0.4, 0.45)

  const W = 595.28
  const H = 841.89
  const margin = 48
  const right = W - margin
  let page = doc.addPage([W, H])
  let y = H - margin

  const newPageIfNeeded = (need: number) => {
    if (y < margin + need) { page = doc.addPage([W, H]); y = H - margin }
  }
  const line = (
    text: string,
    opts: { size?: number; f?: typeof font; color?: typeof ink } = {},
  ) => {
    const size = opts.size ?? 11
    newPageIfNeeded(size)
    page.drawText(text, { x: margin, y, size, font: opts.f ?? font, color: opts.color ?? ink })
    y -= size + 6
  }
  const rightText = (text: string, size = 11, f = font, color = ink) => {
    const w = f.widthOfTextAtSize(text, size)
    page.drawText(text, { x: right - w, y, size, font: f, color })
  }

  const num = String(p.number).padStart(6, '0')
  const parcial = p.status === 'parcial' || p.status === 'entregue'
  const situacao = p.status === 'cancelado' ? 'Cancelada'
    : p.status === 'entregue' ? 'Recebida por completo'
      : p.status === 'parcial' ? 'Parcialmente recebida'
        : 'Pendente de entrega'

  line(`Pedido de compra no ${num}`, { size: 18, f: bold })
  line(storeName, { size: 11, color: muted })
  y -= 4
  line(`Fornecedor: ${p.supplier || '-'}`)
  const dt = p.when ? new Date(p.when) : null
  line(`Data: ${dt && !Number.isNaN(dt.getTime()) ? dt.toLocaleDateString('pt-BR') : '-'}`)
  line(`Pagamento: ${p.paymentMethod || '-'}${p.installments && p.installments.length > 1 ? ` · ${p.installments.length}x` : ''} · ${p.paid ? 'Paga' : 'A pagar'}`)
  line(`Situacao: ${situacao}`)
  y -= 6

  line('Itens', { size: 13, f: bold })
  let total = 0
  for (const i of p.items) {
    const nome = `${i.name}${i.size ? ` (${i.size})` : ''}`
    const sub = i.unitCost * i.quantity
    total += sub
    newPageIfNeeded(30)
    const label = `• ${i.quantity}x ${nome}`
    page.drawText(label.length > 56 ? label.slice(0, 55) + '…' : label, { x: margin, y, size: 11, font, color: ink })
    rightText(`${BRL.format(i.unitCost)}/un  =  ${BRL.format(sub)}`, 11, font, muted)
    y -= 15
    if (parcial) {
      const recebido = Math.min(i.received ?? 0, i.quantity)
      page.drawText(`recebido ${recebido} · falta ${faltaReceber(i)}`, { x: margin + 14, y, size: 9, font, color: muted })
      y -= 13
    }
    y -= 3
  }

  y -= 6
  newPageIfNeeded(24)
  page.drawText('Total do pedido', { x: margin, y, size: 13, font: bold, color: ink })
  rightText(BRL.format(total), 13, bold, ink)
  y -= 26
  line('Pode confirmar disponibilidade e prazo de entrega, por favor?', { size: 11, color: muted })

  return await doc.save()
}

/** Dispara o download de um arquivo PDF (a partir dos bytes). */
function triggerDownload(bytes: Uint8Array, fileName: string) {
  const buf = new Uint8Array(bytes) // cópia num ArrayBuffer "limpo" para o Blob
  const blob = new Blob([buf], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64)
  const arr = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
  return arr
}

/**
 * Baixa o PDF do pedido. Prefere o arquivo gerado pela Edge Function (mesmo
 * que vai pelo WhatsApp); se não houver backend ou a função falhar, gera o PDF
 * no próprio navegador.
 */
export async function downloadPurchasePdf(p: PurchaseSummary, storeName = 'Martinica Store'): Promise<void> {
  const fallbackName = `pedido-${String(p.number).padStart(6, '0')}.pdf`
  if (p.id) {
    const server = await fetchPurchasePdf(p.id)
    if (server) { triggerDownload(base64ToBytes(server.base64), server.fileName || fallbackName); return }
  }
  const bytes = await buildPurchasePdfBytes(p, storeName)
  triggerDownload(new Uint8Array(bytes), fallbackName)
}
