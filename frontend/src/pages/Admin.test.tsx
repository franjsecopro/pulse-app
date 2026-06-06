import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Admin } from './Admin'

vi.mock('../context/AuthContext', () => ({
  useAuth: vi.fn(),
}))

vi.mock('../services/admin.service', () => ({
  adminService: {
    listUsers: vi.fn(),
    setUserRole: vi.fn(),
    deleteUser: vi.fn(),
    syncGCal: vi.fn(),
    listClients: vi.fn(),
    moveClientFromDemo: vi.fn(),
    hardDeleteClient: vi.fn(),
    moveClientToDemo: vi.fn(),
    demoStatus: vi.fn(),
    demoEnter: vi.fn(),
    demoExit: vi.fn(),
    demoReset: vi.fn(),
  },
}))

vi.mock('../components/ui/ConfirmModal', () => ({
  ConfirmModal: ({ isOpen, message }: { isOpen: boolean; message: string }) => {
    if (!isOpen) return null
    return React.createElement('div', { 'data-testid': 'mock-confirm-modal' }, message)
  },
}))

vi.mock('../components/ui/DoubleConfirmModal', () => ({
  DoubleConfirmModal: ({ isOpen, warningMessage }: { isOpen: boolean; warningMessage: string }) => {
    if (!isOpen) return null
    return React.createElement(
      'div',
      { 'data-testid': 'mock-double-confirm-modal' },
      warningMessage,
    )
  },
}))

vi.mock('../i18n', () => ({
  default: { language: 'es' },
  useTranslation: () => ({ t: (key: string) => key }),
}))

import { useAuth } from '../context/AuthContext'
import { adminService } from '../services/admin.service'
import type { AdminClient } from '../types'

const mockUseAuth = vi.mocked(useAuth)
const mockListUsers = vi.mocked(adminService.listUsers)
const mockSyncGCal = vi.mocked(adminService.syncGCal)
const mockDeleteUser = vi.mocked(adminService.deleteUser)
const mockListClients = vi.mocked(adminService.listClients)
const mockMoveToDemo = vi.mocked(adminService.moveClientToDemo)
const mockMoveFromDemo = vi.mocked(adminService.moveClientFromDemo)
const mockHardDeleteClient = vi.mocked(adminService.hardDeleteClient)
const mockDemoEnter = vi.mocked(adminService.demoEnter)
const mockDemoExit = vi.mocked(adminService.demoExit)
const mockDemoReset = vi.mocked(adminService.demoReset)

const mockReloadUser = vi.fn()

const fakeUsers = [
  { id: 1, email: 'admin@test.com', role: 'admin' as const, created_at: '2026-01-01' },
  { id: 2, email: 'user@test.com', role: 'user' as const, created_at: '2026-01-02' },
]

const fakeClients: AdminClient[] = [
  {
    id: 10,
    name: 'Juan',
    owner_id: 1,
    owner_email: 'admin@test.com',
    is_active: true,
    archived_at: null,
  },
  {
    id: 11,
    name: 'María',
    owner_id: 1,
    owner_email: 'admin@test.com',
    is_active: false,
    archived_at: '2026-01-01',
  },
]

function renderAdmin() {
  return render(<Admin />)
}

beforeEach(() => {
  vi.clearAllMocks()
  mockUseAuth.mockReturnValue({
    user: {
      id: 1,
      email: 'admin@test.com',
      role: 'admin',
      locale: 'es',
      is_demo_active: false,
    },
    isLoading: false,
    isDemoActive: false,
    reloadUser: mockReloadUser,
  } as never)
  mockListUsers.mockResolvedValue(fakeUsers as never)
  mockListClients.mockResolvedValue(fakeClients as never)
  mockSyncGCal.mockResolvedValue({ scheduled: 5 } as never)
  mockMoveToDemo.mockResolvedValue({ moved: 1, name: 'Juan' } as never)
  mockMoveFromDemo.mockResolvedValue({ moved: 1, name: 'Juan' } as never)
  mockHardDeleteClient.mockResolvedValue({ deleted: 1, name: 'Juan' } as never)
  mockDeleteUser.mockResolvedValue(undefined as never)
  mockDemoEnter.mockResolvedValue({} as never)
  mockDemoExit.mockResolvedValue({} as never)
  mockDemoReset.mockResolvedValue({ clients_count: 1, classes_count: 5, reseed_at: '' } as never)
})

