export default function ErrorBanner({ message, onClose }: { message: string | null; onClose?: () => void }) {
  if (!message) return null
  return (
    <div className="animate-slide-up flex items-start gap-3 rounded-2xl border border-neon-red/50 bg-neon-red/15 px-4 py-3 text-neon-red">
      <span className="text-xl">⚠️</span>
      <p className="flex-1 text-base text-white">{message}</p>
      {onClose && (
        <button onClick={onClose} className="text-white/60 hover:text-white" aria-label="Schliessen">
          ✕
        </button>
      )}
    </div>
  )
}
