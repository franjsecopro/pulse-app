import { type QueryKey, type UseQueryOptions, useQuery } from '@tanstack/react-query'

/**
 * App wrapper around React Query's `useQuery`.
 *
 * Forwards the fully typed options and re-exposes only the result fields the
 * app consumes (ISP — expose what's used, nothing more). When a real call site
 * needs another field, add it here; never import `useQuery` directly elsewhere.
 */
export function useQueryRequest<
  TQueryFnData,
  TError = Error,
  TData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey,
>(options: UseQueryOptions<TQueryFnData, TError, TData, TQueryKey>) {
  const { data, error, isLoading, isFetching, refetch } = useQuery(options)
  return { data, error, isLoading, isFetching, refetch }
}
