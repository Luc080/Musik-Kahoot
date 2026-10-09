import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Logo from '../components/Logo'
import ErrorBanner from '../components/ErrorBanner'
import { ensureSession, errorMessage, getClient } from '../lib/supabase'
import { api } from '../lib/api'

export default function Home() {
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function createRoom() {
    setBusy(true)
    setError(null)
    try {
      const client = getClient('host')
      await ensureSession(client)
      const room = await api.createRoom(client)
      navigate(`/host/${room.id}`)
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-10 px-6 py-10 text-center">
      <div className="animate-float">
        <Logo size="lg" />
      </div>
      <p className="text-xl text-white/70">
        Das Musik-Quiz für eure Party. <br />
        Song hören, schnell tippen, gewinnen! 🎶
      </p>

      <div className="flex w-full flex-col gap-4">
        <button className="btn-primary py-6 text-2xl" onClick={() => navigate('/join')}>
          📱 Mitspielen
        </button>
        <button className="btn-secondary py-5 text-xl" onClick={createRoom} disabled={busy}>
          {busy ? 'Raum wird erstellt…' : '📺 Spiel hosten'}
        </button>
      </div>

      <ErrorBanner message={error} onClose={() => setError(null)} />

      <p className="text-sm text-white/40">
        Hosten am besten auf Laptop oder TV – dort läuft die Musik. Alle anderen spielen am Handy.
      </p>
    </main>
  )
}
