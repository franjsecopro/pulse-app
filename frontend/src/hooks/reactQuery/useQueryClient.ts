import { useQueryClient as useReactQueryClient } from '@tanstack/react-query'

/**
 * App wrapper around React Query's `useQueryClient`.
 *
 * Hooks across the app use several client methods (invalidate / set / get /
 * cancel / remove queries), so the full instance is forwarded rather than a
 * curated subset. Never import `useQueryClient` directly elsewhere.
 */
export function useQueryClient() {
  return useReactQueryClient()
}
