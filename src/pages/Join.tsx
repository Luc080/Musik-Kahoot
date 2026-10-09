import { useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import Logo from '../components/Logo'
import ErrorBanner from '../components/ErrorBanner'
import { ensureSession, errorMessage, getClient } from '../lib/supabase'
import { api } from '../lib/api'

const NICK_KEY = 'musikquiz-nickname'

function readNick(): string {
  try {
    return localStorage.getItem(NICK_KEY) ?? ''
  } catch {
    return ''
  }
}

export default function Join() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [code, setCode] = useState((params.get('code') ?? '').replace(/\D/g, '').slice(0, 4))
  const [nickname, setNickname] = useState(readNick)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const valid = /^\d{4}$/.test(code) && nickname.trim().length >= 1

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!valid) return
    setBusy(true)
    setError(null)
    try {
      const client = getClient('player')
      await ensureSession(client)
      const { room_id } = await api.joinRoom(client, code, nickname.trim())
      try {
        localStorage.setItem(NICK_KEY, nickname.trim())
        localStorage.setItem('musikquiz-code', code)
      } catch {
        /* egal */
      }
      navigate(`/play/${room_id}`)
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-8 px-6 py-10">
      <button onClick={() => navigate('/')} className="self-start text-white/50 hover:text-white">
        ← Zurück
      </button>
      <div className="flex justify-center">
        <Logo />
      </div>

      <form onSubmit={submit} className="flex flex-col gap-5">
        <label className="flex flex-col gap-2">
          <span className="text-lg text-white/70">Raum-Code</span>
          <input
            className="input text-center text-5xl font-bold tracking-[0.4em]"
            inputMode="numeric"
            autoComplete="off"
            pattern="\d{4}"
            maxLength={4}
            placeholder="0000"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
            autoFocus={!code}
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-lg text-white/70">Dein Nickname</span>
          <input
            className="input text-2xl"
            maxLength={20}
            autoComplete="nickname"
            placeholder="z.B. DiscoQueen"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            autoFocus={Boolean(code)}
          />
          <span className="text-sm text-white/40">
            Verbindung verloren? Einfach mit demselben Nickname wieder beitreten – deine Punkte bleiben.
          </span>
        </label>

        <ErrorBanner message={error} onClose={() => setError(null)} />

        <button type="submit" className="btn-primary py-6 text-2xl" disabled={!valid || busy}>
          {busy ? 'Beitreten…' : "Los geht's! 🚀"}
        </button>
      </form>
    </main>
  )
}
