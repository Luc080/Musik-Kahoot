/** Animierte Equalizer-Balken, solange Musik läuft */
export default function Equalizer({ playing = true, bars = 24 }: { playing?: boolean; bars?: number }) {
  return (
    <div className="flex h-24 items-end justify-center gap-1.5" aria-hidden>
      {Array.from({ length: bars }).map((_, i) => (
        <span
          key={i}
          className="w-2.5 origin-bottom rounded-full bg-gradient-to-t from-neon-pink to-neon-cyan md:w-3"
          style={{
            height: '100%',
            animation: playing ? `eq 0.${5 + (i % 5)}s ease-in-out ${(i * 73) % 400}ms infinite alternate` : 'none',
            transform: playing ? undefined : 'scaleY(0.15)',
          }}
        />
      ))}
      <style>{`@keyframes eq { 0% { transform: scaleY(0.12) } 100% { transform: scaleY(1) } }`}</style>
    </div>
  )
}
