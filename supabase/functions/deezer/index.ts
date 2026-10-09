// Supabase Edge Function: Deezer-Proxy
// ---------------------------------------------------------------
// Die Deezer API sendet keine CORS-Header, Browser dürfen sie also
// nicht direkt aufrufen. Diese Funktion leitet erlaubte Anfragen
// weiter und hängt die CORS-Header an.
//
// Aufruf (vom Frontend über supabase.functions.invoke):
//   POST { "path": "chart/0/tracks", "params": { "limit": 100 } }
//
// Deploy:  supabase functions deploy deezer
// ---------------------------------------------------------------

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

// Nur diese Deezer-Endpunkte sind erlaubt (kein offener Proxy!).
const ALLOWED_PATHS: RegExp[] = [
  /^chart\/\d+\/tracks$/, // Charts (0 = global, sonst Genre-ID)
  /^playlist\/\d+\/tracks$/, // Songs einer Playlist
  /^search$/, // Song-Suche
  /^search\/playlist$/, // Playlist-Suche
  /^track\/\d+$/, // einzelner Song (frische Vorschau-URL)
]

const ALLOWED_PARAMS = ['q', 'limit', 'index', 'strict', 'order']

function json(body: unknown, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', ...extra },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    let path = ''
    let params: Record<string, unknown> = {}

    if (req.method === 'GET') {
      const url = new URL(req.url)
      path = url.searchParams.get('path') ?? ''
      url.searchParams.forEach((value, key) => {
        if (key !== 'path') params[key] = value
      })
    } else {
      const body = await req.json().catch(() => ({}))
      path = String(body?.path ?? '')
      params = typeof body?.params === 'object' && body.params ? body.params : {}
    }

    path = path.replace(/^\/+/, '').replace(/\/+$/, '')
    if (!ALLOWED_PATHS.some((re) => re.test(path))) {
      return json({ error: { message: `Pfad nicht erlaubt: ${path}` } }, 400)
    }

    const target = new URL(`https://api.deezer.com/${path}`)
    for (const [key, value] of Object.entries(params)) {
      if (ALLOWED_PARAMS.includes(key) && value !== undefined && value !== null) {
        target.searchParams.set(key, String(value).slice(0, 200))
      }
    }

    const res = await fetch(target, { headers: { Accept: 'application/json' } })
    if (!res.ok) {
      return json({ error: { message: `Deezer antwortet mit ${res.status}` } }, 502)
    }
    const data = await res.json()

    // Deezer meldet Fehler (z.B. Quota) mit Status 200 und einem error-Objekt.
    if (data?.error) {
      return json({ error: data.error }, 502)
    }

    // Kurzes Caching – Track-Abfragen bewusst nicht, weil Vorschau-URLs ablaufen.
    const cache = path.startsWith('track/') ? 'no-store' : 'public, max-age=120'
    return json(data, 200, { 'Cache-Control': cache })
  } catch (err) {
    return json({ error: { message: err instanceof Error ? err.message : String(err) } }, 500)
  }
})
