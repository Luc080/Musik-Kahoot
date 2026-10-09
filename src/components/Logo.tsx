export default function Logo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const text = { sm: 'text-2xl', md: 'text-4xl', lg: 'text-[2.6rem] sm:text-6xl md:text-7xl' }[size]
  return (
    <div className={`flex items-center gap-3 font-bold whitespace-nowrap ${text}`}>
      <span className="animate-glow">🎧</span>
      <span className="neon-text">Musik-Quiz</span>
    </div>
  )
}
