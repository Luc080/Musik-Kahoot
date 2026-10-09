import { useEffect, useState } from 'react'
import { serverNow } from '../lib/time'

/** Liefert die aktuelle Serverzeit und aktualisiert sie regelmässig. */
export function useServerNow(intervalMs = 200, active = true): number {
  const [now, setNow] = useState(serverNow)
  useEffect(() => {
    if (!active) return
    const id = window.setInterval(() => setNow(serverNow()), intervalMs)
    return () => window.clearInterval(id)
  }, [intervalMs, active])
  return now
}
