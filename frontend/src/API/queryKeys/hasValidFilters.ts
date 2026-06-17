/**
 * True when `filters` carries at least one usable value, so it's worth adding
 * to a query key. Objects need one non-`undefined` field; primitives must be
 * truthy (empty string excluded). Keeps keys stable: an "empty" filter set
 * yields the bare base key instead of a noisy `{ ...all undefined }` segment.
 */
export function hasValidFilters(filters: unknown): boolean {
  if (filters === undefined || filters === null) return false
  if (typeof filters === 'object') {
    return Object.values(filters as Record<string, unknown>).some((value) => value !== undefined)
  }
  return filters !== ''
}
