-- =====================================================================
-- Musik-Quiz – Datenbankschema für Supabase
-- Tabellen, Row-Level-Security, Spiel-Funktionen (RPC) und Realtime.
--
-- Grundprinzip:
--   * Browser dürfen NUR lesen (und auch das nur eingeschränkt per RLS).
--   * Jede Änderung läuft über eine SECURITY-DEFINER-Funktion, die prüft,
--     wer aufruft (auth.uid()) und ob er das darf.
--   * Die richtige Antwort liegt in `round_secrets` – lesbar nur für den
--     Host. Erst bei der Auflösung wird sie in `rounds` kopiert und damit
--     für die Spieler sichtbar.
--   * Punkte werden in reveal_round() auf dem Server berechnet.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Tabellen
-- ---------------------------------------------------------------------

create table if not exists public.rooms (
  id            uuid primary key default gen_random_uuid(),
  code          text not null check (code ~ '^[0-9]{4}$'),
  host_id       uuid not null,
  phase         text not null default 'lobby'
                check (phase in ('lobby', 'loading', 'question', 'reveal', 'finished', 'closed')),
  category_id   text,
  category_name text,
  total_rounds  int  not null default 10,
  current_round int  not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Ein Code ist nur unter den offenen Räumen eindeutig.
create unique index if not exists rooms_open_code_idx on public.rooms (code) where phase <> 'closed';
create index if not exists rooms_host_idx on public.rooms (host_id);

create table if not exists public.players (
  id         uuid primary key default gen_random_uuid(),
  room_id    uuid not null references public.rooms (id) on delete cascade,
  user_id    uuid not null,
  nickname   text not null check (char_length(nickname) between 1 and 20),
  score      int  not null default 0,
  streak     int  not null default 0,
  created_at timestamptz not null default now()
);

create unique index if not exists players_room_nick_idx on public.players (room_id, lower(nickname));
create unique index if not exists players_room_user_idx on public.players (room_id, user_id);
create index if not exists players_user_idx on public.players (user_id);

-- Öffentlicher Teil einer Runde. correct_index & Co. bleiben NULL bis zur Auflösung.
create table if not exists public.rounds (
  id            uuid primary key default gen_random_uuid(),
  room_id       uuid not null references public.rooms (id) on delete cascade,
  round_number  int  not null,
  options       jsonb not null,               -- [{ "title": "...", "artist": "..." }, x4]
  duration_ms   int  not null default 20000,
  started_at    timestamptz,
  ends_at       timestamptz,
  revealed_at   timestamptz,
  correct_index int,
  answer_title  text,
  answer_artist text,
  cover_url     text,
  unique (room_id, round_number)
);

-- Geheimer Teil einer Runde – nur für den Host lesbar, nie in Realtime.
create table if not exists public.round_secrets (
  round_id      uuid primary key references public.rounds (id) on delete cascade,
  room_id       uuid not null references public.rooms (id) on delete cascade,
  round_number  int  not null,
  track_id      bigint not null,
  correct_index int  not null check (correct_index between 0 and 3),
  title         text not null,
  artist        text not null,
  cover_url     text,
  preview_url   text not null
);

create index if not exists round_secrets_room_idx on public.round_secrets (room_id, round_number);

-- Antworten. is_correct/points/bonus werden erst bei der Auflösung gesetzt,
-- damit über die eigene Antwort-Zeile nichts vorher durchsickert.
create table if not exists public.answers (
  id           uuid primary key default gen_random_uuid(),
  round_id     uuid not null references public.rounds (id) on delete cascade,
  room_id      uuid not null references public.rooms (id) on delete cascade,
  player_id    uuid not null references public.players (id) on delete cascade,
  choice_index int  not null check (choice_index between 0 and 3),
  elapsed_ms   int  not null,
  is_correct   boolean,
  points       int,
  bonus        int,
  created_at   timestamptz not null default now(),
  unique (round_id, player_id)
);

create index if not exists answers_room_idx on public.answers (room_id);

-- updated_at automatisch pflegen
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists rooms_touch on public.rooms;
create trigger rooms_touch before update on public.rooms
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- Hilfsfunktionen für RLS (security definer → keine RLS-Rekursion)
-- ---------------------------------------------------------------------

create or replace function public.is_room_host(p_room uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.rooms where id = p_room and host_id = auth.uid());
$$;

create or replace function public.is_room_player(p_room uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.players where room_id = p_room and user_id = auth.uid());
$$;

-- ---------------------------------------------------------------------
-- Row-Level-Security
-- ---------------------------------------------------------------------

alter table public.rooms         enable row level security;
alter table public.players       enable row level security;
alter table public.rounds        enable row level security;
alter table public.round_secrets enable row level security;
alter table public.answers       enable row level security;

-- Direkte Schreibzugriffe komplett sperren – alles läuft über die RPC-Funktionen.
revoke all on public.rooms, public.players, public.rounds, public.round_secrets, public.answers from anon;
revoke insert, update, delete, truncate on public.rooms, public.players, public.rounds, public.round_secrets, public.answers from authenticated;
grant select on public.rooms, public.players, public.rounds, public.round_secrets, public.answers to authenticated;

drop policy if exists rooms_select on public.rooms;
create policy rooms_select on public.rooms for select to authenticated
  using (host_id = auth.uid() or public.is_room_player(id));

drop policy if exists players_select on public.players;
create policy players_select on public.players for select to authenticated
  using (public.is_room_host(room_id) or public.is_room_player(room_id));

-- Spieler sehen eine Runde erst, wenn sie gestartet wurde (keine Vorschau auf künftige Optionen).
drop policy if exists rounds_select on public.rounds;
create policy rounds_select on public.rounds for select to authenticated
  using (
    public.is_room_host(room_id)
    or (started_at is not null and public.is_room_player(room_id))
  );

drop policy if exists round_secrets_select on public.round_secrets;
create policy round_secrets_select on public.round_secrets for select to authenticated
  using (public.is_room_host(room_id));

-- Host sieht alle Antworten seines Raums, Spieler nur die eigenen.
drop policy if exists answers_select on public.answers;
create policy answers_select on public.answers for select to authenticated
  using (
    public.is_room_host(room_id)
    or exists (select 1 from public.players p where p.id = player_id and p.user_id = auth.uid())
  );

-- ---------------------------------------------------------------------
-- Spiel-Funktionen (RPC)
-- ---------------------------------------------------------------------

-- Serverzeit, damit alle Geräte denselben Countdown anzeigen.
create or replace function public.server_time()
returns timestamptz language sql volatile as $$
  select clock_timestamp();
$$;

-- Host erstellt einen Raum mit freiem 4-stelligem Code.
create or replace function public.create_room()
returns public.rooms language plpgsql security definer set search_path = public as $$
declare
  v_uid  uuid := auth.uid();
  v_room public.rooms;
  v_try  int := 0;
begin
  if v_uid is null then
    raise exception 'Nicht angemeldet';
  end if;

  -- Alte Räume aufräumen, damit Codes wieder frei werden.
  update public.rooms set phase = 'closed'
   where phase <> 'closed' and updated_at < now() - interval '12 hours';

  loop
    begin
      insert into public.rooms (code, host_id)
      values (lpad(floor(random() * 10000)::int::text, 4, '0'), v_uid)
      returning * into v_room;
      return v_room;
    exception when unique_violation then
      v_try := v_try + 1;
      if v_try > 60 then
        raise exception 'Kein freier Raumcode gefunden – bitte nochmal versuchen';
      end if;
    end;
  end loop;
end $$;

-- Spieler tritt bei (oder steigt mit demselben Nickname wieder ein).
create or replace function public.join_room(p_code text, p_nickname text)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_uid     uuid := auth.uid();
  v_nick    text := btrim(regexp_replace(coalesce(p_nickname, ''), '\s+', ' ', 'g'));
  v_room    public.rooms;
  v_by_name public.players;
  v_mine    public.players;
  v_id      uuid;
begin
  if v_uid is null then
    raise exception 'Nicht angemeldet';
  end if;
  if char_length(v_nick) < 1 or char_length(v_nick) > 20 then
    raise exception 'Der Nickname muss 1–20 Zeichen lang sein';
  end if;

  select * into v_room from public.rooms
   where code = btrim(p_code) and phase <> 'closed'
   order by created_at desc limit 1;
  if v_room.id is null then
    raise exception 'Raum nicht gefunden – stimmt der Code?';
  end if;
  if v_room.host_id = v_uid then
    raise exception 'Der Host kann nicht gleichzeitig mitspielen (anderen Tab/Browser verwenden)';
  end if;

  select * into v_by_name from public.players
   where room_id = v_room.id and lower(nickname) = lower(v_nick);
  select * into v_mine from public.players
   where room_id = v_room.id and user_id = v_uid;

  if v_by_name.id is not null then
    -- Wiedereinstieg: der Nickname "gehört" ab jetzt diesem Gerät.
    if v_mine.id is not null and v_mine.id <> v_by_name.id then
      delete from public.players where id = v_mine.id;
    end if;
    update public.players set user_id = v_uid where id = v_by_name.id;
    v_id := v_by_name.id;
  elsif v_mine.id is not null then
    -- Gleiches Gerät, neuer Name → umbenennen.
    update public.players set nickname = v_nick where id = v_mine.id;
    v_id := v_mine.id;
  else
    if (select count(*) from public.players where room_id = v_room.id) >= 50 then
      raise exception 'Der Raum ist voll (max. 50 Spieler)';
    end if;
    insert into public.players (room_id, user_id, nickname)
    values (v_room.id, v_uid, v_nick)
    returning id into v_id;
  end if;

  return json_build_object('room_id', v_room.id, 'player_id', v_id);
end $$;

-- Host entfernt einen Spieler aus der Lobby.
create or replace function public.kick_player(p_player uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_room uuid;
begin
  select room_id into v_room from public.players where id = p_player;
  if v_room is null or not public.is_room_host(v_room) then
    raise exception 'Nur der Host darf Spieler entfernen';
  end if;
  delete from public.players where id = p_player;
  update public.rooms set updated_at = now() where id = v_room; -- Realtime-Signal für alle
end $$;

-- Host startet ein Spiel: Runden + Geheimnisse anlegen, Punkte zurücksetzen.
-- p_rounds: [{ options:[{title,artist}x4], correct_index, track_id, title, artist, cover_url, preview_url }]
create or replace function public.start_game(
  p_room          uuid,
  p_category_id   text,
  p_category_name text,
  p_duration_ms   int,
  p_rounds        jsonb
)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_room     public.rooms;
  v_item     jsonb;
  v_idx      int := 0;
  v_round_id uuid;
  v_options  jsonb;
  v_correct  int;
  v_duration int := least(greatest(coalesce(p_duration_ms, 20000), 5000), 30000);
begin
  select * into v_room from public.rooms where id = p_room for update;
  if v_room.id is null or v_room.host_id <> auth.uid() then
    raise exception 'Nur der Host darf das Spiel starten';
  end if;
  if jsonb_typeof(p_rounds) <> 'array' or jsonb_array_length(p_rounds) not between 1 and 30 then
    raise exception 'Ungültige Rundenanzahl';
  end if;

  delete from public.rounds where room_id = p_room; -- löscht Geheimnisse & Antworten mit
  update public.players set score = 0, streak = 0 where room_id = p_room;

  for v_item in select value from jsonb_array_elements(p_rounds) loop
    v_idx := v_idx + 1;
    v_correct := (v_item ->> 'correct_index')::int;

    if jsonb_array_length(v_item -> 'options') <> 4 or v_correct not between 0 and 3 then
      raise exception 'Runde % ist ungültig', v_idx;
    end if;

    -- Optionen bereinigen: nur Titel + Interpret, keine weiteren Felder.
    select jsonb_agg(jsonb_build_object('title', o ->> 'title', 'artist', o ->> 'artist') order by ord)
      into v_options
      from jsonb_array_elements(v_item -> 'options') with ordinality as t(o, ord);

    insert into public.rounds (room_id, round_number, options, duration_ms)
    values (p_room, v_idx, v_options, v_duration)
    returning id into v_round_id;

    insert into public.round_secrets
      (round_id, room_id, round_number, track_id, correct_index, title, artist, cover_url, preview_url)
    values
      (v_round_id, p_room, v_idx, (v_item ->> 'track_id')::bigint, v_correct,
       v_item ->> 'title', v_item ->> 'artist', v_item ->> 'cover_url', v_item ->> 'preview_url');
  end loop;

  update public.rooms
     set phase = 'loading', current_round = 0, total_rounds = v_idx,
         category_id = p_category_id, category_name = p_category_name
   where id = p_room;
end $$;

-- Host startet Runde n. Die Uhr läuft ab jetzt (Serverzeit).
create or replace function public.start_round(p_room uuid, p_round_number int)
returns public.rounds language plpgsql security definer set search_path = public as $$
declare
  v_room  public.rooms;
  v_round public.rounds;
begin
  select * into v_room from public.rooms where id = p_room for update;
  if v_room.id is null or v_room.host_id <> auth.uid() then
    raise exception 'Nur der Host darf Runden starten';
  end if;

  update public.rounds
     set started_at = now(),
         ends_at    = now() + make_interval(secs => duration_ms / 1000.0)
   where room_id = p_room and round_number = p_round_number and started_at is null
  returning * into v_round;

  if v_round.id is null then
    -- Schon gestartet (z.B. Doppelklick) → einfach zurückgeben.
    select * into v_round from public.rounds where room_id = p_room and round_number = p_round_number;
    if v_round.id is null then
      raise exception 'Runde % existiert nicht', p_round_number;
    end if;
  end if;

  update public.rooms set phase = 'question', current_round = p_round_number where id = p_room;
  return v_round;
end $$;

-- Spieler antwortet. Gibt nichts über richtig/falsch zurück.
create or replace function public.submit_answer(p_round uuid, p_choice int)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_round   public.rounds;
  v_player  public.players;
  v_elapsed int;
begin
  if p_choice is null or p_choice not between 0 and 3 then
    raise exception 'Ungültige Antwort';
  end if;

  -- FOR SHARE: verhindert, dass reveal_round() gleichzeitig auswertet.
  select * into v_round from public.rounds where id = p_round for share;
  if v_round.id is null then
    raise exception 'Runde nicht gefunden';
  end if;

  select * into v_player from public.players
   where room_id = v_round.room_id and user_id = auth.uid();
  if v_player.id is null then
    raise exception 'Du bist nicht in diesem Raum';
  end if;

  if v_round.started_at is null or v_round.revealed_at is not null
     or now() > v_round.ends_at + interval '1 second' then   -- 1 s Kulanz für Netzwerk-Latenz
    raise exception 'Zu spät – die Zeit ist abgelaufen';
  end if;

  v_elapsed := least(
    v_round.duration_ms,
    greatest(0, floor(extract(epoch from (now() - v_round.started_at)) * 1000)::int)
  );

  insert into public.answers (round_id, room_id, player_id, choice_index, elapsed_ms)
  values (v_round.id, v_round.room_id, v_player.id, p_choice, v_elapsed)
  on conflict (round_id, player_id) do nothing;

  return found;
end $$;

-- Host löst die aktuelle Runde auf: Punkte berechnen, Antwort veröffentlichen.
-- Punkte: richtig = 1000 (sofort) bis 500 (letzte Sekunde), falsch = 0.
-- Serienbonus: jede 3. richtige Antwort in Folge = +200.
create or replace function public.reveal_round(p_room uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_room   public.rooms;
  v_round  public.rounds;
  v_secret public.round_secrets;
  v_player public.players;
  v_answer public.answers;
  v_points int;
  v_bonus  int;
  v_streak int;
begin
  select * into v_room from public.rooms where id = p_room for update;
  if v_room.id is null or v_room.host_id <> auth.uid() then
    raise exception 'Nur der Host darf auflösen';
  end if;

  select * into v_round from public.rounds
   where room_id = p_room and round_number = v_room.current_round
   for update;
  if v_round.id is null or v_round.started_at is null then
    raise exception 'Keine laufende Runde';
  end if;
  if v_round.revealed_at is not null then
    return; -- schon aufgelöst
  end if;

  select * into v_secret from public.round_secrets where round_id = v_round.id;

  for v_player in select * from public.players where room_id = p_room loop
    v_answer := null;
    select * into v_answer from public.answers
     where round_id = v_round.id and player_id = v_player.id;

    if v_answer.id is not null and v_answer.choice_index = v_secret.correct_index then
      v_points := round(1000 - 500.0 * v_answer.elapsed_ms / v_round.duration_ms);
      v_points := least(1000, greatest(500, v_points));
      v_streak := v_player.streak + 1;
      v_bonus  := case when v_streak % 3 = 0 then 200 else 0 end;

      update public.answers set is_correct = true, points = v_points, bonus = v_bonus
       where id = v_answer.id;
      update public.players set score = score + v_points + v_bonus, streak = v_streak
       where id = v_player.id;
    else
      if v_answer.id is not null then
        update public.answers set is_correct = false, points = 0, bonus = 0 where id = v_answer.id;
      end if;
      update public.players set streak = 0 where id = v_player.id;
    end if;
  end loop;

  update public.rounds
     set revealed_at   = now(),
         correct_index = v_secret.correct_index,
         answer_title  = v_secret.title,
         answer_artist = v_secret.artist,
         cover_url     = v_secret.cover_url
   where id = v_round.id;

  update public.rooms set phase = 'reveal' where id = p_room;
end $$;

-- Host beendet das Spiel → Siegerehrung.
create or replace function public.finish_game(p_room uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_room_host(p_room) then
    raise exception 'Nur der Host darf das Spiel beenden';
  end if;
  update public.rooms set phase = 'finished' where id = p_room;
end $$;

-- "Nochmal spielen": zurück in die Lobby, gleiche Spieler, Punkte auf 0.
create or replace function public.reset_room(p_room uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_room_host(p_room) then
    raise exception 'Nur der Host darf den Raum zurücksetzen';
  end if;
  delete from public.rounds where room_id = p_room;
  update public.players set score = 0, streak = 0 where room_id = p_room;
  update public.rooms
     set phase = 'lobby', current_round = 0, category_id = null, category_name = null
   where id = p_room;
end $$;

-- Host schliesst den Raum.
create or replace function public.close_room(p_room uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_room_host(p_room) then
    raise exception 'Nur der Host darf den Raum schliessen';
  end if;
  update public.rooms set phase = 'closed' where id = p_room;
end $$;

-- Ausführungsrechte: nur angemeldete (auch anonyme) Nutzer.
revoke execute on function
  public.server_time(), public.create_room(), public.join_room(text, text),
  public.kick_player(uuid), public.start_game(uuid, text, text, int, jsonb),
  public.start_round(uuid, int), public.submit_answer(uuid, int), public.reveal_round(uuid),
  public.finish_game(uuid), public.reset_room(uuid), public.close_room(uuid),
  public.is_room_host(uuid), public.is_room_player(uuid)
from public, anon;

grant execute on function
  public.server_time(), public.create_room(), public.join_room(text, text),
  public.kick_player(uuid), public.start_game(uuid, text, text, int, jsonb),
  public.start_round(uuid, int), public.submit_answer(uuid, int), public.reveal_round(uuid),
  public.finish_game(uuid), public.reset_room(uuid), public.close_room(uuid),
  public.is_room_host(uuid), public.is_room_player(uuid)
to authenticated;

-- ---------------------------------------------------------------------
-- Realtime (round_secrets bewusst NICHT!)
-- ---------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['rooms', 'players', 'rounds', 'answers'] loop
    if not exists (
      select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
