import { afterEach, describe, expect, it, vi } from 'vitest'
import { EosHttpError, fetchScoreList } from './eos'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('EOS HTTP failures', () => {
  it('names the endpoint and status when a proxy answers with an HTML 502', async () => {
    const html = '<html><body>502 Bad Gateway</body></html>'
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(html, { status: 502 })))
    const failure = await fetchScoreList('abc').catch((error: unknown) => error)
    expect(failure).toBeInstanceOf(EosHttpError)
    expect(failure).toMatchObject({
      status: 502,
      endpoint: 'tournament_score_list',
      message: 'EOS tournament_score_list failed with HTTP 502',
    })
  })

  it('carries Retry-After on a 429 so a caller can back off', async () => {
    const limited = new Response('slow down', { status: 429, headers: { 'Retry-After': '7' } })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(limited))
    const failure = await fetchScoreList('abc').catch((error: unknown) => error)
    expect(failure).toMatchObject({ status: 429, retryAfterMs: 7000 })
  })
})
