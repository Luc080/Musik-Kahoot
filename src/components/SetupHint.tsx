export default function SetupHint() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-4 p-6">
      <h1 className="neon-text text-4xl font-bold">Fast geschafft!</h1>
      <div className="card space-y-3 text-white/80">
        <p>Die App kennt deine Supabase-Zugangsdaten noch nicht.</p>
        <ol className="list-decimal space-y-2 pl-5">
          <li>
            Kopiere <code className="text-neon-cyan">.env.example</code> nach{' '}
            <code className="text-neon-cyan">.env</code>.
          </li>
          <li>
            Trage <code className="text-neon-cyan">VITE_SUPABASE_URL</code> und{' '}
            <code className="text-neon-cyan">VITE_SUPABASE_ANON_KEY</code> ein (Supabase → Project Settings → API).
          </li>
          <li>Starte den Dev-Server neu (bzw. setze die Variablen bei Vercel/Netlify und deploye neu).</li>
        </ol>
      </div>
    </main>
  )
}
