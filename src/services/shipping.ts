import type { Address, ShippingOption } from '../types'

/** CEP de origem (loja). Ajuste para o CEP real da sua operação. */
export const ORIGIN_UF = 'SP'

// Regiões dos Correios por UF, com base de preço (R$) e prazo (dias úteis) do
// PAC. O SEDEX é derivado (mais caro e mais rápido). É uma ESTIMATIVA — troque
// por `quoteShippingApi` (Correios/Melhor Envio) quando tiver contrato.
interface RegionRate {
  pacBase: number
  pacPerKg: number
  pacDays: number
}

const UF_REGION: Record<string, string> = {
  SP: 'sudeste', RJ: 'sudeste', MG: 'sudeste', ES: 'sudeste',
  PR: 'sul', SC: 'sul', RS: 'sul',
  DF: 'centro', GO: 'centro', MT: 'centro', MS: 'centro',
  BA: 'nordeste', SE: 'nordeste', AL: 'nordeste', PE: 'nordeste', PB: 'nordeste',
  RN: 'nordeste', CE: 'nordeste', PI: 'nordeste', MA: 'nordeste',
  TO: 'norte', PA: 'norte', AP: 'norte', RR: 'norte', AM: 'norte', AC: 'norte', RO: 'norte',
}

const REGION_RATE: Record<string, RegionRate> = {
  sudeste: { pacBase: 18.9, pacPerKg: 6, pacDays: 4 },
  sul: { pacBase: 22.9, pacPerKg: 7, pacDays: 5 },
  centro: { pacBase: 26.9, pacPerKg: 8, pacDays: 6 },
  nordeste: { pacBase: 32.9, pacPerKg: 10, pacDays: 8 },
  norte: { pacBase: 39.9, pacPerKg: 13, pacDays: 11 },
}

function round2(n: number) {
  return Math.round(n * 100) / 100
}

export function onlyDigits(cep: string) {
  return (cep || '').replace(/\D/g, '')
}

export function formatCep(cep: string) {
  const d = onlyDigits(cep).slice(0, 8)
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d
}

/**
 * Estima as opções de frete (PAC e SEDEX) para um destino (UF) e peso total.
 * O `subtotal` é aceito por compatibilidade, mas não altera o valor do frete.
 */
export function quoteShipping(
  uf: string,
  weightGrams: number,
  _subtotal?: number,
): ShippingOption[] {
  const region = UF_REGION[(uf || '').toUpperCase()] ?? 'sudeste'
  const rate = REGION_RATE[region]
  const kg = Math.max(0.3, weightGrams / 1000)

  const pacPrice = round2(rate.pacBase + rate.pacPerKg * kg)
  const sedexPrice = round2(pacPrice * 1.6 + 5)
  const sedexDays = Math.max(1, Math.ceil(rate.pacDays / 2))

  return [
    { service: 'PAC', price: pacPrice, days: rate.pacDays },
    { service: 'SEDEX', price: sedexPrice, days: sedexDays },
  ]
}

export interface CepResult {
  address: Partial<Address> | null
  error: string | null
}

/**
 * Consulta o CEP no ViaCEP (gratuito) para pré-preencher o endereço.
 * Roda no navegador do cliente; em caso de erro/offline, o endereço pode ser
 * preenchido manualmente.
 */
export async function lookupCep(cep: string): Promise<CepResult> {
  const digits = onlyDigits(cep)
  if (digits.length !== 8) {
    return { address: null, error: 'CEP deve ter 8 dígitos.' }
  }
  try {
    const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    if (data.erro) return { address: null, error: 'CEP não encontrado.' }
    return {
      address: {
        cep: formatCep(digits),
        street: data.logradouro ?? '',
        neighborhood: data.bairro ?? '',
        city: data.localidade ?? '',
        uf: data.uf ?? '',
      },
      error: null,
    }
  } catch {
    return { address: null, error: 'Não foi possível consultar o CEP agora. Preencha manualmente.' }
  }
}

/** Peso total do carrinho em gramas (padrão 300 g por item sem peso definido). */
export function cartWeight(items: { product: { weight?: number }; quantity: number }[]): number {
  return items.reduce((sum, i) => sum + (i.product.weight ?? 300) * i.quantity, 0)
}
