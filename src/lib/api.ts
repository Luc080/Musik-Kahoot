import type { SupabaseClient } from '@supabase/supabase-js'
import type { Room, Round, RoundInput } from './types'

async function rpc<T>(client: SupabaseClient, fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await client.rpc(fn, args)
  if (error) throw new Error(error.message)
  return data as T
}

export const api = {
  createRoom: (c: SupabaseClient) => rpc<Room>(c, 'create_room'),

  joinRoom: (c: SupabaseClient, code: string, nickname: string) =>
    rpc<{ room_id: string; player_id: string }>(c, 'join_room', { p_code: code, p_nickname: nickname }),

  kickPlayer: (c: SupabaseClient, playerId: string) => rpc<void>(c, 'kick_player', { p_player: playerId }),

  startGame: (
    c: SupabaseClient,
    roomId: string,
    categoryId: string,
    categoryName: string,
    durationMs: number,
    rounds: RoundInput[],
  ) =>
    rpc<void>(c, 'start_game', {
      p_room: roomId,
      p_category_id: categoryId,
      p_category_name: categoryName,
      p_duration_ms: durationMs,
      p_rounds: rounds,
    }),

  startRound: (c: SupabaseClient, roomId: string, n: number) =>
    rpc<Round>(c, 'start_round', { p_room: roomId, p_round_number: n }),

  submitAnswer: (c: SupabaseClient, roundId: string, choice: number) =>
    rpc<boolean>(c, 'submit_answer', { p_round: roundId, p_choice: choice }),

  revealRound: (c: SupabaseClient, roomId: string) => rpc<void>(c, 'reveal_round', { p_room: roomId }),

  finishGame: (c: SupabaseClient, roomId: string) => rpc<void>(c, 'finish_game', { p_room: roomId }),

  resetRoom: (c: SupabaseClient, roomId: string) => rpc<void>(c, 'reset_room', { p_room: roomId }),

  closeRoom: (c: SupabaseClient, roomId: string) => rpc<void>(c, 'close_room', { p_room: roomId }),

  serverTime: (c: SupabaseClient) => rpc<string>(c, 'server_time'),
}
