import type { Answer, Player, Room, Round } from '../../lib/types'
import { ANSWER_STYLES } from '../answerStyles'
import Leaderboard from '../Leaderboard'
import { GAME_SETTINGS } from '../../config/categories'

interface Props {
  room: Room
  round: Round
  players: Player[]
  answers: Answer[]
  now: number
  advanceAt: number | null
  autoAdvance: boolean
  onToggleAuto: () => void
  onNext: () => void
  busy: boolean
}

export default function HostReveal(props: Props) {
  const { room, round, players, answers, now, advanceAt, autoAdvance } = props
  const counts = [0, 0, 0, 0]
  answers.forEach((a) => counts[a.choice_index]++)
  const maxCount = Math.max(1, ...counts)

  const gained: Record<string, number> = {}
  answers.forEach((a) => (gained[a.player_id] = (a.points ?? 0) + (a.bonus ?? 0)))
  const byId = new Map(players.map((p) => [p.id, p]))
  const correct = answers
    .filter((a) => a.is_correct)
    .sort((a, b) => a.elapsed_ms - b.elapsed_ms)
    .map((a) => ({ answer: a, player: byId.get(a.player_id) }))
    .filter((x) => x.player)

  const isLast = room.current_round >= room.total_rounds
  const remaining = advanceAt ? Math.max(0, advanceAt - now) : 0
  const progress = advanceAt ? 100 - (remaining / (GAME_SETTINGS.revealSeconds * 1000)) * 100 : 0

  return (
    <main className="mx-auto flex min-h-dvh max-w-[1600px] flex-col gap-6 p-4 md:p-8">
      <header className="flex items-center justify-between text-xl md:text-2xl">
        <span className="rounded-full bg-white/10 px-5 py-2 font-semibold">
          Runde {round.round_number} / {room.total_rounds}
        </span>
        <span className="text-white/70">Auflösung</span>
      </header>

      <div className="grid flex-1 gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <section className="flex flex-col gap-6">
          {/* Song */}
          <div className="card flex flex-col items-center gap-6 md:flex-row">
            {round.cover_url ? (
              <img
                src={round.cover_url}
                alt=""
                className="animate-bounce-in h-48 w-48 rounded-2xl shadow-[0_0_50px_rgb(255_43_214/0.5)] md:h-64 md:w-64"
              />
            ) : (
              <div className="flex h-48 w-48 items-center justify-center rounded-2xl bg-white/10 text-7xl">🎵</div>
            )}
            <div className="animate-slide-up min-w-0 text-center md:text-left">
              <p className="text-lg tracking-widest text-neon-cyan uppercase">Das war</p>
              <p className="text-4xl font-bold md:text-6xl">{round.answer_title}</p>
              <p className="text-2xl text-white/70 md:text-4xl">{round.answer_artist}</p>
            </div>
          </div>

          {/* Antwortverteilung */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {round.options.map((o, i) => {
              const s = ANSWER_STYLES[i]
              const isCorrect = i === round.correct_index
              return (
                <div
                  key={i}
                  className={`relative flex items-center gap-3 overflow-hidden rounded-2xl p-4 transition ${
                    isCorrect ? `${s.bg} ${s.text} ${s.ring} scale-[1.02]` : 'bg-white/5 text-white/40'
                  }`}
                >
                  <span className="text-3xl">{isCorrect ? '✓' : s.shape}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xl font-bold">{o.title}</p>
                    <p className="truncate opacity-75">{o.artist}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div
                      className={`h-3 rounded-full ${isCorrect ? 'bg-night-950/50' : 'bg-white/30'}`}
                      style={{ width: `${(counts[i] / maxCount) * 80 + 4}px` }}
                    />
                    <span className="w-8 text-right text-2xl font-bold">{counts[i]}</span>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Wer lag richtig */}
          <div className="card">
            <h3 className="mb-3 text-2xl font-bold">
              {correct.length > 0 ? `Richtig lagen (${correct.length}) 🎉` : 'Niemand lag richtig 😱'}
            </h3>
            <div className="flex flex-wrap gap-2">
              {correct.map(({ answer, player }, i) => (
                <span
                  key={answer.id}
                  className="animate-pop rounded-full bg-neon-green/20 px-4 py-2 text-lg text-neon-green"
                  style={{ animationDelay: `${i * 80}ms` }}
                >
                  {i === 0 && '⚡ '}
                  {player!.nickname} <b>+{answer.points}</b>
                  {(answer.bonus ?? 0) > 0 && <b className="text-neon-yellow"> 🔥+{answer.bonus}</b>}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* Zwischenrangliste */}
        <section className="card flex flex-col gap-4">
          <h2 className="text-3xl font-bold">Rangliste</h2>
          <div className="flex-1">
            <Leaderboard players={players} gained={gained} limit={8} big />
          </div>

          <div className="flex flex-col gap-3">
            <button className="btn-primary text-2xl" onClick={props.onNext} disabled={props.busy}>
              {isLast ? '🏆 Zur Siegerehrung' : '▶ Nächster Song'}
            </button>
            {autoAdvance && advanceAt && (
              <div className="h-2 overflow-hidden rounded-full bg-white/10">
                <div className="h-full bg-neon-cyan transition-[width] duration-200" style={{ width: `${progress}%` }} />
              </div>
            )}
            <button className="text-sm text-white/50 hover:text-white" onClick={props.onToggleAuto}>
              {autoAdvance
                ? `Automatisch weiter in ${Math.ceil(remaining / 1000)} s – pausieren`
                : 'Automatisches Weiterschalten ist aus – einschalten'}
            </button>
          </div>
        </section>
      </div>
    </main>
  )
}
