import { describe, expect, it } from 'vitest'
import { formatPageRange, toPageRanges } from './pages'

describe('toPageRanges', () => {
  it('collapses contiguous pages', () => {
    expect(toPageRanges([4, 5])).toEqual([{ start: 4, end: 5 }])
  })

  it('splits non-contiguous pages and dedupes/sorts', () => {
    expect(toPageRanges([7, 2, 3, 3])).toEqual([
      { start: 2, end: 3 },
      { start: 7, end: 7 },
    ])
  })

  it('ignores invalid page numbers', () => {
    expect(toPageRanges([0, -1, 1.5, 2])).toEqual([{ start: 2, end: 2 }])
  })

  it('handles empty input', () => {
    expect(toPageRanges([])).toEqual([])
  })
})

describe('formatPageRange', () => {
  it('formats single pages and ranges', () => {
    expect(formatPageRange({ start: 4, end: 4 })).toBe('p. 4')
    expect(formatPageRange({ start: 4, end: 5 })).toBe('p. 4–5')
  })
})
