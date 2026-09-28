let counter = 0

/** Stable-enough unique keys for list rendering within a session. */
export function nextId(prefix = 'id'): string {
  counter += 1
  return `${prefix}-${Date.now().toString(36)}-${counter}`
}
