/**
 * Query-key segments for the payments request. Every variant shares the
 * `payments` root, so invalidating `all` clears the whole domain by prefix.
 */
const base = 'payments'

export const paymentsKeys = {
  all: [base],
  list: [base, 'list'],
  statementHistory: [base, 'statement-history'],
} as const
