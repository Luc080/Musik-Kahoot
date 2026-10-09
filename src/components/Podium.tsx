import type { Player } from '../lib/types'
import { rankPlayers } from '../lib/game'

const STEPS = [
  { place: 2, height: 'h-32 md:h-48', color: 'from-slate-300 to-slate-500', medal: '🥈', delay: 400 },
  { place: 1, height: 'h-44 md:h-64', color: 'from-neon-yellow to-amber-500', medal: '🥇', delay: 900 },
  { place: 3, height: 'h-24 md:h-36', color: 'from-orange-400 to-orange-700', medal: '🥉', delay: 0 },
]

/** Siegerpodest für Platz 1–3 */
export default function Podium({ players, big = false }: { players: Player[]; big?: boolean }) {
  const ranked = rankPlayers(players)

  return (
    <div className="flex items-end justify-center gap-2 md:gap-4">
      {STEPS.map((step) => {
        const p = ranked[step.place - 1]
        return (
          <div key={step.place} className={`flex flex-col items-center ${big ? 'w-44 md:w-60' : 'w-28'}`}>
            {p ? (
              <div
                className="animate-bounce-in mb-2 flex flex-col items-center text-center"
                style={{ animationDelay: `${step.delay + 500}ms` }}
              >
                <span className={big ? 'text-6xl' : 'text-4xl'}>{step.medal}</span>
                <span className={`max-w-full truncate font-bold ${big ? 'text-3xl' : 'text-lg'}`}>{p.nickname}</span>
                <span className={`font-semibold text-neon-yellow tabular-nums ${big ? 'text-2xl' : 'text-base'}`}>
                  {p.score.toLocaleString('de-CH')}
                </span>
              </div>
            ) : (
              <div className="mb-2 h-10" />
            )}
            <div
              className={`animate-rise flex w-full origin-bottom items-start justify-center rounded-t-2xl bg-gradient-to-b ${step.color} ${step.height} pt-3 font-bold text-night-950 ${big ? 'text-6xl' : 'text-4xl'}`}
              style={{ animationDelay: `${step.delay}ms` }}
            >
              {step.place}
            </div>
          </div>
        )
      })}
    </div>
  )
}
