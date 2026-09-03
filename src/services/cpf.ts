// Utilitários de CPF: máscara, dígitos e validação (dígitos verificadores).

export function onlyDigitsCpf(v: string): string {
  return (v || '').replace(/\D/g, '').slice(0, 11)
}

/** Formata como 000.000.000-00 conforme digita. */
export function formatCpf(v: string): string {
  const d = onlyDigitsCpf(v)
  const p = [d.slice(0, 3), d.slice(3, 6), d.slice(6, 9), d.slice(9, 11)]
  let out = p[0]
  if (p[1]) out += `.${p[1]}`
  if (p[2]) out += `.${p[2]}`
  if (p[3]) out += `-${p[3]}`
  return out
}

/** Valida CPF pelos dígitos verificadores (rejeita sequências iguais). */
export function isValidCpf(v: string): boolean {
  const c = onlyDigitsCpf(v)
  if (c.length !== 11) return false
  if (/^(\d)\1{10}$/.test(c)) return false
  const calc = (base: string, factor: number) => {
    let sum = 0
    for (const ch of base) sum += Number(ch) * factor--
    const rest = (sum * 10) % 11
    return rest === 10 ? 0 : rest
  }
  const d1 = calc(c.slice(0, 9), 10)
  if (d1 !== Number(c[9])) return false
  const d2 = calc(c.slice(0, 10), 11)
  return d2 === Number(c[10])
}
