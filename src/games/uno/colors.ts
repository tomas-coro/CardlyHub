import type { Card, Color } from './engine.ts'

// Colori e nomi delle carte UNO, condivisi da UnoFace (grafica) e UnoTable (testi).
export const COL: Record<Color, string> = { r: '#e63a2e', b: '#2b6fd6', y: '#f5c315', g: '#2fa35b' }
export const COLOR_NAME: Record<Color, string> = { r: 'Rosso', b: 'Blu', y: 'Giallo', g: 'Verde' }
const VALUE_NAME: Record<string, string> = { skip: 'Salta', rev: 'Inverti', d2: '+2', w: 'Jolly', w4: 'Jolly +4' }
export const cardLabel = (c: Card) => (c.c === 'w' ? VALUE_NAME[c.v] : `${COLOR_NAME[c.c]} ${VALUE_NAME[c.v] ?? c.v}`)
