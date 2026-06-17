import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PaymentsTab } from './PaymentsTab'

vi.mock('../../context/AuthContext', () => ({
  useAuth: vi.fn(),
}))

vi.mock('../../hooks/usePayments', () => ({
  usePayments: vi.fn(),
}))

vi.mock('../../hooks/useAlerts', () => ({
  useAlerts: vi.fn(),
}))

vi.mock('../payments/PaymentForm', () => ({
  PaymentForm: () => React.createElement('div', { 'data-testid': 'mock-payment-form' }),
}))

vi.mock('../payments/ImportStatementModal', () => ({
  ImportStatementModal: () =>
    React.createElement('div', {
      'data-testid': 'mock-import-statement-modal',
    }),
}))

vi.mock('../payments/StatementHistoryView', () => ({
  StatementHistoryView: (props: Record<string, unknown>) => {
    mockStatementHistoryViewProps = props
    return React.createElement('div', {
      'data-testid': 'mock-statement-history-view',
    })
  },
}))

vi.mock('../ui/Pagination', () => ({
  Pagination: () => React.createElement('div', { 'data-testid': 'mock-pagination' }),
}))

vi.mock('../ui/ConfirmationModal', () => ({
  ConfirmationModal: ({ isOpen, message }: { isOpen: boolean; message: string }) => {
    if (!isOpen) return null
    return React.createElement('div', { 'data-testid': 'mock-confirm-dialog' }, message)
  },
}))

