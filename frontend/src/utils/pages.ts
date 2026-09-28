export interface PageRange {
  start: number
  end: number
}

/** Collapse page numbers into contiguous ranges: [2, 3, 4, 7] -> [{2,4}, {7,7}]. */
export function toPageRanges(pages: number[]): PageRange[] {
  const sorted = [...new Set(pages)].filter((p) => Number.isInteger(p) && p > 0).sort((a, b) => a - b)
  const ranges: PageRange[] = []
  for (const page of sorted) {
    const last = ranges.at(-1)
    if (last && page === last.end + 1) {
      last.end = page
    } else {
      ranges.push({ start: page, end: page })
    }
  }
  return ranges
}

/** "p. 4" or "p. 4–5" (en dash). */
export function formatPageRange({ start, end }: PageRange): string {
  return start === end ? `p. ${start}` : `p. ${start}–${end}`
}

export function describePageRange({ start, end }: PageRange): string {
  return start === end ? `Cited from page ${start}` : `Cited from pages ${start} to ${end}`
}
