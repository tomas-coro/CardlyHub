import { useId } from 'react'
import type { Card, Color } from './engine.ts'
import { COL } from './colors.ts'

// Fronte di una carta UNO, direzione "Pop + indici grandi" (stessa geometria di mockups/10-uno-tavolo.html), viewBox 200x300.
// Il Jolly mostra l'ovale a 4 colori; una volta scelto il colore (card.chosen) diventa un ovale pieno di quel colore.

const Reverse = ({ x, y, size, color }: { x: number; y: number; size: number; color: string }) => (
  <g transform={`translate(${x} ${y}) scale(${size / 24})`} fill="none" stroke={color} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 9h13l-3.5-3.5M20 15H7l3.5 3.5" />
  </g>
)
const Skip = ({ x, y, size, color }: { x: number; y: number; size: number; color: string }) => (
  <g transform={`translate(${x} ${y}) scale(${size / 24})`} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round">
    <circle cx="12" cy="12" r="8.5" /><path d="M6 18L18 6" />
  </g>
)
const Plus = ({ t, x, y, size, fill, stroke }: { t: string; x: number; y: number; size: number; fill: string; stroke?: string }) => (
  <text x={x} y={y} textAnchor={x === 100 ? 'middle' : undefined} fontSize={size} fontWeight={900} letterSpacing={-3} fill={fill}
    stroke={stroke} strokeWidth={stroke ? 7 : undefined} paintOrder={stroke ? 'stroke' : undefined}>{t}</text>
)

export function UnoFace({ card }: { card: Card }) {
  const uid = useId().replace(/\W/g, '')
  const wild = card.c === 'w'
  const fill = wild ? '#15171c' : COL[card.c as Color]
  const ink = card.c === 'y' ? '#16181d' : '#fff'
  const mid = card.c === 'y' ? '#16181d' : fill

  let center: React.ReactNode = null
  if (card.v === 'rev') center = <Reverse x={42} y={112} size={116} color={mid} />
  else if (card.v === 'skip') center = <Skip x={36} y={106} size={128} color={mid} />
  else if (card.v === 'd2') center = <Plus t="+2" x={100} y={196} size={96} fill={mid} />
  else if (card.v === 'w4') center = <Plus t="+4" x={100} y={176} size={70} fill="#fff" stroke="#15171c" />
  else if (!wild) center = <text x="100" y="205" textAnchor="middle" fontSize="120" fontWeight={900} letterSpacing={-6} fill={mid}>{card.v}</text>

  const index = (rot: boolean) => {
    let g: React.ReactNode
    if (card.v === 'rev') g = <Reverse x={10} y={8} size={56} color={ink} />
    else if (card.v === 'skip') g = <Skip x={10} y={10} size={50} color={ink} />
    else if (card.v === 'd2') g = <Plus t="+2" x={14} y={52} size={42} fill={ink} />
    else if (card.v === 'w4') g = <Plus t="+4" x={14} y={52} size={42} fill={ink} />
    else if (wild) g = (
      <g transform="translate(18 18)">
        <rect width="19" height="19" fill={COL.r} /><rect x="21" width="19" height="19" fill={COL.b} />
        <rect y="21" width="19" height="19" fill={COL.y} /><rect x="21" y="21" width="19" height="19" fill={COL.g} />
      </g>
    )
    else g = <text x="16" y="56" fontSize="54" fontWeight={900} fill={ink}>{card.v}</text>
    return rot ? <g transform="rotate(180 100 150)">{g}</g> : g
  }

  // sui Jolly l'ovale è più piccolo di quello dei numeri: resta il nero attorno, come sulle carte vere
  const jolly = { cx: 100, cy: 150, rx: 64, ry: 84, transform: 'rotate(-28 100 150)' }
  let oval: React.ReactNode
  if (wild && card.chosen) oval = <ellipse {...jolly} fill={COL[card.chosen]} stroke="#fff" strokeWidth="5" />
  else if (wild) oval = (
    <>
      <clipPath id={`${uid}e`}><ellipse {...jolly} /></clipPath>
      <g clipPath={`url(#${uid}e)`}>
        <rect x="20" y="40" width="80" height="110" fill={COL.r} /><rect x="100" y="40" width="80" height="110" fill={COL.b} />
        <rect x="20" y="150" width="80" height="120" fill={COL.y} /><rect x="100" y="150" width="80" height="120" fill={COL.g} />
      </g>
      <ellipse {...jolly} fill="none" stroke="#fff" strokeWidth="5" />
    </>
  )
  else oval = <ellipse cx="100" cy="168" rx="92" ry="93" fill="#fff" transform="rotate(-28 100 168)" />

  return (
    <svg viewBox="0 0 200 300" fontFamily="Archivo,'Arial Black',sans-serif" aria-hidden="true">
      <rect width="200" height="300" fill="#fff" />
      <clipPath id={`${uid}a`}><rect x="10" y="10" width="180" height="280" rx="16" /></clipPath>
      <g clipPath={`url(#${uid}a)`}>
        <rect x="10" y="10" width="180" height="280" fill={fill} />
        {!wild && <><circle cx="168" cy="268" r="62" fill="#000" fillOpacity=".16" /><circle cx="163" cy="39" r="11" fill="#fff" fillOpacity=".3" /></>}
      </g>
      {oval}{center}{index(false)}{index(true)}
    </svg>
  )
}
