import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '../services/api'
import { AppHeader } from './AppHeader'

vi.mock('../services/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/api')>()
  return { ...actual, checkHealth: vi.fn() }
})

const mockedHealth = vi.mocked(api.checkHealth)
const networkError = () => new api.ApiError('network_error', 'offline')

describe('AppHeader backend status', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockedHealth.mockReset()
  })
  afterEach(() => vi.useRealTimers())

  it('shows Connected when the backend answers quickly', async () => {
    mockedHealth.mockResolvedValue({ status: 'ok', ai_configured: true })
    render(<AppHeader />)
    await act(() => vi.advanceTimersByTimeAsync(10))
    expect(screen.getByText('Connected')).toBeInTheDocument()
  })

  it('shows the waking notice after 3s, keeps retrying, then connects', async () => {
    mockedHealth
      .mockRejectedValueOnce(networkError())
      .mockRejectedValueOnce(networkError())
      .mockResolvedValue({ status: 'ok', ai_configured: true })
    render(<AppHeader />)

    await act(() => vi.advanceTimersByTimeAsync(2_900))
    expect(screen.getByText('Connecting…')).toBeInTheDocument()
    await act(() => vi.advanceTimersByTimeAsync(200))
    expect(screen.getByText('Waking server… up to 1 min')).toBeInTheDocument()

    await act(() => vi.advanceTimersByTimeAsync(3_000))
    expect(screen.getByText('Connected')).toBeInTheDocument()
    expect(mockedHealth).toHaveBeenCalledTimes(3)
  })

  it('gives up and shows offline after the 90s wake budget', async () => {
    mockedHealth.mockRejectedValue(networkError())
    render(<AppHeader />)
    await act(() => vi.advanceTimersByTimeAsync(60_000))
    expect(screen.getByText('Waking server… up to 1 min')).toBeInTheDocument()
    await act(() => vi.advanceTimersByTimeAsync(31_000))
    expect(screen.getByText('Server offline')).toBeInTheDocument()
    const calls = mockedHealth.mock.calls.length
    await act(() => vi.advanceTimersByTimeAsync(30_000))
    expect(mockedHealth).toHaveBeenCalledTimes(calls) // no more retries
  })

  it('stops retrying after unmount', async () => {
    mockedHealth.mockRejectedValue(networkError())
    const { unmount } = render(<AppHeader />)
    await act(() => vi.advanceTimersByTimeAsync(10))
    unmount()
    const calls = mockedHealth.mock.calls.length
    await act(() => vi.advanceTimersByTimeAsync(30_000))
    expect(mockedHealth).toHaveBeenCalledTimes(calls)
  })
})
