/**
 * Centralized API endpoint paths.
 *
 * Keeping routes in one place removes magic strings across the service layer,
 * makes refactors safer, and gives autocomplete for every API path. Each path
 * is relative to the `/api` base URL handled by `api.ts` unless noted otherwise
 * (e.g. browser-facing preview URLs).
 */
export const ENDPOINTS = {
  auth: {
    register: '/auth/register',
    login: '/auth/login',
    refresh: '/auth/refresh',
    me: '/auth/me',
    logout: '/auth/logout',
  },

  clients: {
    base: '/clients',
    byId: (id: number) => `/clients/${id}`,
    archive: (id: number) => `/clients/${id}/archive`,
    activate: (id: number) => `/clients/${id}/activate`,
    contracts: (clientId: number) => `/clients/${clientId}/contracts`,
    contractById: (clientId: number, contractId: number) =>
      `/clients/${clientId}/contracts/${contractId}`,
    generateClasses: (clientId: number, contractId: number) =>
      `/clients/${clientId}/contracts/${contractId}/generate-classes`,
    futureClasses: (clientId: number, contractId: number) =>
      `/clients/${clientId}/contracts/${contractId}/future-classes`,
    payers: (clientId: number) => `/clients/${clientId}/payers`,
    payerById: (clientId: number, payerId: number) =>
      `/clients/${clientId}/payers/${payerId}`,
  },

  classes: {
    base: '/classes',
    byId: (id: number) => `/classes/${id}`,
    stats: '/classes/stats',
    syncGCal: '/classes/sync-gcal',
    syncCalendar: (id: number) => `/classes/${id}/sync-calendar`,
  },

  payments: {
    base: '/payments',
    byId: (id: number) => `/payments/${id}`,
  },

  invoices: {
    base: '/invoices',
    byId: (id: number) => `/invoices/${id}`,
    byClass: (classId: number) => `/invoices/by-class/${classId}`,
    fromClass: (classId: number) => `/invoices/from-class/${classId}`,
    fromPeriod: '/invoices/from-period',
    issue: (id: number) => `/invoices/${id}/issue`,
    share: (id: number) => `/invoices/${id}/share`,
    send: (id: number) => `/invoices/${id}/send`,
    pdf: (id: number) => `/invoices/${id}/pdf`,
    /** Full browser URL (includes `/api`) for opening a preview in a new tab. */
    previewUrl: (id: number) => `/api/invoices/${id}/preview`,
  },

  accounting: {
    summary: '/accounting/summary',
    client: (clientId: number) => `/accounting/client/${clientId}`,
    report: '/accounting/report',
  },

  imports: {
    statement: '/imports/statement',
    history: '/imports/history',
    byId: (id: number) => `/imports/${id}`,
  },

  dashboard: {
    summary: '/dashboard/summary',
    upcoming: '/dashboard/upcoming',
  },

  businessProfile: {
    base: '/business-profile',
  },

  googleCalendar: {
    status: '/google-calendar/status',
    connect: '/google-calendar/connect',
    disconnect: '/google-calendar/disconnect',
  },

  notifications: {
    pending: '/notifications/pending',
    generate: '/notifications/generate',
    markSent: (id: number) => `/notifications/${id}/mark-sent`,
    log: '/notifications/log',
    settings: '/notifications/settings',
  },

  alerts: {
    base: '/alerts',
  },

  admin: {
    users: '/admin/users',
    userById: (id: number) => `/admin/users/${id}`,
    userRole: (id: number) => `/admin/users/${id}/role`,
    userSyncGCal: (id: number) => `/admin/users/${id}/sync-gcal`,
    clients: '/admin/clients',
    clientById: (id: number) => `/admin/clients/${id}`,
    clientMoveFromDemo: (id: number) => `/admin/clients/${id}/move-from-demo`,
    clientMoveToDemo: (id: number) => `/admin/clients/${id}/move-to-demo`,
    demoStatus: '/admin/demo/status',
    demoEnter: '/admin/demo/enter',
    demoExit: '/admin/demo/exit',
    demoReset: '/admin/demo/reset',
  },
} as const
