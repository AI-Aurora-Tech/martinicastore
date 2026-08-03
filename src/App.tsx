import { useMemo, useState } from 'react'
import { Header } from './components/Header'
import { Hero } from './components/Hero'
import { Benefits } from './components/Benefits'
import { ProductCard } from './components/ProductCard'
import { CartDrawer } from './components/CartDrawer'
import { Footer } from './components/Footer'
import { PDVGate } from './components/PDVGate'
import { categories, products } from './data/products'
import type { CategoryId } from './types'

export default function App() {
  const [view, setView] = useState<'loja' | 'pdv'>('loja')
  const [active, setActive] = useState<CategoryId | 'todos'>('todos')
  const [query, setQuery] = useState('')

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
      const byCategory = active === 'todos' || p.category === active
      const bySearch =
        q === '' ||
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q)
      return byCategory && bySearch
    })
  }, [active, query])

  const activeLabel =
    active === 'todos'
      ? 'Todos os produtos'
      : categories.find((c) => c.id === active)?.label ?? ''

  const heading = query.trim()
    ? `Resultados para “${query.trim()}”`
    : active === 'todos'
      ? 'Destaques da loja'
      : activeLabel

  if (view === 'pdv') {
    return <PDVGate onExit={() => setView('loja')} />
  }

  return (
    <div id="topo">
      <Header
        active={active}
        onSelect={selectCategory}
        query={query}
        onQuery={setQuery}
        onOpenPDV={() => setView('pdv')}
      />

      {active === 'todos' && !query.trim() && <Hero onShop={selectCategory} />}

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
            {filtered.length}{' '}
            {filtered.length === 1 ? 'produto' : 'produtos'}
          </span>
        </div>

        {filtered.length === 0 ? (
          <div className="vitrine__empty">
            <p>Nenhum produto encontrado. 😕</p>
            <button className="btn btn--primary" onClick={() => selectCategory('todos')}>
              Ver toda a loja
            </button>
          </div>
        ) : (
          <div className="grid">
            {filtered.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </main>

      <Footer />
      <CartDrawer />
    </div>
  )
}
