/**
 * Query-key segments for the notifications request. Every variant shares the
 * `notifications` root, so invalidating `all` clears the whole domain by prefix.
 */
const base = 'notifications'

export const notificationsKeys = {
  all: [base],
  pending: [base, 'pending'],
  log: [base, 'log'],
} as const
