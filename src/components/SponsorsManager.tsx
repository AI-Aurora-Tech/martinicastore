import { useEffect, useState } from 'react'
import { deleteSponsor, loadSponsors, newSponsorId, saveSponsor } from '../services/sponsors'
import type { Sponsor } from '../types'

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp']
const MAX_BYTES = 3 * 1024 * 1024

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.onerror = () => reject(r.error)
    r.readAsDataURL(file)
  })
}

export function SponsorsManager({ onFlash }: { onFlash?: (msg: string) => void }) {
  const [sponsors, setSponsors] = useState<Sponsor[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [edits, setEdits] = useState<Record<string, { name: string; link: string }>>({})

  async function reload() {
    setLoading(true)
    setSponsors(await loadSponsors(false)) // inclui inativos no painel
    setLoading(false)
  }
  useEffect(() => { reload() }, [])

  async function addFromFile(file: File) {
    if (!ALLOWED.includes(file.type)) return setError('Envie um arquivo JPG, PNG ou WEBP.')
    if (file.size > MAX_BYTES) return setError('Imagem muito grande (máximo 3 MB).')
    if (!confirm('Adicionar este patrocinador à loja?')) return
    setBusy(true); setError(null)
    const dataUrl = await readAsDataUrl(file).catch(() => null)
    if (!dataUrl) { setBusy(false); return setError('Não foi possível ler a imagem.') }
    const sponsor: Sponsor = { id: newSponsorId(), imageUrl: '', active: true, sort: sponsors.length }
    const { error: sErr, sponsor: saved } = await saveSponsor(sponsor, dataUrl)
    setBusy(false)
    if (sErr) return setError(sErr)
    if (saved) setSponsors((s) => [...s, saved])
    onFlash?.('Patrocinador adicionado.')
  }

  async function patch(s: Sponsor, changes: Partial<Sponsor>, confirmMsg?: string) {
    if (confirmMsg && !confirm(confirmMsg)) return
    setBusy(true); setError(null)
    const { error: sErr, sponsor: saved } = await saveSponsor({ ...s, ...changes })
    setBusy(false)
    if (sErr) return setError(sErr)
    if (saved) setSponsors((list) => list.map((x) => (x.id === s.id ? saved : x)))
    onFlash?.('Patrocinador atualizado.')
  }

  async function remove(s: Sponsor) {
    if (!confirm('Excluir este patrocinador? Esta ação não pode ser desfeita.')) return
    setBusy(true); setError(null)
    const { error: sErr } = await deleteSponsor(s.id)
    setBusy(false)
    if (sErr) return setError(sErr)
    setSponsors((list) => list.filter((x) => x.id !== s.id))
    onFlash?.('Patrocinador excluído.')
  }

  function editOf(s: Sponsor) {
    return edits[s.id] ?? { name: s.name ?? '', link: s.link ?? '' }
  }

  if (loading) return <div className="reports__loading">Carregando patrocinadores…</div>

  return (
    <div className="sponsors-admin">
      <div className="banners-admin__hint">
        <p>Adicione logos dos patrocinadores com o link para a página de cada um. Eles aparecem na seção <strong>“Nossos patrocinadores”</strong> da loja.</p>
      </div>

      {error && <p className="pdvlogin__error">⚠️ {error}</p>}

      <label className={`btn btn--primary sponsors-admin__add ${busy ? 'is-busy' : ''}`}>
        {busy ? 'Enviando…' : '＋ Adicionar patrocinador'}
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          hidden
          disabled={busy}
          onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) addFromFile(f) }}
        />
      </label>

      {sponsors.length === 0 ? (
        <p className="purch__empty">Nenhum patrocinador cadastrado ainda.</p>
      ) : (
        <ul className="sponsors-admin__list">
          {sponsors.map((s) => {
            const e = editOf(s)
            const dirty = e.name !== (s.name ?? '') || e.link !== (s.link ?? '')
            return (
              <li key={s.id} className={`sponsors-admin__item ${s.active === false ? 'is-off' : ''}`}>
                <div className="sponsors-admin__logo">
                  <img src={s.imageUrl} alt={s.name || 'Patrocinador'} />
                </div>
                <div className="sponsors-admin__fields">
                  <label className="checkout__field">
                    <span>Nome</span>
                    <input
                      value={e.name}
                      onChange={(ev) => setEdits((m) => ({ ...m, [s.id]: { ...e, name: ev.target.value } }))}
                      placeholder="Ex.: Loja do Zé"
                    />
                  </label>
                  <label className="checkout__field">
                    <span>Link (página do patrocinador)</span>
                    <input
                      value={e.link}
                      onChange={(ev) => setEdits((m) => ({ ...m, [s.id]: { ...e, link: ev.target.value } }))}
                      placeholder="https://…"
                    />
                  </label>
                </div>
                <div className="sponsors-admin__actions">
                  <button
                    className="btn btn--primary"
                    disabled={busy || !dirty}
                    onClick={() => patch(s, { name: e.name.trim() || undefined, link: e.link.trim() || undefined }, 'Salvar as alterações deste patrocinador?')}
                  >
                    Salvar
                  </button>
                  <button
                    className="btn btn--ghost"
                    disabled={busy}
                    onClick={() => patch(s, { active: !(s.active !== false) }, s.active !== false ? 'Ocultar este patrocinador da loja?' : 'Exibir este patrocinador na loja?')}
                  >
                    {s.active !== false ? 'Ocultar' : 'Exibir'}
                  </button>
                  <button className="btn btn--ghost sponsors-admin__del" disabled={busy} onClick={() => remove(s)}>
                    Excluir
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
