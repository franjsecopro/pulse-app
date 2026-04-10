/**
 * Tests for useClients hook.
 *
 * Key behaviors:
 *  - filterActive mapping ('active' / 'archived' / 'all') → correct service args
 *  - search string forwarded (or undefined when empty)
 *  - active clients sorted before archived ones in the returned array
 *  - updateClientContracts / updateClientPayers patch local state without refetching
 */
import { renderHook, waitFor, act } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { useClients } from './useClients'
import { clientService } from '../services/client.service'

vi.mock('../services/client.service', () => ({
  clientService: {
    getAll:     vi.fn(),
    create:     vi.fn(),
    update:     vi.fn(),
    archive:    vi.fn(),
    activate:   vi.fn(),
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
  it('active → is_active=true, deleted_filter="exclude"', async () => {
    renderHook(() => useClients('', 'active'))

    await waitFor(() =>
      expect(mockGetAll).toHaveBeenCalledWith({
        search: undefined,
        is_active: true,
        deleted_filter: 'exclude',
      })
    )
  })

  it('archived → is_active=undefined, deleted_filter="only"', async () => {
    renderHook(() => useClients('', 'archived'))

    await waitFor(() =>
      expect(mockGetAll).toHaveBeenCalledWith({
        search: undefined,
        is_active: undefined,
        deleted_filter: 'only',
      })
    )
  })

  it('all → is_active=undefined, deleted_filter="include"', async () => {
    renderHook(() => useClients('', 'all'))

    await waitFor(() =>
      expect(mockGetAll).toHaveBeenCalledWith({
        search: undefined,
        is_active: undefined,
        deleted_filter: 'include',
      })
    )
  })
})


// ─── search ─────────────────────────────────────────────────────────────────

describe('search forwarding', () => {
  it('passes non-empty search string to the service', async () => {
    renderHook(() => useClients('ana', 'all'))

    await waitFor(() =>
      expect(mockGetAll).toHaveBeenCalledWith(
        expect.objectContaining({ search: 'ana' })
      )
    )
  })

  it('passes undefined when search is empty string', async () => {
    renderHook(() => useClients('', 'all'))

    await waitFor(() =>
      expect(mockGetAll).toHaveBeenCalledWith(
        expect.objectContaining({ search: undefined })
      )
    )
  })
})


// ─── sorting ─────────────────────────────────────────────────────────────────

describe('sorting', () => {
  it('active clients appear before archived ones', async () => {
    mockGetAll.mockResolvedValue([
      { id: 1, name: 'Archivado', is_active: false } as any,
      { id: 2, name: 'Activo',    is_active: true  } as any,
    ])

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
      { id: 1, name: 'Cliente', is_active: true, contracts: [] } as any,
    ])
    const { result } = renderHook(() => useClients('', 'all'))

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    const newContracts = [{ id: 99 }] as any
    act(() => result.current.updateClientContracts(1, newContracts))

    expect(result.current.clients[0].contracts).toEqual(newContracts)
    // Should NOT have triggered an extra fetch
    expect(mockGetAll).toHaveBeenCalledTimes(1)
  })

  it('does not affect other clients', async () => {
    mockGetAll.mockResolvedValue([
      { id: 1, name: 'A', is_active: true, contracts: [] } as any,
      { id: 2, name: 'B', is_active: true, contracts: [] } as any,
    ])
    const { result } = renderHook(() => useClients('', 'all'))

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    act(() => result.current.updateClientContracts(1, [{ id: 99 }] as any))

    expect(result.current.clients[1].contracts).toEqual([])
  })
})

describe('updateClientPayers', () => {
  it('replaces payers for the target client without re-fetching', async () => {
    mockGetAll.mockResolvedValue([
      { id: 1, name: 'Cliente', is_active: true, payers: [] } as any,
    ])
    const { result } = renderHook(() => useClients('', 'all'))

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    const newPayers = [{ id: 55, name: 'Transferencia' }] as any
    act(() => result.current.updateClientPayers(1, newPayers))

    expect(result.current.clients[0].payers).toEqual(newPayers)
  })
})
