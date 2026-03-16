import { useState, useEffect, useCallback, type FormEvent } from 'react'
import { clientService } from '../services/client.service'
import { Modal } from '../components/ui/Modal'
import type { Client, Contract } from '../types'

// --- Client Form ---
function ClientForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: Partial<Client>
  onSave: (data: Partial<Client>) => Promise<void>
  onCancel: () => void
}) {
  const [form, setForm] = useState({
    name: initial?.name ?? '',
    payment_name: initial?.payment_name ?? '',
    email: initial?.email ?? '',
    phone: initial?.phone ?? '',
    address: initial?.address ?? '',
    is_active: initial?.is_active ?? true,
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)
    try {
      await onSave(form)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className="block text-sm font-semibold text-slate-700 mb-1">Nombre *</label>
          <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">Nombre para matching bancario</label>
          <input value={form.payment_name} onChange={e => setForm(f => ({ ...f, payment_name: e.target.value }))}
            placeholder="Ej: García"
            className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">Email</label>
          <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">Teléfono</label>
          <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
            className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">Dirección</label>
          <input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
            className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm" />
        </div>
        <div className="flex items-center gap-3 mt-2">
          <input type="checkbox" id="is_active" checked={form.is_active}
            onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
            className="w-4 h-4 accent-primary" />
          <label htmlFor="is_active" className="text-sm font-medium text-slate-700">Cliente activo</label>
        </div>
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onCancel}
          className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors">
          Cancelar
        </button>
        <button type="submit" disabled={isSubmitting}
          className="px-6 py-2 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary-hover transition-colors disabled:opacity-60 shadow-md shadow-primary/20 flex items-center gap-2">
          {isSubmitting && <span className="material-symbols-outlined text-base animate-spin">sync</span>}
          Guardar
        </button>
      </div>
    </form>
  )
}

// --- Contract Form ---
function ContractForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: Partial<Contract>
  onSave: (data: Partial<Contract>) => Promise<void>
  onCancel: () => void
}) {
  const [form, setForm] = useState({
    description: initial?.description ?? '',
    start_date: initial?.start_date ?? new Date().toISOString().split('T')[0],
    end_date: initial?.end_date ?? '',
    hourly_rate: initial?.hourly_rate ?? 0,
    is_active: initial?.is_active ?? true,
    notes: initial?.notes ?? '',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)
    try {
      await onSave({ ...form, end_date: form.end_date || null })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
      )}
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-1">Descripción *</label>
        <input required value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          placeholder="Ej: Clases de inglés"
          className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">Fecha inicio *</label>
          <input required type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
            className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">Fecha fin</label>
          <input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
            className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">Tarifa €/hora *</label>
          <input required type="number" step="0.01" min="0" value={form.hourly_rate}
            onChange={e => setForm(f => ({ ...f, hourly_rate: parseFloat(e.target.value) }))}
            className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm" />
        </div>
        <div className="flex items-end pb-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
              className="w-4 h-4 accent-primary" />
            <span className="text-sm font-medium text-slate-700">Contrato activo</span>
          </label>
        </div>
      </div>
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-1">Notas</label>
        <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2}
          className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm resize-none" />
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onCancel}
          className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors">
          Cancelar
        </button>
        <button type="submit" disabled={isSubmitting}
          className="px-6 py-2 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary-hover transition-colors disabled:opacity-60 shadow-md shadow-primary/20 flex items-center gap-2">
          {isSubmitting && <span className="material-symbols-outlined text-base animate-spin">sync</span>}
          Guardar contrato
        </button>
      </div>
    </form>
  )
}

