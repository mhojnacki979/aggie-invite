'use client'

/**
 * The Supabase side of score check-in: the crew sign-in and the shared bale checkmarks. Only
 * `app/checkin/` imports this, so the public pages never load supabase-js.
 */
import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { CHECKIN_SUPABASE_KEY, CHECKIN_SUPABASE_URL } from '@/config/checkin'
import type { BaleCheck, CheckStore } from './checkin-store'

const TABLE = 'bale_checks'
/** Postgres unique violation: the bale was already checked (another tablet got there first). */
const ALREADY_CHECKED = '23505'

let client: SupabaseClient | null = null

/** Created on first use, so building the static page never opens a connection. */
function supabase(): SupabaseClient {
  client ??= createClient(CHECKIN_SUPABASE_URL, CHECKIN_SUPABASE_KEY, { auth: { persistSession: true } })
  return client
}

const rowSchema = z.object({
  line_key: z.string(),
  bale: z.number().int(),
  checked_at: z.string(),
  checked_by: z.string(),
})

function toCheck(row: z.infer<typeof rowSchema>): BaleCheck {
  return { lineKey: row.line_key, bale: row.bale, checkedAt: row.checked_at, checkedBy: row.checked_by }
}

export const supabaseStore: CheckStore = {
  async list(tournamentId) {
    const { data, error } = await supabase().from(TABLE).select('line_key, bale, checked_at, checked_by').eq('tournament_id', tournamentId)
    if (error) throw new Error(error.message)
    return z.array(rowSchema).parse(data).map(toCheck)
  },
  async check(tournamentId, lineKey, bale) {
    const { error } = await supabase().from(TABLE).insert({ tournament_id: tournamentId, line_key: lineKey, bale })
    if (error && error.code !== ALREADY_CHECKED) throw new Error(error.message)
  },
  async uncheck(tournamentId, lineKey, bale) {
    const { error } = await supabase().from(TABLE).delete().match({ tournament_id: tournamentId, line_key: lineKey, bale })
    if (error) throw new Error(error.message)
  },
  subscribe(tournamentId, onChange) {
    const channel = supabase()
      .channel(`bale-checks:${tournamentId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: TABLE, filter: `tournament_id=eq.${tournamentId}` }, onChange)
      .subscribe((status) => {
        // Joining (or rejoining after a dropped socket) refetches, so a missed change can't leave a tablet stale.
        if (status === 'SUBSCRIBED') onChange()
      })
    return () => {
      void supabase().removeChannel(channel)
    }
  },
}

export type SignInResult = { ok: true } | { ok: false; message: string }

export async function signIn(email: string, password: string): Promise<SignInResult> {
  const { error } = await supabase().auth.signInWithPassword({ email: email.trim(), password })
  return error ? { ok: false, message: error.message } : { ok: true }
}

export async function signOut(): Promise<void> {
  await supabase().auth.signOut()
}

/** Calls back once with whether a crew session exists now, then on every sign-in or sign-out. */
export function onAuthChange(callback: (signedIn: boolean) => void): () => void {
  const { data } = supabase().auth.onAuthStateChange((_event, session) => callback(session !== null))
  return () => data.subscription.unsubscribe()
}
