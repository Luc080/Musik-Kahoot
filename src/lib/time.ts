import type { SupabaseClient } from '@supabase/supabase-js'
import { api } from './api'

/**
 * Differenz zwischen Server- und Gerätezeit in ms.
 * Alle Countdowns rechnen mit serverNow(), damit die Uhren von
 * Host und Handys übereinstimmen – auch wenn ein Handy falsch geht.
 */
let offsetMs = 0

export async function syncServerTime(client: SupabaseClient): Promise<void> {
  try {
    let best = Infinity
    for (let i = 0; i < 3; i++) {
      const t0 = Date.now()
      const server = new Date(await api.serverTime(client)).getTime()
      const t1 = Date.now()
      const rtt = t1 - t0
      if (rtt < best) {
        best = rtt
        offsetMs = server - (t0 + t1) / 2
      }
    }
  } catch {
    offsetMs = 0
  }
}

export function serverNow(): number {
  return Date.now() + offsetMs
}
