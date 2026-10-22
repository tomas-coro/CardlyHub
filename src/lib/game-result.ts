export type GameResult = {
  winner: number | null
  scores?: [number, number]   // punteggio finale di ciascuno: alimenta miglior e peggior punteggio
  hands?: [number, number]    // mani vinte da ciascuno in una serie "al meglio di" (UNO)
}
