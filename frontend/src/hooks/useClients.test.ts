/**
 * Tests for useClients hook.
 *
 * Key behaviors:
 *  - filterActive mapping ('active' / 'archived' / 'all') → correct service args
 *  - search string forwarded (or undefined when empty)
 *  - active clients sorted before archived ones in the returned array
 *  - updateClientContracts / updateClientPayers patch local state without refetching
 */
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { clientService } from '../services/client.service'
import { useClients } from './useClients'

vi.mock('../context/ToastContext', () => ({
  useToast: () => ({ addToast: vi.fn() }),
}))

vi.mock('../services/client.service', () => ({
  clientService: {
    getAll: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    archive: vi.fn(),
    activate: vi.fn(),
    hardDelete: vi.fn(),
  },
}))

const mockGetAll = vi.mocked(clientService.getAll)

beforeEach(() => {
  vi.clearAllMocks()
  mockGetAll.mockResolvedValue([])
})

// ─── filterActive mapping ────────────────────────────────────────────────────

describe('filterActive → service arguments', () => {
  it('active → isActive=true, deleted_filter="exclude"', async () => {
    renderHook(() => useClients('', 'active'))

    await waitFor(() =>
      expect(mockGetAll).toHaveBeenCalledWith({
        search: undefined,
        isActive: true,
        deleted_filter: 'exclude',
      }),
    )
  })

  it('archived → isActive=undefined, deleted_filter="only"', async () => {
    renderHook(() => useClients('', 'archived'))

    await waitFor(() =>
      expect(mockGetAll).toHaveBeenCalledWith({
        search: undefined,
        isActive: undefined,
        deleted_filter: 'only',
      }),
    )
  })

  it('all → isActive=undefined, deleted_filter="include"', async () => {
    renderHook(() => useClients('', 'all'))

    await waitFor(() =>
      expect(mockGetAll).toHaveBeenCalledWith({
        search: undefined,
        isActive: undefined,
        deleted_filter: 'include',
      }),
    )
  })
})

// ─── search ─────────────────────────────────────────────────────────────────

describe('search forwarding', () => {
  it('passes non-empty search string to the service', async () => {
    renderHook(() => useClients('ana', 'all'))

    await waitFor(() =>
      expect(mockGetAll).toHaveBeenCalledWith(expect.objectContaining({ search: 'ana' })),
    )
  })

  it('passes undefined when search is empty string', async () => {
    renderHook(() => useClients('', 'all'))

    await waitFor(() =>
      expect(mockGetAll).toHaveBeenCalledWith(expect.objectContaining({ search: undefined })),
    )
  })
})

// ─── sorting ─────────────────────────────────────────────────────────────────

describe('sorting', () => {
  it('active clients appear before archived ones', async () => {
    mockGetAll.mockResolvedValue([
      { id: 1, name: 'Archivado', isActive: false },
      { id: 2, name: 'Activo', isActive: true },
    ] as never)

    const { result } = renderHook(() => useClients('', 'all'))

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.clients[0].name).toBe('Activo')
    expect(result.current.clients[1].name).toBe('Archivado')
  })
})

// ─── loading state ───────────────────────────────────────────────────────────

describe('loading state', () => {
  it('isLoading starts true and becomes false after load', async () => {
    const { result } = renderHook(() => useClients('', 'all'))

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => expect(result.current.isLoading).toBe(false))
  })
})

// ─── local state updaters ─────────────────────────────────────────────────────

describe('updateClientContracts', () => {
  it('replaces contracts for the target client without re-fetching', async () => {
    mockGetAll.mockResolvedValue([
      { id: 1, name: 'Cliente', isActive: true, contracts: [] },
    ] as never)
    const { result } = renderHook(() => useClients('', 'all'))

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    const newContracts = [{ id: 99 }] as never
    act(() => result.current.updateClientContracts(1, newContracts))

    expect(result.current.clients[0].contracts).toEqual(newContracts)
    // Should NOT have triggered an extra fetch
    expect(mockGetAll).toHaveBeenCalledTimes(1)
  })

  it('does not affect other clients', async () => {
    mockGetAll.mockResolvedValue([
      { id: 1, name: 'A', isActive: true, contracts: [] },
      { id: 2, name: 'B', isActive: true, contracts: [] },
    ] as never)
    const { result } = renderHook(() => useClients('', 'all'))

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    act(() => result.current.updateClientContracts(1, [{ id: 99 }] as never))

    expect(result.current.clients[1].contracts).toEqual([])
  })
})

describe('updateClientPayers', () => {
  it('replaces payers for the target client without re-fetching', async () => {
    mockGetAll.mockResolvedValue([{ id: 1, name: 'Cliente', isActive: true, payers: [] }] as never)
    const { result } = renderHook(() => useClients('', 'all'))

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    const newPayers = [{ id: 55, name: 'Transferencia' }] as never
    act(() => result.current.updateClientPayers(1, newPayers))

    expect(result.current.clients[0].payers).toEqual(newPayers)
  })
})
