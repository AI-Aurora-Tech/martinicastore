import type { Supplier } from '../types'

/**
 * Normaliza o telefone para o formato do WhatsApp (só dígitos, com DDI).
 * Se não vier DDI, assume Brasil (55).
 */
export function waPhone(phone: string | undefined): string {
  const d = (phone || '').replace(/\D/g, '')
  if (!d) return ''
  if (d.startsWith('55')) return d
  // 10-11 dígitos = número nacional (DDD + número) → prefixa 55
  if (d.length === 10 || d.length === 11) return `55${d}`
  return d
}

/** Monta o link wa.me (click-to-chat) com a mensagem já preenchida. */
export function waLink(phone: string | undefined, message: string): string | null {
  const p = waPhone(phone)
  if (!p) return null
  return `https://wa.me/${p}?text=${encodeURIComponent(message)}`
}

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

export interface POLine {
  name: string
  quantity: number
  unitCost: number
}

/** Texto do pedido de compra para enviar ao fornecedor. */
export function buildPurchaseText(
  supplier: Supplier | null,
  lines: POLine[],
  storeName = 'Martinica Store',
): string {
  const total = lines.reduce((s, l) => s + l.unitCost * l.quantity, 0)
  const rows = lines
    .map((l) => `• ${l.quantity}x ${l.name} — ${BRL.format(l.unitCost)}/un`)
    .join('\n')
  const hi = supplier?.contact || supplier?.name || ''
  return (
    `*Pedido de compra — ${storeName}*\n` +
    (hi ? `Olá, ${hi}!\n` : '') +
    `\nGostaríamos de solicitar:\n${rows}\n\n` +
    `*Total estimado:* ${BRL.format(total)}\n\n` +
    `Pode confirmar disponibilidade e prazo? Obrigado!`
  )
}
