import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Clients } from './Clients'

vi.mock('../context/AuthContext', () => ({
  useAuth: vi.fn(),
}))

vi.mock('../hooks/useClients', () => ({
  useClients: vi.fn(),
}))

vi.mock('../services/client.service', () => ({
  clientService: {
    getById: vi.fn(),
  },
}))

vi.mock('../i18n', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { returnObjects?: boolean }) => {
      if (key === 'common.weekdays.short' && opts?.returnObjects) {
        return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
      }
      return key
    },
  }),
}))

import { useAuth } from '../context/AuthContext'
import { useClients } from '../hooks/useClients'
import { clientService } from '../services/client.service'
import type { Client } from '../types'

const mockUseAuth = vi.mocked(useAuth)
const mockUseClients = vi.mocked(useClients)
const mockGetById = vi.mocked(clientService.getById)

const mockCreateClient = vi.fn()
const mockUpdateClient = vi.fn()
const mockArchiveClient = vi.fn()
const mockActivateClient = vi.fn()
const mockHardDeleteClient = vi.fn()
const mockUpdateClientContracts = vi.fn()
const mockUpdateClientPayers = vi.fn()

function makeHook(overrides: Partial<ReturnType<typeof useClients>> = {}) {
  return {
    clients: [],
    isLoading: false,
    loadClients: vi.fn(),
    createClient: mockCreateClient,
    updateClient: mockUpdateClient,
    archiveClient: mockArchiveClient,
    activateClient: mockActivateClient,
    hardDeleteClient: mockHardDeleteClient,
    updateClientContracts: mockUpdateClientContracts,
    updateClientPayers: mockUpdateClientPayers,
    ...overrides,
  }
}

function renderClients() {
  return render(
    <MemoryRouter>
      <Clients />
    </MemoryRouter>,
  )
}

const makeClient = (overrides: Partial<Client> = {}): Client => ({
  id: 1,
  name: 'Juan García',
  payment_name: null,
  email: 'juan@test.com',
  phone: '+34666555444',
  whatsapp_phone: null,
  address: null,
  tax_id: null,
  payment_timing: 'same_month',
  is_active: true,
  created_at: '2026-01-01',
  archived_at: null,
  contracts: [],
  payers: [],
  ...overrides,
})

beforeEach(() => {
  vi.clearAllMocks()
  mockUseAuth.mockReturnValue({
    user: { id: 1, email: 'admin@test.com', role: 'admin' },
    isLoading: false,
  } as never)
  mockUseClients.mockReturnValue(makeHook() as never)
  mockGetById.mockResolvedValue(makeClient() as never)
})

