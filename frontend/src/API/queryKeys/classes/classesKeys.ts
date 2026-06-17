/**
 * Query-key segments for the classes request. Every variant shares the
 * `classes` root, so invalidating `all` clears the whole domain by prefix.
 */
const base = 'classes'

export const classesKeys = {
  all: [base],
  list: [base, 'list'],
  stats: [base, 'stats'],
} as const
