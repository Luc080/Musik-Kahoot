import type { SupabaseClient } from '@supabase/supabase-js'
import type { Category, TrackSource } from '../config/categories'
import type { Track } from './types'

interface DeezerTrack {
  id: number
  title: string
  title_short?: string
  readable?: boolean
  preview?: string
  artist?: { name: string }
  album?: { cover_medium?: string; cover_big?: string; cover_xl?: string }
}

interface DeezerList<T> {
  data?: T[]
}

/** Alle Deezer-Aufrufe laufen über die Edge Function "deezer" (CORS-Proxy). */
async function deezer<T>(client: SupabaseClient, path: string, params: Record<string, string | number> = {}): Promise<T> {
  const { data, error } = await client.functions.invoke('deezer', { body: { path, params } })
  if (error) throw new Error(`Deezer-Proxy: ${error.message}`)
  if (data?.error) throw new Error(`Deezer: ${data.error.message ?? 'Fehler'}`)
  return data as T
}

function toTrack(t: DeezerTrack): Track | null {
  if (!t || !t.id || !t.preview || t.readable === false || !t.artist?.name) return null
  return {
    id: t.id,
    title: (t.title_short || t.title || '').trim(),
    artist: t.artist.name.trim(),
    cover: t.album?.cover_xl || t.album?.cover_big || t.album?.cover_medium || null,
    preview: t.preview,
  }
}

async function tracksFromSource(client: SupabaseClient, source: TrackSource): Promise<DeezerTrack[]> {
  switch (source.type) {
    case 'chart': {
      const res = await deezer<DeezerList<DeezerTrack>>(client, `chart/${source.genreId}/tracks`, { limit: 100 })
      return res.data ?? []
    }
    case 'playlist': {
      const res = await deezer<DeezerList<DeezerTrack>>(client, `playlist/${source.id}/tracks`, { limit: 200 })
      return res.data ?? []
    }
    case 'search': {
      const res = await deezer<DeezerList<DeezerTrack>>(client, 'search', { q: source.query, limit: 100 })
      return res.data ?? []
    }
    case 'playlistSearch': {
      const found = await deezer<DeezerList<{ id: number; nb_tracks?: number }>>(client, 'search/playlist', {
        q: source.query,
        limit: 10,
      })
      const lists = (found.data ?? []).filter((p) => (p.nb_tracks ?? 0) >= 20).slice(0, source.take ?? 1)
      const results = await Promise.all(
        lists.map((p) =>
          deezer<DeezerList<DeezerTrack>>(client, `playlist/${p.id}/tracks`, { limit: 200 })
            .then((r) => r.data ?? [])
            .catch(() => [] as DeezerTrack[]),
        ),
      )
      return results.flat()
    }
  }
}

/** Normalisiert Titel/Interpret, um Duplikate (Remaster, feat. …) zu erkennen. */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\(.*?\)|\[.*?\]/g, '')
    .replace(/ - .*$/, '')
    .replace(/feat\..*$|ft\..*$/, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export function trackKey(t: { title: string; artist: string }): string {
  return `${normalize(t.title)}|${normalize(t.artist)}`
}

/** Lädt alle Songs einer Kategorie – nur mit Vorschau, ohne Duplikate. */
export async function loadCategoryTracks(client: SupabaseClient, category: Category): Promise<Track[]> {
  const settled = await Promise.allSettled(category.sources.map((s) => tracksFromSource(client, s)))
  const errors: string[] = []
  const seenIds = new Set<number>()
  const seenKeys = new Set<string>()
  const pool: Track[] = []

  for (const result of settled) {
    if (result.status === 'rejected') {
      errors.push(result.reason instanceof Error ? result.reason.message : String(result.reason))
      continue
    }
    for (const raw of result.value) {
      const track = toTrack(raw)
      if (!track || !track.title) continue
      const key = trackKey(track)
      if (seenIds.has(track.id) || seenKeys.has(key)) continue
      seenIds.add(track.id)
      seenKeys.add(key)
      pool.push(track)
    }
  }

  if (pool.length === 0 && errors.length > 0) {
    throw new Error(`Songs konnten nicht geladen werden: ${errors[0]}`)
  }
  return pool
}

/**
 * Deezer-Vorschau-URLs sind signiert und laufen nach einiger Zeit ab.
 * Darum holt der Host kurz vor jeder Runde eine frische URL.
 */
export async function fetchFreshTrack(client: SupabaseClient, trackId: number): Promise<Track | null> {
  const raw = await deezer<DeezerTrack>(client, `track/${trackId}`)
  return toTrack(raw)
}
