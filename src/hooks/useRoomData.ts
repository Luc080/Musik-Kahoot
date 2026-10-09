import { useCallback, useEffect, useRef, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Answer, Player, Room, Round } from '../lib/types'
import { rankPlayers } from '../lib/game'

export interface RoomData {
  loading: boolean
  /** true, wenn der Raum (für diesen Nutzer) nicht sichtbar ist */
  missing: boolean
  room: Room | null
  players: Player[]
  round: Round | null
  /** Host: alle Antworten der aktuellen Runde. Spieler: nur die eigene. */
  answers: Answer[]
  connected: boolean
}

const initial: RoomData = {
  loading: true,
  missing: false,
  room: null,
  players: [],
  round: null,
  answers: [],
  connected: false,
}

/**
 * Lädt den kompletten Raumzustand und hält ihn per Supabase Realtime aktuell.
 *
 * Statt einzelne Events mühsam zusammenzusetzen, löst jedes Event ein
 * (entprelltes) Neuladen aus. Das ist bei Party-Grösse (≤ 50 Spieler)
 * billig und sehr robust – auch nach Verbindungsabbrüchen.
 * RLS sorgt dafür, dass jeder nur sieht, was er sehen darf.
 */
export function useRoomData(client: SupabaseClient, roomId: string | undefined, userId: string | null) {
  const [data, setData] = useState<RoomData>(initial)
  const seq = useRef(0)
  const timer = useRef<number | undefined>(undefined)

  const load = useCallback(async () => {
    if (!roomId || !userId) return
    const mySeq = ++seq.current

    const { data: room, error: roomError } = await client.from('rooms').select('*').eq('id', roomId).maybeSingle<Room>()
    if (mySeq !== seq.current) return
    if (roomError) {
      setData((d) => ({ ...d, loading: false }))
      return
    }
    if (!room) {
      setData({ ...initial, loading: false, missing: true })
      return
    }

    const [playersRes, roundRes] = await Promise.all([
      client.from('players').select('*').eq('room_id', roomId),
      room.current_round > 0
        ? client.from('rounds').select('*').eq('room_id', roomId).eq('round_number', room.current_round).maybeSingle<Round>()
        : Promise.resolve({ data: null }),
    ])
    const round = (roundRes.data as Round | null) ?? null

    let answers: Answer[] = []
    if (round) {
      // RLS filtert: Host bekommt alle, Spieler nur die eigene Antwort.
      const { data: ans } = await client.from('answers').select('*').eq('round_id', round.id)
      answers = (ans as Answer[]) ?? []
    }
    if (mySeq !== seq.current) return

    setData((d) => ({
      ...d,
      loading: false,
      missing: false,
      room,
      players: rankPlayers((playersRes.data as Player[]) ?? []),
      round,
      answers,
    }))
  }, [client, roomId, userId])

  const schedule = useCallback(() => {
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(load, 120)
  }, [load])

  useEffect(() => {
    if (!roomId || !userId) return
    load()

    const channel = client
      .channel(`room-${roomId}-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` }, schedule)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players', filter: `room_id=eq.${roomId}` }, schedule)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rounds', filter: `room_id=eq.${roomId}` }, schedule)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'answers', filter: `room_id=eq.${roomId}` }, schedule)
      .subscribe((status) => {
        const ok = status === 'SUBSCRIBED'
        setData((d) => ({ ...d, connected: ok }))
        if (ok) schedule() // nach (Wieder-)Verbindung alles neu laden
      })

    // Sicherheitsnetz: Handy war im Standby, WLAN weg usw.
    const onWake = () => document.visibilityState === 'visible' && schedule()
    document.addEventListener('visibilitychange', onWake)
    window.addEventListener('online', schedule)
    window.addEventListener('focus', schedule)
    const poll = window.setInterval(load, 8000)

    return () => {
      window.clearTimeout(timer.current)
      window.clearInterval(poll)
      document.removeEventListener('visibilitychange', onWake)
      window.removeEventListener('online', schedule)
      window.removeEventListener('focus', schedule)
      client.removeChannel(channel)
    }
  }, [client, roomId, userId, load, schedule])

  return { ...data, reload: load }
}
