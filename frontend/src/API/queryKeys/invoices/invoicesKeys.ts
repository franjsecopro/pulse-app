/**
 * Query-key segments for the invoices request. Every variant shares the
 * `invoices` root, so invalidating `all` clears the whole domain by prefix.
 */
const base = 'invoices'

export const invoicesKeys = {
  all: [base],
  list: [base, 'list'],
} as const
