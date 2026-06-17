/**
 * Non-hook React Query symbols.
 *
 * `QueryClient` (a class) and `QueryClientProvider` (a component) cannot be
 * wrapped as hooks, so they are re-exported here. This keeps the whole
 * `reactQuery/` folder the single boundary that touches `@tanstack/react-query`.
 */
export { QueryClient, QueryClientProvider } from '@tanstack/react-query'
