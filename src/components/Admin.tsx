import { useEffect, useMemo, useRef, useState } from 'react'
import { BRL, CLUB } from '../data/products'
import type { Category, CategoryId, Product, ProductKind, Supplier } from '../types'
import { listSuppliers } from '../services/suppliers'
import { createPurchase, notifyPurchase } from '../services/purchase'
import { saveCategory, slugify } from '../services/categories'
import { SuppliersModal } from './SuppliersModal'
import { useCatalog } from '../context/CatalogContext'
import { deleteProduct, saveProduct, setStock, uploadProductImage } from '../services/admin'
import { cleanVariants, hasVariants } from '../services/variants'
import type { Operator } from '../services/auth'
import { Reports } from './Reports'
import { Orders } from './Orders'
import { Purchases } from './Purchases'
import { Despesas } from './Despesas'
import { BannersManager } from './BannersManager'
import { SponsorsManager } from './SponsorsManager'
import { CategoriesManager } from './CategoriesManager'
import { pdfKpis, pdfSection, pdfTable, printReport } from '../services/exportPdf'
import { isSupabaseConfigured } from '../lib/supabase'

interface Props {
  operator: Operator
  onExit: () => void
  onLogout: () => Promise<void>
}

const LOW_STOCK = 5

const KINDS: ProductKind[] = [
  'jersey', 'jacket', 'shorts', 'cap', 'ball', 'scarf', 'mug', 'backpack', 'shoe', 'pet',
]

