import { describePageRange, formatPageRange, type PageRange } from '../utils/pages'

interface CitationChipProps {
  range: PageRange
  /** Optional: when provided, the chip becomes a button (e.g. to open the PDF at that page). */
  onSelect?: (range: PageRange) => void
}

export function CitationChip({ range, onSelect }: CitationChipProps) {
  const label = formatPageRange(range)
  const description = describePageRange(range)

  if (onSelect) {
    return (
      <button
        type="button"
        className="citation-chip citation-chip--interactive"
        onClick={() => onSelect(range)}
        aria-label={description}
      >
        {label}
      </button>
    )
  }
  return (
    <span className="citation-chip" title={description}>
      <span aria-hidden="true">{label}</span>
      <span className="sr-only">({description})</span>
    </span>
  )
}
