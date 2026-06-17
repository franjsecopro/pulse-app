/**
 * React Query boundary. Import every React Query primitive from here — the
 * wrapper hooks (`useQueryRequest`, `useMutationRequest`, `useQueryClient`) and
 * the non-hook symbols (`QueryClient`, `QueryClientProvider`). Nothing outside
 * this folder may import from `@tanstack/react-query` directly.
 */
export { QueryClient, QueryClientProvider } from './client'
export { useMutationRequest } from './useMutationRequest'
export { useQueryClient } from './useQueryClient'
export { useQueryRequest } from './useQueryRequest'
