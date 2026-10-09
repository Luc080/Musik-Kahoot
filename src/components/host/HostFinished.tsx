import type { Player } from '../../lib/types'
import { rankPlayers } from '../../lib/game'
import Podium from '../Podium'

interface Props {
  players: Player[]
  onPlayAgain: () => void
  onHome: () => void
}

export default function HostFinished({ players, onPlayAgain, onHome }: Props) {
  const ranked = rankPlayers(players)
  const rest = ranked.slice(3)

  return (
    <main className="mx-auto flex min-h-dvh max-w-6xl flex-col items-center gap-8 p-4 md:p-8">
      <h1 className="neon-text animate-bounce-in text-center text-5xl font-bold md:text-7xl">🏆 Siegerehrung 🏆</h1>

      <Podium players={players} big />

      {rest.length > 0 && (
        <ol className="grid w-full max-w-3xl grid-cols-1 gap-2 md:grid-cols-2">
          {rest.map((p, i) => (
            <li
              key={p.id}
              className="animate-slide-up flex items-center gap-3 rounded-2xl bg-white/5 px-4 py-3 text-xl"
              style={{ animationDelay: `${1800 + i * 80}ms` }}
            >
              <span className="w-10 font-bold text-white/50">{ranked.findIndex((r) => r.score === p.score) + 1}.</span>
              <span className="flex-1 truncate">{p.nickname}</span>
              <span className="font-bold text-neon-yellow tabular-nums">{p.score.toLocaleString('de-CH')}</span>
            </li>
          ))}
        </ol>
      )}

      <div className="flex flex-col gap-3 md:flex-row">
        <button className="btn-primary px-10 text-2xl" onClick={onPlayAgain}>
          🔁 Nochmal spielen
        </button>
        <button className="btn-ghost" onClick={onHome}>
          Raum schliessen
        </button>
      </div>
    </main>
  )
}
