import type { Locale } from '../i18n'

export interface User {
  id: number
  email: string
  role: 'admin' | 'user'
  locale: Locale
  isDemoActive?: boolean
  realEmail?: string | null
}

export interface AdminClient {
  id: number
  name: string
  ownerId: number
  ownerEmail: string
  isActive: boolean
  archivedAt: string | null
}

export interface PaymentIdentifier {
  id: number
  clientId: number
  name: string
  info: string | null
  createdAt: string
}

export interface DaySchedule {
  start: string // "HH:MM"
  end: string // "HH:MM"
}

export interface Contract {
  id: number
  clientId: number
  description: string
  startDate: string
  endDate: string | null
  hourlyRate: number
  isActive: boolean
  notes: string | null
  // weekday ("0"=Mon…"6"=Sun) → {start, end} in "HH:MM"
  scheduleDays: Record<string, DaySchedule> | null
  calendarDescription: string | null
  calendarReminders: Array<{
    method: 'email' | 'popup'
    minutes: number
  }> | null
  phone: string | null
  notify: boolean
  createdAt: string
}

export type PaymentTiming = 'same_month' | 'next_month'

export interface Client {
  id: number
  name: string
  paymentName: string | null
  email: string | null
  phone: string | null
  whatsappPhone: string | null
  address: string | null
  taxId: string | null
  paymentTiming: PaymentTiming
  isActive: boolean
  createdAt: string
  updatedAt?: string
  archivedAt?: string | null
  contracts: Contract[]
  payers: PaymentIdentifier[]
}

export interface BusinessProfile {
  businessName: string | null
  taxId: string | null
  fiscalAddress: string | null
}

export type ClassStatus = 'normal' | 'cancelledWithPayment' | 'cancelledWithoutPayment'

export interface ClassSession {
  id: number
  userId: number
  clientId: number
  contractId: number | null
  classDate: string
  classTime: string | null
  durationHours: number
  hourlyRate: number
  status: ClassStatus
  notes: string | null
  googleCalendarId: string | null
  createdAt: string
  clientName: string | null
  contractDescription: string | null
  effectiveRevenue: number | null
}

export interface StatementImportRecord {
  id: number
  filename: string
  importedAt: string
  month: number | null
  year: number | null
  transactionCount: number
  totalAmount: number
}

export interface ContractBreakdown {
  contractId: number | null
  contractDescription: string
  hourlyRate: number
  classCount: number
  normalCount: number
  cancelledWithPaymentCount: number
  cancelledWithoutPaymentCount: number
  expected: number
}

export interface AccountingSummaryEntry {
  clientId: number
  clientName: string
  expected: number
  paid: number
  previousCredit: number
  balance: number
  month: number
  year: number
  monthName: string
  contracts: ContractBreakdown[]
}

export interface GoogleCalendarStatus {
  connected: boolean
  email?: string
}

export interface Payment {
  id: number
  userId: number
  clientId: number | null
  amount: number
  paymentDate: string
  concept: string | null
  source: string
  status: string
  notes: string | null
  createdAt: string
  clientName: string | null
}

export interface DashboardSummary {
  totalExpected: number
  totalPaid: number
  totalPending: number
  activeClients: number
  monthlyClasses: number
  monthlyPayments: number
  month: number
  year: number
}

export type NotificationStatus = 'pending' | 'sent' | 'skipped'
export type NotificationChannel = 'whatsapp' | 'email'

export interface AppNotification {
  id: number
  clientId: number
  clientName: string
  classId: number
  classDate: string
  classTime: string | null
  channel: NotificationChannel
  status: NotificationStatus
  message: string
  whatsappUrl: string | null
  sentAt: string | null
}

export interface NotificationLogFilters {
  mode: 'day' | 'week' | 'month'
  date: string
  status?: NotificationStatus
  clientId?: number
  channel?: NotificationChannel
  page: number
  pageSize: number
}

export interface NotificationLogPage {
  items: AppNotification[]
  total: number
  page: number
  pageSize: number
}

export interface NotificationSettings {
  defaultChannel: NotificationChannel
  messageTemplate: string
}

export interface UpcomingClass {
  id: number
  clientName: string | null
  contractDescription: string | null
  classDate: string
  classTime: string | null
  durationHours: number
  effectiveRevenue: number
  status: ClassStatus
}

export interface ClassStats {
  count: number
  totalRevenue: number
}

export interface UpcomingClasses {
  today: UpcomingClass[]
  tomorrow: UpcomingClass[]
}

export type AlertType = 'debt' | 'credit' | 'statement_missing'
export type AlertSeverity = 'error' | 'info' | 'warning'

export interface Alert {
  clientId: number | null
  clientName: string | null
  type: AlertType
  severity: AlertSeverity
  amount: number
  month: number
  year: number
}
