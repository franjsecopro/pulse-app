import { fireEvent, render, screen } from '@testing-library/react'
import React from 'react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Finanzas } from './Finanzas'

let financeFiltersProps: Record<string, unknown> = {}

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: [] }),
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

function renderFinanzas(initialEntry = '/finanzas') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Finanzas />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  financeFiltersProps = {}
})

describe('Finanzas', () => {
  it('renders the unified title and a single filter bar', () => {
    renderFinanzas()
    expect(screen.getByText('finanzas.title')).toBeTruthy()
    expect(screen.getAllByTestId('mock-finance-filters')).toHaveLength(1)
  })

  it('starts on the Pagos tab by default', () => {
    renderFinanzas()
    expect(screen.getByTestId('mock-payments-tab')).toBeTruthy()
    expect(screen.queryByTestId('mock-accounting-tab')).toBeNull()
    expect(screen.queryByTestId('mock-invoices-tab')).toBeNull()
  })

  it('honours the ?tab= query param', () => {
    renderFinanzas('/finanzas?tab=facturas')
    expect(screen.getByTestId('mock-invoices-tab')).toBeTruthy()
    expect(screen.queryByTestId('mock-payments-tab')).toBeNull()
  })

  it('switches tabs when a tab button is clicked', () => {
    renderFinanzas()
    fireEvent.click(screen.getByRole('button', { name: 'finanzas.tab.contabilidad' }))
    expect(screen.getByTestId('mock-accounting-tab')).toBeTruthy()
    expect(screen.queryByTestId('mock-payments-tab')).toBeNull()
  })

  it('shows the status filter on Pagos and Facturas', () => {
    renderFinanzas()
    expect(typeof financeFiltersProps.onStatusChange).toBe('function')

    fireEvent.click(screen.getByRole('button', { name: 'finanzas.tab.facturas' }))
    expect(typeof financeFiltersProps.onStatusChange).toBe('function')
  })

  it('hides the status filter on Contabilidad', () => {
    renderFinanzas()
    fireEvent.click(screen.getByRole('button', { name: 'finanzas.tab.contabilidad' }))
    expect(financeFiltersProps.onStatusChange).toBeUndefined()
  })
})
