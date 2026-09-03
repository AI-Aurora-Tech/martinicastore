import type { ProductKind } from '../types'

interface Props {
  kind: ProductKind
  colors: [string, string]
  className?: string
  /** Foto do produto (URL/data URL). Quando presente, substitui a ilustração. */
  image?: string
  alt?: string
}

/**
 * Foto do produto quando cadastrada; caso contrário, ilustração vetorial por
 * tipo de produto (mantém identidade visual sem depender de imagens externas).
 */
export function ProductImage({ kind, colors, className, image, alt }: Props) {
  if (image) {
    // Preenche a caixa (aspect-ratio do container) sem esticá-la: absolute evita
    // que uma foto retrato/paisagem aumente a altura do container; contain = sem cortes.
    return (
      <img
        src={image}
        alt={alt ?? ''}
        className={className}
        loading="lazy"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' }}
      />
    )
  }

  const [main, accent] = colors
  const common = {
    className,
    viewBox: '0 0 200 200',
    xmlns: 'http://www.w3.org/2000/svg',
    role: 'img',
  } as const

  switch (kind) {
    case 'jersey':
    case 'pet':
      return (
        <svg {...common} aria-label="Camisa">
          <path
            d="M70 40 L55 30 L30 48 L42 78 L58 70 L58 165 Q100 175 142 165 L142 70 L158 78 L170 48 L145 30 L130 40 Q100 58 70 40 Z"
            fill={main}
            stroke={accent}
            strokeWidth="4"
            strokeLinejoin="round"
          />
          <path d="M70 40 Q100 58 130 40 L122 52 Q100 66 78 52 Z" fill={accent} />
          <rect x="90" y="92" width="20" height="46" rx="3" fill={accent} opacity="0.85" />
        </svg>
      )
    case 'jacket':
      return (
        <svg {...common} aria-label="Agasalho">
          <path
            d="M68 42 L52 34 L28 54 L40 84 L56 76 L56 168 L96 168 L96 60 L104 60 L104 168 L144 168 L144 76 L160 84 L172 54 L148 34 L132 42 Q100 60 68 42 Z"
            fill={main}
            stroke={accent}
            strokeWidth="4"
            strokeLinejoin="round"
          />
          <line x1="100" y1="60" x2="100" y2="168" stroke={accent} strokeWidth="4" />
          <circle cx="100" cy="80" r="3" fill={accent} />
          <circle cx="100" cy="100" r="3" fill={accent} />
          <circle cx="100" cy="120" r="3" fill={accent} />
        </svg>
      )
    case 'shorts':
      return (
        <svg {...common} aria-label="Calção">
          <path
            d="M52 50 L148 50 L146 120 L118 120 L100 78 L82 120 L54 120 Z"
            fill={main}
            stroke={accent}
            strokeWidth="4"
            strokeLinejoin="round"
          />
          <rect x="52" y="50" width="96" height="12" fill={accent} />
        </svg>
      )
    case 'cap':
      return (
        <svg {...common} aria-label="Boné">
          <path d="M40 118 Q100 60 160 118 Z" fill={main} stroke={accent} strokeWidth="4" />
          <path d="M40 118 Q100 130 160 118 L182 128 Q100 150 40 128 Z" fill={accent} />
          <circle cx="100" cy="72" r="6" fill={accent} />
        </svg>
      )
    case 'ball':
      return (
        <svg {...common} aria-label="Bola">
          <circle cx="100" cy="100" r="62" fill={main} stroke={accent} strokeWidth="4" />
          <polygon points="100,74 122,90 114,116 86,116 78,90" fill={accent} />
          <path d="M100 38 L100 74 M162 100 L122 90 M138 158 L114 116 M62 158 L86 116 M38 100 L78 90"
            stroke={accent} strokeWidth="4" fill="none" />
        </svg>
      )
    case 'scarf':
      return (
        <svg {...common} aria-label="Cachecol / bandeira">
          <rect x="40" y="34" width="120" height="120" rx="6" fill={main} stroke={accent} strokeWidth="4" />
          <rect x="40" y="70" width="120" height="16" fill={accent} />
          <rect x="40" y="102" width="120" height="16" fill={accent} />
          <circle cx="100" cy="58" r="12" fill={accent} />
        </svg>
      )
    case 'mug':
      return (
        <svg {...common} aria-label="Caneca">
          <rect x="58" y="60" width="70" height="88" rx="8" fill={main} stroke={accent} strokeWidth="4" />
          <path d="M128 82 Q160 82 160 104 Q160 126 128 126" fill="none" stroke={accent} strokeWidth="8" />
          <circle cx="93" cy="104" r="16" fill={accent} />
        </svg>
      )
    case 'backpack':
      return (
        <svg {...common} aria-label="Mochila">
          <rect x="58" y="52" width="84" height="104" rx="18" fill={main} stroke={accent} strokeWidth="4" />
          <rect x="80" y="86" width="40" height="46" rx="8" fill={accent} />
          <path d="M78 54 Q100 30 122 54" fill="none" stroke={accent} strokeWidth="6" />
        </svg>
      )
    case 'shoe':
      return (
        <svg {...common} aria-label="Calçado">
          <path
            d="M36 120 Q40 96 64 100 L92 104 L150 128 Q168 132 166 142 L164 150 L38 150 Q30 150 32 138 Z"
            fill={main}
            stroke={accent}
            strokeWidth="4"
            strokeLinejoin="round"
          />
          <path d="M70 106 L78 128 M88 108 L96 132 M106 112 L114 136" stroke={accent} strokeWidth="4" />
          <rect x="32" y="150" width="134" height="8" rx="4" fill={accent} />
        </svg>
      )
    default:
      return (
        <svg {...common} aria-label="Produto">
          <rect x="50" y="50" width="100" height="100" rx="12" fill={main} stroke={accent} strokeWidth="4" />
        </svg>
      )
  }
}
