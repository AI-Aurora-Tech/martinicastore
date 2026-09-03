import { useEffect, useState } from 'react'
import { loadSponsors } from '../services/sponsors'
import type { Sponsor } from '../types'

/** Faixa de patrocinadores da loja (logos com link). Some quando não há nenhum. */
export function Sponsors() {
  const [sponsors, setSponsors] = useState<Sponsor[]>([])

  useEffect(() => {
    loadSponsors(true).then(setSponsors).catch(() => setSponsors([]))
  }, [])

  if (sponsors.length === 0) return null

  return (
    <section className="sponsors" aria-label="Patrocinadores">
      <h2 className="sponsors__title">Nossos patrocinadores</h2>
      <div className="sponsors__grid">
        {sponsors.map((s) =>
          s.link ? (
            <a
              key={s.id}
              className="sponsors__item"
              href={s.link}
              target="_blank"
              rel="noopener noreferrer"
              title={s.name || 'Patrocinador'}
            >
              <img src={s.imageUrl} alt={s.name || 'Patrocinador'} loading="lazy" />
            </a>
          ) : (
            <span key={s.id} className="sponsors__item" title={s.name || 'Patrocinador'}>
              <img src={s.imageUrl} alt={s.name || 'Patrocinador'} loading="lazy" />
            </span>
          ),
        )}
      </div>
    </section>
  )
}
