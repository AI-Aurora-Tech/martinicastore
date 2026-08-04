import { useEffect, useState } from 'react'
import type { Supplier } from '../types'
import { deleteSupplier, listSuppliers, saveSupplier } from '../services/suppliers'

interface Props {
  onClose: () => void
  onChange: (list: Supplier[]) => void
}

const EMPTY: Supplier = { id: '', name: '', phone: '', cnpj: '', email: '', contact: '' }

export function SuppliersModal({ onClose, onChange }: Props) {
  const [list, setList] = useState<Supplier[]>([])
  const [form, setForm] = useState<Supplier>(EMPTY)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  function reload() {
    listSuppliers()
      .then((l) => { setList(l); onChange(l) })
      .catch((e) => setError(e instanceof Error ? e.message : 'Falha ao carregar.'))
  }
  useEffect(() => reload(), [])

  function set<K extends keyof Supplier>(k: K, v: Supplier[K]) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    if (!form.name.trim()) return setError('Informe o nome do fornecedor.')
    setBusy(true)
    setError('')
    const { error: err } = await saveSupplier({ ...form, name: form.name.trim() })
    setBusy(false)
    if (err) return setError(err)
    setForm(EMPTY)
    reload()
  }

  async function remove(id: string) {
    if (!confirm('Excluir este fornecedor?')) return
    const { error: err } = await deleteSupplier(id)
    if (err) return setError(err)
    if (form.id === id) setForm(EMPTY)
    reload()
  }

  return (
    <div className="pdv__receipt-overlay" onClick={onClose}>
      <div className="sup-modal" onClick={(e) => e.stopPropagation()}>
        <div className="sup-modal__head">
          <h3>Fornecedores</h3>
          <button className="drawer__close" onClick={onClose} aria-label="Fechar">✕</button>
        </div>

        <div className="sup-modal__body">
          <ul className="sup-modal__list">
            {list.length === 0 && <li className="purch__empty">Nenhum fornecedor cadastrado.</li>}
            {list.map((s) => (
              <li key={s.id} className="sup-modal__item">
                <div>
                  <strong>{s.name}</strong>
                  <small>{[s.phone && `📱 ${s.phone}`, s.contact, s.cnpj].filter(Boolean).join(' · ') || '—'}</small>
                </div>
                <div className="sup-modal__actions">
                  <button onClick={() => setForm({ ...EMPTY, ...s })} title="Editar">✎</button>
                  <button onClick={() => remove(s.id)} title="Excluir">🗑</button>
                </div>
              </li>
            ))}
          </ul>

          <form className="sup-modal__form" onSubmit={save}>
            <h4>{form.id ? 'Editar fornecedor' : 'Novo fornecedor'}</h4>
            <label>Nome *<input value={form.name} onChange={(e) => set('name', e.target.value)} /></label>
            <label>WhatsApp<input value={form.phone ?? ''} onChange={(e) => set('phone', e.target.value)} placeholder="(11) 90000-0000" /></label>
            <label>Contato<input value={form.contact ?? ''} onChange={(e) => set('contact', e.target.value)} placeholder="Nome do vendedor" /></label>
            <label>CNPJ<input value={form.cnpj ?? ''} onChange={(e) => set('cnpj', e.target.value)} /></label>
            <label>E-mail<input value={form.email ?? ''} onChange={(e) => set('email', e.target.value)} /></label>
            {error && <p className="pdvlogin__error">⚠️ {error}</p>}
            <div className="sup-modal__form-actions">
              {form.id && <button type="button" className="checkout__link" onClick={() => setForm(EMPTY)}>cancelar edição</button>}
              <button type="submit" className="btn btn--primary" disabled={busy}>
                {busy ? 'Salvando…' : form.id ? 'Salvar' : 'Adicionar'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
