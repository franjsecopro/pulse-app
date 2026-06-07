type QueryParamValue = string | number | string[] | undefined

/**
 * Builds a URL query string from a record of params.
 * - Filters out undefined values so the backend never sees them.
 * - URL-encodes keys and values so arbitrary strings (names, emails) round-trip safely.
 * - Array values are emitted as repeated keys (e.g. `?types=debt&types=credit`),
 *   which is what FastAPI expects for `Optional[list[str]]` query params.
 * - Returns an empty string when no params survive, so the caller can append it
 *   unconditionally without producing a dangling "?".
 */
export function buildQuery(params: Record<string, QueryParamValue>): string {
  const usp = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue
    if (Array.isArray(value)) {
      for (const item of value) usp.append(key, item)
    } else {
      usp.append(key, String(value))
    }
  }
  const serialized = usp.toString()
  return serialized ? `?${serialized}` : ''
}