// --- Client Card ---
function ClientCard({
  client,
  onEdit,
  onDelete,
  onManageContracts,
}: {
  client: Client
  onEdit: () => void
  onDelete: () => void
  onManageContracts: () => void
}) {
  const activeContracts = client.contracts?.filter(c => c.is_active) ?? []

  return (
    <div className={`bg-white border rounded-xl p-5 flex flex-col lg:flex-row lg:items-center gap-5 shadow-sm hover:border-primary/50 transition-colors ${!client.is_active ? 'opacity-60' : 'border-slate-200'}`}>
      <div className="flex items-center gap-4 flex-1">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${client.is_active ? 'bg-primary/10 text-primary' : 'bg-slate-100 text-slate-400'}`}>
          <span className="material-symbols-outlined text-2xl">person</span>
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-bold text-slate-900 truncate">{client.name}</h3>
            {client.is_active ? (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">Activo</span>
            ) : (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200">Inactivo</span>
            )}
          </div>
          {client.email && <p className="text-sm text-slate-500 truncate">{client.email}</p>}
          {client.phone && <p className="text-sm text-slate-400">{client.phone}</p>}
        </div>
      </div>

      <div className="flex-1 lg:border-x border-slate-100 px-0 lg:px-6">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Contratos</p>
        {activeContracts.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {activeContracts.map(c => (
              <span key={c.id} className="bg-slate-50 text-slate-600 px-2 py-1 rounded text-xs border border-slate-200">
                {c.description} — €{c.hourly_rate}/h
              </span>
            ))}
          </div>
        ) : (
          <span className="text-slate-400 text-xs italic">Sin contratos activos</span>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button onClick={onManageContracts}
          className="p-2 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors" title="Gestionar contratos">
          <span className="material-symbols-outlined">description</span>
        </button>
        <button onClick={onEdit}
          className="p-2 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors" title="Editar">
          <span className="material-symbols-outlined">edit</span>
        </button>
        <button onClick={onDelete}
          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Eliminar">
          <span className="material-symbols-outlined">delete</span>
        </button>
      </div>
    </div>
  )
}

// --- Contracts Manager ---
function ContractsManager({ client, onClose }: { client: Client; onClose: () => void }) {
  const [contracts, setContracts] = useState<Contract[]>(client.contracts ?? [])
  const [showForm, setShowForm] = useState(false)
  const [editingContract, setEditingContract] = useState<Contract | null>(null)

  const reload = useCallback(async () => {
    const updated = await clientService.getContracts(client.id)
    setContracts(updated)
  }, [client.id])

  const handleCreate = async (data: Partial<Contract>) => {
    await clientService.createContract(client.id, data as Omit<Contract, 'id' | 'client_id' | 'created_at'>)
    await reload()
    setShowForm(false)
  }

  const handleUpdate = async (data: Partial<Contract>) => {
    if (!editingContract) return
    await clientService.updateContract(client.id, editingContract.id, data)
    await reload()
    setEditingContract(null)
  }

  const handleDelete = async (contractId: number) => {
    if (!confirm('¿Eliminar este contrato?')) return
    await clientService.deleteContract(client.id, contractId)
    await reload()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-slate-500 text-sm">Contratos de <strong>{client.name}</strong></p>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-1 px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-bold hover:bg-primary-hover transition-colors">
          <span className="material-symbols-outlined text-base">add</span> Nuevo
        </button>
      </div>

      {(showForm || editingContract) && (
        <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
          <ContractForm
            initial={editingContract ?? undefined}
            onSave={editingContract ? handleUpdate : handleCreate}
            onCancel={() => { setShowForm(false); setEditingContract(null) }}
          />
        </div>
      )}

      {contracts.length === 0 ? (
        <div className="text-center py-8 text-slate-400">
          <span className="material-symbols-outlined text-3xl block mb-2">description</span>
          No hay contratos. Añade uno para empezar.
        </div>
      ) : (
        <div className="space-y-3">
          {contracts.map(c => (
            <div key={c.id} className={`flex items-center justify-between gap-4 p-4 rounded-xl border ${c.is_active ? 'border-slate-200 bg-white' : 'border-slate-100 bg-slate-50 opacity-60'}`}>
              <div>
                <p className="font-semibold text-slate-900 text-sm">{c.description}</p>
                <p className="text-xs text-slate-500">€{c.hourly_rate}/h · Desde {c.start_date}{c.end_date ? ` hasta ${c.end_date}` : ''}</p>
                {c.notes && <p className="text-xs text-slate-400 mt-0.5">{c.notes}</p>}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {c.is_active ? (
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">Activo</span>
                ) : (
                  <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">Inactivo</span>
                )}
                <button onClick={() => setEditingContract(c)}
                  className="p-1.5 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors">
                  <span className="material-symbols-outlined text-base">edit</span>
                </button>
                <button onClick={() => handleDelete(c.id)}
                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                  <span className="material-symbols-outlined text-base">delete</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-end pt-2">
        <button onClick={onClose}
          className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors">
          Cerrar
        </button>
      </div>
    </div>
  )
}

// --- Main Page ---
export function Clients() {
  const [clients, setClients] = useState<Client[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('all')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingClient, setEditingClient] = useState<Client | null>(null)
  const [contractsClient, setContractsClient] = useState<Client | null>(null)

  const loadClients = useCallback(async () => {
    setIsLoading(true)
    const is_active = filterActive === 'all' ? undefined : filterActive === 'active'
    const data = await clientService.getAll({ search: search || undefined, is_active })
    setClients(data)
    setIsLoading(false)
  }, [search, filterActive])

  useEffect(() => { loadClients() }, [loadClients])

  const handleCreate = async (data: Partial<Client>) => {
    await clientService.create(data as Omit<Client, 'id' | 'created_at' | 'updated_at' | 'deleted_at' | 'contracts'>)
    setShowCreateModal(false)
    loadClients()
  }

  const handleUpdate = async (data: Partial<Client>) => {
    if (!editingClient) return
    await clientService.update(editingClient.id, data)
    setEditingClient(null)
    loadClients()
  }

  const handleDelete = async (client: Client) => {
    if (!confirm(`¿Eliminar a ${client.name}? (Se archivará durante 1 año)`)) return
    await clientService.delete(client.id)
    loadClients()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Clientes</h1>
          <p className="text-slate-500 text-sm mt-1">Administra tu cartera de clientes y contratos.</p>
        </div>
        <button onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 bg-primary hover:bg-primary-hover text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-primary/20 transition-all">
          <span className="material-symbols-outlined">add</span>
          Nuevo cliente
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre..."
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
          />
        </div>
        <select value={filterActive} onChange={e => setFilterActive(e.target.value as typeof filterActive)}
          className="border border-slate-200 rounded-lg py-2 pl-3 pr-8 text-sm focus:ring-primary focus:border-primary text-slate-600 bg-white">
          <option value="all">Todos</option>
          <option value="active">Activos</option>
          <option value="inactive">Inactivos</option>
        </select>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex items-center justify-center h-32">
          <span className="material-symbols-outlined text-primary text-3xl animate-spin">sync</span>
        </div>
      ) : clients.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-slate-200">
          <span className="material-symbols-outlined text-5xl text-slate-300 block mb-3">group</span>
          <p className="text-slate-500 font-medium">No hay clientes</p>
          <button onClick={() => setShowCreateModal(true)}
            className="mt-4 text-primary text-sm font-semibold hover:underline">
            Añade tu primer cliente
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {clients.map(client => (
            <ClientCard
              key={client.id}
              client={client}
              onEdit={() => setEditingClient(client)}
              onDelete={() => handleDelete(client)}
              onManageContracts={() => setContractsClient(client)}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="Nuevo cliente">
        <ClientForm onSave={handleCreate} onCancel={() => setShowCreateModal(false)} />
      </Modal>

      <Modal isOpen={!!editingClient} onClose={() => setEditingClient(null)} title="Editar cliente">
        {editingClient && (
          <ClientForm
            initial={editingClient}
            onSave={handleUpdate}
            onCancel={() => setEditingClient(null)}
          />
        )}
      </Modal>

      <Modal isOpen={!!contractsClient} onClose={() => setContractsClient(null)} title="Contratos" size="lg">
        {contractsClient && (
          <ContractsManager client={contractsClient} onClose={() => setContractsClient(null)} />
        )}
      </Modal>
    </div>
  )
}
