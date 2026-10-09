import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const isConfigured = Boolean(url && key)

export type Role = 'host' | 'player'

const clients: Partial<Record<Role, SupabaseClient>> = {}

/**
 * Host und Spieler bekommen getrennte Supabase-Clients mit eigener,
 * anonymer Identität:
 *  - Host: localStorage → bleibt auch nach Schliessen des Tabs Host.
 *  - Spieler: sessionStorage → jeder Tab ist ein eigener Spieler (ideal
 *    zum Testen mit mehreren Fenstern). Geht die Sitzung verloren, kann
 *    man mit demselben Nickname wieder einsteigen.
 */
export function getClient(role: Role): SupabaseClient {
  if (!isConfigured) {
    throw new Error('Supabase ist nicht konfiguriert (.env fehlt)')
  }
  if (!clients[role]) {
    clients[role] = createClient(url!, key!, {
      auth: {
        storageKey: `musikquiz-${role}`,
        storage: role === 'host' ? window.localStorage : window.sessionStorage,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
      realtime: { params: { eventsPerSecond: 20 } },
    })
  }
  return clients[role]!
}

/** Stellt sicher, dass eine (anonyme) Sitzung existiert, und gibt die User-ID zurück. */
export async function ensureSession(client: SupabaseClient): Promise<string> {
  const { data } = await client.auth.getSession()
  if (data.session) {
    client.realtime.setAuth(data.session.access_token)
    return data.session.user.id
  }
  const { data: signIn, error } = await client.auth.signInAnonymously()
  if (error || !signIn.session) {
    throw new Error(
      'Anonyme Anmeldung fehlgeschlagen. Ist „Anonymous Sign-Ins“ in Supabase aktiviert? ' +
        (error?.message ?? ''),
    )
  }
  client.realtime.setAuth(signIn.session.access_token)
  return signIn.session.user.id
}

/** Macht aus Supabase-Fehlern eine lesbare deutsche Meldung. */
export function errorMessage(err: unknown): string {
  if (!err) return 'Unbekannter Fehler'
  if (typeof err === 'string') return err
  if (err instanceof Error) return err.message
  if (typeof err === 'object' && 'message' in err) return String((err as { message: unknown }).message)
  return 'Unbekannter Fehler'
}
