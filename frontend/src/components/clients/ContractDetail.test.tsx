import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ContractDetail } from './ContractDetail'

vi.mock('../../services/client.service', () => ({
  clientService: {
    generateContractClasses: vi.fn(),
    deleteFutureContractClasses: vi.fn(),
  },
}))

vi.mock('./ContractForm', () => ({
  ContractForm: () => React.createElement('div', { 'data-testid': 'mock-contract-form' }),
}))

vi.mock('../../i18n', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { returnObjects?: boolean }) => {
      if (key === 'common.weekdays.short' && opts?.returnObjects) {
        return ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
      }
      return key
    },
  }),
}))

import { clientService } from '../../services/client.service'
import type { Contract } from '../../types'

const mockGenerate = vi.mocked(clientService.generateContractClasses)
const mockDeleteFuture = vi.mocked(clientService.deleteFutureContractClasses)

function makeContract(overrides: Partial<Contract> = {}): Contract {
  return {
    id: 1,
    client_id: 100,
    description: 'María - Colegio',
    start_date: '2026-01-01',
    end_date: null,
    hourly_rate: 30,
    is_active: true,
    notes: null,
    schedule_days: {
      '0': { start: '16:00', end: '17:30' },
      '2': { start: '16:00', end: '17:30' },
    },
    calendar_description: null,
    calendar_reminders: null,
    phone: null,
    notify: false,
    created_at: '2026-01-01',
    ...overrides,
  }
}

interface RenderOpts {
  contract?: Contract
  isEditMode?: boolean
  onStartEdit?: () => void
  onSaveEdit?: (data: Partial<Contract>) => Promise<void>
  onCancelEdit?: () => void
}

function renderDetail(opts: RenderOpts = {}) {
  const onStartEdit = opts.onStartEdit ?? vi.fn()
  const onSaveEdit = opts.onSaveEdit ?? vi.fn()
  const onCancelEdit = opts.onCancelEdit ?? vi.fn()
  const onClose = vi.fn()

  return {
    onStartEdit,
    onSaveEdit,
    onCancelEdit,
    ...render(
      <ContractDetail
        contract={opts.contract ?? makeContract()}
        clientId={100}
        isEditMode={opts.isEditMode ?? false}
        onStartEdit={onStartEdit as never}
        onSaveEdit={onSaveEdit as never}
        onCancelEdit={onCancelEdit as never}
        onClose={onClose as never}
      />,
    ),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGenerate.mockResolvedValue({ created: 5 } as never)
  mockDeleteFuture.mockResolvedValue({ deleted: 3 } as never)
})

