/**
 * Query-key segments for the clients request. Every variant shares the
 * `clients` root, so invalidating `all` clears the whole domain by prefix.
 */
const base = 'clients'

export const clientsKeys = {
  all: [base],
  list: [base, 'list'],
  dropdown: [base, 'dropdown'],
} as const
