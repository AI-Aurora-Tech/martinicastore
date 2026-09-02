import { useEffect, useRef, useState } from 'react'
import type { Banner, CategoryId } from '../types'
import { loadBanners } from '../services/banners'
import { Hero } from './Hero'

interface Props {
  onShop: (id: CategoryId | 'todos') => void
}

/**
 * Banner principal da loja. Editável no painel de gestão.
 * - Nenhum banner cadastrado → mostra o destaque padrão (Hero).
 * - Um banner → imagem única.
 * - Vários banners → carrossel (auto-avanço + setas + indicadores).
 * O container é responsivo (largura total, proporção fixa) e funciona em
 * qualquer dispositivo.
 */
export function BannerCarousel({ onShop }: Props) {
  const [banners, setBanners] = useState<Banner[] | null>(null)
  const [index, setIndex] = useState(0)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    let alive = true
    loadBanners(true).then((list) => {
      if (alive) setBanners(list)
    })
    return () => {
      alive = false
    }
  }, [])

  const count = banners?.length ?? 0

  useEffect(() => {
    if (count <= 1) return
    timer.current = setInterval(() => setIndex((i) => (i + 1) % count), 5000)
    return () => {
      if (timer.current) clearInterval(timer.current)
    }
  }, [count])

  // Ainda carregando: não pisca nada (evita "pulo" de layout).
  if (banners === null) return null
  // Sem banners cadastrados: usa o destaque padrão.
  if (count === 0) return <Hero onShop={onShop} />

  const go = (i: number) => setIndex(((i % count) + count) % count)

  function activate(b: Banner) {
    const link = (b.link ?? '').trim()
    if (!link) return
    if (/^https?:\/\//i.test(link)) {
      window.open(link, '_blank', 'noopener')
    } else {
      onShop(link as CategoryId | 'todos')
    }
  }

  return (
    <section className="banner" aria-label="Banner principal" aria-roledescription="carrossel">
      <div className="banner__viewport">
        <div className="banner__track" style={{ transform: `translateX(-${index * 100}%)` }}>
          {banners.map((b) => (
            <div className="banner__slide" key={b.id}>
              <img className="banner__img" src={b.imageUrl} alt={b.headline ?? 'Banner da loja'} />
              {(b.headline || b.subtext || b.ctaLabel) && (
                <div className="banner__overlay">
                  {b.headline && <h2 className="banner__headline">{b.headline}</h2>}
                  {b.subtext && <p className="banner__subtext">{b.subtext}</p>}
                  {b.ctaLabel && (
                    <button className="btn btn--primary banner__cta" onClick={() => activate(b)}>
                      {b.ctaLabel}
                    </button>
                  )}
                </div>
              )}
              {!b.ctaLabel && b.link && (
                <button
                  className="banner__hit"
                  aria-label={b.headline ?? 'Abrir'}
                  onClick={() => activate(b)}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {count > 1 && (
        <>
          <button className="banner__arrow banner__arrow--prev" onClick={() => go(index - 1)} aria-label="Anterior">‹</button>
          <button className="banner__arrow banner__arrow--next" onClick={() => go(index + 1)} aria-label="Próximo">›</button>
          <div className="banner__dots" role="tablist">
            {banners.map((b, i) => (
              <button
                key={b.id}
                className={`banner__dot ${i === index ? 'is-active' : ''}`}
                aria-label={`Ir ao banner ${i + 1}`}
                aria-selected={i === index}
                onClick={() => go(i)}
              />
            ))}
          </div>
        </>
      )}
    </section>
  )
}
