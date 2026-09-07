// Constantes de URL da loja, sem dependência do DOM — usadas tanto pela SPA
// quanto por scripts Node (ex.: scripts/gen-sitemap.ts).

/** Domínio do site. Ajuste se o domínio final for outro. */
export const SITE_URL = 'https://www.martinicaoficial.com.br'

/** Caminho da página de um produto (deep-link /produto/<id>). */
export function productPath(id: string): string {
  return `/produto/${encodeURIComponent(id)}`
}

/** URL absoluta da página de um produto. */
export function productUrl(id: string): string {
  return SITE_URL + productPath(id)
}
