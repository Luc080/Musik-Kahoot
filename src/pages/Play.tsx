import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { errorMessage, getClient } from '../lib/supabase'
import { api } from '../lib/api'
import { syncServerTime } from '../lib/time'
import { burst, celebrate } from '../lib/confetti'
import { placeOf } from '../lib/game'
import { useRoomData } from '../hooks/useRoomData'
import { useWakeLock } from '../hooks/useWakeLock'
import ErrorBanner from '../components/ErrorBanner'
import Logo from '../components/Logo'
import PlayerQuestion from '../components/player/PlayerQuestion'
import PlayerReveal from '../components/player/PlayerReveal'
import Podium from '../components/Podium'

function lastCode(): string {
  try {
    return localStorage.getItem('musikquiz-code') ?? ''
  } catch {
    return ''
  }
}

export default function Play() {
  const { roomId } = useParams()
  const navigate = useNavigate()
  const client = useMemo(() => getClient('player'), [])
  const [userId, setUserId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState<{ roundId: string; choice: number } | null>(null)
  const effectsFor = useRef<string | null>(null)

  useWakeLock()

  const goJoin = () => {
    const code = lastCode()
    navigate(code ? `/join?code=${code}` : '/join', { replace: true })
  }

  // Sitzung laden – ohne Sitzung zurück zum Beitreten (Nickname eingeben = Wiedereinstieg)
  useEffect(() => {
    client.auth.getSession().then(async ({ data }) => {
      if (!data.session) {
        goJoin()
        return
      }
      client.realtime.setAuth(data.session.access_token)
      await syncServerTime(client)
      setUserId(data.session.user.id)
    })
  }, [client])

  const data = useRoomData(client, roomId, userId)
  const { room, players, round, answers } = data
  const me = players.find((p) => p.user_id === userId) ?? null
  const myAnswer = answers.find((a) => a.player_id === me?.id) ?? null

  async function answer(choice: number) {
    if (!round || pending?.roundId === round.id || myAnswer) return
    setPending({ roundId: round.id, choice })
    navigator.vibrate?.(30)
    try {
      await api.submitAnswer(client, round.id, choice)
      await data.reload()
    } catch (err) {
      setPending(null)
      setError(errorMessage(err))
    }
  }

  // Effekte bei der Auflösung (einmal pro Runde)
  useEffect(() => {
    if (room?.phase === 'reveal' && round?.revealed_at && myAnswer && effectsFor.current !== round.id) {
      if (myAnswer.is_correct === null) return
      effectsFor.current = round.id
      if (myAnswer.is_correct) {
        burst()
        navigator.vibrate?.([40, 60, 40])
      } else {
        navigator.vibrate?.(250)
      }
    }
    if (room?.phase === 'finished' && effectsFor.current !== 'finished') {
      effectsFor.current = 'finished'
      if (me && placeOf(players, me.id) <= 3) celebrate(3500)
    }
    if (room?.phase === 'lobby') effectsFor.current = null
  }, [room?.phase, round, myAnswer, me, players])

  let content: ReactNode

  if (!userId || data.loading) {
    content = <Center>Verbinde…</Center>
  } else if (data.missing || !room || !me) {
    content = (
      <Center>
        <p className="text-5xl">👋</p>
        <p>Du bist nicht (mehr) in diesem Raum.</p>
        <button className="btn-primary mt-4 w-full" onClick={goJoin}>
          Wieder beitreten
        </button>
      </Center>
    )
  } else if (room.phase === 'closed') {
    content = (
      <Center>
        <p className="text-5xl">🎉</p>
        <p>Der Host hat den Raum geschlossen. Danke fürs Mitspielen!</p>
        <button className="btn-primary mt-4 w-full" onClick={() => navigate('/')}>
          Zur Startseite
        </button>
      </Center>
    )
  } else if (room.phase === 'lobby') {
    content = (
      <Center>
        <p className="animate-float text-7xl">🎧</p>
        <p className="text-3xl font-bold">Du bist drin, {me.nickname}!</p>
        <p className="text-white/60">Schau auf den grossen Bildschirm – gleich geht's los.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {players.map((p) => (
            <span
              key={p.id}
              className={`animate-pop rounded-full px-3 py-1 text-base ${
                p.id === me.id ? 'bg-neon-cyan text-night-950' : 'bg-white/10'
              }`}
            >
              {p.nickname}
            </span>
          ))}
        </div>
      </Center>
    )
  } else if (room.phase === 'loading' || (room.phase === 'question' && !round)) {
    content = (
      <Center>
        <p className="animate-spin-slow text-7xl">💿</p>
        <p className="text-2xl font-semibold">Gleich geht's los…</p>
        {room.category_name && <p className="text-white/60">Kategorie: {room.category_name}</p>}
      </Center>
    )
  } else if (room.phase === 'question' && round) {
    content = (
      <PlayerQuestion
        key={round.id}
        room={room}
        round={round}
        myAnswer={myAnswer}
        pendingChoice={pending?.roundId === round.id ? pending.choice : null}
        onAnswer={answer}
      />
    )
  } else if (room.phase === 'reveal' && round) {
    content = <PlayerReveal room={room} round={round} me={me} players={players} myAnswer={myAnswer} />
  } else if (room.phase === 'finished') {
    const place = placeOf(players, me.id)
    content = (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center gap-6 px-4 py-8 text-center">
        <h1 className="neon-text text-4xl font-bold">Spiel vorbei!</h1>
        <div className="animate-bounce-in">
          <p className="text-7xl">{place === 1 ? '🏆' : place <= 3 ? '🎉' : '🎶'}</p>
          <p className="mt-2 text-3xl font-bold">Platz {place}</p>
          <p className="text-xl text-neon-yellow">{me.score.toLocaleString('de-CH')} Punkte</p>
        </div>
        <Podium players={players} />
        <p className="text-white/50">Warte auf den Host für eine neue Runde…</p>
      </main>
    )
  } else {
    content = <Center>Lade…</Center>
  }

  return (
    <div className="min-h-dvh">
      {me && room && room.phase !== 'finished' && (
        <div className="sticky top-0 z-30 flex items-center justify-between bg-night-950/80 px-4 py-2 text-sm backdrop-blur">
          <span className="font-semibold">{me.nickname}</span>
          <span className="text-white/50">
            Raum {room.code}
            {!data.connected && <span className="ml-2 text-neon-red">● offline</span>}
          </span>
          <span className="font-bold text-neon-yellow">{me.score.toLocaleString('de-CH')} P</span>
        </div>
      )}
      {error && (
        <div className="fixed inset-x-0 bottom-4 z-50 px-4">
          <ErrorBanner message={error} onClose={() => setError(null)} />
        </div>
      )}
      {content}
    </div>
  )
}

function Center({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-[calc(100dvh-40px)] max-w-md flex-col items-center justify-center gap-3 px-6 text-center text-xl">
      <div className="mb-4">
        <Logo size="sm" />
      </div>
      {children}
    </main>
  )
}