describe('Clients', () => {
  describe('header', () => {
    it('renders the page title and subtitle', () => {
      renderClients()
      expect(screen.getByText('clients.title')).toBeTruthy()
      expect(screen.getByText('clients.subtitle')).toBeTruthy()
    })

    it('renders the new client primary button in the header', () => {
      renderClients()
      const newClientButton = screen.getByRole('button', { name: /clients\.newClient/ })
      expect(newClientButton).toBeTruthy()
      expect(newClientButton.getAttribute('type')).toBe('button')
    })
  })

  describe('loading state', () => {
    it('shows a spinner when isLoading is true', () => {
      mockUseClients.mockReturnValue(makeHook({ isLoading: true, clients: [] }) as never)
      renderClients()
      const spinner = document.querySelector('.material-symbols-outlined.animate-spin')
      expect(spinner).toBeTruthy()
    })
  })

  describe('empty state', () => {
    beforeEach(() => {
      mockUseClients.mockReturnValue(makeHook({ clients: [], isLoading: false }) as never)
    })

    it('shows the empty state message', () => {
      renderClients()
      expect(screen.getByText('clients.empty')).toBeTruthy()
    })

    it('renders the addFirst button in the empty state', () => {
      renderClients()
      const addFirstButton = screen.getByRole('button', { name: /clients\.addFirst/ })
      expect(addFirstButton).toBeTruthy()
    })
  })

  describe('client list (active client)', () => {
    beforeEach(() => {
      mockUseClients.mockReturnValue(
        makeHook({ clients: [makeClient()], isLoading: false }) as never,
      )
    })

    it('renders one ClientCard per client', () => {
      renderClients()
      expect(screen.getByText('Juan García')).toBeTruthy()
    })

    it('opens the create modal when the newClient button is clicked', () => {
      renderClients()
      const newClientButton = screen.getByRole('button', { name: /clients\.newClient/ })
      fireEvent.click(newClientButton)
      const closeButton = screen.getByLabelText('Close')
      expect(closeButton).toBeTruthy()
    })

    it('opens the edit modal and calls clientService.getById when the edit button is clicked', async () => {
      renderClients()
      const editButton = screen.getByTitle('clients.edit')
      fireEvent.click(editButton)
      await waitFor(() => {
        expect(mockGetById).toHaveBeenCalledWith(1, false)
      })
      const closeButton = screen.getByLabelText('Close')
      expect(closeButton).toBeTruthy()
    })

    it('opens the archive ConfirmDialog when the delete (archive) button is clicked', () => {
      renderClients()
      const archiveButton = screen.getByTitle('clients.archiveTooltip')
      fireEvent.click(archiveButton)
      expect(screen.getByText('clients.archiveTitle')).toBeTruthy()
      expect(screen.getByText('clients.archiveMessage')).toBeTruthy()
    })

    it('opens the manageContracts modal when the description button is clicked', () => {
      renderClients()
      const manageButton = screen.getByTitle('clients.manageContracts')
      fireEvent.click(manageButton)
      const closeButton = screen.getByLabelText('Close')
      expect(closeButton).toBeTruthy()
    })
  })

  describe('archived client', () => {
    const archivedClient = makeClient({ archived_at: '2026-01-01', is_active: false })

    beforeEach(() => {
      mockUseClients.mockReturnValue(
        makeHook({ clients: [archivedClient], isLoading: false }) as never,
      )
    })

    it('shows the activate button when the client is archived', () => {
      renderClients()
      const activateButton = screen.getByTitle('clients.activateTooltip')
      expect(activateButton).toBeTruthy()
    })

    it('opens the activate ConfirmDialog when the activate button is clicked', () => {
      renderClients()
      const activateButton = screen.getByTitle('clients.activateTooltip')
      fireEvent.click(activateButton)
      expect(screen.getByText('clients.activateTitle')).toBeTruthy()
      expect(screen.getByText('clients.activateMessage')).toBeTruthy()
    })
  })

  describe('admin-only hard delete', () => {
    const archivedClient = makeClient({ archived_at: '2026-01-01', is_active: false })

    it('passes onHardDelete to ClientCard when user role is admin', () => {
      mockUseAuth.mockReturnValue({
        user: { id: 1, email: 'admin@test.com', role: 'admin' },
        isLoading: false,
      } as never)
      mockUseClients.mockReturnValue(
        makeHook({ clients: [archivedClient], isLoading: false }) as never,
      )
      renderClients()
      const hardDeleteButton = screen.getByTitle('clients.hardDeleteTooltip')
      expect(hardDeleteButton).toBeTruthy()
    })

    it('does NOT pass onHardDelete to ClientCard when user role is not admin', () => {
      mockUseAuth.mockReturnValue({
        user: { id: 1, email: 'user@test.com', role: 'user' },
        isLoading: false,
      } as never)
      mockUseClients.mockReturnValue(
        makeHook({ clients: [archivedClient], isLoading: false }) as never,
      )
      renderClients()
      const hardDeleteButton = screen.queryByTitle('clients.hardDeleteTooltip')
      expect(hardDeleteButton).toBeFalsy()
    })

    it('opens the hardDelete ConfirmDialog when the delete_forever button is clicked', () => {
      mockUseAuth.mockReturnValue({
        user: { id: 1, email: 'admin@test.com', role: 'admin' },
        isLoading: false,
      } as never)
      mockUseClients.mockReturnValue(
        makeHook({ clients: [archivedClient], isLoading: false }) as never,
      )
      renderClients()
      const hardDeleteButton = screen.getByTitle('clients.hardDeleteTooltip')
      fireEvent.click(hardDeleteButton)
      expect(screen.getByText('clients.hardDeleteTitle')).toBeTruthy()
    })
  })
})
