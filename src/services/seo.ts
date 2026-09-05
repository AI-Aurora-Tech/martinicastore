// SEO dinâmico por produto (SPA): atualiza <title>/metas/canonical/OG e injeta
// JSON-LD de Product na página do produto — o Googlebot renderiza JS e lê isso,
// permitindo rich results (preço, disponibilidade, avaliações).

import type { Product } from '../types'

/** Domínio do site. Ajuste se o domínio final for outro. */
export const SITE_URL = 'https://www.martinicaoficial.com.br'

export function productPath(id: string): string {
  return `/produto/${encodeURIComponent(id)}`
}
export function productUrl(id: string): string {
  return SITE_URL + productPath(id)
}

function q<T extends Element>(sel: string): T | null {
  return document.head.querySelector(sel)
}
function upsertMeta(attr: 'name' | 'property', key: string, content: string) {
  let m = q<HTMLMetaElement>(`meta[${attr}="${key}"]`)
  if (!m) {
    m = document.createElement('meta')
    m.setAttribute(attr, key)
    document.head.appendChild(m)
  }
  m.setAttribute('content', content)
}
function upsertCanonical(href: string) {
  let l = q<HTMLLinkElement>('link[rel="canonical"]')
  if (!l) {
    l = document.createElement('link')
    l.rel = 'canonical'
    document.head.appendChild(l)
  }
  l.href = href
}

// Valores originais (estáticos do index.html), para restaurar ao sair do produto.
const DEFAULTS = {
  title: document.title,
  description: q<HTMLMetaElement>('meta[name="description"]')?.content ?? '',
  ogType: q<HTMLMetaElement>('meta[property="og:type"]')?.content ?? 'website',
  ogTitle: q<HTMLMetaElement>('meta[property="og:title"]')?.content ?? '',
  ogDescription: q<HTMLMetaElement>('meta[property="og:description"]')?.content ?? '',
  ogUrl: q<HTMLMetaElement>('meta[property="og:url"]')?.content ?? `${SITE_URL}/`,
  ogImage: q<HTMLMetaElement>('meta[property="og:image"]')?.content ?? `${SITE_URL}/og-image.png`,
  twTitle: q<HTMLMetaElement>('meta[name="twitter:title"]')?.content ?? '',
  twDescription: q<HTMLMetaElement>('meta[name="twitter:description"]')?.content ?? '',
  twImage: q<HTMLMetaElement>('meta[name="twitter:image"]')?.content ?? `${SITE_URL}/og-image.png`,
  canonical: q<HTMLLinkElement>('link[rel="canonical"]')?.href ?? `${SITE_URL}/`,
}

const LD_ID = 'ld-product'

function shortDesc(p: Product): string {
  const d = (p.description || '').replace(/\s+/g, ' ').trim()
  if (!d) return `${p.name} — produto oficial da Martinica, com entrega para todo o Brasil.`
  return d.length > 160 ? `${d.slice(0, 157)}…` : d
}
function absImage(p: Product): string {
  const img = p.image || (p.images && p.images[0]) || `${SITE_URL}/og-image.png`
  return /^https?:/i.test(img) ? img : SITE_URL + (img.startsWith('/') ? img : `/${img}`)
}

/** Aplica o SEO da página de um produto (título, metas, OG e JSON-LD). */
export function setProductSeo(p: Product) {
  const url = productUrl(p.id)
  const image = absImage(p)
  const title = `${p.name} | Martinica Store`
  const desc = shortDesc(p)

  document.title = title
  upsertMeta('name', 'description', desc)
  upsertCanonical(url)
  upsertMeta('property', 'og:type', 'product')
  upsertMeta('property', 'og:title', title)
  upsertMeta('property', 'og:description', desc)
  upsertMeta('property', 'og:url', url)
  upsertMeta('property', 'og:image', image)
  upsertMeta('name', 'twitter:title', title)
  upsertMeta('name', 'twitter:description', desc)
  upsertMeta('name', 'twitter:image', image)

  const inStock = p.stock == null || p.stock > 0
  const ld: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.name,
    description: desc,
    image: [image],
    sku: p.id,
    brand: { '@type': 'Brand', name: 'Martinica' },
    offers: {
      '@type': 'Offer',
      url,
      priceCurrency: 'BRL',
      price: Number(p.price).toFixed(2),
      availability: inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      itemCondition: 'https://schema.org/NewCondition',
      seller: { '@type': 'Organization', name: 'Martinica Store' },
    },
  }
  if (p.reviews > 0) {
    ld.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: Number(p.rating).toFixed(1),
      reviewCount: p.reviews,
    }
  }

  let s = document.getElementById(LD_ID) as HTMLScriptElement | null
  if (!s) {
    s = document.createElement('script')
    s.type = 'application/ld+json'
    s.id = LD_ID
    document.head.appendChild(s)
  }
  s.textContent = JSON.stringify(ld)
}

/** Restaura o SEO padrão (home) e remove o JSON-LD de produto. */
export function clearProductSeo() {
  document.title = DEFAULTS.title
  upsertMeta('name', 'description', DEFAULTS.description)
  upsertCanonical(DEFAULTS.canonical)
  upsertMeta('property', 'og:type', DEFAULTS.ogType)
  upsertMeta('property', 'og:title', DEFAULTS.ogTitle)
  upsertMeta('property', 'og:description', DEFAULTS.ogDescription)
  upsertMeta('property', 'og:url', DEFAULTS.ogUrl)
  upsertMeta('property', 'og:image', DEFAULTS.ogImage)
  upsertMeta('name', 'twitter:title', DEFAULTS.twTitle)
  upsertMeta('name', 'twitter:description', DEFAULTS.twDescription)
  upsertMeta('name', 'twitter:image', DEFAULTS.twImage)
  document.getElementById(LD_ID)?.remove()
}
