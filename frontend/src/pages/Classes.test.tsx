import { fireEvent, render, screen } from '@testing-library/react'
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Classes } from './Classes'

vi.mock('../hooks/useClasses', () => ({
  useClasses: vi.fn(),
}))

vi.mock('../components/classes/CalendarView', () => ({
  CalendarView: () => React.createElement('div', { 'data-testid': 'mock-calendar-view' }),
}))

vi.mock('../components/classes/ClassForm', () => ({
  ClassForm: () => React.createElement('div', { 'data-testid': 'mock-class-form' }),
}))

vi.mock('../components/classes/DayView', () => ({
  DayView: () => React.createElement('div', { 'data-testid': 'mock-day-view' }),
}))

vi.mock('../components/ui/ConfirmModal', () => ({
  ConfirmModal: ({ isOpen, message }: { isOpen: boolean; message: string }) => {
    if (!isOpen) return null
    return React.createElement('div', { 'data-testid': 'mock-confirm-modal' }, message)
  },
}))

vi.mock('../components/ui/Pagination', () => ({
  Pagination: () => React.createElement('div', { 'data-testid': 'mock-pagination' }),
}))

vi.mock('../i18n', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { returnObjects?: boolean }) => {
      if (key === 'common.months.full' && opts?.returnObjects) {
        return ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio']
      }
      if (key === 'common.weekdays.short' && opts?.returnObjects) {
        return ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
      }
      return key
    },
  }),
}))

import { useClasses } from '../hooks/useClasses'
import type { ClassSession, Client } from '../types'

const mockUseClasses = vi.mocked(useClasses)

const mockCreateClass = vi.fn()
const mockUpdateClass = vi.fn()
const mockRequestDelete = vi.fn()
const mockConfirmDelete = vi.fn()
const mockCancelDelete = vi.fn()
const mockSyncGCal = vi.fn()
const mockGoToPage = vi.fn()

function makeClass(overrides: Partial<ClassSession> = {}): ClassSession {
  return {
    id: 1,
    userId: 1,
    clientId: 1,
    contractId: null,
    classDate: '2026-06-15',
    classTime: '16:00',
    durationHours: 1.5,
    hourlyRate: 30,
    status: 'normal',
    notes: null,
    googleCalendarId: null,
    createdAt: '2026-06-01',
    clientName: 'Juan García',
    contractDescription: null,
    totalAmount: 45,
    ...overrides,
  }
}

function makeHook(overrides: Partial<ReturnType<typeof useClasses>> = {}) {
  return {
    classes: [],
    clients: [] as Client[],
    isLoading: false,
    isSyncing: false,
    pendingDeleteId: null,
    totalRevenue: 0,
    page: 1,
    pageCount: 1,
    totalCount: 0,
    goToPage: mockGoToPage,
    createClass: mockCreateClass,
    updateClass: mockUpdateClass,
    requestDelete: mockRequestDelete,
    confirmDelete: mockConfirmDelete,
    cancelDelete: mockCancelDelete,
    syncGCal: mockSyncGCal,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  mockUseClasses.mockReturnValue(makeHook() as never)
})

