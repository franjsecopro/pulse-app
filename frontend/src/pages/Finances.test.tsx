import { fireEvent, render, screen } from '@testing-library/react'
import React from 'react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Finances } from './Finances'

let financeFiltersProps: Record<string, unknown> = {}

vi.mock('../hooks/reactQuery', () => ({
  useQueryRequest: () => ({ data: [] }),
}))

vi.mock('../components/finance/FinanceFilters', () => ({
  FinanceFilters: (props: Record<string, unknown>) => {
    financeFiltersProps = props
    return React.createElement('div', { 'data-testid': 'mock-finance-filters' })
  },
}))

vi.mock('../components/finance/PaymentsTab', () => ({
  PaymentsTab: () => React.createElement('div', { 'data-testid': 'mock-payments-tab' }),
}))

vi.mock('../components/finance/AccountingTab', () => ({
  AccountingTab: () => React.createElement('div', { 'data-testid': 'mock-accounting-tab' }),
}))

vi.mock('../components/finance/InvoicesTab', () => ({
  InvoicesTab: () => React.createElement('div', { 'data-testid': 'mock-invoices-tab' }),
}))

vi.mock('../i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

function renderFinances(initialEntry = '/finances') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Finances />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  financeFiltersProps = {}
})

describe('Finances', () => {
  it('renders the unified title and a single filter bar', () => {
    renderFinances()
    expect(screen.getByText('finances.title')).toBeTruthy()
    expect(screen.getAllByTestId('mock-finance-filters')).toHaveLength(1)
  })

  it('starts on the Payments tab by default', () => {
    renderFinances()
    expect(screen.getByTestId('mock-payments-tab')).toBeTruthy()
    expect(screen.queryByTestId('mock-accounting-tab')).toBeNull()
    expect(screen.queryByTestId('mock-invoices-tab')).toBeNull()
  })

  it('honours the ?tab= query param', () => {
    renderFinances('/finances?tab=invoices')
    expect(screen.getByTestId('mock-invoices-tab')).toBeTruthy()
    expect(screen.queryByTestId('mock-payments-tab')).toBeNull()
  })

  it('switches tabs when a tab button is clicked', () => {
    renderFinances()
    fireEvent.click(screen.getByRole('button', { name: 'finances.tab.accounting' }))
    expect(screen.getByTestId('mock-accounting-tab')).toBeTruthy()
    expect(screen.queryByTestId('mock-payments-tab')).toBeNull()
  })

  it('shows the status filter on Payments and Invoices', () => {
    renderFinances()
    expect(typeof financeFiltersProps.onStatusChange).toBe('function')

    fireEvent.click(screen.getByRole('button', { name: 'finances.tab.invoices' }))
    expect(typeof financeFiltersProps.onStatusChange).toBe('function')
  })

  it('hides the status filter on Accounting', () => {
    renderFinances()
    fireEvent.click(screen.getByRole('button', { name: 'finances.tab.accounting' }))
    expect(financeFiltersProps.onStatusChange).toBeUndefined()
  })
})
