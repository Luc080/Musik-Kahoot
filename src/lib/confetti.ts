import confetti from 'canvas-confetti'

const COLORS = ['#ff2bd6', '#22f0ff', '#ffe14d', '#4dff88', '#a855ff']

/** Konfetti-Regen von beiden Seiten für ein paar Sekunden */
export function celebrate(durationMs = 4000) {
  const end = Date.now() + durationMs
  const frame = () => {
    confetti({ particleCount: 6, angle: 60, spread: 70, origin: { x: 0, y: 0.7 }, colors: COLORS })
    confetti({ particleCount: 6, angle: 120, spread: 70, origin: { x: 1, y: 0.7 }, colors: COLORS })
    if (Date.now() < end) requestAnimationFrame(frame)
  }
  confetti({ particleCount: 160, spread: 100, origin: { y: 0.4 }, colors: COLORS })
  frame()
}

/** Kleiner Konfetti-Knall (z.B. bei richtiger Antwort) */
export function burst() {
  confetti({ particleCount: 80, spread: 80, origin: { y: 0.6 }, colors: COLORS })
}
