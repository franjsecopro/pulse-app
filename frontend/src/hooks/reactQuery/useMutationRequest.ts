import { type UseMutationOptions, useMutation } from '@tanstack/react-query'

/**
 * App wrapper around React Query's `useMutation`.
 *
 * Forwards the fully typed options and re-exposes only the result fields the
 * app consumes (ISP). Note v5 naming: the in-flight flag is `isPending`, not
 * the v4 `isLoading`. Never import `useMutation` directly elsewhere.
 */
export function useMutationRequest<
  TData = unknown,
  TError = Error,
  TVariables = void,
  TContext = unknown,
>(options: UseMutationOptions<TData, TError, TVariables, TContext>) {
  const { mutate, mutateAsync, data, variables, isPending, error } = useMutation(options)
  return { mutate, mutateAsync, data, variables, isPending, error }
}
