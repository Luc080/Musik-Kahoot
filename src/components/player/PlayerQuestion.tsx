import type { Answer, Room, Round } from '../../lib/types'
import CountdownBar from '../CountdownBar'
import { ANSWER_STYLES } from '../answerStyles'
import { useServerNow } from '../../hooks/useNow'

interface Props {
  room: Room
  round: Round
  myAnswer: Answer | null
  pendingChoice: number | null
  onAnswer: (choice: number) => void
}

export default function PlayerQuestion({ room, round, myAnswer, pendingChoice, onAnswer }: Props) {
  const now = useServerNow(250)
  const endsAt = round.ends_at ? new Date(round.ends_at).getTime() : 0
  const timeUp = now > endsAt + 500
  const chosen = myAnswer?.choice_index ?? pendingChoice

  return (
    <main className="mx-auto flex min-h-[calc(100dvh-40px)] max-w-md flex-col gap-4 px-4 py-4">
      <div className="flex items-center justify-between text-white/70">
        <span>
          Runde {round.round_number}/{room.total_rounds}
        </span>
        <span>{room.category_name}</span>
      </div>

      <CountdownBar endsAt={round.ends_at} durationMs={round.duration_ms} />

      {chosen !== null && chosen !== undefined ? (
        <div className="animate-pop flex flex-1 flex-col items-center justify-center gap-6 text-center">
          <p className="animate-float text-7xl">🤞</p>
          <p className="text-3xl font-bold">Antwort eingeloggt!</p>
          <div
            className={`w-full rounded-3xl p-5 ${ANSWER_STYLES[chosen].bg} ${ANSWER_STYLES[chosen].text} ${ANSWER_STYLES[chosen].ring}`}
          >
            <p className="text-xl font-bold">
              {ANSWER_STYLES[chosen].shape} {round.options[chosen].title}
            </p>
            <p className="opacity-75">{round.options[chosen].artist}</p>
          </div>
          <p className="text-white/50">Warte auf die Auflösung…</p>
        </div>
      ) : timeUp ? (
        <div className="animate-shake flex flex-1 flex-col items-center justify-center gap-4 text-center">
          <p className="text-7xl">⏰</p>
          <p className="text-3xl font-bold">Zu spät!</p>
          <p className="text-white/50">Beim nächsten Song klappt's bestimmt.</p>
        </div>
      ) : (
        <div className="grid flex-1 grid-cols-1 gap-3">
          {round.options.map((o, i) => {
            const s = ANSWER_STYLES[i]
            return (
              <button
                key={i}
                onClick={() => onAnswer(i)}
                className={`animate-slide-up flex min-h-24 items-center gap-4 rounded-3xl px-5 py-4 text-left transition active:scale-95 ${s.bg} ${s.text} ${s.ring}`}
                style={{ animationDelay: `${i * 70}ms` }}
              >
                <span className="text-4xl">{s.shape}</span>
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 block text-xl leading-tight font-bold">{o.title}</span>
                  <span className="block truncate text-base opacity-75">{o.artist}</span>
                </span>
              </button>
            )
          })}
        </div>
      )}
    </main>
  )
}
