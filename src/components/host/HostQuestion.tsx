import type { Answer, Player, Room, Round } from '../../lib/types'
import CountdownBar from '../CountdownBar'
import Equalizer from '../Equalizer'
import { ANSWER_STYLES } from '../answerStyles'

interface Props {
  room: Room
  round: Round
  players: Player[]
  answers: Answer[]
  isPlaying: boolean
  onResumeAudio: () => void
  onRevealNow: () => void
}

export default function HostQuestion({ room, round, players, answers, isPlaying, onResumeAudio, onRevealNow }: Props) {
  const answered = new Set(answers.map((a) => a.player_id))

  return (
    <main className="mx-auto flex min-h-dvh max-w-[1600px] flex-col gap-6 p-4 md:p-8">
      <header className="flex flex-wrap items-center justify-between gap-3 text-xl md:text-2xl">
        <span className="rounded-full bg-white/10 px-5 py-2 font-semibold">
          Runde {round.round_number} / {room.total_rounds}
        </span>
        <span className="text-white/70">{room.category_name}</span>
        <span className="rounded-full bg-white/10 px-5 py-2">
          Code <b className="text-neon-cyan">{room.code}</b>
        </span>
      </header>

      <section className="flex flex-col items-center gap-4 py-4 text-center">
        <h1 className="text-4xl font-bold md:text-6xl">Welcher Song ist das? 🎧</h1>
        <Equalizer playing={isPlaying} bars={32} />
        {!isPlaying && (
          <button className="btn-secondary animate-pulse" onClick={onResumeAudio}>
            🔊 Musik abspielen
          </button>
        )}
      </section>

      <CountdownBar endsAt={round.ends_at} durationMs={round.duration_ms} big />

      <section className="grid flex-1 grid-cols-1 gap-4 md:grid-cols-2">
        {round.options.map((o, i) => {
          const s = ANSWER_STYLES[i]
          return (
            <div
              key={i}
              className={`animate-slide-up flex items-center gap-4 rounded-3xl p-5 md:p-7 ${s.bg} ${s.text} ${s.ring}`}
              style={{ animationDelay: `${i * 90}ms` }}
            >
              <span className="text-4xl md:text-5xl">{s.shape}</span>
              <div className="min-w-0">
                <p className="truncate text-2xl font-bold md:text-4xl">{o.title}</p>
                <p className="truncate text-lg opacity-75 md:text-2xl">{o.artist}</p>
              </div>
            </div>
          )
        })}
      </section>

      <footer className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-2 text-2xl font-bold">
            {answered.size} / {players.length} geantwortet
          </span>
          {players.map((p) => (
            <span
              key={p.id}
              className={`rounded-full px-3 py-1 text-base transition ${
                answered.has(p.id) ? 'animate-pop bg-neon-green/25 text-neon-green' : 'bg-white/5 text-white/40'
              }`}
            >
              {answered.has(p.id) ? '✓ ' : ''}
              {p.nickname}
            </span>
          ))}
        </div>
        <button className="btn-ghost px-5 py-3 text-base" onClick={onRevealNow}>
          Jetzt auflösen ⏭
        </button>
      </footer>
    </main>
  )
}