describe('Classes', () => {
  describe('header', () => {
    it('renders the page title and subtitle', () => {
      render(<Classes />)
      expect(screen.getByText('classes.title')).toBeTruthy()
      expect(screen.getByText('classes.subtitle')).toBeTruthy()
    })

    it('renders the new class primary button in the header', () => {
      render(<Classes />)
      const newClassButton = screen.getByRole('button', {
        name: /classes\.newClass/,
      })
      expect(newClassButton).toBeTruthy()
    })

    it('renders the sync GCal button', () => {
      render(<Classes />)
      const syncButton = screen.getByRole('button', {
        name: /classes\.syncGCal/,
      })
      expect(syncButton).toBeTruthy()
    })

    it('disables the sync GCal button when isSyncing is true', () => {
      mockUseClasses.mockReturnValue(makeHook({ isSyncing: true }) as never)
      render(<Classes />)
      const syncButton = screen.getByRole('button', {
        name: /classes\.syncing/,
      })
      expect((syncButton as HTMLButtonElement).disabled).toBe(true)
    })

    it('calls syncGCal when the sync button is clicked', () => {
      render(<Classes />)
      fireEvent.click(screen.getByRole('button', { name: /classes\.syncGCal/ }))
      expect(mockSyncGCal).toHaveBeenCalledTimes(1)
    })
  })

  describe('view mode toggle', () => {
    it('renders the list view and calendar view toggle buttons', () => {
      render(<Classes />)
      expect(screen.getByRole('button', { name: /classes\.view\.list/ })).toBeTruthy()
      expect(screen.getByRole('button', { name: /classes\.view\.calendar/ })).toBeTruthy()
    })

    it('switches to calendar view and persists in localStorage', () => {
      render(<Classes />)
      fireEvent.click(screen.getByRole('button', { name: /classes\.view\.calendar/ }))
      expect(localStorage.getItem('classes-view')).toBe('calendar')
      expect(screen.getByTestId('mock-calendar-view')).toBeTruthy()
    })

    it('switches back to list view and persists in localStorage', () => {
      localStorage.setItem('classes-view', 'calendar')
      render(<Classes />)
      fireEvent.click(screen.getByRole('button', { name: /classes\.view\.list/ }))
      expect(localStorage.getItem('classes-view')).toBe('list')
    })
  })

  describe('list view states', () => {
    it('shows a spinner while loading', () => {
      mockUseClasses.mockReturnValue(makeHook({ isLoading: true }) as never)
      render(<Classes />)
      const spinner = document.querySelector('.material-symbols-outlined.animate-spin')
      expect(spinner).toBeTruthy()
    })

    it('shows the empty state when there are no classes', () => {
      mockUseClasses.mockReturnValue(makeHook({ classes: [], totalCount: 0 }) as never)
      render(<Classes />)
      expect(screen.getByText('classes.empty.list')).toBeTruthy()
    })

    it('shows the registerFirst button in the empty state', () => {
      mockUseClasses.mockReturnValue(makeHook({ classes: [], totalCount: 0 }) as never)
      render(<Classes />)
      const registerFirstButton = screen.getByRole('button', {
        name: /classes\.registerFirst/,
      })
      expect(registerFirstButton).toBeTruthy()
    })

    it('renders the classes table when there are classes', () => {
      mockUseClasses.mockReturnValue(makeHook({ classes: [makeClass()], totalCount: 1 }) as never)
      render(<Classes />)
      expect(screen.getByText('Juan García')).toBeTruthy()
      expect(screen.getByTestId('mock-pagination')).toBeTruthy()
    })
  })

  describe('per-row actions', () => {
    beforeEach(() => {
      mockUseClasses.mockReturnValue(makeHook({ classes: [makeClass()], totalCount: 1 }) as never)
    })

    it('opens the edit modal when the row edit button is clicked', () => {
      render(<Classes />)
      const editIcon = screen.getByText('edit')
      fireEvent.click(editIcon.closest('button') as HTMLElement)
      expect(screen.getByTestId('mock-class-form')).toBeTruthy()
    })

    it('calls requestDelete when the row delete button is clicked', () => {
      render(<Classes />)
      const deleteIcon = screen.getByText('delete')
      fireEvent.click(deleteIcon.closest('button') as HTMLElement)
      expect(mockRequestDelete).toHaveBeenCalledWith(1)
    })
  })

  describe('new class modal', () => {
    it('opens the create modal when the new class button is clicked', () => {
      render(<Classes />)
      fireEvent.click(screen.getByRole('button', { name: /classes\.newClass/ }))
      expect(screen.getByTestId('mock-class-form')).toBeTruthy()
    })
  })

  describe('delete confirmation', () => {
    it('shows the ConfirmModal when pendingDeleteId is set', () => {
      mockUseClasses.mockReturnValue(
        makeHook({
          pendingDeleteId: 1,
          classes: [makeClass()],
          totalCount: 1,
        }) as never,
      )
      render(<Classes />)
      const confirmModal = screen.getByTestId('mock-confirm-modal')
      expect(confirmModal).toBeTruthy()
      expect(confirmModal.textContent).toContain('classes.deleteConfirm')
    })
  })
})
