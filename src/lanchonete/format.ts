/** Formatações compartilhadas pelo app da lanchonete. */

export const brl = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

export function money(v: number): string {
  // `+ 0` evita que -0 vire "-R$ 0,00" nas linhas do demonstrativo.
  return brl.format(Number.isFinite(v) ? v + 0 : 0)
}

/** Quantidade com no máximo 3 casas, sem zeros à toa (0.5 → "0,5"). */
export function qty(v: number): string {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 }).format(v)
}

export function dateTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function timeOnly(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

/** Converte "YYYY-MM-DD" em "DD/MM/AAAA" sem passar por fuso horário. */
export function dateBR(iso: string): string {
  if (!iso) return '—'
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

export function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`
}

/** Início do mês corrente em ISO. */
export function monthStartISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

/** Minutos decorridos desde uma data ISO. */
export function minutesSince(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000))
}
