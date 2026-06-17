/**
 * Query-key segments for the alerts request. Every variant shares the
 * `alerts` root, so invalidating `all` clears the whole domain by prefix.
 */
const base = 'alerts'

export const alertsKeys = {
  all: [base],
  list: [base, 'list'],
} as const