describe('Admin', () => {
  describe('header & tabs', () => {
    it('renders the page title and subtitle', () => {
      renderAdmin()
      expect(screen.getByText('admin.title')).toBeTruthy()
      expect(screen.getByText('admin.subtitle')).toBeTruthy()
    })

    it('renders the three tab buttons (users, clients, demo)', () => {
      renderAdmin()
      expect(screen.getByRole('button', { name: /admin\.tab\.users/ })).toBeTruthy()
      expect(screen.getByRole('button', { name: /admin\.tab\.clients/ })).toBeTruthy()
      expect(screen.getByRole('button', { name: /admin\.tab\.demo/ })).toBeTruthy()
    })

    it('starts with the users tab active by default', async () => {
      renderAdmin()
      await waitFor(() => {
        expect(screen.getByText('admin@test.com')).toBeTruthy()
      })
    })
  })

  describe('users tab', () => {
    it('renders the users table with fetched users', async () => {
      renderAdmin()
      await waitFor(() => {
        expect(screen.getByText('user@test.com')).toBeTruthy()
      })
    })

    it('calls adminService.syncGCal when the sync button is clicked', async () => {
      renderAdmin()
      await waitFor(() => {
        expect(screen.getAllByTitle('admin.users.syncTooltip').length).toBeGreaterThan(0)
      })
      fireEvent.click(screen.getAllByTitle('admin.users.syncTooltip')[0])
      await waitFor(() => {
        expect(mockSyncGCal).toHaveBeenCalled()
      })
    })

    it('opens the ConfirmModal when the delete user button is clicked', async () => {
      renderAdmin()
      await waitFor(() => {
        expect(screen.getAllByTitle('admin.users.deleteTooltip').length).toBeGreaterThan(0)
      })
      fireEvent.click(screen.getAllByTitle('admin.users.deleteTooltip')[0])
      await waitFor(() => {
        expect(screen.getByTestId('mock-confirm-modal')).toBeTruthy()
      })
    })
  })

  describe('clients tab', () => {
    beforeEach(() => {
      mockListUsers.mockResolvedValue([] as never)
    })

    it('switches to clients tab and renders the clients table', async () => {
      renderAdmin()
      fireEvent.click(screen.getByRole('button', { name: /admin\.tab\.clients/ }))
      await waitFor(() => {
        expect(screen.getByText('Juan')).toBeTruthy()
        expect(screen.getByText('María')).toBeTruthy()
      })
    })

    it('calls adminService.moveClientToDemo when the move-to-demo button is clicked', async () => {
      renderAdmin()
      fireEvent.click(screen.getByRole('button', { name: /admin\.tab\.clients/ }))
      await waitFor(() => {
        expect(screen.getByText('Juan')).toBeTruthy()
      })
      const moveButton = screen
        .getAllByText('admin.clients.moveToDemo')[0]
        .closest('button') as HTMLElement
      fireEvent.click(moveButton)
      await waitFor(() => {
        expect(mockMoveToDemo).toHaveBeenCalled()
      })
    })

    it('opens the DoubleConfirmModal when the delete-forever button is clicked', async () => {
      renderAdmin()
      fireEvent.click(screen.getByRole('button', { name: /admin\.tab\.clients/ }))
      await waitFor(() => {
        expect(screen.getByText('Juan')).toBeTruthy()
      })
      const deleteButton = screen.getAllByText('actions.delete')[0].closest('button') as HTMLElement
      fireEvent.click(deleteButton)
      await waitFor(() => {
        expect(screen.getByTestId('mock-double-confirm-modal')).toBeTruthy()
      })
    })
  })

  describe('demo tab', () => {
    it('switches to demo tab and shows the enter button when not in demo', async () => {
      renderAdmin()
      fireEvent.click(screen.getByRole('button', { name: /admin\.tab\.demo/ }))
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /admin\.demo\.enter/ })).toBeTruthy()
      })
    })

    it('calls adminService.demoEnter and reloadUser when enter is clicked', async () => {
      renderAdmin()
      fireEvent.click(screen.getByRole('button', { name: /admin\.tab\.demo/ }))
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /admin\.demo\.enter/ })).toBeTruthy()
      })
      fireEvent.click(screen.getByRole('button', { name: /admin\.demo\.enter/ }))
      await waitFor(() => {
        expect(mockDemoEnter).toHaveBeenCalled()
        expect(mockReloadUser).toHaveBeenCalled()
      })
    })

    it('shows the exit button when isDemoActive is true', async () => {
      mockUseAuth.mockReturnValue({
        user: {
          id: 1,
          email: 'admin@test.com',
          role: 'admin',
          locale: 'es',
          is_demo_active: true,
        },
        isLoading: false,
        isDemoActive: true,
        reloadUser: mockReloadUser,
      } as never)
      renderAdmin()
      fireEvent.click(screen.getByRole('button', { name: /admin\.tab\.demo/ }))
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /admin\.demo\.exit/ })).toBeTruthy()
      })
    })

    it('calls adminService.demoExit when exit is clicked', async () => {
      mockUseAuth.mockReturnValue({
        user: {
          id: 1,
          email: 'admin@test.com',
          role: 'admin',
          locale: 'es',
          is_demo_active: true,
        },
        isLoading: false,
        isDemoActive: true,
        reloadUser: mockReloadUser,
      } as never)
      renderAdmin()
      fireEvent.click(screen.getByRole('button', { name: /admin\.tab\.demo/ }))
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /admin\.demo\.exit/ })).toBeTruthy()
      })
      fireEvent.click(screen.getByRole('button', { name: /admin\.demo\.exit/ }))
      await waitFor(() => {
        expect(mockDemoExit).toHaveBeenCalled()
      })
    })

    it('opens the ConfirmModal when the reset button is clicked', async () => {
      renderAdmin()
      fireEvent.click(screen.getByRole('button', { name: /admin\.tab\.demo/ }))
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /admin\.demo\.reset/ })).toBeTruthy()
      })
      fireEvent.click(screen.getByRole('button', { name: /admin\.demo\.reset/ }))
      await waitFor(() => {
        expect(screen.getByTestId('mock-confirm-modal')).toBeTruthy()
      })
    })
  })
})
