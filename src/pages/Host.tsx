import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ensureSession, errorMessage, getClient } from '../lib/supabase'
import { api } from '../lib/api'
import { syncServerTime, serverNow } from '../lib/time'
import { fetchFreshTrack, loadCategoryTracks } from '../lib/deezer'
import { buildRounds } from '../lib/game'
import { fadeOut, loadAudio, unlockAudio } from '../lib/audio'
import { celebrate } from '../lib/confetti'
import type { RoundSecret } from '../lib/types'
import { CATEGORIES, GAME_SETTINGS } from '../config/categories'
import { useRoomData } from '../hooks/useRoomData'
import { useServerNow } from '../hooks/useNow'
import { useWakeLock } from '../hooks/useWakeLock'
import ErrorBanner from '../components/ErrorBanner'
import HostLobby from '../components/host/HostLobby'
import HostQuestion from '../components/host/HostQuestion'
import HostReveal from '../components/host/HostReveal'
import HostFinished from '../components/host/HostFinished'
import Logo from '../components/Logo'

export default function Host() {
  const { roomId } = useParams()
  const navigate = useNavigate()
  const client = useMemo(() => getClient('host'), [])
  const [userId, setUserId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)

  const [categoryId, setCategoryId] = useState(CATEGORIES[0].id)
  const [roundCount, setRoundCount] = useState<number>(GAME_SETTINGS.defaultRounds)
  const [autoAdvance, setAutoAdvance] = useState(true)

  const audioRef = useRef<HTMLAudioElement>(null)
  const revealedFor = useRef<string | null>(null)
  const advancing = useRef(false)
  const celebrated = useRef(false)

  useWakeLock()

  useEffect(() => {
    ensureSession(client)
      .then(async (uid) => {
        await syncServerTime(client)
        setUserId(uid)
      })
      .catch((err) => setError(errorMessage(err)))
  }, [client])

  const data = useRoomData(client, roomId, userId)
  const { room, players, round, answers, reload } = data
  const phase = room?.phase
  const now = useServerNow(250, phase === 'question' || phase === 'reveal')

  // ------------------------------------------------------------------
  // Runde vorbereiten & starten
  // ------------------------------------------------------------------
  const playRound = useCallback(
    async (n: number) => {
      if (!roomId || !audioRef.current) return
      const audio = audioRef.current
      setBusy(`Runde ${n} wird vorbereitet…`)
      setError(null)
      try {
        const { data: secret, error: secretError } = await client
          .from('round_secrets')
          .select('*')
          .eq('room_id', roomId)
          .eq('round_number', n)
          .single<RoundSecret>()
        if (secretError || !secret) throw new Error(`Runde ${n} wurde nicht gefunden`)

        // Frische Vorschau-URL holen (die alten laufen nach einiger Zeit ab)
        let url = secret.preview_url
        try {
          const fresh = await fetchFreshTrack(client, secret.track_id)
          if (fresh?.preview) url = fresh.preview
        } catch {
          /* gespeicherte URL verwenden */
        }

        await fadeOut(audio, 400)
        try {
          await loadAudio(audio, url)
        } catch {
          setError('Der Song konnte nicht geladen werden. Du kannst die Runde mit „Jetzt auflösen“ überspringen.')
        }

        await api.startRound(client, roomId, n)
        audio.currentTime = 0
        audio.play().catch(() => {
          /* Autoplay blockiert → Button "Musik abspielen" wird angezeigt */
        })
        await reload()
      } catch (err) {
        setError(errorMessage(err))
      } finally {
        setBusy(null)
      }
    },
    [client, roomId, reload],
  )

  async function startGame() {
    if (!roomId) return
    unlockAudio(audioRef.current) // muss vor dem ersten await passieren!
    const category = CATEGORIES.find((c) => c.id === categoryId) ?? CATEGORIES[0]
    setBusy(`Songs für „${category.name}“ werden geladen…`)
    setError(null)
    try {
      const pool = await loadCategoryTracks(client, category)
      const rounds = buildRounds(pool, roundCount)
      await api.startGame(client, roomId, category.id, category.name, GAME_SETTINGS.answerSeconds * 1000, rounds)
      celebrated.current = false
      revealedFor.current = null
      await playRound(1)
    } catch (err) {
      setError(errorMessage(err))
      setBusy(null)
    }
  }

  // ------------------------------------------------------------------
  // Auflösen (automatisch, wenn Zeit um oder alle geantwortet haben)
  // ------------------------------------------------------------------
  const reveal = useCallback(async () => {
    if (!roomId || !round || revealedFor.current === round.id) return
    revealedFor.current = round.id
    try {
      await api.revealRound(client, roomId)
      await reload()
    } catch (err) {
      revealedFor.current = null
      setError(errorMessage(err))
    }
  }, [client, roomId, round, reload])

  const endsAt = round?.ends_at ? new Date(round.ends_at).getTime() : null
  const allAnswered = players.length > 0 && answers.length >= players.length
  // +800 ms: Antworten, die kurz vor Schluss abgeschickt wurden, kommen noch an
  const timeUp = endsAt !== null && now >= endsAt + 800

  useEffect(() => {
    if (phase === 'question' && round && !round.revealed_at && (timeUp || allAnswered)) {
      reveal()
    }
  }, [phase, round, timeUp, allAnswered, reveal])

  // ------------------------------------------------------------------
  // Weiter zur nächsten Runde / Siegerehrung
  // ------------------------------------------------------------------
  const next = useCallback(async () => {
    if (!room || advancing.current) return
    advancing.current = true
    try {
      if (room.current_round >= room.total_rounds) {
        await api.finishGame(client, room.id)
        await reload()
      } else {
        await playRound(room.current_round + 1)
      }
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      advancing.current = false
    }
  }, [client, room, playRound, reload])

  const revealedAt = round?.revealed_at ? new Date(round.revealed_at).getTime() : null
  const advanceAt = revealedAt ? revealedAt + GAME_SETTINGS.revealSeconds * 1000 : null

  useEffect(() => {
    if (phase === 'reveal' && autoAdvance && advanceAt && now >= advanceAt && !busy) next()
  }, [phase, autoAdvance, advanceAt, now, busy, next])

  // Siegerehrung: Konfetti + Musik ausblenden
  useEffect(() => {
    if (phase === 'finished' && !celebrated.current) {
      celebrated.current = true
      fadeOut(audioRef.current, 2500)
      celebrate(5000)
    }
    if (phase === 'lobby') celebrated.current = false
  }, [phase])

  async function playAgain() {
    if (!roomId) return
    try {
      await fadeOut(audioRef.current, 300)
      await api.resetRoom(client, roomId)
      revealedFor.current = null
      await reload()
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  async function closeRoom() {
    if (!roomId) return
    if (!window.confirm('Raum wirklich schliessen? Alle Spieler fliegen raus.')) return
    try {
      await api.closeRoom(client, roomId)
    } catch {
      /* egal */
    }
    navigate('/')
  }

  async function kick(playerId: string) {
    try {
      await api.kickPlayer(client, playerId)
      await reload()
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  /** Nach einem Reload des Host-Tabs: Musik der laufenden Runde fortsetzen */
  async function resumeAudio() {
    const audio = audioRef.current
    if (!audio || !round?.started_at || !roomId) return
    try {
      if (!audio.src || audio.src.startsWith('data:')) {
        const { data: secret } = await client
          .from('round_secrets')
          .select('*')
          .eq('round_id', round.id)
          .single<RoundSecret>()
        if (!secret) return
        const fresh = await fetchFreshTrack(client, secret.track_id).catch(() => null)
        await loadAudio(audio, fresh?.preview ?? secret.preview_url)
      }
      const elapsed = (serverNow() - new Date(round.started_at).getTime()) / 1000
      if (elapsed < 29) audio.currentTime = Math.max(0, elapsed)
      await audio.play()
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------
  let content: ReactNode = null

  if (!userId || data.loading) {
    content = <Centered>Verbinde…</Centered>
  } else if (data.missing || !room || room.host_id !== userId) {
    content = (
      <Centered>
        <p>Dieser Raum existiert nicht (mehr) oder du bist nicht der Host.</p>
        <button className="btn-primary mt-6" onClick={() => navigate('/')}>
          Zur Startseite
        </button>
      </Centered>
    )
  } else if (room.phase === 'closed') {
    content = (
      <Centered>
        <p>Der Raum wurde geschlossen.</p>
        <button className="btn-primary mt-6" onClick={() => navigate('/')}>
          Neues Spiel
        </button>
      </Centered>
    )
  } else if (room.phase === 'lobby') {
    content = (
      <HostLobby
        room={room}
        players={players}
        categoryId={categoryId}
        onCategory={setCategoryId}
        roundCount={roundCount}
        onRoundCount={setRoundCount}
        onStart={startGame}
        onKick={kick}
        onClose={closeRoom}
        busy={Boolean(busy)}
      />
    )
  } else if (room.phase === 'loading') {
    content = (
      <Centered>
        <p className="text-3xl">Die Songs sind gemischt 🎶</p>
        {!busy && (
          <button
            className="btn-primary mt-8 text-2xl"
            onClick={() => {
              unlockAudio(audioRef.current)
              playRound(1)
            }}
          >
            ▶ Runde 1 starten
          </button>
        )}
      </Centered>
    )
  } else if (room.phase === 'question' && round) {
    content = (
      <HostQuestion
        room={room}
        round={round}
        players={players}
        answers={answers}
        isPlaying={isPlaying}
        onResumeAudio={resumeAudio}
        onRevealNow={reveal}
      />
    )
  } else if (room.phase === 'reveal' && round) {
    content = (
      <HostReveal
        room={room}
        round={round}
        players={players}
        answers={answers}
        now={now}
        advanceAt={advanceAt}
        autoAdvance={autoAdvance}
        onToggleAuto={() => setAutoAdvance((v) => !v)}
        onNext={next}
        busy={Boolean(busy)}
      />
    )
  } else if (room.phase === 'finished') {
    content = <HostFinished players={players} onPlayAgain={playAgain} onHome={closeRoom} />
  } else {
    content = <Centered>Lade…</Centered>
  }

  return (
    <div className="min-h-dvh">
      {/* Das einzige Gerät, das Musik abspielt */}
      <audio
        ref={audioRef}
        preload="auto"
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
      />

      {error && (
        <div className="fixed inset-x-0 top-4 z-50 mx-auto max-w-2xl px-4">
          <ErrorBanner message={error} onClose={() => setError(null)} />
        </div>
      )}

      {!data.connected && userId && !data.loading && (
        <div className="fixed right-4 bottom-4 z-40 rounded-full bg-neon-red/20 px-4 py-2 text-sm text-neon-red">
          ● Verbindung wird wiederhergestellt…
        </div>
      )}

      {content}

      {busy && (
        <div className="fixed inset-0 z-40 flex flex-col items-center justify-center gap-6 bg-night-950/85 backdrop-blur">
          <div className="animate-spin-slow text-7xl">💿</div>
          <p className="animate-pulse text-3xl font-semibold">{busy}</p>
        </div>
      )}
    </div>
  )
}

function Centered({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 p-8 text-center text-2xl">
      <Logo size="md" />
      <div className="flex flex-col items-center">{children}</div>
    </main>
  )
}
