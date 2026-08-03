import type { CategoryId } from '../types'

interface Props {
  onShop: (id: CategoryId | 'todos') => void
}

export function Hero({ onShop }: Props) {
  return (
    <section className="hero" aria-label="Destaque">
      <div className="hero__content">
        <span className="hero__eyebrow">Coleção 2026 já chegou</span>
        <h1 className="hero__title">
          Vista o manto do <span>Timão da Martinica</span>
        </h1>
        <p className="hero__text">
          O novo uniforme oficial, agasalhos e tudo o que o torcedor precisa
          para apoiar o clube dentro e fora do estádio.
        </p>
        <div className="hero__cta">
          <button className="btn btn--primary" onClick={() => onShop('camisas')}>
            Comprar camisas
          </button>
          <button className="btn btn--ghost" onClick={() => onShop('todos')}>
            Ver toda a loja
          </button>
        </div>
        <ul className="hero__stats">
          <li>
            <strong>+1M</strong>
            <span>torcedores atendidos</span>
          </li>
          <li>
            <strong>4.9★</strong>
            <span>avaliação da loja</span>
          </li>
          <li>
            <strong>24h</strong>
            <span>despacho do pedido</span>
          </li>
        </ul>
      </div>

      <div className="hero__art" aria-hidden="true">
        <div className="hero__jersey">
          <svg viewBox="0 0 200 240" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M70 44 L52 32 L24 54 L38 92 L58 82 L58 210 Q100 224 142 210 L142 82 L162 92 L176 54 L148 32 L130 44 Q100 66 70 44 Z"
              fill="#d6001c"
              stroke="#111"
              strokeWidth="5"
              strokeLinejoin="round"
            />
            <path d="M70 44 Q100 66 130 44 L120 60 Q100 76 80 60 Z" fill="#111" />
            <text x="100" y="150" fontFamily="Arial" fontSize="60" fontWeight="800" fill="#fff" textAnchor="middle">
              10
            </text>
            <text x="100" y="192" fontFamily="Arial" fontSize="18" fontWeight="700" fill="#fff" textAnchor="middle" letterSpacing="2">
              MARTINICA
            </text>
          </svg>
        </div>
        <span className="hero__price-tag">
          <small>a partir de</small>
          <strong>R$ 349,90</strong>
        </span>
      </div>
    </section>
  )
}
