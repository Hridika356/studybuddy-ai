import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, askQuestion, checkHealth, errorMessage } from './api'

function mockFetch(impl: (url: string, init?: RequestInit) => Promise<Response>) {
  const spy = vi.fn(impl)
  vi.stubGlobal('fetch', spy)
  return spy
}

afterEach(() => vi.unstubAllGlobals())

describe('api service', () => {
  it('posts questions as JSON to the configured base URL', async () => {
    const spy = mockFetch(async () =>
      Response.json({ parts: [{ text: 'A stack is LIFO.', pages: [4] }] }),
    )
    const result = await askQuestion('abc', 'What is a stack?')

    expect(result.parts[0].pages).toEqual([4])
    const [url, init] = spy.mock.calls[0]
    expect(url).toBe('http://api.test/ask')
    expect(init?.method).toBe('POST')
    expect(JSON.parse(String(init?.body))).toEqual({ doc_id: 'abc', question: 'What is a stack?' })
  })

  it('surfaces the backend error message and code', async () => {
    mockFetch(async () =>
      Response.json(
        { error: { code: 'document_not_found', message: 'Please upload your PDF again.' } },
        { status: 404 },
      ),
    )
    const error = await askQuestion('abc', 'q').catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).code).toBe('document_not_found')
    expect((error as ApiError).status).toBe(404)
    expect(errorMessage(error)).toBe('Please upload your PDF again.')
  })

  it('handles non-JSON error bodies', async () => {
    mockFetch(async () => new Response('<html>Bad gateway</html>', { status: 502 }))
    await expect(checkHealth()).rejects.toMatchObject({ code: 'http_error', status: 502 })
  })

  it('maps network failures to a friendly message', async () => {
    mockFetch(async () => {
      throw new TypeError('Failed to fetch')
    })
    await expect(checkHealth()).rejects.toMatchObject({ code: 'network_error' })
  })

  it('uses a generic message for unknown errors', () => {
    expect(errorMessage(new Error('boom'))).toBe('Something went wrong. Please try again.')
  })
})
