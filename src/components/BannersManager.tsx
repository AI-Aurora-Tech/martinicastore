import { useEffect, useState } from 'react'
import { useCatalog } from '../context/CatalogContext'
import { deleteBanner, loadBanners, newBannerId, saveBanner } from '../services/banners'
import type { Banner, Category, Product } from '../types'

const ALLOWED = ['image/jpeg', 'image/png']
const MAX_BYTES = 3 * 1024 * 1024

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.onerror = () => reject(r.error)
    r.readAsDataURL(file)
  })
}

/** Edição do banner principal da loja (um ou vários — vira carrossel). */
export function BannersManager() {
  const { categories, products } = useCatalog()
  const [banners, setBanners] = useState<Banner[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function reload() {
    setLoading(true)
    setBanners(await loadBanners(false)) // inclui inativos no painel
    setLoading(false)
  }
  useEffect(() => {
    reload()
  }, [])

  async function addFromFile(file: File) {
    if (!ALLOWED.includes(file.type)) return setError('Envie um arquivo JPG ou PNG.')
    if (file.size > MAX_BYTES) return setError('Imagem muito grande (máximo 3 MB).')
    setBusy(true)
    setError(null)
    const dataUrl = await readAsDataUrl(file).catch(() => null)
    if (!dataUrl) {
      setBusy(false)
      return setError('Não foi possível ler a imagem.')
    }
    const banner: Banner = {
      id: newBannerId(),
      imageUrl: '',
      active: true,
      sort: banners.length,
    }
    // A imagem sobe pelo servidor (Edge Function), junto com a criação do banner.
    const { error: sErr, banner: saved } = await saveBanner(banner, dataUrl)
    setBusy(false)
    if (sErr) return setError(sErr)
    if (saved) setBanners((b) => [...b, saved])
  }

  async function patch(b: Banner, changes: Partial<Banner>) {
    const next = { ...b, ...changes }
    setBanners((list) => list.map((x) => (x.id === b.id ? next : x)))
    const { error: err } = await saveBanner(next)
    if (err) setError(err)
  }

  async function move(b: Banner, dir: -1 | 1) {
    const ordered = [...banners]
    const i = ordered.findIndex((x) => x.id === b.id)
    const j = i + dir
    if (j < 0 || j >= ordered.length) return
    ;[ordered[i], ordered[j]] = [ordered[j], ordered[i]]
    setBusy(true)
    for (let k = 0; k < ordered.length; k++) {
      ordered[k] = { ...ordered[k], sort: k }
      await saveBanner(ordered[k])
    }
    setBanners(ordered)
    setBusy(false)
  }

  async function remove(b: Banner) {
    if (!confirm('Excluir este banner?')) return
    setBusy(true)
    const { error: err } = await deleteBanner(b.id)
    setBusy(false)
    if (err) return setError(err)
    setBanners((list) => list.filter((x) => x.id !== b.id))
  }

  return (
    <section className="banners-admin">
      <div className="cats__head">
        <h3>Banner principal da loja</h3>
        <p>
          Envie uma ou mais imagens. Com mais de uma, a loja exibe em{' '}
          <strong>carrossel</strong> automático.
        </p>
        <div className="banners-admin__hint">
          📐 <strong>A imagem aparece INTEIRA</strong> (sem cortes) em qualquer
          tela — a altura se ajusta à proporção da arte. Para ficar bonito no
          computador <em>e</em> no celular, use uma imagem em{' '}
          <strong>paisagem</strong> (recomendado 1600 × 600 px, proporção ~8:3);
          imagens muito “quadradas” ficam altas no celular. JPG ou PNG de até 3 MB.
        </div>
      </div>

      {error && (
        <div className="admin__banner admin__banner--error">
          ⚠️ {error} <button onClick={() => setError(null)}>fechar</button>
        </div>
      )}

      <label className="banners-admin__upload">
        <input
          type="file"
          accept="image/jpeg,image/png"
          disabled={busy}
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) addFromFile(f)
            e.target.value = ''
          }}
        />
        <span className="btn btn--primary">{busy ? 'Enviando…' : '+ Adicionar banner'}</span>
      </label>

      {loading ? (
        <p className="cats__empty">Carregando…</p>
      ) : banners.length === 0 ? (
        <p className="cats__empty">
          Nenhum banner cadastrado — a loja mostra o destaque padrão. Adicione um
          acima.
        </p>
      ) : (
        <ul className="banners-admin__list">
          {banners.map((b, i) => (
            <li key={b.id} className="banners-admin__item">
              <img className="banners-admin__thumb" src={b.imageUrl} alt="" />
              <div className="banners-admin__fields">
                <label>
                  <span>Título (opcional)</span>
                  <input
                    value={b.headline ?? ''}
                    placeholder="Ex.: Coleção 2026"
                    onChange={(e) => setBanners((l) => l.map((x) => (x.id === b.id ? { ...x, headline: e.target.value } : x)))}
                    onBlur={(e) => patch(b, { headline: e.target.value })}
                  />
                </label>
                <label>
                  <span>Subtítulo (opcional)</span>
                  <input
                    value={b.subtext ?? ''}
                    placeholder="Ex.: Já disponível na loja"
                    onChange={(e) => setBanners((l) => l.map((x) => (x.id === b.id ? { ...x, subtext: e.target.value } : x)))}
                    onBlur={(e) => patch(b, { subtext: e.target.value })}
                  />
                </label>
                <div className="banners-admin__row2">
                  <label>
                    <span>Botão (opcional)</span>
                    <input
                      value={b.ctaLabel ?? ''}
                      placeholder="Ex.: Comprar agora"
                      onChange={(e) => setBanners((l) => l.map((x) => (x.id === b.id ? { ...x, ctaLabel: e.target.value } : x)))}
                      onBlur={(e) => patch(b, { ctaLabel: e.target.value })}
                    />
                  </label>
                  <LinkPicker
                    value={b.link ?? ''}
                    categories={categories}
                    products={products}
                    onCommit={(link) => patch(b, { link })}
                  />
                </div>
              </div>
              <div className="banners-admin__actions">
                <label className="banners-admin__active">
                  <input
                    type="checkbox"
                    checked={b.active !== false}
                    onChange={(e) => patch(b, { active: e.target.checked })}
                  />
                  Ativo
                </label>
                <div className="cats__order">
                  <button onClick={() => move(b, -1)} disabled={busy || i === 0} aria-label="Subir">▲</button>
                  <button onClick={() => move(b, 1)} disabled={busy || i === banners.length - 1} aria-label="Descer">▼</button>
                </div>
                <button className="cats__del" onClick={() => remove(b)} disabled={busy} aria-label="Excluir">🗑</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/** Campo "Link ao clicar": Nenhum, Toda a loja, Categoria ou Produto. */
function LinkPicker({
  value,
  categories,
  products,
  onCommit,
}: {
  value: string
  categories: Category[]
  products: Product[]
  onCommit: (link: string) => void
}) {
  return (
    <label>
      <span>Link ao clicar</span>
      <select value={value} onChange={(e) => onCommit(e.target.value)}>
        <option value="">— Nenhum —</option>
        <option value="todos">Toda a loja</option>
        <optgroup label="Categorias">
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.label}</option>
          ))}
        </optgroup>
        <optgroup label="Produtos">
          {products.map((p) => (
            <option key={p.id} value={`produto:${p.id}`}>{p.name}</option>
          ))}
        </optgroup>
      </select>
    </label>
  )
}
