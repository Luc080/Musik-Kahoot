import type { RoundInput, Track } from './types'
import { normalize, trackKey } from './deezer'

/** Fisher-Yates mit kryptografischem Zufall */
export function shuffle<T>(input: readonly T[]): T[] {
  const arr = [...input]
  for (let i = arr.length - 1; i > 0; i--) {
    const buf = new Uint32Array(1)
    crypto.getRandomValues(buf)
    const j = buf[0] % (i + 1)
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

/**
 * Baut die Runden eines Spiels:
 *  - jeder richtige Song kommt nur einmal pro Spiel vor
 *  - 3 falsche Antworten aus derselben Kategorie (kein gleicher Titel)
 *  - falsche Antworten werden möglichst wenig wiederholt
 */
export function buildRounds(pool: Track[], count: number): RoundInput[] {
  if (pool.length < count + 3) {
    throw new Error(
      `Zu wenige Songs mit Vorschau in dieser Kategorie gefunden (${pool.length}). ` +
        'Wähle weniger Runden oder eine andere Kategorie.',
    )
  }

  const shuffled = shuffle(pool)
  const answers = shuffled.slice(0, count)
  const usedAsDecoy = new Map<number, number>()

  return answers.map((correct) => {
    const correctTitle = normalize(correct.title)
    const candidates = shuffle(
      pool.filter((t) => t.id !== correct.id && trackKey(t) !== trackKey(correct) && normalize(t.title) !== correctTitle),
    ).sort((a, b) => (usedAsDecoy.get(a.id) ?? 0) - (usedAsDecoy.get(b.id) ?? 0))

    const decoys: Track[] = []
    const titles = new Set([correctTitle])
    for (const c of candidates) {
      const t = normalize(c.title)
      if (titles.has(t)) continue
      titles.add(t)
      decoys.push(c)
      if (decoys.length === 3) break
    }
    if (decoys.length < 3) {
      throw new Error('Nicht genug unterschiedliche Songs für die Antwortmöglichkeiten.')
    }
    decoys.forEach((d) => usedAsDecoy.set(d.id, (usedAsDecoy.get(d.id) ?? 0) + 1))

    const options = shuffle([correct, ...decoys])
    return {
      options: options.map((o) => ({ title: o.title, artist: o.artist })),
      correct_index: options.findIndex((o) => o.id === correct.id),
      track_id: correct.id,
      title: correct.title,
      artist: correct.artist,
      cover_url: correct.cover,
      preview_url: correct.preview,
    }
  })
}

/** Rangliste: höchste Punkte zuerst, bei Gleichstand alphabetisch */
export function rankPlayers<T extends { score: number; nickname: string }>(players: T[]): T[] {
  return [...players].sort((a, b) => b.score - a.score || a.nickname.localeCompare(b.nickname, 'de'))
}

/** Platzierung mit geteilten Plätzen bei Gleichstand (1, 2, 2, 4 …) */
export function placeOf<T extends { id: string; score: number; nickname: string }>(players: T[], id: string): number {
  const ranked = rankPlayers(players)
  const me = ranked.find((p) => p.id === id)
  if (!me) return 0
  return ranked.findIndex((p) => p.score === me.score) + 1
}
