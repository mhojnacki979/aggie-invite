/**
 * Eyes on Score API access. Runs in the visitor's browser (CORS is open on
 * the EOS API). The token is EOS's public read-only scoreboard token, the
 * same one their own public scoreboard ships in client code.
 */
import { z } from 'zod'
import { parseScoreList, parseScorecard } from './eos-schema'
import type { ArcherRow, Scorecard } from './types'

export const EOS_API = 'https://api.eyesonscore.com/api'
const TOKEN = 'Bearer 08a42685c4d02c948fd16848e38e194bab23d2ba90d390e14b772122f631c3b0b18f8cc3170040fa'
const TIMEOUT_MS = 15_000

const envelopeSchema = z.object({
  status_code: z.coerce.number(),
  message: z.string().optional(),
  data: z.unknown(),
})

/** A non-2xx HTTP answer (a proxy 502, a 429 rate limit). Carries what a retry loop needs. */
export class EosHttpError extends Error {
  constructor(
    readonly status: number,
    readonly endpoint: string,
    /** From the Retry-After header, when EOS sent one and the browser exposes it. */
    readonly retryAfterMs: number | null,
  ) {
    super(`EOS ${endpoint} failed with HTTP ${status}`)
    this.name = 'EosHttpError'
  }
}

function retryAfterMs(res: Response): number | null {
  const seconds = Number(res.headers.get('Retry-After'))
  return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : null
}

/** Unwrap the EOS envelope: throw its message unless status_code is 200. */
async function readEnvelope(res: Response): Promise<unknown> {
  const json: unknown = await res.json()
  const envelope = envelopeSchema.parse(json)
  if (envelope.status_code !== 200) {
    throw new Error(envelope.message ?? `EOS ${res.status}`)
  }
  return envelope.data
}

async function post(path: string, headers: Record<string, string>, body?: string): Promise<unknown> {
  const res = await fetch(`${EOS_API}/${path}`, {
    method: 'POST',
    headers: { Authorization: TOKEN, ...headers },
    body,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  // A proxy 502 or a 429 page is HTML, not JSON: name the failure before parsing.
  if (!res.ok) throw new EosHttpError(res.status, path.split('?')[0] ?? path, retryAfterMs(res))
  return readEnvelope(res)
}

/** Every archer in the tournament, grouped by division on the wire. */
export async function fetchScoreList(
  tournamentId: string,
): Promise<{ rows: ArcherRow[]; skipped: number }> {
  const query = new URLSearchParams({ is_private: 'false', id: tournamentId, for_fav: 'true' })
  const data = await post(`tournament_score_list?${query.toString()}`, {
    'Content-Type': 'application/json',
  })
  return parseScoreList(data)
}

/** One archer's end-by-end scorecard. The endpoint wants a form-encoded body. */
export async function fetchScorecard(tournamentId: string, shooterId: string): Promise<Scorecard> {
  const body = new URLSearchParams({ shooter_id: shooterId, tournament_id: tournamentId })
  const data = await post(
    'shooter_details_by_score',
    { 'Content-Type': 'application/x-www-form-urlencoded' },
    body.toString(),
  )
  return parseScorecard(data)
}
