export interface User {
  id: number
  email: string
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

export interface Contract {
  id: number
  client_id: number
  description: string
  start_date: string
  end_date: string | null
  hourly_rate: number
  is_active: boolean
  notes: string | null
  created_at: string
}

export interface Client {
  id: number
  name: string
  payment_name: string | null
  email: string | null
  phone: string | null
  address: string | null
  is_active: boolean
  created_at: string
  updated_at?: string
  deleted_at?: string | null
  contracts: Contract[]
  payers: PaymentIdentifier[]
}

export interface ClassSession {
  id: number
  user_id: number
  client_id: number
  contract_id: number | null
  class_date: string
  class_time: string | null
  duration_hours: number
  hourly_rate: number
  notes: string | null
  created_at: string
  client_name: string | null
  contract_description: string | null
  total_amount: number | null
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

export interface Alert {
  client_id: number
  client_name: string
  type: 'debt' | 'credit'
  message: string
  expected: number
  paid: number
  diff: number
  month: number
  year: number
}
