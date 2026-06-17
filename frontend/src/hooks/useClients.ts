import {
  getClientsAllQueryKeys,
  getClientsListQueryKeys,
} from '../API/queryKeys/clients/clientsQueryKeys'
import { useToast } from '../context/ToastContext'
import { clientService } from '../services/client.service'
import type { Client, Contract, PaymentIdentifier } from '../types'
import { useMutationRequest, useQueryClient, useQueryRequest } from './reactQuery'

type FilterActive = 'all' | 'active' | 'archived'

/** Maps the UI filter to service arguments. Kept verbatim — pinned by useClients.test.ts. */
function toServiceArgs(search: string, filterActive: FilterActive) {
  let isActive: boolean | undefined
  let deletedFilter: 'exclude' | 'include' | 'only'

  if (filterActive === 'active') {
    isActive = true
    deletedFilter = 'exclude'
  } else if (filterActive === 'archived') {
    isActive = undefined
    deletedFilter = 'only'
  } else {
    isActive = undefined
    deletedFilter = 'include'
  }

  return { search: search || undefined, isActive, deletedFilter }
}

export function useClients(search: string, filterActive: FilterActive) {
  const { addToast } = useToast()
  const queryClient = useQueryClient()

  const serviceArgs = toServiceArgs(search, filterActive)
  const listKey = getClientsListQueryKeys(serviceArgs)

  const query = useQueryRequest({
    queryKey: listKey,
    queryFn: () => clientService.getAll(serviceArgs),
    // Sort runs over the cache on read — never mutate the cached array itself.
    select: (data) => [...data].sort((a, b) => Number(b.isActive) - Number(a.isActive)),
  })

  const invalidateClients = () =>
    queryClient.invalidateQueries({ queryKey: getClientsAllQueryKeys() })

  const createMutation = useMutationRequest({
    mutationFn: clientService.create,
    onSuccess: () => {
      addToast('toasts.clientCreated', 'success')
      invalidateClients()
    },
    onError: (error) => addToast('toasts.clientCreateError', 'error', undefined, error.message),
  })

  const updateMutation = useMutationRequest({
    mutationFn: ({ id, data }: { id: number; data: Partial<Client> }) =>
      clientService.update(id, data),
    onSuccess: () => {
      addToast('toasts.clientUpdated', 'success')
      invalidateClients()
    },
    onError: (error) => addToast('toasts.clientUpdateError', 'error', undefined, error.message),
  })

  const archiveMutation = useMutationRequest({
    mutationFn: clientService.archive,
    onSuccess: () => {
      addToast('toasts.clientArchived', 'success')
      invalidateClients()
    },
    onError: (error) => addToast('toasts.clientArchiveError', 'error', undefined, error.message),
  })

  const activateMutation = useMutationRequest({
    mutationFn: clientService.activate,
    onSuccess: () => {
      addToast('toasts.clientActivated', 'success')
      invalidateClients()
    },
    onError: (error) => addToast('toasts.clientActivateError', 'error', undefined, error.message),
  })

  const hardDeleteMutation = useMutationRequest({
    mutationFn: clientService.hardDelete,
    onSuccess: () => {
      addToast('toasts.clientHardDeleted', 'success')
      invalidateClients()
    },
    onError: (error) => addToast('toasts.clientHardDeleteError', 'error', undefined, error.message),
  })

  // Errors are swallowed (the onError toast already informed the user) so the
  // public API keeps its pre-React-Query contract: callers `await` and never catch.
  const swallow = () => undefined

  const createClient = (
    data: Omit<Client, 'id' | 'createdAt' | 'updatedAt' | 'archivedAt' | 'contracts'>,
  ) => createMutation.mutateAsync(data).then(swallow, swallow)

  const updateClient = (id: number, data: Partial<Client>) =>
    updateMutation.mutateAsync({ id, data }).then(swallow, swallow)

  const archiveClient = (id: number) => archiveMutation.mutateAsync(id).then(swallow, swallow)

  const activateClient = (id: number) => activateMutation.mutateAsync(id).then(swallow, swallow)

  const hardDeleteClient = (id: number) => hardDeleteMutation.mutateAsync(id).then(swallow, swallow)

  // Local cache patches — contracts/payers are edited in nested managers that
  // already saved server-side; a refetch here would be a wasted round-trip.
  const updateClientContracts = (clientId: number, contracts: Contract[]) => {
    queryClient.setQueryData<Client[]>(listKey, (prev) =>
      prev?.map((c) => (c.id === clientId ? { ...c, contracts } : c)),
    )
  }

  const updateClientPayers = (clientId: number, payers: PaymentIdentifier[]) => {
    queryClient.setQueryData<Client[]>(listKey, (prev) =>
      prev?.map((c) => (c.id === clientId ? { ...c, payers } : c)),
    )
  }

  return {
    clients: query.data ?? [],
    isLoading: query.isLoading,
    loadClients: invalidateClients,
    createClient,
    updateClient,
    archiveClient,
    activateClient,
    hardDeleteClient,
    updateClientContracts,
    updateClientPayers,
  }
}
