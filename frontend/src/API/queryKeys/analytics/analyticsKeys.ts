/**
 * Query-key segments for the analytics domain. Every variant shares the
 * `analytics` root, so invalidating `all` clears the whole domain by prefix.
 */
const base = 'analytics'

export const analyticsKeys = {
  all: [base],
  overview: [base, 'overview'],
  revenueSeries: [base, 'revenueSeries'],
  receivables: [base, 'receivables'],
  projection: [base, 'projection'],
  clientContribution: [base, 'clientContribution'],
} as const
