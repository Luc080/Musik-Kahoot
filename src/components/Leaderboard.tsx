import type { Player } from '../lib/types'
import { rankPlayers } from '../lib/game'

interface Props {
  players: Player[]
  highlightId?: string
  limit?: number
  /** Punkte der letzten Runde pro Spieler (Host-Ansicht) */
  gained?: Record<string, number>
  big?: boolean
}

const medals = ['🥇', '🥈', '🥉']

export default function Leaderboard({ players, highlightId, limit, gained, big = false }: Props) {
  const ranked = rankPlayers(players)
  const shown = limit ? ranked.slice(0, limit) : ranked

  return (
    <ol className="space-y-2">
      {shown.map((p, i) => {
        const place = ranked.findIndex((r) => r.score === p.score) + 1
        const me = p.id === highlightId
        return (
          <li
            key={p.id}
            className={`animate-slide-up flex items-center gap-3 rounded-2xl px-4 ${big ? 'py-3 text-2xl' : 'py-2.5 text-lg'} ${
              me ? 'border-2 border-neon-cyan bg-neon-cyan/15' : 'bg-white/5'
            }`}
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <span className="w-9 text-center font-bold text-white/60">{medals[place - 1] ?? `${place}.`}</span>
            <span className="flex-1 truncate font-semibold">
              {p.nickname}
              {p.streak >= 3 && <span className="ml-2" title={`${p.streak} richtige in Folge`}>🔥{p.streak}</span>}
            </span>
            {gained && gained[p.id] > 0 && (
              <span className="animate-pop font-semibold text-neon-green">+{gained[p.id]}</span>
            )}
            <span className="font-bold tabular-nums text-neon-yellow">{p.score.toLocaleString('de-CH')}</span>
          </li>
        )
      })}
    </ol>
  )
}
