# 🎧 Musik-Quiz – das Party-Quiz mit Songs

Ein Kahoot-artiges Musik-Quiz für Partys: Der **Host** (Laptop/TV) spielt 30-Sekunden-Vorschauen von Deezer ab,
alle **Spieler** raten am Handy, welcher Song läuft. Wer schnell und richtig tippt, gewinnt.

**Stack:** React + Vite + TypeScript + Tailwind CSS · Supabase (Postgres, Realtime, anonyme Anmeldung, Edge Functions) · Deezer API · Vercel/Netlify

---

## Inhalt

1. [Architektur](#1-architektur)
2. [Ordnerstruktur](#2-ordnerstruktur)
3. [Getroffene Entscheidungen](#3-getroffene-entscheidungen)
4. [Supabase einrichten](#4-supabase-einrichten)
5. [Lokal starten](#5-lokal-starten)
6. [Online stellen (Vercel oder Netlify)](#6-online-stellen)
7. [Allein testen mit mehreren Fenstern](#7-allein-testen-mit-mehreren-fenstern)
8. [Kategorien anpassen](#8-kategorien-anpassen)
9. [Fehlerbehebung](#9-fehlerbehebung)
10. [Ideen für Version 2](#10-ideen-für-version-2)

---

## 1. Architektur

```
 ┌──────────────────────┐        RPC (start_game, start_round,        ┌───────────────────────────┐
 │  HOST (Laptop / TV)  │ ───────  reveal_round, finish_game …) ─────▶ │        SUPABASE           │
 │  /host/:roomId       │                                              │                           │
 │  • spielt die Musik  │ ◀──────── Realtime (Spieler, Antworten) ──── │  Postgres + RLS           │
 │  • steuert den Ablauf│                                              │   rooms, players, rounds, │
 │                      │ ── functions.invoke('deezer') ─┐             │   round_secrets, answers  │
 └──────────────────────┘                                │             │                           │
                                                         ▼             │  Edge Function "deezer"   │──▶ api.deezer.com
 ┌──────────────────────┐                                              │   (CORS-Proxy)            │
 │  SPIELER (Handy)     │ ── RPC join_room / submit_answer ──────────▶ │                           │
 │  /play/:roomId       │ ◀──────── Realtime (Raum, Runde, Punkte) ─── │  Realtime                 │
 └──────────────────────┘                                              └───────────────────────────┘
```

**Ablauf einer Partie**

1. Host klickt „Spiel hosten“ → `create_room()` erzeugt einen Raum mit 4-stelligem Code. QR-Code zeigt auf `/join?code=1234`.
2. Spieler geben Code + Nickname ein → `join_room()`. Jeder ist anonym bei Supabase angemeldet (keine Registrierung).
3. Host wählt Kategorie + Runden und tippt **Start** (schaltet gleichzeitig Audio im Browser frei).
   Der Host-Browser holt über die Edge Function die Songs der Kategorie, mischt sie und schickt die Runden an `start_game()`.
   Dabei landen die Antwortmöglichkeiten in `rounds` und die **Lösung in `round_secrets`** (nur für den Host lesbar).
4. Pro Runde: Host lädt eine frische Vorschau-URL vor, ruft `start_round()` auf (Serverzeit = Startschuss) und spielt den Song.
   Die Handys bekommen per Realtime nur die 4 Optionen – ohne Lösung.
5. Spieler tippen → `submit_answer()` speichert Antwort + Server-gemessene Antwortzeit. Kein Feedback, ob richtig.
6. Zeit abgelaufen oder alle haben geantwortet → Host ruft `reveal_round()`: **Der Server** berechnet die Punkte,
   aktualisiert Serien und kopiert die Lösung (Titel, Interpret, Cover) erst jetzt in `rounds` → Handys sehen die Auflösung.
7. Nach der letzten Runde `finish_game()` → Podest + Konfetti. „Nochmal spielen“ → `reset_room()` zurück in die Lobby.

**Punkte (in `reveal_round()` auf dem Server)**

| Situation | Punkte |
|---|---|
| Richtig, sofort | 1000 |
| Richtig, in der letzten Sekunde | 500 (linear dazwischen: `1000 − 500 · Antwortzeit / Rundenzeit`) |
| Falsch / keine Antwort | 0, Serie wird zurückgesetzt |
| Serienbonus | +200 bei jeder 3. richtigen Antwort in Folge (3., 6., 9. …) |

**Sicherheit / Anti-Schummeln**

* Alle Tabellen haben **Row-Level-Security**. Browser dürfen nur *lesen* – und nur ihren eigenen Raum.
  Jede Änderung läuft über `SECURITY DEFINER`-Funktionen, die `auth.uid()` prüfen.
* Die richtige Antwort steht bis zur Auflösung nur in `round_secrets` (Policy: nur Host; nicht in der Realtime-Publikation).
  `rounds.correct_index` ist bis dahin `NULL` – im Netzwerkverkehr der Handys ist die Lösung nicht sichtbar.
* Spieler sehen eine Runde erst, wenn sie gestartet ist (keine Vorschau künftiger Optionen).
* Antwortzeit und Punkte rechnet der Server (`now()` in Postgres), nicht der Browser. Antworten nach Ablauf (+1 s Kulanz) werden abgelehnt.
  Jeder Spieler kann pro Runde nur einmal antworten.
* Die Edge Function ist kein offener Proxy: nur fünf Deezer-Endpunkte sind erlaubt.

---

## 2. Ordnerstruktur

```
├── index.html                    HTML-Einstieg (Schrift "Fredoka", Meta-Tags)
├── package.json                  Abhängigkeiten & Skripte
├── vite.config.ts                Vite + React + Tailwind
├── tsconfig.json
├── .env.example                  Vorlage für Supabase-Schlüssel
├── vercel.json                   SPA-Routing für Vercel
├── netlify.toml                  Build + SPA-Routing für Netlify
├── public/
│   ├── favicon.svg
│   └── _redirects                SPA-Routing (Netlify-Fallback)
├── supabase/
│   ├── config.toml               CLI-Konfiguration (anonyme Anmeldung an)
│   ├── migrations/
│   │   └── 20261009000000_musik_quiz.sql   Tabellen, RLS, Funktionen, Realtime
│   └── functions/
│       └── deezer/index.ts       Edge Function: Deezer-CORS-Proxy
└── src/
    ├── main.tsx / App.tsx        Einstieg & Routen
    ├── index.css                 Tailwind, Farben, Animationen
    ├── config/
    │   └── categories.ts         ⭐ Kategorien & Spiel-Einstellungen (hier erweitern!)
    ├── lib/
    │   ├── supabase.ts           Supabase-Clients (Host/Spieler getrennt), anonyme Anmeldung
    │   ├── api.ts                Aufrufe der Datenbank-Funktionen
    │   ├── deezer.ts             Songs laden über die Edge Function, Duplikate filtern
    │   ├── game.ts               Runden bauen (1 richtig + 3 falsch), Rangliste
    │   ├── audio.ts              Audio freischalten, vorladen, ausblenden
    │   ├── time.ts               Serverzeit-Abgleich für synchrone Countdowns
    │   ├── confetti.ts           Konfetti-Effekte
    │   └── types.ts              TypeScript-Typen
    ├── hooks/
    │   ├── useRoomData.ts        Raumzustand laden + Realtime-Abo
    │   ├── useNow.ts             tickende Serverzeit
    │   └── useWakeLock.ts        Bildschirm bleibt an
    ├── pages/
    │   ├── Home.tsx              Startseite (Mitspielen / Hosten)
    │   ├── Join.tsx              Code + Nickname
    │   ├── Host.tsx              Host-Steuerung (Spielablauf, Audio)
    │   └── Play.tsx              Spieler-Ansicht am Handy
    └── components/
        ├── host/                 HostLobby, HostQuestion, HostReveal, HostFinished
        ├── player/               PlayerQuestion, PlayerReveal
        ├── CountdownBar.tsx, Leaderboard.tsx, Podium.tsx, Equalizer.tsx …
        └── answerStyles.ts       Farben/Symbole der 4 Antwort-Buttons
```

---

## 3. Getroffene Entscheidungen

Wo die Aufgabe offen war, habe ich so entschieden:

| Thema | Entscheidung |
|---|---|
| Antwortzeit | **20 Sekunden** pro Runde (Song läuft 30 s weiter, auch während der Auflösung). Einstellbar in `src/config/categories.ts`. |
| Auflösung → nächste Runde | Automatisch nach **12 Sekunden**, Host kann pausieren oder sofort weiter. |
| Serienbonus | +200 bei jeder 3. richtigen Antwort in Folge (also bei 3, 6, 9 …). |
| Gleichstand | Gleicher Platz für gleiche Punkte (1, 2, 2, 4). |
| Wiedereinstieg | Wer mit einem bereits vergebenen Nickname beitritt, **übernimmt** diesen Spieler inkl. Punkten. Bewusst simpel für Partys unter Freunden (kein Passwort). |
| Identität pro Tab | Spieler-Sitzung liegt im `sessionStorage` → jeder Tab = eigener Spieler (perfekt zum Testen). Host-Sitzung im `localStorage` → Host bleibt Host, auch nach Neuladen. |
| Spiel-Logik wo? | Songauswahl im Host-Browser (der Host ist Spielleiter), **Punkte, Zeitmessung & Geheimhaltung in der Datenbank**. So bleibt die Edge Function ein reiner Proxy. |
| Kategorie-Quellen | Deezer-Playlist-IDs ändern sich gelegentlich. Darum nutzen die meisten Kategorien eine **Playlist-Suche** (z.B. „Top Switzerland“) statt fester IDs, plus Charts-Endpunkte. Fällt eine Quelle aus, werden die übrigen genutzt. Feste IDs kannst du jederzeit eintragen. |
| Vorschau-URLs | Deezer-Vorschau-Links laufen ab. Der Host holt deshalb vor jeder Runde eine frische URL (`track/{id}`). |
| Late Join | Spieler können auch während des Spiels beitreten (starten mit 0 Punkten). |
| Max. Spieler | 50 pro Raum. Alte Räume werden nach 12 h Inaktivität automatisch geschlossen (Code wird frei). |
| Host spielt mit? | Nicht im selben Tab. Auf demselben Laptop geht's in einem zweiten Tab (eigene Identität). |

---

## 4. Supabase einrichten

### 4.1 Projekt anlegen
1. Auf [supabase.com](https://supabase.com) kostenlos registrieren → **New project**.
2. Name, Datenbank-Passwort und Region (z.B. *Central EU (Frankfurt)* oder *Zurich*, falls verfügbar) wählen.

### 4.2 Datenbank-Schema einspielen
**Variante A – SQL-Editor (am einfachsten):**
1. Im Dashboard links **SQL Editor** → **New query**.
2. Den kompletten Inhalt von `supabase/migrations/20261009000000_musik_quiz.sql` einfügen → **Run**.
   (Das Skript kann gefahrlos mehrmals ausgeführt werden.)

**Variante B – Supabase CLI:**
```bash
npx supabase login
npx supabase link --project-ref DEINE_PROJECT_REF   # steht in der Projekt-URL: https://<ref>.supabase.co
npx supabase db push
```

### 4.3 Anonyme Anmeldung aktivieren ⚠️ wichtig
Dashboard → **Authentication** → **Sign In / Providers** (bzw. *Providers*) → **Allow anonymous sign-ins** einschalten → Speichern.

> Tipp: Unter *Authentication → Rate Limits* ist „Anonymous sign-ins“ standardmässig auf 30 pro Stunde **pro IP** begrenzt.
> Spielen viele Leute im selben WLAN, den Wert erhöhen (z.B. auf 200).

### 4.4 Realtime prüfen
Das SQL-Skript fügt `rooms`, `players`, `rounds` und `answers` zur Publikation `supabase_realtime` hinzu.
Kontrolle: **Database → Publications → supabase_realtime** – die vier Tabellen sollten angehakt sein
(`round_secrets` absichtlich **nicht**).

### 4.5 Edge Function deployen
```bash
npx supabase login                                   # einmalig, öffnet den Browser
npx supabase link --project-ref DEINE_PROJECT_REF    # falls noch nicht gemacht
npx supabase functions deploy deezer
```
Danach erscheint sie unter **Edge Functions → deezer**. Sie prüft das JWT des (anonym angemeldeten) Nutzers –
die App schickt es automatisch mit.

> Ohne CLI: Dashboard → **Edge Functions → Deploy a new function → Via Editor**, Name `deezer`,
> Inhalt von `supabase/functions/deezer/index.ts` einfügen → **Deploy**.

### 4.6 Schlüssel finden
Dashboard → **Project Settings** (Zahnrad) → **API Keys** bzw. **Data API** (oder oben auf den Button **Connect**):

| Variable | Wo? |
|---|---|
| `VITE_SUPABASE_URL` | **Project URL**, z.B. `https://abcdefgh.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | **anon / public** Key (unter „Legacy API Keys“) **oder** der neue **Publishable key** (`sb_publishable_…`) |

Der anon-/publishable-Key ist öffentlich und gehört ins Frontend – geschützt wird alles durch RLS.
**Niemals** den `service_role`/Secret-Key ins Frontend kopieren!

---

## 5. Lokal starten

Voraussetzung: [Node.js](https://nodejs.org) 20 oder neuer.

```bash
git clone <dein-repo> musik-quiz && cd musik-quiz
npm install
cp .env.example .env          # Windows: copy .env.example .env
# .env öffnen und URL + anon key eintragen
npm run dev
```

Öffne <http://localhost:5173>.

**Mit dem Handy im selben WLAN testen:** `npm run dev` zeigt auch eine `Network`-Adresse (z.B. `http://192.168.1.23:5173`).
Öffne **diese** Adresse auf dem Laptop zum Hosten – dann zeigt auch der QR-Code darauf und das Handy kann direkt scannen.

Weitere Befehle:
```bash
npm run build      # Typprüfung + Produktions-Build nach dist/
npm run preview    # Build lokal ansehen
```

---

## 6. Online stellen

### Variante A: Vercel
1. Code auf GitHub pushen.
2. Auf [vercel.com](https://vercel.com) → **Add New → Project** → Repository importieren.
3. Framework wird als **Vite** erkannt (Build: `npm run build`, Output: `dist`).
4. **Environment Variables**: `VITE_SUPABASE_URL` und `VITE_SUPABASE_ANON_KEY` eintragen.
5. **Deploy**. Die `vercel.json` sorgt dafür, dass Links wie `/join?code=1234` direkt funktionieren.

### Variante B: Netlify
1. Code auf GitHub pushen.
2. Auf [netlify.com](https://netlify.com) → **Add new site → Import an existing project** → Repository wählen.
3. Build-Einstellungen kommen aus `netlify.toml` (Build: `npm run build`, Publish: `dist`).
4. **Site configuration → Environment variables**: die beiden `VITE_…`-Variablen setzen.
5. **Deploy site**.

> Wichtig: Vite baut die Variablen beim Build ein. Nach dem Ändern von Variablen **neu deployen**.

### Danach in Supabase
**Authentication → URL Configuration → Site URL** auf deine neue Adresse setzen (z.B. `https://musik-quiz.vercel.app`).
Für anonyme Anmeldung nicht zwingend nötig, aber sauber.

---

## 7. Allein testen mit mehreren Fenstern

Jeder Browser-**Tab** ist ein eigener Spieler (Sitzung im `sessionStorage`). So geht's:

1. `npm run dev` starten, <http://localhost:5173> öffnen → **Spiel hosten**. Code merken (z.B. `4821`).
2. Ein **neues** Fenster öffnen (Strg/Cmd + N) und <http://localhost:5173/join?code=4821> eingeben → Nickname „Anna“.
3. Noch einen **neuen** Tab → gleiche Adresse → Nickname „Ben“. Optional ein privates Fenster für „Carla“.
   ⚠️ Nicht „Tab duplizieren“ verwenden – das kopiert die Sitzung, und beide Tabs wären derselbe Spieler.
4. Tipp: Fenster nebeneinander anordnen und die Spieler-Fenster per DevTools (F12 → Gerätesymbol) auf Handy-Grösse stellen.
5. Im Host-Fenster Kategorie + **5 Runden** wählen → **Start**. Die Musik läuft nur im Host-Tab.
6. In den Spieler-Tabs unterschiedlich schnell und mal falsch antworten. Prüfen:
   - Countdown läuft überall synchron, Host-Ansicht zeigt „✓ Anna“ sobald Anna antwortet.
   - Antworten alle → sofortige Auflösung; sonst nach 20 s.
   - Spieler sehen grün/rot + Punkte, Host sieht Verteilung, „Richtig lagen“ und Rangliste.
   - 3× in Folge richtig → „🔥 3er-Serie! +200 Bonus“.
7. **Verbindungsabbruch testen:** einen Spieler-Tab schliessen, neuen Tab öffnen, mit **demselben Nickname** beitreten → Punkte sind noch da.
8. **Anti-Schummel-Test:** In einem Spieler-Tab DevTools → **Network** öffnen. Während der Frage enthalten die Antworten
   von `rounds` nur `options` und `correct_index: null`. Die Lösung taucht erst nach der Auflösung auf.
   In der Konsole `fetch` auf `round_secrets` liefert für Spieler eine leere Liste.
9. Nach der letzten Runde: Podest + Konfetti, dann **Nochmal spielen** → alle landen wieder in der Lobby.

---

## 8. Kategorien anpassen

Alles in `src/config/categories.ts`. Beispiel für eine neue Kategorie:

```ts
{
  id: 'mundart',
  name: 'Mundart',
  emoji: '🏔️',
  description: 'Schweizerdeutsch zum Mitsingen',
  gradient: 'from-red-500 to-white',
  sources: [
    { type: 'playlistSearch', query: 'Mundart Hits', take: 2 },
    { type: 'search', query: 'artist:"Patent Ochsner"' },
    { type: 'playlist', id: 1234567890 }, // ID aus https://www.deezer.com/playlist/1234567890
  ],
},
```

* `chart` – Deezer-Charts (`genreId: 0` = weltweit, `116` = Rap/Hip-Hop, `132` = Pop, `152` = Rock …)
* `playlist` – feste Playlist-ID
* `playlistSearch` – sucht Playlists und nimmt die `take` besten (mit mind. 20 Songs)
* `search` – Song-Suche, unterstützt Deezer-Syntax wie `artist:"…"`, `track:"…"`

Pro Spiel braucht eine Kategorie mindestens *Rundenanzahl + 3* verschiedene Songs mit Vorschau.

---

## 9. Fehlerbehebung

| Problem | Lösung |
|---|---|
| „Anonyme Anmeldung fehlgeschlagen“ | Anonymous Sign-ins aktivieren (4.3). Rate-Limit erhöhen. |
| „Deezer-Proxy: …“ / keine Songs | Edge Function deployt (4.5)? Logs unter *Edge Functions → deezer → Logs*. |
| Keine Musik beim Host | Lautsprecher/Tab-Ton prüfen. Button **🔊 Musik abspielen** tippen (Browser hat Autoplay blockiert). |
| Spieler sehen keine Updates | Realtime-Publikation prüfen (4.4). Die App lädt zusätzlich alle 8 s und beim Zurückkehren in den Tab neu. |
| `/join` gibt online 404 | `vercel.json` bzw. `netlify.toml`/`_redirects` mit deployt? |
| „Raum nicht gefunden“ | Code falsch oder Raum geschlossen bzw. > 12 h inaktiv. |
| Kategorie liefert zu wenige Songs | Weniger Runden wählen oder weitere Quellen in `categories.ts` eintragen. |

---

## 10. Ideen für Version 2

* **Buzzer-Modus:** Wer zuerst buzzert, darf antworten (Host bestätigt per Klick, falsche Antwort sperrt für die Runde).
* **Freitext-Antworten:** Titel/Interpret eintippen, unscharfer Vergleich (Levenshtein) in einer DB-Funktion, Teilpunkte für nur Interpret.
* **Spotify-Playlists importieren:** Spotify-Playlist-Link einfügen, Titel per Spotify Web API lesen und bei Deezer die Vorschau suchen (Matching per ISRC).
* **Eigene Deezer-Playlist** direkt in der Lobby per Link wählen.
* **Ranglisten über mehrere Spiele:** Tabelle `game_results` + „Party-Abend“-Gesamtwertung, optional Freundesgruppen mit festem Code.
* **Teams:** Spieler in Teams einteilen, Teampunkte = Durchschnitt.
* **Spezialrunden:** „Jahr erraten“ (Schätzfrage mit Nähe-Punkten), „Intro-Runde“ (nur 5 Sekunden), doppelte Punkte in der letzten Runde.
* **Joker:** 50:50 einmal pro Spiel.
* **Avatare & Emoji-Reaktionen**, die live auf dem TV erscheinen.
* **Host-Einstellungen:** Antwortzeit, Auto-Weiter, Lautstärke, Mehrsprachigkeit (DE/FR/IT/EN).
* **Presence** (Supabase Realtime Presence) für „online/offline“-Anzeige und Raum-Aufräumen.
* **Moderation:** Nickname-Filter, Host-Passwort, Raum sperren nach Spielstart.
* **PWA:** installierbar, Vollbild am Handy.
* **Statistiken:** schnellste Antwort des Abends, längste Serie, „Song, den niemand kannte“.
