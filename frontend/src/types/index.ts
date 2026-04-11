export interface User {
  id: number
  email: string
  role: 'admin' | 'user'
}

export interface TokenResponse {
  access_token: string
  refresh_token: string
  token_type: string
}

export interface PaymentIdentifier {
  id: number
  client_id: number
  name: string
  info: string | null
  created_at: string
}

export interface DaySchedule {
  start: string  // "HH:MM"
  end: string    // "HH:MM"
}

export interface Contract {
  id: number
  client_id: number
  description: string
  start_date: string
  end_date: string | null
  hourly_rate: number
  is_active: boolean
  notes: string | null
  // weekday ("0"=Mon…"6"=Sun) → {start, end} in "HH:MM"
  schedule_days: Record<string, DaySchedule> | null
  calendar_description: string | null
  calendar_reminders: Array<{ method: 'email' | 'popup'; minutes: number }> | null
  phone: string | null
  notify: boolean
  created_at: string
}

export interface Client {
  id: number
  name: string
  payment_name: string | null
  email: string | null
  phone: string | null
  whatsapp_phone: string | null
  address: string | null
  is_active: boolean
  created_at: string
  updated_at?: string
  archived_at?: string | null
  contracts: Contract[]
  payers: PaymentIdentifier[]
}

export type ClassStatus = 'normal' | 'cancelled_with_payment' | 'cancelled_without_payment'

export interface ClassSession {
  id: number
  user_id: number
  client_id: number
  contract_id: number | null
  class_date: string
  class_time: string | null
  duration_hours: number
  hourly_rate: number
  status: ClassStatus
  notes: string | null
  google_calendar_id: string | null
  created_at: string
  client_name: string | null
  contract_description: string | null
  total_amount: number | null
}

export interface PDFImportRecord {
  id: number
  filename: string
  imported_at: string
  month: number | null
  year: number | null
  transaction_count: number
  total_amount: number
}

export interface ContractBreakdown {
  contract_id: number | null
  contract_description: string
  hourly_rate: number
  class_count: number
  normal_count: number
  cancelled_with_payment_count: number
  cancelled_without_payment_count: number
  expected: number
}

export interface AccountingSummaryEntry {
  client_id: number
  client_name: string
  expected: number
  paid: number
  previous_credit: number
  balance: number
  month: number
  year: number
  month_name: string
  contracts: ContractBreakdown[]
}

export interface GoogleCalendarStatus {
  connected: boolean
  email?: string
  calendar_id?: string
}

export interface Payment {
  id: number
  user_id: number
  client_id: number | null
  amount: number
  payment_date: string
  concept: string | null
  source: string
  status: string
  notes: string | null
  created_at: string
  client_name: string | null
}

export interface DashboardSummary {
  total_expected: number
  total_paid: number
  total_pending: number
  active_clients: number
  monthly_classes: number
  monthly_payments: number
  month: number
  year: number
}

export type NotificationStatus = 'pending' | 'sent' | 'skipped'
export type NotificationChannel = 'whatsapp' | 'email'

export interface AppNotification {
  id: number
  client_id: number
  client_name: string
  class_id: number
  class_date: string
  class_time: string | null
  channel: NotificationChannel
  status: NotificationStatus
  message: string
  whatsapp_url: string | null
  sent_at: string | null
}

export interface NotificationSettings {
  default_channel: NotificationChannel
  message_template: string
}

export interface UpcomingClass {
  id: number
  client_name: string | null
  contract_description: string | null
  class_date: string
  class_time: string | null
  duration_hours: number
  total_amount: number
  status: ClassStatus
}

export interface UpcomingClasses {
  today: UpcomingClass[]
  tomorrow: UpcomingClass[]
}

export interface Alert {
  client_id: number | null
  client_name: string | null
  type: 'debt' | 'credit' | 'pdf_missing'
  message: string
  expected: number
  paid: number
  diff: number
  month: number
  year: number
}