vi.mock('../../i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

import { useAuth } from '../../context/AuthContext'
import { useAlerts } from '../../hooks/useAlerts'
import { usePayments } from '../../hooks/usePayments'
import type { Payment } from '../../types'

const mockUseAuth = vi.mocked(useAuth)
const mockUsePayments = vi.mocked(usePayments)
const mockUseAlerts = vi.mocked(useAlerts)

const mockCreatePayment = vi.fn()
const mockUpdatePayment = vi.fn()
const mockRequestDelete = vi.fn()
const mockConfirmDelete = vi.fn()
const mockCancelDelete = vi.fn()
const mockGoToPage = vi.fn()
const mockLoadStatementHistory = vi.fn()
const mockHandleImported = vi.fn()
const mockDeleteStatementImport = vi.fn()
const mockOnPeriodChange = vi.fn()

let mockStatementHistoryViewProps: Record<string, unknown> = {}

function makePayment(overrides: Partial<Payment> = {}): Payment {
  return {
    id: 1,
    userId: 1,
    clientId: 1,
    amount: 100,
    paymentDate: '2026-06-15',
    concept: 'Pago mensual',
    status: 'pending',
    source: 'manual',
    notes: null,
    createdAt: '2026-06-01',
    clientName: 'Juan García',
    ...overrides,
  }
}

function makeHook(overrides: Partial<ReturnType<typeof usePayments>> = {}) {
  return {
    payments: [],
    clients: [],
    statementHistory: [],
    isLoading: false,
    isStatementHistoryLoading: false,
    totalAmount: 0,
    pendingDeleteId: null,
    page: 1,
    pageCount: 1,
    totalCount: 0,
    goToPage: mockGoToPage,
    loadStatementHistory: mockLoadStatementHistory,
    createPayment: mockCreatePayment,
    updatePayment: mockUpdatePayment,
    requestDelete: mockRequestDelete,
    confirmDelete: mockConfirmDelete,
    cancelDelete: mockCancelDelete,
    handleImported: mockHandleImported,
    deleteStatementImport: mockDeleteStatementImport,
    ...overrides,
  }
}

function renderPaymentsTab() {
  return render(
    <PaymentsTab month={6} year={2026} client='' status='' onPeriodChange={mockOnPeriodChange} />,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockStatementHistoryViewProps = {}
  mockUseAuth.mockReturnValue({
    user: { id: 1, email: 'admin@test.com', role: 'admin' },
    isLoading: false,
  } as never)
  mockUsePayments.mockReturnValue(makeHook() as never)
  mockUseAlerts.mockReturnValue({ alerts: [], isLoading: false, count: 0 } as never)
})

describe('PaymentsTab', () => {
  describe('actions', () => {
    it('renders the import statement secondary button', () => {
      renderPaymentsTab()
      const importButton = screen.getByRole('button', {
        name: /payments\.importStatement/,
      })
      expect(importButton).toBeTruthy()
    })

    it('renders the new payment primary button', () => {
      renderPaymentsTab()
      const newPaymentButton = screen.getByRole('button', {
        name: /payments\.newPayment/,
      })
      expect(newPaymentButton).toBeTruthy()
    })

    it('opens the import modal when the import statement button is clicked', () => {
      renderPaymentsTab()
      fireEvent.click(screen.getByRole('button', { name: /payments\.importStatement/ }))
      expect(screen.getByTestId('mock-import-statement-modal')).toBeTruthy()
    })

    it('opens the create modal when the new payment button is clicked', () => {
      renderPaymentsTab()
      fireEvent.click(screen.getByRole('button', { name: /payments\.newPayment/ }))
      expect(screen.getByTestId('mock-payment-form')).toBeTruthy()
    })
  })

  describe('sub-tabs', () => {
    it('renders the payments and history tab buttons', () => {
      renderPaymentsTab()
      expect(screen.getByRole('button', { name: /payments\.tab\.payments/ })).toBeTruthy()
      expect(screen.getByRole('button', { name: /payments\.tab\.history/ })).toBeTruthy()
    })

    it('switches to history tab and shows StatementHistoryView', () => {
      renderPaymentsTab()
      fireEvent.click(screen.getByRole('button', { name: /payments\.tab\.history/ }))
      expect(screen.getByTestId('mock-statement-history-view')).toBeTruthy()
    })

    it('starts on the payments sub-tab by default', () => {
      renderPaymentsTab()
      // The payments sub-tab shows the empty state (no payments) by default.
      expect(screen.getByText('payments.empty')).toBeTruthy()
    })
  })

  describe('payments list (default sub-tab)', () => {
    it('shows a spinner while loading', () => {
      mockUsePayments.mockReturnValue(makeHook({ isLoading: true }) as never)
      renderPaymentsTab()
      const spinner = document.querySelector('.material-symbols-outlined.animate-spin')
      expect(spinner).toBeTruthy()
    })

    it('shows the empty state when there are no payments', () => {
      mockUsePayments.mockReturnValue(makeHook({ payments: [], totalCount: 0 }) as never)
      renderPaymentsTab()
      expect(screen.getByText('payments.empty')).toBeTruthy()
    })

    it('shows the registerFirst button in the empty state', () => {
      mockUsePayments.mockReturnValue(makeHook({ payments: [], totalCount: 0 }) as never)
      renderPaymentsTab()
      const registerFirstButton = screen.getByRole('button', {
        name: /payments\.registerFirst/,
      })
      expect(registerFirstButton).toBeTruthy()
    })

    it('renders the payments table when there are payments', () => {
      mockUsePayments.mockReturnValue(
        makeHook({ payments: [makePayment()], totalCount: 1 }) as never,
      )
      renderPaymentsTab()
      expect(screen.getByText('Juan García')).toBeTruthy()
      expect(screen.getByTestId('mock-pagination')).toBeTruthy()
    })

    it('shows the total amount badge when there are payments', () => {
      mockUsePayments.mockReturnValue(
        makeHook({ payments: [makePayment()], totalCount: 1, totalAmount: 100 }) as never,
      )
      renderPaymentsTab()
      expect(screen.getByText('payments.totalAmount')).toBeTruthy()
    })
  })

  describe('per-row actions', () => {
    beforeEach(() => {
      mockUsePayments.mockReturnValue(
        makeHook({ payments: [makePayment()], totalCount: 1 }) as never,
      )
    })

    it('opens the edit modal when the row edit button is clicked', () => {
      renderPaymentsTab()
      const editIcon = screen.getByText('edit')
      fireEvent.click(editIcon.closest('button') as HTMLElement)
      expect(screen.getByTestId('mock-payment-form')).toBeTruthy()
    })

    it('calls requestDelete when the row delete button is clicked', () => {
      renderPaymentsTab()
      const deleteIcon = screen.getByText('delete')
      fireEvent.click(deleteIcon.closest('button') as HTMLElement)
      expect(mockRequestDelete).toHaveBeenCalledWith(1)
    })
  })

  describe('delete confirmation', () => {
    it('shows the ConfirmDialog when pendingDeleteId is set', () => {
      mockUsePayments.mockReturnValue(
        makeHook({
          pendingDeleteId: 1,
          payments: [makePayment()],
          totalCount: 1,
        }) as never,
      )
      renderPaymentsTab()
      const confirmDialog = screen.getByTestId('mock-confirm-dialog')
      expect(confirmDialog).toBeTruthy()
      expect(confirmDialog.textContent).toContain('payments.deleteMessage')
    })
  })

  describe('admin check', () => {
    it('passes isAdmin=true to StatementHistoryView when user role is admin', async () => {
      mockUseAuth.mockReturnValue({
        user: { id: 1, email: 'admin@test.com', role: 'admin' },
        isLoading: false,
      } as never)
      renderPaymentsTab()
      fireEvent.click(screen.getByRole('button', { name: /payments\.tab\.history/ }))
      await waitFor(() => {
        expect(screen.getByTestId('mock-statement-history-view')).toBeTruthy()
      })
      expect(mockStatementHistoryViewProps.isAdmin).toBe(true)
    })

    it('passes isAdmin=false to StatementHistoryView when user role is not admin', async () => {
      mockUseAuth.mockReturnValue({
        user: { id: 2, email: 'user@test.com', role: 'user' },
        isLoading: false,
      } as never)
      renderPaymentsTab()
      fireEvent.click(screen.getByRole('button', { name: /payments\.tab\.history/ }))
      await waitFor(() => {
        expect(screen.getByTestId('mock-statement-history-view')).toBeTruthy()
      })
      expect(mockStatementHistoryViewProps.isAdmin).toBe(false)
    })
  })
})
