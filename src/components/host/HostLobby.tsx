import { QRCodeSVG } from 'qrcode.react'
import type { Player, Room } from '../../lib/types'
import { CATEGORIES, GAME_SETTINGS } from '../../config/categories'
import Logo from '../Logo'

interface Props {
  room: Room
  players: Player[]
  categoryId: string
  onCategory: (id: string) => void
  roundCount: number
  onRoundCount: (n: number) => void
  onStart: () => void
  onKick: (playerId: string) => void
  onClose: () => void
  busy: boolean
}

export default function HostLobby(props: Props) {
  const { room, players, categoryId, roundCount, busy } = props
  const joinUrl = `${window.location.origin}/join?code=${room.code}`
  const prettyUrl = `${window.location.host}/join`
  const sortedPlayers = [...players].sort((a, b) => a.created_at.localeCompare(b.created_at))

  return (
    <main className="mx-auto flex min-h-dvh max-w-[1600px] flex-col gap-6 p-4 md:p-8">
      <header className="flex items-center justify-between">
        <Logo size="sm" />
        <button className="btn-ghost px-4 py-2 text-base" onClick={props.onClose}>
          Raum schliessen
        </button>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        {/* Beitritts-Infos */}
        <section className="card flex flex-col items-center gap-5 text-center">
          <p className="text-xl text-white/70 md:text-2xl">
            Öffne <span className="font-semibold text-neon-cyan">{prettyUrl}</span> oder scanne den QR-Code
          </p>
          <div className="rounded-3xl bg-white p-4 shadow-[0_0_40px_rgb(34_240_255/0.35)]">
            <QRCodeSVG value={joinUrl} size={220} level="M" />
          </div>
          <div>
            <p className="text-lg tracking-widest text-white/60 uppercase">Raum-Code</p>
            <p className="neon-text animate-glow text-7xl font-bold tracking-[0.2em] md:text-9xl">{room.code}</p>
          </div>
        </section>

        {/* Spielerliste */}
        <section className="card flex flex-col gap-4">
          <div className="flex items-baseline justify-between">
            <h2 className="text-3xl font-bold">Spieler</h2>
            <span className="text-2xl font-semibold text-neon-cyan">{players.length}</span>
          </div>
          {players.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 py-10 text-white/50">
              <span className="animate-float text-6xl">📱</span>
              <p className="text-xl">Warte auf Spieler…</p>
            </div>
          ) : (
            <ul className="flex flex-wrap gap-3">
              {sortedPlayers.map((p) => (
                <li
                  key={p.id}
                  className="animate-pop group flex items-center gap-2 rounded-full bg-gradient-to-r from-neon-purple/40 to-neon-pink/40 py-2 pr-2 pl-5 text-xl font-semibold md:text-2xl"
                >
                  {p.nickname}
                  <button
                    onClick={() => props.onKick(p.id)}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-base text-white/40 hover:bg-white/10 hover:text-white"
                    title="Spieler entfernen"
                    aria-label={`${p.nickname} entfernen`}
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Einstellungen */}
      <section className="card flex flex-col gap-5">
        <h2 className="text-2xl font-bold">Kategorie</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {CATEGORIES.map((c) => {
            const active = c.id === categoryId
            return (
              <button
                key={c.id}
                onClick={() => props.onCategory(c.id)}
                className={`flex flex-col items-start gap-1 rounded-2xl bg-gradient-to-br p-4 text-left transition ${c.gradient} ${
                  active ? 'scale-[1.03] ring-4 ring-white' : 'opacity-60 hover:opacity-90'
                }`}
              >
                <span className="text-3xl">{c.emoji}</span>
                <span className="text-lg font-bold text-night-950">{c.name}</span>
                <span className="text-sm text-night-950/70">{c.description}</span>
              </button>
            )
          })}
        </div>

        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xl font-semibold">Runden:</span>
            {GAME_SETTINGS.roundOptions.map((n) => (
              <button
                key={n}
                onClick={() => props.onRoundCount(n)}
                className={`h-14 w-16 rounded-2xl text-2xl font-bold transition ${
                  n === roundCount ? 'bg-neon-cyan text-night-950 shadow-[0_0_20px_rgb(34_240_255/0.6)]' : 'bg-white/10'
                }`}
              >
                {n}
              </button>
            ))}
          </div>

          <div className="flex flex-col items-stretch gap-2 md:items-end">
            <button
              className="btn-primary px-12 py-5 text-3xl"
              onClick={props.onStart}
              disabled={busy || players.length === 0}
            >
              ▶ Start
            </button>
            <span className="text-sm text-white/50">
              {players.length === 0
                ? 'Mindestens 1 Spieler muss beitreten.'
                : '🔊 Lautsprecher an! Der Klick auf „Start“ schaltet die Musik im Browser frei.'}
            </span>
          </div>
        </div>
      </section>
    </main>
  )
}
