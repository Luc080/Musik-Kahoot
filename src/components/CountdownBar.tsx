import { useServerNow } from '../hooks/useNow'

interface Props {
  endsAt: string | null
  durationMs: number
  big?: boolean
}

/** Countdown-Balken auf Basis der Serverzeit */
export default function CountdownBar({ endsAt, durationMs, big = false }: Props) {
  const now = useServerNow(100, Boolean(endsAt))
  const end = endsAt ? new Date(endsAt).getTime() : now
  const remaining = Math.max(0, end - now)
  const pct = Math.min(100, (remaining / durationMs) * 100)
  const seconds = Math.ceil(remaining / 1000)
  const urgent = remaining < 5000

  const color = urgent
    ? 'from-neon-red to-neon-pink'
    : pct < 50
      ? 'from-neon-yellow to-neon-pink'
      : 'from-neon-cyan to-neon-green'

  return (
    <div className="flex w-full items-center gap-3">
      <div className={`relative flex-1 overflow-hidden rounded-full bg-white/10 ${big ? 'h-6' : 'h-4'}`}>
        <div
          className={`h-full rounded-full bg-gradient-to-r ${color} transition-[width] duration-100 ease-linear`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span
        className={`w-14 text-right font-bold tabular-nums ${big ? 'text-4xl' : 'text-2xl'} ${
          urgent ? 'animate-pulse text-neon-red' : 'text-white'
        }`}
      >
        {seconds}
      </span>
    </div>
  )
}
