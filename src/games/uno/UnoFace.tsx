import type { Card, Color } from './engine.ts'
import { COL } from './colors.ts'

// Fronte di una carta UNO, direzione "Moderna pulita" (mockups/14-uno-fronti.html, tile B), viewBox 200x300.
// Struttura vera di UNO: bordo bianco, ovale inclinato, numero grande al centro, indici agli angoli.
// Il Jolly mostra l'ovale a 4 colori; una volta scelto il colore (card.chosen) diventa un ovale pieno di quel colore.

const Reverse = ({ x, y, size, color }: { x: number; y: number; size: number; color: string }) => (
  <g transform={`translate(${x} ${y}) scale(${size / 24})`} fill="none" stroke={color} strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 9h13l-3.5-3.5M20 15H7l3.5 3.5" />
  </g>
)
const Skip = ({ x, y, size, color }: { x: number; y: number; size: number; color: string }) => (
  <g transform={`translate(${x} ${y}) scale(${size / 24})`} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round">
    <circle cx="12" cy="12" r="8.5" /><path d="M6 18L18 6" />
  </g>
)
const Label = ({ t, x, y, size, fill, stroke }: { t: string; x: number; y: number; size: number; fill: string; stroke?: string }) => (
  <text x={x} y={y} textAnchor="middle" fontSize={size} fontWeight={800} fill={fill}
    stroke={stroke} strokeWidth={stroke ? size * 0.07 : undefined} paintOrder={stroke ? 'stroke' : undefined} strokeLinejoin="round">{t}</text>
)

// Ovale inclinato: stesso angolo e dimensioni su tutte le carte
const OVAL = { rx: 74, ry: 108, angle: 24 }

export function UnoFace({ card, className }: { card: Card; className?: string }) {
  const wild = card.c === 'w'
  const fill = wild ? '#1b1b20' : COL[card.c as Color]
  const ink = '#fff'
  const mid = card.c === 'y' ? '#16181d' : fill

  let center: React.ReactNode = null
  if (card.v === 'rev') center = <Reverse x={48} y={98} size={104} color={mid} />
  else if (card.v === 'skip') center = <Skip x={36} y={86} size={128} color={mid} />
  else if (card.v === 'd2') center = (
    <>
      <rect x="68" y="108" width="46" height="68" rx="6" fill={mid} stroke="#fff" strokeWidth="4" transform="rotate(-12 92 142)" />
      <rect x="90" y="118" width="46" height="68" rx="6" fill={mid} stroke="#fff" strokeWidth="4" transform="rotate(12 113 152)" />
    </>
  )
  else if (card.v === 'w4') center = <Label t="+4" x={100} y={178} size={93} fill="#fff" stroke="#15171c" />
  else if (!wild) center = <text x="100" y="192" textAnchor="middle" fontSize="116" fontWeight={800} fill={mid}>{card.v}</text>

  const index = (rot: boolean) => {
    let g: React.ReactNode
    if (card.v === 'rev') g = <Reverse x={14} y={16} size={38} color={ink} />
    else if (card.v === 'skip') g = <Skip x={10} y={10} size={44} color={ink} />
    else if (card.v === 'd2') g = <Label t="+2" x={33} y={54} size={42} fill={ink} />
    else if (card.v === 'w4') g = <Label t="+4" x={33} y={54} size={42} fill={ink} />
    else if (wild) g = (
      <g transform="translate(14 18)">
        <rect width="14" height="14" fill={COL.y} /><rect x="14" width="14" height="14" fill={COL.r} />
        <rect y="14" width="14" height="14" fill={COL.g} /><rect x="14" y="14" width="14" height="14" fill={COL.b} />
      </g>
    )
    else g = <Label t={card.v} x={31} y={54} size={46} fill={ink} />
    return rot ? <g transform="rotate(180 100 150)">{g}</g> : g
  }

  // Jolly: quattro quarti d'ovale (rosso, blu, verde, giallo) dentro un bordo bianco; con colore scelto, ovale pieno
  const { rx, ry, angle } = OVAL
  let oval: React.ReactNode
  if (wild && card.chosen) oval = (
    <g transform={`translate(100 150) rotate(${angle})`}><ellipse rx={rx + 5} ry={ry + 5} fill="#fff" /><ellipse rx={rx} ry={ry} fill={COL[card.chosen]} /></g>
  )
  else if (wild) oval = (
    <g transform={`translate(100 150) rotate(${angle})`}>
      <ellipse rx={rx + 5} ry={ry + 5} fill="#fff" />
      <path d={`M0 0L0 ${-ry} A${rx} ${ry} 0 0 1 ${rx} 0Z`} fill={COL.r} />
      <path d={`M0 0L${rx} 0 A${rx} ${ry} 0 0 1 0 ${ry}Z`} fill={COL.b} />
      <path d={`M0 0L0 ${ry} A${rx} ${ry} 0 0 1 ${-rx} 0Z`} fill={COL.g} />
      <path d={`M0 0L${-rx} 0 A${rx} ${ry} 0 0 1 0 ${-ry}Z`} fill={COL.y} />
    </g>
  )
  else oval = <ellipse cx="100" cy="150" rx={rx} ry={ry} fill="#fff" transform={`rotate(${angle} 100 150)`} />

  return (
    <svg className={className} viewBox="0 0 200 300" fontFamily="Sora,'Arial Black',sans-serif" aria-hidden="true">
      <rect width="200" height="300" rx="16" fill="#fff" />
      <rect x="8" y="8" width="184" height="284" rx="18" fill={fill} />
      {!wild && <path d="M192 190L192 274Q192 292 174 292L90 292Q175 270 192 190Z" fill="#000" fillOpacity=".14" />}
      {oval}{center}{index(false)}{index(true)}
    </svg>
  )
}
