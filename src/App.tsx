import { useEffect, useMemo, useState } from 'react'
import { Header } from './components/Header'
import { BannerCarousel } from './components/BannerCarousel'
import { Benefits } from './components/Benefits'
import { Sponsors } from './components/Sponsors'
import { ProductCard } from './components/ProductCard'
import { CartDrawer } from './components/CartDrawer'
import { Footer } from './components/Footer'
import { Backoffice } from './components/Backoffice'
import { Checkout } from './components/Checkout'
import { ProductDetail } from './components/ProductDetail'
import { LegalPage, type LegalSection } from './components/LegalPage'
import { useCatalog } from './context/CatalogContext'
import type { CategoryId, Product } from './types'

/** A área da equipe (PDV + Gestão) fica numa URL separada da loja: /gestao. */
const IS_BACKOFFICE = /^\/(gestao|admin|pdv)(\/|$)/.test(window.location.pathname)

export default function App() {
  const { products, categories, loading } = useCatalog()
  const [view, setView] = useState<'loja' | 'checkout' | 'legal' | 'produto'>('loja')
  const [legalSection, setLegalSection] = useState<LegalSection>('trocas')
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)

  function openProduct(p: Product) {
    setSelectedProduct(p)
    setView('produto')
    window.scrollTo({ top: 0 })
  }

  function openLegal(section: LegalSection) {
    setLegalSection(section)
    setView('legal')
    window.scrollTo({ top: 0 })
  }
  const [active, setActive] = useState<CategoryId | 'todos'>('todos')
  const [query, setQuery] = useState('')
  const [payNotice, setPayNotice] = useState<{ pedido: string; status: string } | null>(null)

  // Retorno do Mercado Pago (?pedido=&pago=)
  useEffect(() => {
    const q = new URLSearchParams(window.location.search)
    const pedido = q.get('pedido')
    const pago = q.get('pago')
    if (pedido && pago) {
      setPayNotice({ pedido, status: pago })
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

  function selectCategory(id: CategoryId | 'todos') {
    setActive(id)
    setQuery('')
    const grid = document.getElementById('vitrine')
    if (id !== 'todos' && grid) {
      grid.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return products.filter((p) => {
      const isActive = p.active !== false
      const byCategory = active === 'todos' || p.category === active
      const bySearch =
        q === '' ||
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q)
      return isActive && byCategory && bySearch
    })
  }, [products, active, query])

  const activeLabel =
    active === 'todos'
      ? 'Todos os produtos'
      : categories.find((c) => c.id === active)?.label ?? ''

  const heading = query.trim()
    ? `Resultados para “${query.trim()}”`
    : active === 'todos'
      ? 'Destaques da loja'
      : activeLabel

  // Área da equipe (PDV + Gestão) numa URL separada da loja.
  if (IS_BACKOFFICE) {
    return <Backoffice />
  }

  if (view === 'checkout') {
    return <Checkout onExit={() => setView('loja')} />
  }

  if (view === 'legal') {
    return <LegalPage initial={legalSection} onExit={() => setView('loja')} />
  }

  if (view === 'produto' && selectedProduct) {
    return (
      <ProductDetail
        product={selectedProduct}
        onExit={() => setView('loja')}
        onGoCheckout={() => setView('checkout')}
      />
    )
  }

  return (
    <div id="topo">
      <Header
        active={active}
        onSelect={selectCategory}
        query={query}
        onQuery={setQuery}
      />

      {payNotice && (
        <div className={`paynotice paynotice--${payNotice.status}`} role="status">
          <span>
            {payNotice.status === 'aprovado'
              ? `🎉 Pagamento aprovado! Pedido nº ${payNotice.pedido.padStart(6, '0')} confirmado — enviamos a confirmação no seu WhatsApp.`
              : payNotice.status === 'pendente'
                ? `⏳ Pagamento do pedido nº ${payNotice.pedido.padStart(6, '0')} pendente. Avisaremos no WhatsApp quando for aprovado.`
                : `⚠️ Não foi possível concluir o pagamento do pedido nº ${payNotice.pedido.padStart(6, '0')}. Tente novamente.`}
          </span>
          <button onClick={() => setPayNotice(null)} aria-label="Fechar">✕</button>
        </div>
      )}

      {active === 'todos' && !query.trim() && (
        <BannerCarousel
          onShop={selectCategory}
          onOpenProduct={(id) => {
            const p = products.find((x) => x.id === id)
            if (p) openProduct(p)
          }}
        />
      )}

      <Benefits />

      {active === 'todos' && !query.trim() && (
        <section className="collections" aria-label="Coleções">
          {categories.map((c) => (
            <button
              key={c.id}
              className="collections__card"
              onClick={() => selectCategory(c.id)}
            >
              <span className="collections__label">{c.label}</span>
              <span className="collections__cta">Ver tudo →</span>
            </button>
          ))}
        </section>
      )}

      <main id="vitrine" className="vitrine">
        <div className="vitrine__head">
          <h2>{heading}</h2>
          <span className="vitrine__count">
            {loading
              ? 'Carregando…'
              : `${filtered.length} ${filtered.length === 1 ? 'produto' : 'produtos'}`}
          </span>
        </div>

        {loading ? (
          <div className="grid">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="card card--skeleton" aria-hidden="true">
                <div className="card__media" />
                <div className="card__body">
                  <span className="skeleton skeleton--line" />
                  <span className="skeleton skeleton--line skeleton--short" />
                  <span className="skeleton skeleton--btn" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="vitrine__empty">
            <p>Nenhum produto encontrado. 😕</p>
            <button className="btn btn--primary" onClick={() => selectCategory('todos')}>
              Ver toda a loja
            </button>
          </div>
        ) : (
          <div className="grid">
            {filtered.map((p) => (
              <ProductCard key={p.id} product={p} onOpen={openProduct} />
            ))}
          </div>
        )}
      </main>

      {active === 'todos' && !query.trim() && <Sponsors />}

      <Footer onLegal={openLegal} />
      <CartDrawer onCheckout={() => setView('checkout')} />
    </div>
  )
}
