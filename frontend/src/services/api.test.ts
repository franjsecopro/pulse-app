/**
 * Tests for the api service — focused on postForm and the FormData handling
 * that the httpOnly-cookie migration broke.
 *
 * Key behaviors:
 *  - postForm sends FormData WITHOUT forcing a JSON Content-Type (the browser
 *    must set its own multipart boundary)
 *  - every request travels with credentials:'include' (httpOnly cookies)
 *  - postForm gets the same 401 -> refresh -> retry flow as JSON requests
 *  - post (JSON) still sets application/json — regression guard for the
 *    isFormData branch added to requestFull
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, api } from './api'

const fetchMock = vi.fn()

/** Minimal Response stand-in covering what requestFull reads. */
function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(),
    json: async () => body,
  } as Response
}

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockReset()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

// ─── FormData content-type handling ──────────────────────────────────────────

describe('postForm', () => {
  it('sends FormData without forcing a JSON Content-Type', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([]))
    const formData = new FormData()
    formData.append('file', new Blob(['pdf'], { type: 'application/pdf' }), 'extracto.pdf')

    await api.postForm('/imports/statement', formData)

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/imports/statement')
    expect(init.body).toBeInstanceOf(FormData)
    expect((init.headers as Record<string, string>)['Content-Type']).toBeUndefined()
    expect(init.credentials).toBe('include')
  })

  it('returns the parsed JSON payload', async () => {
    const parsedRows = [{ date: '2026-01-01', concept: 'TRANSFER', amount: 50 }]
    fetchMock.mockResolvedValueOnce(jsonResponse(parsedRows))

    const result = await api.postForm('/imports/statement', new FormData())

    expect(result).toEqual(parsedRows)
  })
})

// ─── 401 refresh flow on uploads ─────────────────────────────────────────────

describe('postForm session refresh', () => {
  it('refreshes the session and retries once on 401', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ detail: 'unauthorized' }, 401)) // upload #1
      .mockResolvedValueOnce({ ok: true } as Response) // refresh
      .mockResolvedValueOnce(jsonResponse([{ ok: true }])) // upload retry

    const result = await api.postForm('/imports/statement', new FormData())

    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(fetchMock.mock.calls[1][0]).toBe('/api/auth/refresh')
    expect(result).toEqual([{ ok: true }])
  })

  it('dispatches session-expired and throws ApiError when refresh fails', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ detail: 'unauthorized' }, 401)) // upload
      .mockResolvedValueOnce({ ok: false } as Response) // refresh fails

    const onExpired = vi.fn()
    window.addEventListener('session-expired', onExpired)

    await expect(api.postForm('/imports/statement', new FormData())).rejects.toBeInstanceOf(
      ApiError,
    )
    expect(onExpired).toHaveBeenCalledOnce()

    window.removeEventListener('session-expired', onExpired)
  })
})

// ─── JSON requests unaffected by the isFormData branch ───────────────────────

describe('post (JSON) regression guard', () => {
  it('still sets an application/json Content-Type and stringifies the body', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: 1 }))

    await api.post('/payments', { amount: 10 })

    const [, init] = fetchMock.mock.calls[0]
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json')
    expect(init.body).toBe(JSON.stringify({ amount: 10 }))
  })
})