export function Admin({ operator, onExit, onLogout }: Props) {
  const { products, categories, source, error: catalogError, upsertLocal, upsertCategoryLocal, removeLocal } = useCatalog()

  /** Cria uma categoria a partir do rótulo (usada direto no cadastro do produto). */
  async function createCategory(label: string): Promise<{ id: string | null; error: string | null }> {
    const clean = label.trim()
    if (!clean) return { id: null, error: 'Informe o nome da categoria.' }
    const id = slugify(clean) || `cat-${Date.now().toString(36)}`
    if (categories.some((c) => c.id === id)) return { id: null, error: 'Já existe uma categoria com esse nome.' }
    const cat: Category = { id, label: clean, sort: categories.length }
    const { error: err } = await saveCategory(cat, categories)
    if (err) return { id: null, error: err }
    upsertCategoryLocal(cat)
    return { id, error: null }
  }
  const [tab, setTab] = useState<
    'estoque' | 'categorias' | 'banners' | 'patrocinadores' | 'compras' | 'despesas' | 'pedidos' | 'relatorios'
  >('estoque')
  const [query, setQuery] = useState('')
  const [cat, setCat] = useState<CategoryId | 'todos'>('todos')
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [flashMsg, setFlashMsg] = useState<string | null>(null)
  /** Produtos marcados (por id) para montar um pedido de compra rápido. */
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [orderingPurchase, setOrderingPurchase] = useState(false)

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  function flash(msg: string) {
    setFlashMsg(msg)
    if (flashTimer.current) clearTimeout(flashTimer.current)
    flashTimer.current = setTimeout(() => setFlashMsg(null), 3500)
  }

  const list = useMemo(() => {
    const q = query.trim().toLowerCase()
    return [...products]
      .filter((p) => (cat === 'todos' || p.category === cat) &&
        (q === '' || p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q)))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [products, query, cat])

  const stats = useMemo(() => {
    const units = products.reduce((s, p) => s + (p.stock ?? 0), 0)
    const out = products.filter((p) => (p.stock ?? 0) === 0).length
    const low = products.filter((p) => (p.stock ?? 0) > 0 && (p.stock ?? 0) <= LOW_STOCK).length
    return { total: products.length, units, out, low }
  }, [products])

  function exportProductsPdf() {
    const rows = list.map((p) => {
      const price = p.price ?? 0
      const cost = p.cost ?? 0
      const margin = price > 0 ? `${(((price - cost) / price) * 100).toFixed(1)}%` : '—'
      const variacoes = hasVariants(p)
        ? (p.variants ?? []).map((v) => `${v.label}: ${v.stock}`).join('; ')
        : '—'
      return [
        p.name,
        p.id,
        categories.find((c) => c.id === p.category)?.label ?? p.category,
        BRL.format(cost),
        BRL.format(price),
        margin,
        String(p.stock ?? 0),
        variacoes,
        p.active === false ? 'Não' : 'Sim',
      ]
    })
    const body =
      pdfSection(undefined, pdfKpis([
        { label: 'Produtos', value: String(stats.total) },
        { label: 'Unidades em estoque', value: String(stats.units) },
        { label: `Estoque baixo (≤ ${LOW_STOCK})`, value: String(stats.low) },
        { label: 'Esgotados', value: String(stats.out) },
      ])) +
      pdfTable(
        ['Produto', 'Código', 'Categoria', 'Custo', 'Preço', 'Margem', 'Estoque', 'Variações', 'Ativo'],
        rows,
        ['l', 'l', 'l', 'r', 'r', 'r', 'r', 'l', 'c'],
      )
    const sub = cat === 'todos' ? 'Todas as categorias' : (categories.find((c) => c.id === cat)?.label ?? String(cat))
    printReport('Produtos e estoque', body, sub)
  }

  async function persist(next: Product, okMsg = 'Produto salvo.') {
    upsertLocal(next)
    const { error: err } = await saveProduct(next)
    if (err) setError(err)
    else flash(okMsg)
  }

  async function changeStock(p: Product, value: number) {
    const stock = Math.max(0, Math.round(value))
    if (stock === (p.stock ?? 0)) return
    if (!confirm(`Alterar o estoque de "${p.name}" de ${p.stock ?? 0} para ${stock}?`)) return
    upsertLocal({ ...p, stock })
    const { error: err } = await setStock(p.id, stock)
    if (err) setError(err)
    else flash(`Estoque de "${p.name}" atualizado (${stock}).`)
  }

  /** Salva um campo do produto com confirmação. */
  async function confirmField(p: Product, changes: Partial<Product>, question: string, okMsg: string) {
    if (!confirm(question)) return
    await persist({ ...p, ...changes }, okMsg)
  }

  async function remove(p: Product) {
    if (!confirm(`Excluir "${p.name}"? Esta ação não pode ser desfeita.`)) return
    removeLocal(p.id)
    const { error: err } = await deleteProduct(p.id)
    if (err) setError(err)
    else flash(`Produto "${p.name}" excluído.`)
  }

  async function changeImage(p: Product, file: File) {
    if (!confirm(`Trocar a imagem de "${p.name}"?`)) return
    const { url, error: err } = await uploadProductImage(file)
    if (err || !url) {
      setError(err ?? 'Falha ao enviar a imagem.')
      return
    }
    await persist({ ...p, image: url }, 'Imagem atualizada.')
  }

  return (
    <div className="admin">
      <header className="pdv__top">
        <div className="pdv__brand">
          <span className="brand__mark" aria-hidden="true">M</span>
          <div>
            <strong>MARTINICA · ADMIN</strong>
            <small>Estoque &amp; Produtos</small>
          </div>
        </div>
        <div className="pdv__operator" title="Operador conectado">
          <span aria-hidden="true">👤</span>
          <div>
            <small>Operador</small>
            <strong>{operator.name}</strong>
          </div>
        </div>
        <button className="pdv__exit" onClick={onExit} style={{ marginLeft: 'auto' }}>
          ← Voltar à loja
        </button>
        <button className="pdv__logout" onClick={onLogout}>⎋ Sair</button>
      </header>

      <div className="admin__body">
        <nav className="admin__tabs">
          <button
            className={`admin__tab ${tab === 'estoque' ? 'admin__tab--active' : ''}`}
            onClick={() => setTab('estoque')}
          >
            📦 Estoque &amp; Produtos
          </button>
          <button
            className={`admin__tab ${tab === 'categorias' ? 'admin__tab--active' : ''}`}
            onClick={() => setTab('categorias')}
          >
            🏷️ Categorias
          </button>
          <button
            className={`admin__tab ${tab === 'banners' ? 'admin__tab--active' : ''}`}
            onClick={() => setTab('banners')}
          >
            🖼️ Banners
          </button>
          <button
            className={`admin__tab ${tab === 'patrocinadores' ? 'admin__tab--active' : ''}`}
            onClick={() => setTab('patrocinadores')}
          >
            🤝 Patrocinadores
          </button>
          <button
            className={`admin__tab ${tab === 'compras' ? 'admin__tab--active' : ''}`}
            onClick={() => setTab('compras')}
          >
            🛒 Compras
          </button>
          <button
            className={`admin__tab ${tab === 'despesas' ? 'admin__tab--active' : ''}`}
            onClick={() => setTab('despesas')}
          >
            💸 Despesas
          </button>
          <button
            className={`admin__tab ${tab === 'pedidos' ? 'admin__tab--active' : ''}`}
            onClick={() => setTab('pedidos')}
          >
            🧾 Pedidos
          </button>
          <button
            className={`admin__tab ${tab === 'relatorios' ? 'admin__tab--active' : ''}`}
            onClick={() => setTab('relatorios')}
          >
            📊 Relatórios
          </button>
        </nav>

        {source === 'supabase' && (
          <div className="admin__banner admin__banner--ok">
            ✅ <strong>Conectado ao Supabase</strong> — os produtos e vendas são
            os dados reais do seu banco.
            {products.length === 0 && (
              <> Catálogo vazio: use <strong>+ Novo produto</strong> para começar
              a cadastrar.</>
            )}
          </div>
        )}
        {source === 'supabase' && catalogError && (
          <div className="admin__banner admin__banner--error">
            ⚠️ <strong>Estoque por variação indisponível</strong> — {catalogError}
          </div>
        )}
        {source === 'demo' && isSupabaseConfigured && (
          <div className="admin__banner admin__banner--error">
            ⚠️ <strong>Supabase configurado, mas a leitura falhou</strong> — exibindo
            dados locais. Verifique se você rodou a migração
            (<code>0001_init.sql</code>) e as policies de RLS.
            {catalogError && <> Detalhe: {catalogError}</>}
          </div>
        )}
        {source === 'demo' && !isSupabaseConfigured && (
          <div className="admin__banner">
            ⚠️ <strong>Modo demo</strong> — alterações e vendas valem só nesta
            sessão (guardadas no navegador). Configure o Supabase (veja o README)
            para persistir de verdade.
          </div>
        )}
        {error && (
          <div className="admin__banner admin__banner--error">
            ⚠️ {error} <button onClick={() => setError(null)}>fechar</button>
          </div>
        )}

        {tab === 'categorias' && <CategoriesManager onFlash={flash} />}
        {tab === 'banners' && <BannersManager onFlash={flash} />}
        {tab === 'patrocinadores' && <SponsorsManager onFlash={flash} />}
        {tab === 'compras' && <Purchases operatorEmail={operator.email} />}
        {tab === 'despesas' && <Despesas operatorEmail={operator.email} />}
        {tab === 'pedidos' && <Orders />}
        {tab === 'relatorios' && <Reports />}

        <div style={{ display: tab === 'estoque' ? 'contents' : 'none' }}>
        <section className="admin__stats">
          <div className="admin__stat">
            <strong>{stats.total}</strong><span>produtos</span>
          </div>
          <div className="admin__stat">
            <strong>{stats.units}</strong><span>unidades em estoque</span>
          </div>
          <div className="admin__stat admin__stat--warn">
            <strong>{stats.low}</strong><span>estoque baixo (≤ {LOW_STOCK})</span>
          </div>
          <div className="admin__stat admin__stat--danger">
            <strong>{stats.out}</strong><span>esgotados</span>
          </div>
        </section>

        <div className="admin__toolbar">
          <input
            type="search"
            className="admin__search"
            placeholder="Buscar por nome ou código…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <select value={cat} onChange={(e) => setCat(e.target.value as CategoryId | 'todos')}>
            <option value="todos">Todas as categorias</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
          <button className="reports__refresh" onClick={exportProductsPdf} disabled={list.length === 0}>⤓ Exportar PDF</button>
          <button className="btn btn--primary admin__new" onClick={() => setCreating(true)}>
            + Novo produto
          </button>
        </div>

        <div className="admin__tablewrap">
          <table className="admin__table admin__table--cards">
            <thead>
              <tr>
                <th className="admin__col-sel">
                  <input
                    type="checkbox"
                    aria-label="Selecionar todos os produtos filtrados"
                    checked={list.length > 0 && list.every((p) => selected.has(p.id))}
                    ref={(el) => {
                      if (el) el.indeterminate = list.some((p) => selected.has(p.id)) && !list.every((p) => selected.has(p.id))
                    }}
                    onChange={(e) => {
                      const on = e.target.checked
                      setSelected((prev) => {
                        const next = new Set(prev)
                        for (const p of list) { if (on) next.add(p.id); else next.delete(p.id) }
                        return next
                      })
                    }}
                  />
                </th>
                <th>Produto</th>
                <th>Categoria</th>
                <th>Custo</th>
                <th>Preço</th>
                <th>Margem</th>
                <th className="admin__col-stock">Estoque</th>
                <th>Ativo</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {list.map((p) => (
                <AdminRow
                  key={p.id}
                  product={p}
                  selected={selected.has(p.id)}
                  onToggleSelect={() => toggleSelected(p.id)}
                  categoryLabel={categories.find((c) => c.id === p.category)?.label ?? p.category}
                  onChangeStock={(v) => changeStock(p, v)}
                  onSavePrice={(price) => confirmField(p, { price }, `Alterar o preço de "${p.name}" para ${BRL.format(price)}?`, 'Preço atualizado.')}
                  onSaveCost={(cost) => confirmField(p, { cost }, `Alterar o custo de "${p.name}" para ${BRL.format(cost)}?`, 'Custo atualizado.')}
                  onToggleActive={(active) => confirmField(p, { active }, `${active ? 'Ativar' : 'Desativar'} "${p.name}" na loja?`, active ? 'Produto ativado.' : 'Produto desativado.')}
                  onUploadImage={(file) => changeImage(p, file)}
                  onEdit={() => setEditing(p)}
                  onDelete={() => remove(p)}
                />
              ))}
              {list.length === 0 && (
                <tr>
                  <td colSpan={9} className="admin__empty">Nenhum produto encontrado.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {selected.size > 0 && (
          <div className="admin__selbar" role="region" aria-label="Produtos selecionados">
            <span className="admin__selbar-count">
              {selected.size} {selected.size === 1 ? 'produto selecionado' : 'produtos selecionados'}
            </span>
            <div className="admin__selbar-actions">
              <button className="btn btn--ghost" onClick={() => setSelected(new Set())}>Limpar</button>
              <button className="btn btn--primary" onClick={() => setOrderingPurchase(true)}>
                🛒 Pedir compra
              </button>
            </div>
          </div>
        )}
        </div>
      </div>

      {orderingPurchase && (
        <PurchaseFromStockModal
          products={products.filter((p) => selected.has(p.id))}
          operatorEmail={operator.email}
          onClose={() => setOrderingPurchase(false)}
          onDone={(msg) => {
            setOrderingPurchase(false)
            setSelected(new Set())
            flash(msg)
          }}
        />
      )}

      {creating && (
        <ProductModal
          categories={categories}
          existingIds={products.map((p) => p.id)}
          onCreateCategory={createCategory}
          onClose={() => setCreating(false)}
          onSave={async (p) => {
            if (!confirm(`Criar o produto "${p.name}"?`)) return
            await persist(p, 'Produto criado.')
            setCreating(false)
          }}
        />
      )}

      {editing && (
        <ProductModal
          categories={categories}
          existingIds={products.map((p) => p.id)}
          onCreateCategory={createCategory}
          product={editing}
          onClose={() => setEditing(null)}
          onSave={async (p) => {
            if (!confirm(`Salvar as alterações de "${p.name}"?`)) return
            await persist(p, 'Alterações salvas.')
            setEditing(null)
          }}
        />
      )}

      {flashMsg && (
        <div className="admin__flash" role="status" onClick={() => setFlashMsg(null)}>
          ✓ {flashMsg}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------

interface RowProps {
  product: Product
  selected: boolean
  onToggleSelect: () => void
  categoryLabel: string
  onChangeStock: (value: number) => void
  onSavePrice: (price: number) => void
  onSaveCost: (cost: number) => void
  onToggleActive: (active: boolean) => void
  onUploadImage: (file: File) => void
  onEdit: () => void
  onDelete: () => void
}

function AdminRow({
  product, selected, onToggleSelect, categoryLabel, onChangeStock, onSavePrice, onSaveCost, onToggleActive, onUploadImage, onEdit, onDelete,
}: RowProps) {
  const stock = product.stock ?? 0
  const cost = product.cost ?? 0
  const [priceInput, setPriceInput] = useState(String(product.price))
  const [costInput, setCostInput] = useState(String(cost))
  const [stockInput, setStockInput] = useState(String(stock))

  // Mantém os inputs em sincronia quando o produto muda por fora (ex.: +/−).
  useEffect(() => setStockInput(String(stock)), [stock])
  useEffect(() => setPriceInput(String(product.price)), [product.price])
  useEffect(() => setCostInput(String(cost)), [cost])

  const level =
    stock === 0 ? 'admin__stock--out' : stock <= LOW_STOCK ? 'admin__stock--low' : ''
  const margin = product.price > 0 ? (product.price - cost) / product.price : 0
  const marginClass = margin < 0.2 ? 'admin__margin--low' : margin >= 0.5 ? 'admin__margin--high' : ''

  function commitPrice() {
    const v = Number(priceInput.replace(',', '.'))
    if (!Number.isNaN(v) && v >= 0 && v !== product.price) onSavePrice(v)
    else setPriceInput(String(product.price))
  }

  function commitCost() {
    const v = Number(costInput.replace(',', '.'))
    if (!Number.isNaN(v) && v >= 0 && v !== cost) onSaveCost(v)
    else setCostInput(String(cost))
  }

  function commitStock() {
    const v = Math.max(0, Math.round(Number(stockInput) || 0))
    if (v !== stock) onChangeStock(v)
    setStockInput(String(v))
  }

  return (
    <tr className={`${product.active === false ? 'admin__row--inactive' : ''}${selected ? ' admin__row--selected' : ''}`}>
      <td className="admin__col-sel" data-label="Selecionar">
        <input
          type="checkbox"
          aria-label={`Selecionar ${product.name}`}
          checked={selected}
          onChange={onToggleSelect}
        />
      </td>
      <td className="admin__cell-prod" data-label="Produto">
        <div className="admin__prod">
          <label className="admin__thumb" title="Enviar/trocar imagem (JPG ou PNG)">
            {product.image ? (
              <img src={product.image} alt={product.name} />
            ) : (
              <span className="admin__dot" style={{ background: product.colors[0] }}>
                <span className="admin__thumb-cam" aria-hidden="true">📷</span>
              </span>
            )}
            <input
              type="file"
              accept="image/png,image/jpeg"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) onUploadImage(f)
                e.target.value = ''
              }}
            />
          </label>
          <div>
            <strong>{product.name}</strong>
            <small>{product.id}</small>
          </div>
        </div>
      </td>
      <td data-label="Categoria">{categoryLabel}</td>
      <td data-label="Custo">
        <div className="admin__price">
          <span>R$</span>
          <input
            inputMode="decimal"
            value={costInput}
            onChange={(e) => setCostInput(e.target.value)}
            onBlur={commitCost}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          />
        </div>
      </td>
      <td data-label="Preço">
        <div className="admin__price">
          <span>R$</span>
          <input
            inputMode="decimal"
            value={priceInput}
            onChange={(e) => setPriceInput(e.target.value)}
            onBlur={commitPrice}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          />
        </div>
      </td>
      <td data-label="Margem">
        <span className={`admin__margin ${marginClass}`}>
          {(margin * 100).toFixed(0)}%
        </span>
      </td>
      <td data-label="Estoque">
        {hasVariants(product) ? (
          <div className={`admin__stock ${level}`} title="Estoque por variação — edite em ✏️">
            <span className="admin__stock-variants">{stock} · por variação</span>
          </div>
        ) : (
          <div className={`admin__stock ${level}`}>
            <button onClick={() => onChangeStock(stock - 1)} aria-label="Diminuir estoque">−</button>
            <input
              inputMode="numeric"
              value={stockInput}
              onChange={(e) => setStockInput(e.target.value)}
              onBlur={commitStock}
              onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            />
            <button onClick={() => onChangeStock(stock + 1)} aria-label="Aumentar estoque">+</button>
          </div>
        )}
      </td>
      <td data-label="Ativo">
        <label className="admin__switch">
          <input
            type="checkbox"
            checked={product.active !== false}
            onChange={(e) => onToggleActive(e.target.checked)}
          />
          <span />
        </label>
      </td>
      <td className="admin__cell-actions" data-label="Ações">
        <div className="admin__rowactions">
          <button className="admin__edit" onClick={onEdit} aria-label={`Editar ${product.name}`} title="Editar informações do produto">
            ✏️
          </button>
          <button className="admin__del" onClick={onDelete} aria-label={`Excluir ${product.name}`}>
            🗑
          </button>
        </div>
      </td>
    </tr>
  )
}

// ---------------------------------------------------------------------------

interface PurchaseFromStockProps {
  products: Product[]
  operatorEmail?: string
  onClose: () => void
  onDone: (message: string) => void
}

/**
 * Pedido de compra rápido a partir dos produtos marcados no estoque. Só a
 * QUANTIDADE é ajustável — o custo unitário vem do cadastro do produto. Cria a
 * compra como pendente (conta a pagar); detalhes finos (pagamento, parcelas,
 * fornecedor) podem ser ajustados depois na aba Compras.
 */
interface PurchaseRow { key: string; product: Product; size?: string; label: string; stock: number; unitCost: number }

/** Traduz os motivos de falha que a Edge Function de WhatsApp devolve. */
const WA_MOTIVO: Record<string, string> = {
  demo: 'Modo demo: sem backend para enviar o WhatsApp. Configure o Supabase.',
  'sem-destino': 'O fornecedor não tem grupo nem WhatsApp cadastrado. Preencha em "Gerenciar fornecedores".',
  'sem-fornecedor': 'O pedido foi criado sem fornecedor, então não há para quem enviar.',
  'sem-grupo': 'O fornecedor não tem grupo de WhatsApp cadastrado.',
}

function PurchaseFromStockModal({ products, operatorEmail, onClose, onDone }: PurchaseFromStockProps) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [supplierId, setSupplierId] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /** Pedido já criado — habilita o envio pelo WhatsApp. */
  const [created, setCreated] = useState<
    { id: string | null; number: number | null; supplierName?: string; hasDestino: boolean; count: number; units: number } | null
  >(null)
  const [sendingWa, setSendingWa] = useState(false)
  const [waMsg, setWaMsg] = useState<string | null>(null)

  useEffect(() => { listSuppliers().then(setSuppliers).catch(() => {}) }, [])

  // Quando todos os produtos marcados são do mesmo fornecedor, já seleciona
  // esse fornecedor — assim o envio pelo WhatsApp fica disponível sem escolher
  // na mão (o número/grupo vem do cadastro do fornecedor).
  const sharedSupplierId = useMemo(() => {
    const ids = new Set(products.map((p) => p.supplierId).filter(Boolean) as string[])
    return ids.size === 1 ? [...ids][0] : ''
  }, [products])
  useEffect(() => {
    if (sharedSupplierId && suppliers.some((s) => s.id === sharedSupplierId)) {
      setSupplierId((cur) => cur || sharedSupplierId)
    }
  }, [suppliers, sharedSupplierId])

  const selSupplier = suppliers.find((s) => s.id === supplierId) ?? null
  const selDestino = selSupplier
    ? (selSupplier.whatsappGroup?.trim()
        ? 'grupo de WhatsApp'
        : selSupplier.phone?.trim()
          ? `WhatsApp ${selSupplier.phone}`
          : null)
    : null

  // Uma linha por VARIAÇÃO (ou uma única linha quando o produto não tem
  // variações). Cada linha carrega o estoque atual e a quantidade a pedir.
  const rows: PurchaseRow[] = useMemo(() => {
    const acc: PurchaseRow[] = []
    for (const p of products) {
      const unitCost = p.cost ?? 0
      if (hasVariants(p)) {
        for (const v of p.variants ?? []) {
          acc.push({ key: `${p.id}__${v.label}`, product: p, size: v.label, label: v.label, stock: v.stock ?? 0, unitCost })
        }
      } else {
        acc.push({ key: `${p.id}__`, product: p, label: 'sem variação', stock: p.stock ?? 0, unitCost })
      }
    }
    return acc
  }, [products])

  // Toda variação começa com 0 — o operador preenche a quantidade manualmente.
  const [qty, setQty] = useState<Record<string, number>>(
    () => Object.fromEntries(rows.map((r) => [r.key, 0])),
  )
  function setQtyFor(key: string, raw: number) {
    const v = Math.max(0, Math.round(raw || 0))
    setQty((prev) => ({ ...prev, [key]: v }))
  }

  const totalUn = rows.reduce((s, r) => s + (qty[r.key] ?? 0), 0)
  const totalCost = rows.reduce((s, r) => s + (qty[r.key] ?? 0) * r.unitCost, 0)
  const validRows = rows.filter((r) => (qty[r.key] ?? 0) > 0)

  async function confirm() {
    if (validRows.length === 0) { setError('Informe a quantidade a pedir em ao menos uma variação.'); return }
    setSaving(true)
    setError(null)
    const sup = suppliers.find((s) => s.id === supplierId) ?? null
    const { id, number, error: err } = await createPurchase({
      supplier: sup?.name,
      supplierId: sup?.id,
      supplierPhone: sup?.phone,
      operatorEmail,
      paid: false,
      items: validRows.map((r) => ({
        productId: r.product.id,
        name: r.product.name,
        quantity: qty[r.key] ?? 0,
        unitCost: r.unitCost,
        size: r.size,
      })),
    })
    setSaving(false)
    if (err) { setError(err); return }
    // Não fecha ainda: mostra o pedido criado e habilita o envio pelo WhatsApp.
    setCreated({
      id,
      number,
      supplierName: sup?.name,
      hasDestino: Boolean(sup?.whatsappGroup?.trim() || sup?.phone?.trim()),
      count: validRows.length,
      units: totalUn,
    })
  }

  async function sendWhatsApp() {
    if (!created) return
    setWaMsg(null)
    setError(null)
    setSendingWa(true)
    const { sent, reason } = await notifyPurchase(created.id)
    setSendingWa(false)
    const quem = created.supplierName ? `"${created.supplierName}"` : 'o fornecedor'
    if (sent) { setWaMsg(`Pedido enviado para ${quem} no WhatsApp.`); return }
    setError(WA_MOTIVO[reason ?? ''] ?? `Não consegui enviar o pedido: ${reason ?? 'motivo desconhecido'}.`)
  }

  function finish() {
    if (!created) return
    onDone(
      `Pedido de compra nº ${String(created.number ?? 0).padStart(6, '0')} criado com ${created.count} ${created.count === 1 ? 'item' : 'itens'} (${created.units} un.). Ajuste pagamento e recebimento na aba Compras.`,
    )
  }

  return (
    <div className="pdv__receipt-overlay" onClick={onClose}>
      <div className="admin__modal admin__modal--purchase" onClick={(e) => e.stopPropagation()}>
        <header className="admin__modal-head">
          <h3>Pedido de compra — {products.length} {products.length === 1 ? 'produto' : 'produtos'}</h3>
          <button className="admin__modal-close" onClick={onClose} aria-label="Fechar">✕</button>
        </header>

        {created ? (
          <>
            <div className="admin__purchase-body admin__purchase-done">
              <p className="admin__purchase-okmsg">
                ✓ Pedido de compra nº {String(created.number ?? 0).padStart(6, '0')} criado — {created.count} {created.count === 1 ? 'item' : 'itens'} ({created.units} un.).
              </p>
              <p className="admin__purchase-hint">
                {created.supplierName
                  ? (created.hasDestino
                      ? `Envie a lista do pedido para "${created.supplierName}" pelo WhatsApp.`
                      : `"${created.supplierName}" não tem grupo nem WhatsApp cadastrado — cadastre em "Gerenciar fornecedores" para poder enviar.`)
                  : 'Sem fornecedor no pedido: escolha um fornecedor com WhatsApp para poder enviar a lista.'}
              </p>
              {waMsg && <p className="admin__purchase-okmsg">✓ {waMsg}</p>}
            </div>

            {error && <p className="admin__modal-error">{error}</p>}

            <footer className="admin__purchase-foot">
              <div className="admin__purchase-btns">
                <button className="btn btn--ghost" onClick={finish} disabled={sendingWa}>Concluir</button>
                <button
                  className="btn btn--primary"
                  onClick={sendWhatsApp}
                  disabled={sendingWa || !created.hasDestino}
                  title={created.hasDestino
                    ? 'Envia o PDF do pedido pelo WhatsApp da loja, direto ao fornecedor'
                    : 'O fornecedor não tem grupo nem WhatsApp cadastrado'}
                >
                  {sendingWa ? 'Enviando…' : '📲 Enviar PDF pelo WhatsApp'}
                </button>
              </div>
            </footer>
          </>
        ) : (
          <>
            <div className="admin__purchase-body">
              <label className="admin__purchase-sup">
                <span>Fornecedor (necessário para enviar pelo WhatsApp)</span>
                <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
                  <option value="">— sem fornecedor —</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                {supplierId && (
                  <small className={`admin__purchase-sup-hint ${selDestino ? 'is-ok' : 'is-warn'}`}>
                    {selDestino
                      ? `📲 Envio pelo WhatsApp para ${selDestino}.`
                      : '⚠️ Este fornecedor não tem grupo nem WhatsApp cadastrado — cadastre em "Gerenciar fornecedores" para poder enviar.'}
                  </small>
                )}
              </label>

              <p className="admin__purchase-hint">Toda variação começa com 0 — preencha a quantidade a pedir de cada uma.</p>

              <div className="admin__purchase-groups">
                {products.map((p) => {
                  const prodRows = rows.filter((r) => r.product.id === p.id)
                  return (
                    <div key={p.id} className="admin__purchase-group">
                      <div className="admin__purchase-group-head">
                        <strong>{p.name}</strong>
                        <small>{p.id} · {BRL.format(p.cost ?? 0)}/un</small>
                      </div>
                      <table className="admin__purchase-table">
                        <thead>
                          <tr><th>Variação</th><th>Estoque atual</th><th>Pedir</th><th>Subtotal</th></tr>
                        </thead>
                        <tbody>
                          {prodRows.map((r) => {
                            const q = qty[r.key] ?? 0
                            return (
                              <tr key={r.key} className={q === 0 ? 'is-zero' : ''}>
                                <td data-label="Variação">{r.label}</td>
                                <td data-label="Estoque atual">{r.stock}</td>
                                <td data-label="Pedir">
                                  <div className="admin__qty">
                                    <button type="button" onClick={() => setQtyFor(r.key, q - 1)} aria-label="Diminuir">−</button>
                                    <input
                                      inputMode="numeric"
                                      value={q}
                                      onChange={(e) => setQtyFor(r.key, Number(e.target.value))}
                                    />
                                    <button type="button" onClick={() => setQtyFor(r.key, q + 1)} aria-label="Aumentar">+</button>
                                  </div>
                                </td>
                                <td data-label="Subtotal">{BRL.format(q * r.unitCost)}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )
                })}
              </div>
            </div>

            {error && <p className="admin__modal-error">{error}</p>}

            <footer className="admin__purchase-foot">
              <div className="admin__purchase-total">
                <span>{totalUn} un.</span>
                <strong>{BRL.format(totalCost)}</strong>
              </div>
              <div className="admin__purchase-btns">
                <button className="btn btn--ghost" onClick={onClose} disabled={saving}>Cancelar</button>
                <button className="btn btn--primary" onClick={confirm} disabled={saving || validRows.length === 0}>
                  {saving ? 'Criando…' : '🛒 Criar pedido de compra'}
                </button>
              </div>
            </footer>
          </>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------

interface ModalProps {
  categories: Category[]
  existingIds: string[]
  /** Cria uma categoria nova a partir do rótulo; devolve o id gerado. */
  onCreateCategory: (label: string) => Promise<{ id: string | null; error: string | null }>
  /** Quando presente, o modal edita um produto existente. */
  product?: Product
  onClose: () => void
  onSave: (p: Product) => void
}

/** Gera um id único a partir de uma base (slug do nome). */
function makeUniqueId(base: string, existing: string[]): string {
  const clean = base || 'produto'
  if (!existing.includes(clean)) return clean
  let n = 2
  while (existing.includes(`${clean}-${n}`)) n++
  return `${clean}-${n}`
}

function ProductModal({ categories, existingIds, onCreateCategory, product, onClose, onSave }: ModalProps) {
  const isEdit = !!product
  const [id] = useState(product?.id ?? '')
  const [name, setName] = useState(product?.name ?? '')
  const [category, setCategory] = useState(product?.category ?? categories[0]?.id ?? 'camisas')
  // Criação de categoria direto no cadastro.
  const [newCatMode, setNewCatMode] = useState(false)
  const [newCatLabel, setNewCatLabel] = useState('')
  const [catBusy, setCatBusy] = useState(false)

  async function createCat() {
    if (catBusy) return
    setCatBusy(true)
    setErr('')
    const { id: newId, error } = await onCreateCategory(newCatLabel)
    setCatBusy(false)
    if (error || !newId) { setErr(error ?? 'Falha ao criar categoria.'); return }
    setCategory(newId)
    setNewCatLabel('')
    setNewCatMode(false)
  }
  const [kind, setKind] = useState<ProductKind>(product?.kind ?? 'jersey')
  const [price, setPrice] = useState(product ? String(product.price) : '')
  const [oldPrice, setOldPrice] = useState(product?.oldPrice ? String(product.oldPrice) : '')
  const [costV, setCostV] = useState(product?.cost ? String(product.cost) : '')
  const [stock, setStock] = useState(String(product?.stock ?? 0))
  const [weight, setWeight] = useState(String(product?.weight ?? 300))
  const [badge, setBadge] = useState(product?.badge ?? '')
  const [sizes, setSizes] = useState((product?.sizes ?? []).join(', '))
  const [variants, setVariants] = useState<{ label: string; stock: string }[]>(
    (product?.variants ?? []).map((v) => ({ label: v.label, stock: String(v.stock) })),
  )
  const [description, setDescription] = useState(product?.description ?? '')
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [supplierId, setSupplierId] = useState(product?.supplierId ?? '')
  const [showSuppliers, setShowSuppliers] = useState(false)

  useEffect(() => { listSuppliers().then(setSuppliers).catch(() => {}) }, [])

  const variantsTotal = variants.reduce((s, v) => s + Math.max(0, Math.round(Number(v.stock) || 0)), 0)
  const usingVariants = variants.length > 0
  const previewId = isEdit ? id : (name.trim() ? makeUniqueId(slugify(name.trim()), existingIds) : '')

  function addVariant() {
    setVariants((vs) => [...vs, { label: '', stock: '0' }])
  }
  function updateVariant(i: number, field: 'label' | 'stock', value: string) {
    setVariants((vs) => vs.map((v, k) => (k === i ? { ...v, [field]: value } : v)))
  }
  function removeVariant(i: number) {
    setVariants((vs) => vs.filter((_, k) => k !== i))
  }
  const [images, setImages] = useState<string[]>(
    product?.images && product.images.length ? product.images : (product?.image ? [product.image] : []),
  )
  const [imgBusy, setImgBusy] = useState(false)
  const [err, setErr] = useState('')

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (files.length === 0) return
    setImgBusy(true)
    setErr('')
    for (const file of files) {
      const { url, error } = await uploadProductImage(file)
      if (error || !url) { setErr(error ?? 'Falha ao enviar a imagem.'); break }
      setImages((prev) => [...prev, url])
    }
    setImgBusy(false)
  }
  function removeImage(i: number) {
    setImages((prev) => prev.filter((_, k) => k !== i))
  }
  function makePrimary(i: number) {
    setImages((prev) => (i <= 0 ? prev : [prev[i], ...prev.filter((_, k) => k !== i)]))
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const priceNum = Number(price.replace(',', '.'))
    if (!name.trim()) return setErr('Informe o nome.')
    if (Number.isNaN(priceNum) || priceNum < 0) return setErr('Preço inválido.')
    // Novo produto: id gerado automaticamente a partir do nome (único).
    const cleanId = isEdit ? id : makeUniqueId(slugify(name.trim()), existingIds)

    const oldPriceNum = Number(oldPrice.replace(',', '.'))
    const sizeList = sizes.split(',').map((s) => s.trim()).filter(Boolean)
    const variantList = cleanVariants(variants.map((v) => ({ label: v.label, stock: Number(v.stock) })))
    // Com variações, o estoque total é a soma; senão, o campo Estoque.
    const totalStock = variantList.length
      ? variantList.reduce((s, v) => s + v.stock, 0)
      : Math.max(0, Math.round(Number(stock) || 0))

    onSave({
      // Preserva campos não editáveis aqui (rating/reviews) ao editar.
      ...(product ?? { rating: 5, reviews: 0 }),
      id: cleanId,
      name: name.trim(),
      category: category as CategoryId,
      kind,
      price: priceNum,
      oldPrice: oldPrice.trim() && !Number.isNaN(oldPriceNum) && oldPriceNum > 0 ? oldPriceNum : undefined,
      colors: product?.colors ?? [CLUB.primary, CLUB.dark],
      badge: badge.trim() || undefined,
      // Com variações, elas viram as opções (o campo Tamanhos é ignorado).
      sizes: variantList.length ? undefined : (sizeList.length ? sizeList : undefined),
      variants: variantList.length ? variantList : undefined,
      description: description.trim(),
      cost: Math.max(0, Number(costV.replace(',', '.')) || 0),
      stock: totalStock,
      weight: Math.max(1, Math.round(Number(weight) || 300)),
      active: product?.active ?? true,
      image: images[0],
      images: images.length ? images : undefined,
      supplierId: supplierId || undefined,
    })
  }

  return (
    <div className="pdv__receipt-overlay" onClick={onClose}>
      <form className="admin__modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h3>{isEdit ? 'Editar produto' : 'Novo produto'}</h3>
        <div className="admin__form-grid">
          <div className="admin__form-full admin__imgfield">
            <span className="admin__imgfield-label">Fotos do produto</span>
            <div className="admin__gallery">
              {images.map((src, i) => (
                <div key={i} className={`admin__gallery-item ${i === 0 ? 'is-primary' : ''}`}>
                  <img src={src} alt={`Foto ${i + 1}`} />
                  {i === 0 && <span className="admin__gallery-badge">Principal</span>}
                  <div className="admin__gallery-tools">
                    {i > 0 && (
                      <button type="button" title="Tornar principal" onClick={() => makePrimary(i)}>★</button>
                    )}
                    <button type="button" title="Remover" onClick={() => removeImage(i)}>✕</button>
                  </div>
                </div>
              ))}
              <label className={`admin__gallery-add ${imgBusy ? 'is-busy' : ''}`}>
                {imgBusy ? 'Enviando…' : (images.length ? '＋ Adicionar foto' : '＋ Escolher fotos')}
                <input type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={handleFile} hidden disabled={imgBusy} />
              </label>
            </div>
            <small className="admin__hint">JPG, PNG ou WEBP, até 3 MB cada. A 1ª foto é a principal (use ★ para promover outra). Sem foto, usa a ilustração.</small>
          </div>
          <label>Nome<input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do produto" /></label>
          <label>Código (id)
            <input value={previewId || '—'} disabled placeholder="gerado automaticamente" />
            {!isEdit && <small className="admin__hint">Gerado automaticamente a partir do nome.</small>}
          </label>
          <label className="admin__form-full">Categoria
            {newCatMode ? (
              <div className="admin__newcat">
                <input
                  value={newCatLabel}
                  onChange={(e) => setNewCatLabel(e.target.value)}
                  placeholder="Nome da nova categoria"
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); createCat() } }}
                  autoFocus
                />
                <button type="button" className="btn btn--primary" disabled={catBusy || !newCatLabel.trim()} onClick={createCat}>
                  {catBusy ? '…' : 'Criar'}
                </button>
                <button type="button" className="btn btn--ghost" onClick={() => { setNewCatMode(false); setNewCatLabel('') }}>
                  Cancelar
                </button>
              </div>
            ) : (
              <div className="admin__catfield">
                <select value={category} onChange={(e) => setCategory(e.target.value)}>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
                <button type="button" className="btn btn--ghost" onClick={() => setNewCatMode(true)}>+ Nova categoria</button>
              </div>
            )}
          </label>
          <label>Tipo (ilustração)
            <select value={kind} onChange={(e) => setKind(e.target.value as ProductKind)}>
              {KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
          </label>
          <label className="admin__form-full">
            Fornecedor (para compra)
            <div className="admin__supplierfield">
              <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
                <option value="">— sem fornecedor —</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}{s.phone ? ' (📱)' : ''}</option>
                ))}
              </select>
              <button type="button" className="btn btn--ghost" onClick={() => setShowSuppliers(true)}>
                + Cadastrar
              </button>
            </div>
            <small className="admin__hint">O fornecedor precisa estar cadastrado. Ele agiliza o pedido de compra deste produto.</small>
          </label>
          <label>Preço de venda (R$)<input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0,00" /></label>
          <label>Preço "de" (R$) — opcional<input inputMode="decimal" value={oldPrice} onChange={(e) => setOldPrice(e.target.value)} placeholder="0,00" /></label>
          <label>Preço de custo (R$)<input inputMode="decimal" value={costV} onChange={(e) => setCostV(e.target.value)} placeholder="0,00" /></label>
          <label>Estoque{usingVariants ? ' (soma das variações)' : ''}
            <input
              inputMode="numeric"
              value={usingVariants ? String(variantsTotal) : stock}
              onChange={(e) => setStock(e.target.value)}
              disabled={usingVariants}
              title={usingVariants ? 'Controlado pelas variações abaixo' : undefined}
            />
          </label>
          <label>Peso (g) — frete<input inputMode="numeric" value={weight} onChange={(e) => setWeight(e.target.value)} /></label>
          <label>Selo/etiqueta — opcional<input value={badge} onChange={(e) => setBadge(e.target.value)} placeholder="ex.: Lançamento" /></label>
          <label className="admin__form-full">
            Tamanhos (separados por vírgula){usingVariants ? ' — ignorado (usando variações)' : ''}
            <input value={sizes} onChange={(e) => setSizes(e.target.value)} placeholder="ex.: P, M, G, GG" disabled={usingVariants} />
          </label>

          <div className="admin__form-full admin__variants">
            <div className="admin__variants-head">
              <span>Variações com estoque individual (tamanho, cor, etc.)</span>
            </div>
            <p className="admin__variants-hint">
              Preencha para controlar o estoque por variação. Ao usar variações, o
              cliente escolhe uma delas e só compra se houver estoque naquela opção.
            </p>
            <button type="button" className="admin__variants-add" onClick={addVariant}>
              + Adicionar variação
            </button>
            {variants.length > 0 && (
              <div className="admin__variants-list">
                {variants.map((v, i) => (
                  <div key={i} className="admin__variant-row">
                    <input
                      placeholder="Variação (ex.: M / Azul)"
                      value={v.label}
                      onChange={(e) => updateVariant(i, 'label', e.target.value)}
                    />
                    <input
                      inputMode="numeric"
                      placeholder="Estoque"
                      value={v.stock}
                      onChange={(e) => updateVariant(i, 'stock', e.target.value)}
                    />
                    <button type="button" className="cats__del" onClick={() => removeVariant(i)} aria-label="Remover variação">🗑</button>
                  </div>
                ))}
                <div className="admin__variants-total">Total: <strong>{variantsTotal}</strong> unidades</div>
              </div>
            )}
          </div>

          <label className="admin__form-full">Descrição
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Descrição que aparece na página do produto" />
          </label>
        </div>
        {err && <p className="pdvlogin__error">⚠️ {err}</p>}
        <div className="admin__modal-actions">
          <button type="button" className="btn btn--ghost admin__cancel" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn btn--primary">{isEdit ? 'Salvar alterações' : 'Criar produto'}</button>
        </div>
      </form>
      {showSuppliers && (
        <SuppliersModal
          onClose={() => setShowSuppliers(false)}
          onChange={(list) => { setSuppliers(list); }}
        />
      )}
    </div>
  )
}
