// Exporta conteúdo para PDF usando a impressão do navegador (Salvar como PDF).
// Sem dependências: monta um documento HTML formatado num iframe oculto e chama
// print(). Funciona offline e em qualquer navegador.

type Align = 'l' | 'r' | 'c'

function esc(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Monta uma tabela HTML. `aligns` alinha cada coluna ('l'|'r'|'c'). */
export function pdfTable(columns: string[], rows: (string | number)[][], aligns: Align[] = []): string {
  const th = columns.map((c, i) => `<th class="a-${aligns[i] || 'l'}">${esc(c)}</th>`).join('')
  const body = rows.length
    ? rows
        .map(
          (r) =>
            `<tr>${r.map((cell, i) => `<td class="a-${aligns[i] || 'l'}">${esc(cell)}</td>`).join('')}</tr>`,
        )
        .join('')
    : `<tr><td class="a-c empty" colspan="${columns.length}">Nenhum registro.</td></tr>`
  return `<table><thead><tr>${th}</tr></thead><tbody>${body}</tbody></table>`
}

/** Cartões de indicadores (label + valor). */
export function pdfKpis(items: { label: string; value: string }[]): string {
  return (
    '<div class="kpis">' +
    items.map((k) => `<div class="kpi"><span>${esc(k.label)}</span><strong>${esc(k.value)}</strong></div>`).join('') +
    '</div>'
  )
}

/** Um bloco com título opcional. */
export function pdfSection(heading: string | undefined, html: string): string {
  return `${heading ? `<h2>${esc(heading)}</h2>` : ''}${html}`
}

const CSS = `
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body { font: 12px/1.45 -apple-system, "Segoe UI", Roboto, Arial, sans-serif; color: #14110f; }
  .head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px;
          border-bottom: 3px solid #e11d2a; padding-bottom: 10px; margin-bottom: 16px; }
  .head h1 { margin: 0; font-size: 20px; color: #e11d2a; letter-spacing: 0.5px; }
  .head p { margin: 2px 0 0; font-size: 13px; font-weight: 600; }
  .head .meta { font-size: 11px; color: #666; text-align: right; white-space: nowrap; }
  h2 { font-size: 14px; margin: 18px 0 8px; padding-bottom: 4px; border-bottom: 1px solid #ddd; }
  table { width: 100%; border-collapse: collapse; margin: 6px 0 12px; }
  th, td { padding: 6px 8px; border-bottom: 1px solid #e6e6e6; text-align: left; vertical-align: top; }
  th { background: #f5f5f5; font-size: 11px; text-transform: uppercase; letter-spacing: 0.03em; color: #444; }
  td.empty { color: #999; padding: 14px; }
  .a-r { text-align: right; font-variant-numeric: tabular-nums; }
  .a-c { text-align: center; }
  tbody tr:nth-child(even) td { background: #fafafa; }
  .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin: 4px 0 12px; }
  .kpi { border: 1px solid #e0e0e0; border-radius: 6px; padding: 8px 10px; }
  .kpi span { display: block; font-size: 10px; color: #666; text-transform: uppercase; letter-spacing: 0.03em; }
  .kpi strong { font-size: 15px; }
  .foot { margin-top: 20px; font-size: 10px; color: #999; text-align: center; border-top: 1px solid #eee; padding-top: 8px; }
  @page { margin: 14mm 12mm; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
`

/** Abre o documento formatado e dispara a impressão (Salvar como PDF). */
export function printReport(title: string, bodyHtml: string, subtitle?: string): void {
  const when = new Date().toLocaleString('pt-BR')
  const doc =
    `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">` +
    `<title>${esc(title)}</title><style>${CSS}</style></head><body>` +
    `<header class="head"><div><h1>Martinica Store</h1>` +
    `<p>${esc(title)}${subtitle ? ` — ${esc(subtitle)}` : ''}</p></div>` +
    `<div class="meta">Emitido em<br>${esc(when)}</div></header>` +
    bodyHtml +
    `<div class="foot">Grêmio Recreativo Martinica — documento gerado pelo painel de gestão</div>` +
    `</body></html>`

  const iframe = document.createElement('iframe')
  iframe.setAttribute('aria-hidden', 'true')
  Object.assign(iframe.style, {
    position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0',
  })
  document.body.appendChild(iframe)

  const cleanup = () => { if (document.body.contains(iframe)) iframe.remove() }
  const w = iframe.contentWindow
  if (!w) { cleanup(); return }

  const run = () => {
    try {
      w.focus()
      w.onafterprint = cleanup
      w.print()
    } catch {
      cleanup()
      return
    }
    // fallback de limpeza caso afterprint não dispare
    setTimeout(cleanup, 60000)
  }

  w.document.open()
  w.document.write(doc)
  w.document.close()
  // dá tempo de renderizar antes de imprimir
  if (w.document.readyState === 'complete') setTimeout(run, 250)
  else iframe.onload = () => setTimeout(run, 250)
}
