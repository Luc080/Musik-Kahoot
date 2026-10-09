import type { Answer, Player, Room, Round } from '../../lib/types'
import { placeOf } from '../../lib/game'
import { ANSWER_STYLES } from '../answerStyles'

interface Props {
  room: Room
  round: Round
  me: Player
  players: Player[]
  myAnswer: Answer | null
}

export default function PlayerReveal({ room, round, me, players, myAnswer }: Props) {
  const correct = myAnswer?.is_correct === true
  const place = placeOf(players, me.id)
  const ci = round.correct_index ?? 0
  const gained = (myAnswer?.points ?? 0) + (myAnswer?.bonus ?? 0)

  return (
    <main className="mx-auto flex min-h-[calc(100dvh-40px)] max-w-md flex-col items-center gap-5 px-4 py-6 text-center">
      {/* Ergebnis */}
      {correct ? (
        <div className="animate-bounce-in w-full rounded-3xl bg-neon-green px-6 py-8 text-night-950 shadow-[0_0_50px_rgb(77_255_136/0.6)]">
          <p className="text-6xl">✓</p>
          <p className="text-4xl font-bold">Richtig!</p>
          <p className="mt-2 text-3xl font-bold">+{myAnswer?.points}</p>
          {(myAnswer?.bonus ?? 0) > 0 && (
            <p className="animate-pop mt-1 text-xl font-semibold">🔥 {me.streak}er-Serie! +{myAnswer?.bonus} Bonus</p>
          )}
        </div>
      ) : (
        <div className="animate-shake w-full rounded-3xl bg-neon-red px-6 py-8 text-white shadow-[0_0_50px_rgb(255_77_109/0.6)]">
          <p className="text-6xl">{myAnswer ? '✗' : '⏰'}</p>
          <p className="text-4xl font-bold">{myAnswer ? 'Leider falsch' : 'Keine Antwort'}</p>
          <p className="mt-2 text-lg opacity-80">Serie verloren – nächster Song!</p>
        </div>
      )}

      {/* Richtiger Song */}
      <div className="card animate-slide-up flex w-full items-center gap-4 text-left" style={{ animationDelay: '200ms' }}>
        {round.cover_url ? (
          <img src={round.cover_url} alt="" className="h-20 w-20 rounded-xl" />
        ) : (
          <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-white/10 text-4xl">🎵</div>
        )}
        <div className="min-w-0">
          <p className="text-sm text-neon-cyan">
            {ANSWER_STYLES[ci].shape} Richtige Antwort
          </p>
          <p className="truncate text-xl font-bold">{round.answer_title}</p>
          <p className="truncate text-white/70">{round.answer_artist}</p>
        </div>
      </div>

      {/* Stand */}
      <div className="animate-slide-up grid w-full grid-cols-2 gap-3" style={{ animationDelay: '350ms' }}>
        <div className="card">
          <p className="text-sm text-white/50">Platz</p>
          <p className="text-4xl font-bold">
            {place}
            <span className="text-xl text-white/40">/{players.length}</span>
          </p>
        </div>
        <div className="card">
          <p className="text-sm text-white/50">Punkte</p>
          <p className="text-4xl font-bold text-neon-yellow">{me.score.toLocaleString('de-CH')}</p>
          {gained > 0 && <p className="text-sm text-neon-green">+{gained} diese Runde</p>}
        </div>
      </div>

      <p className="text-white/40">
        {room.current_round >= room.total_rounds ? 'Gleich kommt die Siegerehrung…' : 'Gleich kommt der nächste Song…'}
      </p>
    </main>
  )
}
