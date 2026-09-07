// Gera o public/sitemap.xml a partir das configurações da loja (npm run gen:sitemap).
//
// Fonte dos dados, na ordem:
//   1. Supabase (tabela public.products), quando VITE_SUPABASE_URL e
//      VITE_SUPABASE_ANON_KEY estão no ambiente ou no .env — é o catálogo real
//      da loja online, já com o que o admin ativou/desativou no painel;
//   2. src/data/products.ts (modo demo), quando o Supabase não está
//      configurado ou não responde.
//
// Só entram no sitemap as URLs que existem de fato como página: a home e os
// deep-links de produto (/produto/<id>, ver vercel.json + src/services/seo.ts).
// Categorias e páginas institucionais são estados da SPA, sem URL própria, e o
// backoffice (/gestao, /admin, /pdv) está bloqueado no robots.txt.

import { readFileSync } from 'node:fs'
import { products as seedProducts } from '../src/data/products.ts'
import { SITE_URL, productPath } from '../src/services/site.ts'

interface SitemapProduct {
  id: string
  /** Data da última alteração conhecida (YYYY-MM-DD). */
  lastmod: string
}

const TODAY = new Date().toISOString().slice(0, 10)

/** Lê uma variável do ambiente ou do .env local (não versionado). */
function env(key: string): string | undefined {
  if (process.env[key]) return process.env[key]
  try {
    const file = readFileSync(new URL('../.env', import.meta.url), 'utf8')
    const m = file.match(new RegExp(`^${key}\\s*=\\s*(.*)$`, 'm'))
    return m ? m[1].trim().replace(/^["']|["']$/g, '') : undefined
  } catch {
    return undefined
  }
}

function isoDate(v: unknown): string {
  const d = v ? new Date(String(v)) : null
  return d && !Number.isNaN(d.getTime()) ? d.toISOString().slice(0, 10) : TODAY
}

/** Catálogo publicado no Supabase (apenas produtos ativos). */
async function fromSupabase(): Promise<SitemapProduct[] | null> {
  const url = env('VITE_SUPABASE_URL')
  const key = env('VITE_SUPABASE_ANON_KEY')
  if (!url || !key) {
    console.error('[sitemap] Supabase não configurado — usando o catálogo local (modo demo).')
    return null
  }
  const endpoint =
    `${url.replace(/\/$/, '')}/rest/v1/products` +
    '?select=id,active,created_at&active=eq.true&order=sort.asc'
  try {
    const res = await fetch(endpoint, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const rows = (await res.json()) as { id: string; created_at?: string }[]
    if (!Array.isArray(rows) || rows.length === 0) throw new Error('catálogo vazio')
    console.error(`[sitemap] ${rows.length} produtos ativos lidos do Supabase.`)
    return rows.map((r) => ({ id: String(r.id), lastmod: isoDate(r.created_at) }))
  } catch (e) {
    console.error(`[sitemap] Falha ao ler o Supabase (${(e as Error).message}) — usando o catálogo local.`)
    return null
  }
}

/** Catálogo local (src/data/products.ts), o mesmo do modo demo da loja. */
function fromSeed(): SitemapProduct[] {
  return seedProducts
    .filter((p) => p.active !== false)
    .map((p) => ({ id: p.id, lastmod: TODAY }))
}

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function urlEntry(loc: string, lastmod: string, changefreq: string, priority: string): string {
  return [
    '  <url>',
    `    <loc>${xmlEscape(loc)}</loc>`,
    `    <lastmod>${lastmod}</lastmod>`,
    `    <changefreq>${changefreq}</changefreq>`,
    `    <priority>${priority}</priority>`,
    '  </url>',
  ].join('\n')
}

const items = (await fromSupabase()) ?? fromSeed()
const newest = items.reduce((max, p) => (p.lastmod > max ? p.lastmod : max), '0000-00-00')

const out = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<!-- Gerado por npm run gen:sitemap a partir do catálogo da loja. Não editar à mão. -->',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  urlEntry(`${SITE_URL}/`, newest > TODAY ? TODAY : newest, 'daily', '1.0'),
  ...items.map((p) => urlEntry(SITE_URL + productPath(p.id), p.lastmod, 'weekly', '0.8')),
  '</urlset>',
]

console.log(out.join('\n'))
