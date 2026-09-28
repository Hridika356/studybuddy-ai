export function Spinner({ label, size = 'md' }: { label?: string; size?: 'sm' | 'md' }) {
  return (
    <span className={`spinner spinner--${size}`} role="status">
      <span className="spinner__ring" aria-hidden="true" />
      {label ? <span className="spinner__label">{label}</span> : <span className="sr-only">Loading</span>}
    </span>
  )
}
