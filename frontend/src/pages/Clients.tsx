import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { Modal } from '../components/ui/Modal'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { ClientForm } from '../components/clients/ClientForm'
import { ClientCard } from '../components/clients/ClientCard'
import { ContractsManager } from '../components/clients/ContractsManager'
import { PayersManager } from '../components/clients/PayersManager'
import { useClients } from '../hooks/useClients'
import { clientService } from '../services/client.service'
import type { Client, Contract, PaymentIdentifier } from '../types'

type FilterActive = 'all' | 'active' | 'archived'

export function Clients() {
  const { user } = useAuth()
  const [search, setSearch] = useState('')
  const [filterActive, setFilterActive] = useState<FilterActive>('all')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingClient, setEditingClient] = useState<Client | null>(null)
  const [contractsClient, setContractsClient] = useState<Client | null>(null)
  const [confirmDialog, setConfirmDialog] = useState<{ action: 'archive' | 'activate'; client: Client } | null>(null)
  const [isConfirmingAction, setIsConfirmingAction] = useState(false)
  const [hardDeleteTarget, setHardDeleteTarget] = useState<Client | null>(null)
  const [isHardDeleting, setIsHardDeleting] = useState(false)

  const {
    clients,
    isLoading,
    createClient,
    updateClient,
    archiveClient,
    activateClient,
    hardDeleteClient,
    updateClientContracts,
    updateClientPayers,
  } = useClients(search, filterActive)

  const handleCreate = async (data: Partial<Client>) => {
    await createClient(data as Omit<Client, 'id' | 'created_at' | 'updated_at' | 'archived_at' | 'contracts'>)
    setShowCreateModal(false)
  }

  const handleUpdate = async (data: Partial<Client>) => {
    if (!editingClient) return
    await updateClient(editingClient.id, data)
    setEditingClient(null)
  }

  const handleConfirmAction = async () => {
    if (!confirmDialog) return
    setIsConfirmingAction(true)
    try {
      if (confirmDialog.action === 'archive') await archiveClient(confirmDialog.client.id)
      else await activateClient(confirmDialog.client.id)
      setConfirmDialog(null)
    } finally {
      setIsConfirmingAction(false)
    }
  }

  const handleHardDelete = async () => {
    if (!hardDeleteTarget) return
    setIsHardDeleting(true)
    try {
      await hardDeleteClient(hardDeleteTarget.id)
      setHardDeleteTarget(null)
    } finally {
      setIsHardDeleting(false)
    }
  }

  const handleContractsChanged = (clientId: number, contracts: Contract[]) => {
    updateClientContracts(clientId, contracts)
    setContractsClient(prev => prev?.id === clientId ? { ...prev, contracts } : prev)
  }

  const handlePayersChanged = (clientId: number, payers: PaymentIdentifier[]) => {
    updateClientPayers(clientId, payers)
    setEditingClient(prev => prev?.id === clientId ? { ...prev, payers } : prev)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Clientes</h1>
          <p className="text-slate-500 text-sm mt-1">
            Administra tu cartera de clientes y contratos.
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 bg-primary hover:bg-primary-hover text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-primary/20 transition-all"
        >
          <span className="material-symbols-outlined">add</span>
          Nuevo cliente
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">
            search
          </span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre..."
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
          />
        </div>
        <select
          value={filterActive}
          onChange={(e) => setFilterActive(e.target.value as FilterActive)}
          className="border border-slate-200 rounded-lg py-2 pl-3 pr-8 text-sm focus:ring-primary focus:border-primary text-slate-600 bg-white"
        >
          <option value="active">Activos</option>
          <option value="archived">Archivados</option>
          <option value="all">Todos</option>
        </select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-32">
          <span className="material-symbols-outlined text-primary text-3xl animate-spin">sync</span>
        </div>
      ) : clients.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-slate-200">
          <span className="material-symbols-outlined text-5xl text-slate-300 block mb-3">group</span>
          <p className="text-slate-500 font-medium">No hay clientes</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="mt-4 text-primary text-sm font-semibold hover:underline"
          >
            Añade tu primer cliente
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {clients.map((client) => (
            <ClientCard
              key={client.id}
              client={client}
              onEdit={async () => {
                const fullClient = await clientService.getById(client.id, !!client.archived_at)
                setEditingClient(fullClient)
              }}
              onDelete={() => setConfirmDialog({ action: 'archive', client })}
              onActivate={() => setConfirmDialog({ action: 'activate', client })}
              onManageContracts={() => setContractsClient(client)}
              onHardDelete={user?.role === 'admin' ? () => setHardDeleteTarget(client) : undefined}
            />
          ))}
        </div>
      )}

      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="Nuevo cliente">
        <ClientForm onSave={handleCreate} onCancel={() => setShowCreateModal(false)} />
      </Modal>

      <Modal isOpen={!!editingClient} onClose={() => setEditingClient(null)} title="Editar cliente" size="lg">
        {editingClient && (
          <div className="space-y-0">
            <ClientForm
              initial={editingClient}
              onSave={handleUpdate}
              onCancel={() => setEditingClient(null)}
            />
            <PayersManager client={editingClient} onPayersChanged={handlePayersChanged} />
          </div>
        )}
      </Modal>

      <Modal isOpen={!!contractsClient} onClose={() => setContractsClient(null)} title="Contratos" size="lg">
        {contractsClient && (
          <ContractsManager
            client={contractsClient}
            onContractsChanged={handleContractsChanged}
            onClose={() => setContractsClient(null)}
          />
        )}
      </Modal>

      <ConfirmDialog
        isOpen={!!confirmDialog}
        title={confirmDialog?.action === 'archive' ? `Archivar a ${confirmDialog?.client.name}` : `Activar a ${confirmDialog?.client.name}`}
        message={
          confirmDialog?.action === 'archive'
            ? 'El cliente quedará inactivo y se ocultará de la lista de activos. Podrás recuperarlo en la sección de Archivados.'
            : 'El cliente volverá a estar activo y visible en tu cartera principal.'
        }
        confirmText={confirmDialog?.action === 'archive' ? 'Archivar' : 'Activar'}
        isDangerous={confirmDialog?.action === 'archive'}
        isLoading={isConfirmingAction}
        onConfirm={handleConfirmAction}
        onCancel={() => setConfirmDialog(null)}
      />

      <ConfirmDialog
        isOpen={!!hardDeleteTarget}
        title={`Eliminar a ${hardDeleteTarget?.name}`}
        message={`¿Eliminar permanentemente a ${hardDeleteTarget?.name} y todos sus datos (contratos, clases, pagos)? Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        isDangerous
        isLoading={isHardDeleting}
        onConfirm={handleHardDelete}
        onCancel={() => setHardDeleteTarget(null)}
      />
    </div>
  )
}
