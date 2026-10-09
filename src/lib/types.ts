export type Phase = 'lobby' | 'loading' | 'question' | 'reveal' | 'finished' | 'closed'

export interface Room {
  id: string
  code: string
  host_id: string
  phase: Phase
  category_id: string | null
  category_name: string | null
  total_rounds: number
  current_round: number
  created_at: string
  updated_at: string
}

export interface Player {
  id: string
  room_id: string
  user_id: string
  nickname: string
  score: number
  streak: number
  created_at: string
}

export interface AnswerOption {
  title: string
  artist: string
}

export interface Round {
  id: string
  room_id: string
  round_number: number
  options: AnswerOption[]
  duration_ms: number
  started_at: string | null
  ends_at: string | null
  revealed_at: string | null
  correct_index: number | null
  answer_title: string | null
  answer_artist: string | null
  cover_url: string | null
}

export interface RoundSecret {
  round_id: string
  room_id: string
  round_number: number
  track_id: number
  correct_index: number
  title: string
  artist: string
  cover_url: string | null
  preview_url: string
}

export interface Answer {
  id: string
  round_id: string
  room_id: string
  player_id: string
  choice_index: number
  elapsed_ms: number
  is_correct: boolean | null
  points: number | null
  bonus: number | null
  created_at: string
}

/** Ein Song, wie wir ihn intern verwenden */
export interface Track {
  id: number
  title: string
  artist: string
  cover: string | null
  preview: string
}

/** Runde, wie der Host sie an start_game() schickt */
export interface RoundInput {
  options: AnswerOption[]
  correct_index: number
  track_id: number
  title: string
  artist: string
  cover_url: string | null
  preview_url: string
}
