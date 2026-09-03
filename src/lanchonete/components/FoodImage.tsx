import type { FoodKind } from '../types'

interface Props {
  kind: FoodKind
  /** Foto cadastrada (URL ou data URL). Quando presente, substitui o desenho. */
  image?: string
  alt?: string
  className?: string
}

/**
 * Imagem do item de venda: a foto cadastrada quando existe, senão uma
 * ilustração vetorial por tipo. Assim toda a vitrine do PDV tem imagem, sem
 * depender de arquivos externos.
 */
export function FoodImage({ kind, image, alt, className }: Props) {
  if (image) {
    return (
      <img
        src={image}
        alt={alt ?? ''}
        className={className}
        loading="lazy"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
      />
    )
  }
  return (
    <svg
      className={className}
      viewBox="0 0 200 200"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={alt ?? ''}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
    >
      <circle cx="100" cy="100" r="86" fill="#fff2e3" />
      {DRAWINGS[kind] ?? DRAWINGS.snack}
    </svg>
  )
}

const INK = '#141414'
const ORANGE = '#ff6a00'
const ORANGE_DARK = '#c94f00'

const DRAWINGS: Record<FoodKind, JSX.Element> = {
  burger: (
    <g stroke={INK} strokeWidth="4" strokeLinejoin="round">
      <path d="M46 92c0-26 24-44 54-44s54 18 54 44z" fill="#f0a44a" />
      <circle cx="86" cy="70" r="3" fill="#fff" stroke="none" />
      <circle cx="106" cy="62" r="3" fill="#fff" stroke="none" />
      <circle cx="124" cy="74" r="3" fill="#fff" stroke="none" />
      <path d="M44 92h112v12H44z" fill="#ffe08a" />
      <path d="M44 104c14 10 28 4 38 10s24 6 36 0 24 4 38-10z" fill="#6bbf59" />
      <path d="M48 118h104v18H48z" fill="#7a4321" />
      <path d="M46 136h108c0 16-22 26-54 26s-54-10-54-26z" fill="#e79a3f" />
    </g>
  ),
  hotdog: (
    <g stroke={INK} strokeWidth="4" strokeLinejoin="round">
      <path d="M34 118c0-20 30-32 66-32s66 12 66 32-30 30-66 30-66-10-66-30z" fill="#efb264" />
      <path d="M46 108c0-12 24-20 54-20s54 8 54 20-24 18-54 18-54-6-54-18z" fill="#c1512f" />
      <path
        d="M58 106c10 10 18-6 28 4s18-8 28 2 18-8 28 2"
        fill="none"
        stroke="#ffd233"
        strokeWidth="7"
        strokeLinecap="round"
      />
    </g>
  ),
  fries: (
    <g stroke={INK} strokeWidth="4" strokeLinejoin="round">
      <g fill="#ffcf5c">
        <rect x="70" y="46" width="14" height="66" rx="4" />
        <rect x="90" y="36" width="14" height="76" rx="4" />
        <rect x="110" y="50" width="14" height="62" rx="4" />
        <rect x="128" y="62" width="14" height="50" rx="4" />
        <rect x="56" y="64" width="14" height="48" rx="4" />
      </g>
      <path d="M52 100h96l-12 62H64z" fill={ORANGE} />
      <path d="M58 122h84l-4 20H62z" fill="#fff" opacity="0.85" stroke="none" />
    </g>
  ),
  pastel: (
    <g stroke={INK} strokeWidth="4" strokeLinejoin="round">
      <path
        d="M40 72h120v56H40z"
        fill="#f2c15c"
      />
      <path
        d="M40 72c6-6 6-6 0-12m120 12c-6-6-6-6 0-12"
        fill="none"
        opacity="0"
      />
      <path
        d="M40 72l8-8 8 8 8-8 8 8 8-8 8 8 8-8 8 8 8-8 8 8 8-8 8 8 8-8 8 8"
        fill="none"
      />
      <path
        d="M40 128l8 8 8-8 8 8 8-8 8 8 8-8 8 8 8-8 8 8 8-8 8 8 8-8 8 8"
        fill="none"
      />
      <path d="M64 96c14-6 28-6 42 0" fill="none" stroke={ORANGE_DARK} strokeWidth="5" />
      <path d="M108 108c14-6 24-6 34 0" fill="none" stroke={ORANGE_DARK} strokeWidth="5" />
    </g>
  ),
  pizza: (
    <g stroke={INK} strokeWidth="4" strokeLinejoin="round">
      <path d="M100 36l58 112c-36 16-80 16-116 0z" fill="#ffd479" />
      <path d="M42 148c36 16 80 16 116 0l8 16c-42 18-90 18-132 0z" fill="#e2a44b" />
      <circle cx="100" cy="88" r="9" fill="#cf3b2c" />
      <circle cx="78" cy="120" r="9" fill="#cf3b2c" />
      <circle cx="122" cy="122" r="9" fill="#cf3b2c" />
    </g>
  ),
  soda: (
    <g stroke={INK} strokeWidth="4" strokeLinejoin="round">
      <rect x="66" y="44" width="68" height="114" rx="14" fill={ORANGE} />
      <rect x="66" y="76" width="68" height="34" fill="#fff" />
      <rect x="66" y="44" width="68" height="14" rx="7" fill="#d9dde3" />
      <path d="M84 90h32" stroke={ORANGE_DARK} strokeWidth="8" strokeLinecap="round" />
    </g>
  ),
  juice: (
    <g stroke={INK} strokeWidth="4" strokeLinejoin="round">
      <path d="M64 56h72l-10 106H74z" fill="#fff" />
      <path d="M69 86h62l-7 76H76z" fill="#ffa62b" />
      <rect x="120" y="30" width="10" height="46" rx="5" fill={ORANGE_DARK} />
      <circle cx="140" cy="72" r="20" fill="#ffb84d" />
      <path d="M140 52v40M120 72h40" stroke="#fff" strokeWidth="3" />
    </g>
  ),
  coffee: (
    <g stroke={INK} strokeWidth="4" strokeLinejoin="round">
      <path d="M58 78h74v46a26 26 0 01-26 26H84a26 26 0 01-26-26z" fill="#fff" />
      <path d="M132 90h16a16 16 0 010 32h-16z" fill="none" />
      <path d="M64 84h62v22H64z" fill="#6b3a17" />
      <path d="M50 158h96" stroke={INK} strokeWidth="8" strokeLinecap="round" />
      <path d="M82 60c-8-8 8-14 0-22M104 60c-8-8 8-14 0-22" fill="none" stroke={ORANGE_DARK} />
    </g>
  ),
  beer: (
    <g stroke={INK} strokeWidth="4" strokeLinejoin="round">
      <path d="M86 32h28v22c0 10 14 16 14 34v76a8 8 0 01-8 8H80a8 8 0 01-8-8V88c0-18 14-24 14-34z" fill="#3f7d20" />
      <rect x="72" y="96" width="56" height="42" fill="#fff" opacity="0.9" stroke="none" />
      <text x="100" y="126" textAnchor="middle" fontFamily="Segoe UI, sans-serif" fontSize="20" fontWeight="700" fill={ORANGE_DARK} stroke="none">
        LM
      </text>
      <rect x="84" y="28" width="32" height="12" rx="4" fill={ORANGE} />
    </g>
  ),
  water: (
    <g stroke={INK} strokeWidth="4" strokeLinejoin="round">
      <path d="M88 34h24v18c0 8 16 14 16 32v82a8 8 0 01-8 8H80a8 8 0 01-8-8V84c0-18 16-24 16-32z" fill="#d9f0ff" />
      <rect x="72" y="104" width="56" height="30" fill="#2b8fd6" opacity="0.35" stroke="none" />
      <rect x="86" y="26" width="28" height="14" rx="4" fill="#2b8fd6" />
    </g>
  ),
  icecream: (
    <g stroke={INK} strokeWidth="4" strokeLinejoin="round">
      <path d="M62 96h76l-14 40a16 16 0 01-15 11h-18a16 16 0 01-15-11z" fill="#fff" />
      <path d="M96 147h8v18h-8z" fill="#fff" />
      <path d="M78 165h44" strokeWidth="8" strokeLinecap="round" />
      <circle cx="82" cy="86" r="20" fill="#ffd9e2" />
      <circle cx="118" cy="86" r="20" fill="#f6e3b4" />
      <circle cx="100" cy="66" r="20" fill={ORANGE} />
      <path d="M100 46v-14" strokeLinecap="round" />
      <circle cx="100" cy="30" r="7" fill="#cf3b2c" />
    </g>
  ),
  cake: (
    <g stroke={INK} strokeWidth="4" strokeLinejoin="round">
      <path d="M50 78h100v76H50z" fill="#f6dfae" />
      <path d="M50 78h100v18H50z" fill="#5c3317" />
      <path d="M50 112h100v16H50z" fill="#5c3317" />
      <path d="M50 78c8-14 18-14 26 0s18 14 26 0 18-14 26 0 18 14 22 0" fill="#5c3317" />
      <circle cx="100" cy="60" r="10" fill="#cf3b2c" />
    </g>
  ),
  combo: (
    <g stroke={INK} strokeWidth="4" strokeLinejoin="round">
      <path d="M28 92c0-18 16-30 36-30s36 12 36 30z" fill="#f0a44a" />
      <path d="M26 92h76v10H26z" fill="#6bbf59" />
      <path d="M30 102h68v14H30z" fill="#7a4321" />
      <path d="M28 116h72c0 12-16 20-36 20s-36-8-36-20z" fill="#e79a3f" />
      <rect x="118" y="56" width="52" height="88" rx="10" fill={ORANGE} />
      <rect x="118" y="80" width="52" height="24" fill="#fff" />
      <rect x="112" y="140" width="64" height="12" rx="6" fill={INK} />
    </g>
  ),
  snack: (
    <g stroke={INK} strokeWidth="4" strokeLinejoin="round">
      <ellipse cx="100" cy="132" rx="70" ry="24" fill="#fff" />
      <ellipse cx="100" cy="126" rx="70" ry="24" fill="#ffe9cf" />
      <ellipse cx="76" cy="116" rx="24" ry="16" fill="#e0a252" transform="rotate(-15 76 116)" />
      <ellipse cx="118" cy="112" rx="24" ry="16" fill="#d99340" transform="rotate(12 118 112)" />
      <ellipse cx="98" cy="98" rx="22" ry="15" fill="#eab069" />
    </g>
  ),
}