describe('ContractDetail', () => {
  describe('view mode (!isEditMode)', () => {
    it('renders the contract description', () => {
      renderDetail()
      expect(screen.getByText('María - Colegio')).toBeTruthy()
    })

    it('renders the hourly rate', () => {
      renderDetail()
      expect(screen.getByText('€30/h')).toBeTruthy()
    })

    it('shows the edit button when not in edit mode', () => {
      renderDetail()
      const editButton = screen.getByRole('button', { name: /contracts\.edit/ })
      expect(editButton).toBeTruthy()
    })

    it('calls onStartEdit when the edit button is clicked', () => {
      const onStartEdit = vi.fn()
      renderDetail({ onStartEdit })
      fireEvent.click(screen.getByRole('button', { name: /contracts\.edit/ }))
      expect(onStartEdit).toHaveBeenCalledTimes(1)
    })

    it('does NOT render ContractForm in view mode', () => {
      renderDetail()
      expect(screen.queryByTestId('mock-contract-form')).toBeFalsy()
    })
  })

  describe('edit mode (isEditMode=true)', () => {
    it('renders ContractForm when in edit mode', () => {
      renderDetail({ isEditMode: true })
      expect(screen.getByTestId('mock-contract-form')).toBeTruthy()
    })

    it('does NOT render the contract description in edit mode', () => {
      renderDetail({ isEditMode: true })
      expect(screen.queryByText('María - Colegio')).toBeFalsy()
    })

    it('does NOT render the edit button in edit mode', () => {
      renderDetail({ isEditMode: true })
      expect(screen.queryByRole('button', { name: /contracts\.edit/ })).toBeFalsy()
    })
  })

  describe('generate classes button', () => {
    it('shows the generate button when contract has a schedule', () => {
      renderDetail()
      const generateButton = screen.getByRole('button', { name: /contracts\.generateClasses/ })
      expect(generateButton).toBeTruthy()
    })

    it('hides the generate button when contract has no schedule', () => {
      renderDetail({ contract: makeContract({ schedule_days: null }) })
      expect(screen.queryByRole('button', { name: /contracts\.generateClasses/ })).toBeFalsy()
    })

    it('disables the generate button when in edit mode', () => {
      renderDetail({ isEditMode: true })
      const generateButton = screen.getByRole('button', { name: /contracts\.generateClasses/ })
      expect((generateButton as HTMLButtonElement).disabled).toBe(true)
    })

    it('calls clientService.generateContractClasses when the generate button is clicked', async () => {
      renderDetail()
      fireEvent.click(screen.getByRole('button', { name: /contracts\.generateClasses/ }))
      await waitFor(() => {
        expect(mockGenerate).toHaveBeenCalledWith(100, 1)
      })
    })

    it('shows the success result message after generating', async () => {
      mockGenerate.mockResolvedValue({ created: 7 } as never)
      renderDetail()
      fireEvent.click(screen.getByRole('button', { name: /contracts\.generateClasses/ }))
      await waitFor(() => {
        expect(screen.getByText('contracts.generateResult')).toBeTruthy()
      })
    })

    it('shows the error message when generate fails', async () => {
      mockGenerate.mockRejectedValue(new Error('boom') as never)
      renderDetail()
      fireEvent.click(screen.getByRole('button', { name: /contracts\.generateClasses/ }))
      await waitFor(() => {
        expect(screen.getByText('contracts.errors.generate')).toBeTruthy()
      })
    })
  })

  describe('delete future classes flow', () => {
    it('shows the delete future button', () => {
      renderDetail()
      const deleteButton = screen.getByRole('button', { name: /contracts\.deleteFutureClasses/ })
      expect(deleteButton).toBeTruthy()
    })

    it('disables the delete future button when in edit mode', () => {
      renderDetail({ isEditMode: true })
      const deleteButton = screen.getByRole('button', { name: /contracts\.deleteFutureClasses/ })
      expect((deleteButton as HTMLButtonElement).disabled).toBe(true)
    })

    it('opens the confirmation bar when delete future button is clicked', () => {
      renderDetail()
      fireEvent.click(screen.getByRole('button', { name: /contracts\.deleteFutureClasses/ }))
      expect(screen.getByText('contracts.deleteFutureConfirm')).toBeTruthy()
    })

    it('hides the confirmation bar when cancel is clicked in the confirm bar', () => {
      renderDetail()
      fireEvent.click(screen.getByRole('button', { name: /contracts\.deleteFutureClasses/ }))
      fireEvent.click(screen.getByRole('button', { name: /actions\.cancel/ }))
      expect(screen.queryByText('contracts.deleteFutureConfirm')).toBeFalsy()
    })

    it('calls clientService.deleteFutureContractClasses when confirm delete is clicked', async () => {
      renderDetail()
      fireEvent.click(screen.getByRole('button', { name: /contracts\.deleteFutureClasses/ }))
      fireEvent.click(screen.getByRole('button', { name: /actions\.delete/ }))
      await waitFor(() => {
        expect(mockDeleteFuture).toHaveBeenCalledWith(100, 1)
      })
    })

    it('shows the delete result message after confirming delete', async () => {
      mockDeleteFuture.mockResolvedValue({ deleted: 4 } as never)
      renderDetail()
      fireEvent.click(screen.getByRole('button', { name: /contracts\.deleteFutureClasses/ }))
      fireEvent.click(screen.getByRole('button', { name: /actions\.delete/ }))
      await waitFor(() => {
        expect(screen.getByText('contracts.deleteResult')).toBeTruthy()
      })
    })
  })
})
