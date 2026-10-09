// ---------------------------------------------------------------
// Kategorien – hier kannst du ganz einfach neue hinzufügen.
//
// Jede Kategorie hat eine oder mehrere Quellen (sources). Die Songs
// aller Quellen werden zusammengeworfen, Duplikate und Songs ohne
// Vorschau werden automatisch aussortiert. Fällt eine Quelle aus
// (z.B. Playlist gelöscht), werden die anderen trotzdem verwendet.
//
// Quellen-Typen:
//   { type: 'chart', genreId: 0 }            Deezer-Charts (0 = weltweit, 116 = Rap/Hip-Hop,
//                                            132 = Pop, 152 = Rock, 113 = Dance, 106 = Electro)
//   { type: 'playlist', id: 1234567 }        feste Deezer-Playlist (ID aus der URL
//                                            https://www.deezer.com/playlist/1234567)
//   { type: 'playlistSearch', query: '…' }   sucht Playlists und nimmt die besten Treffer
//                                            (take = wie viele, Standard 1)
//   { type: 'search', query: '…' }           normale Song-Suche, z.B. 'artist:"Bligg"'
// ---------------------------------------------------------------

export type TrackSource =
  | { type: 'chart'; genreId: number }
  | { type: 'playlist'; id: number }
  | { type: 'playlistSearch'; query: string; take?: number }
  | { type: 'search'; query: string }

export interface Category {
  id: string
  name: string
  emoji: string
  description: string
  /** Tailwind-Klassen für den Farbverlauf der Kachel */
  gradient: string
  sources: TrackSource[]
}

export const CATEGORIES: Category[] = [
  {
    id: 'aktuelle-hits',
    name: 'Aktuelle Hits',
    emoji: '🔥',
    description: 'Was gerade weltweit läuft',
    gradient: 'from-pink-500 to-orange-400',
    sources: [
      { type: 'chart', genreId: 0 },
      { type: 'playlistSearch', query: 'Top Worldwide', take: 1 },
    ],
  },
  {
    id: 'schweizer-charts',
    name: 'Schweizer Charts',
    emoji: '🇨🇭',
    description: 'Die Top-Songs der Schweiz',
    gradient: 'from-red-500 to-rose-400',
    sources: [
      { type: 'playlistSearch', query: 'Top Switzerland', take: 1 },
      { type: 'playlistSearch', query: 'Schweizer Hits', take: 1 },
    ],
  },
  {
    id: '2000er',
    name: '2000er',
    emoji: '💿',
    description: 'Die grössten Hits der Nullerjahre',
    gradient: 'from-violet-500 to-fuchsia-400',
    sources: [
      { type: 'playlistSearch', query: '2000er Hits', take: 2 },
      { type: 'playlistSearch', query: '2000s hits', take: 1 },
    ],
  },
  {
    id: '90er',
    name: '90er',
    emoji: '📼',
    description: 'Eurodance, Boybands & Grunge',
    gradient: 'from-cyan-400 to-blue-500',
    sources: [
      { type: 'playlistSearch', query: '90er Hits', take: 2 },
      { type: 'playlistSearch', query: '90s hits', take: 1 },
    ],
  },
  {
    id: 'rap-hiphop',
    name: 'Rap/Hip-Hop',
    emoji: '🎤',
    description: 'Von Old School bis Deutschrap',
    gradient: 'from-amber-400 to-yellow-300',
    sources: [
      { type: 'chart', genreId: 116 },
      { type: 'playlistSearch', query: 'Rap Hits', take: 1 },
      { type: 'playlistSearch', query: 'Hip Hop Classics', take: 1 },
    ],
  },
  {
    id: 'partyhits',
    name: 'Partyhits',
    emoji: '🪩',
    description: 'Mitsingen garantiert',
    gradient: 'from-lime-400 to-emerald-500',
    sources: [
      { type: 'playlistSearch', query: 'Partyhits', take: 2 },
      { type: 'playlistSearch', query: 'Party Hits', take: 1 },
    ],
  },
]

// ---------------------------------------------------------------
// Spiel-Einstellungen
// ---------------------------------------------------------------
export const GAME_SETTINGS = {
  /** Auswahl der Rundenanzahl in der Lobby */
  roundOptions: [5, 10, 15] as const,
  defaultRounds: 10,
  /** Antwortzeit pro Runde in Sekunden (max. 30 = Länge der Vorschau) */
  answerSeconds: 20,
  /** Nach so vielen Sekunden geht's nach der Auflösung automatisch weiter */
  revealSeconds: 12,
}
