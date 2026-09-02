import { useEffect, useMemo, useState } from 'react'
import { CLUB } from '../data/products'
import type { CategoryId, Product, ProductKind } from '../types'
import { useCatalog } from '../context/CatalogContext'
import { deleteProduct, saveProduct, setStock, uploadProductImage } from '../services/admin'
import { cleanVariants, hasVariants } from '../services/variants'
import type { Operator } from '../services/auth'
import { Reports } from './Reports'
import { Orders } from './Orders'
import { Purchases } from './Purchases'
import { BannersManager } from './BannersManager'
import { CategoriesManager } from './CategoriesManager'
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
  const { products, categories, source, error: catalogError, upsertLocal, removeLocal } = useCatalog()
  const [tab, setTab] = useState<
    'estoque' | 'categorias' | 'banners' | 'compras' | 'pedidos' | 'relatorios'
  >('estoque')
  const [query, setQuery] = useState('')
  const [cat, setCat] = useState<CategoryId | 'todos'>('todos')
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [error, setError] = useState<string | null>(null)

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

  async function persist(next: Product) {
    upsertLocal(next)
    const { error: err } = await saveProduct(next)
    if (err) setError(err)
  }

  async function changeStock(p: Product, value: number) {
    const stock = Math.max(0, Math.round(value))
    upsertLocal({ ...p, stock })
    const { error: err } = await setStock(p.id, stock)
    if (err) setError(err)
  }

  async function remove(p: Product) {
    if (!confirm(`Excluir "${p.name}"? Esta ação não pode ser desfeita.`)) return
    removeLocal(p.id)
    const { error: err } = await deleteProduct(p.id)
    if (err) setError(err)
  }

  async function changeImage(p: Product, file: File) {
    const { url, error: err } = await uploadProductImage(file)
    if (err || !url) {
      setError(err ?? 'Falha ao enviar a imagem.')
      return
    }
    await persist({ ...p, image: url })
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
            className={`admin__tab ${tab === 'compras' ? 'admin__tab--active' : ''}`}
            onClick={() => setTab('compras')}
          >
            🛒 Compras
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

        {tab === 'categorias' && <CategoriesManager />}
        {tab === 'banners' && <BannersManager />}
        {tab === 'compras' && <Purchases operatorEmail={operator.email} />}
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
          <button className="btn btn--primary admin__new" onClick={() => setCreating(true)}>
            + Novo produto
          </button>
        </div>

        <div className="admin__tablewrap">
          <table className="admin__table">
            <thead>
              <tr>
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
                  categoryLabel={categories.find((c) => c.id === p.category)?.label ?? p.category}
                  onChangeStock={(v) => changeStock(p, v)}
                  onSavePrice={(price) => persist({ ...p, price })}
                  onSaveCost={(cost) => persist({ ...p, cost })}
                  onToggleActive={(active) => persist({ ...p, active })}
                  onUploadImage={(file) => changeImage(p, file)}
                  onEdit={() => setEditing(p)}
                  onDelete={() => remove(p)}
                />
              ))}
              {list.length === 0 && (
                <tr>
                  <td colSpan={8} className="admin__empty">Nenhum produto encontrado.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        </div>
      </div>

      {creating && (
        <ProductModal
          categories={categories.map((c) => c.id)}
          existingIds={products.map((p) => p.id)}
          onClose={() => setCreating(false)}
          onSave={async (p) => {
            await persist(p)
            setCreating(false)
          }}
        />
      )}

      {editing && (
        <ProductModal
          categories={categories.map((c) => c.id)}
          existingIds={products.map((p) => p.id)}
          product={editing}
          onClose={() => setEditing(null)}
          onSave={async (p) => {
            await persist(p)
            setEditing(null)
          }}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------

interface RowProps {
  product: Product
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
  product, categoryLabel, onChangeStock, onSavePrice, onSaveCost, onToggleActive, onUploadImage, onEdit, onDelete,
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
    <tr className={product.active === false ? 'admin__row--inactive' : ''}>
      <td>
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
      <td>{categoryLabel}</td>
      <td>
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
      <td>
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
      <td>
        <span className={`admin__margin ${marginClass}`}>
          {(margin * 100).toFixed(0)}%
        </span>
      </td>
      <td>
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
      <td>
        <label className="admin__switch">
          <input
            type="checkbox"
            checked={product.active !== false}
            onChange={(e) => onToggleActive(e.target.checked)}
          />
          <span />
        </label>
      </td>
      <td>
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

interface ModalProps {
  categories: string[]
  existingIds: string[]
  /** Quando presente, o modal edita um produto existente. */
  product?: Product
  onClose: () => void
  onSave: (p: Product) => void
}

function ProductModal({ categories, existingIds, product, onClose, onSave }: ModalProps) {
  const isEdit = !!product
  const [id, setId] = useState(product?.id ?? '')
  const [name, setName] = useState(product?.name ?? '')
  const [category, setCategory] = useState(product?.category ?? categories[0] ?? 'camisas')
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

  const variantsTotal = variants.reduce((s, v) => s + Math.max(0, Math.round(Number(v.stock) || 0)), 0)
  const usingVariants = variants.length > 0

  function addVariant() {
    setVariants((vs) => [...vs, { label: '', stock: '0' }])
  }
  function updateVariant(i: number, field: 'label' | 'stock', value: string) {
    setVariants((vs) => vs.map((v, k) => (k === i ? { ...v, [field]: value } : v)))
  }
  function removeVariant(i: number) {
    setVariants((vs) => vs.filter((_, k) => k !== i))
  }
  const [image, setImage] = useState<string | undefined>(product?.image)
  const [imgBusy, setImgBusy] = useState(false)
  const [err, setErr] = useState('')

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setImgBusy(true)
    setErr('')
    const { url, error } = await uploadProductImage(file)
    setImgBusy(false)
    if (error || !url) return setErr(error ?? 'Falha ao enviar a imagem.')
    setImage(url)
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const cleanId = id.trim().toLowerCase()
    const priceNum = Number(price.replace(',', '.'))
    if (!cleanId) return setErr('Informe um código (id).')
    if (!isEdit && existingIds.includes(cleanId)) return setErr('Já existe um produto com esse código.')
    if (!name.trim()) return setErr('Informe o nome.')
    if (Number.isNaN(priceNum) || priceNum < 0) return setErr('Preço inválido.')

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
      image,
    })
  }

  return (
    <div className="pdv__receipt-overlay" onClick={onClose}>
      <form className="admin__modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h3>{isEdit ? 'Editar produto' : 'Novo produto'}</h3>
        <div className="admin__form-grid">
          <div className="admin__form-full admin__imgfield">
            <span className="admin__imgfield-label">Imagem do produto</span>
            <div className="admin__imgfield-row">
              <div className="admin__imgpreview">
                {image ? (
                  <img src={image} alt="Pré-visualização" />
                ) : (
                  <span aria-hidden="true">🖼️</span>
                )}
              </div>
              <div className="admin__imgfield-actions">
                <label className="btn btn--ghost admin__imgbtn">
                  {imgBusy ? 'Enviando…' : image ? 'Trocar imagem' : 'Escolher imagem'}
                  <input type="file" accept="image/png,image/jpeg" onChange={handleFile} hidden />
                </label>
                {image && (
                  <button type="button" className="admin__imgremove" onClick={() => setImage(undefined)}>
                    Remover
                  </button>
                )}
                <small>JPG ou PNG, até 3 MB. Opcional — sem imagem usa a ilustração.</small>
              </div>
            </div>
          </div>
          <label>Código (id)
            <input value={id} onChange={(e) => setId(e.target.value)} placeholder="ex.: cam-07" disabled={isEdit} />
          </label>
          <label>Nome<input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do produto" /></label>
          <label>Categoria
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label>Tipo (ilustração)
            <select value={kind} onChange={(e) => setKind(e.target.value as ProductKind)}>
              {KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
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
    </div>
  )
}
