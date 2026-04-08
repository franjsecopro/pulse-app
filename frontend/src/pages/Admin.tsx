import { useState, useEffect } from 'react'
import { api } from '../services/api'
import { ConfirmModal } from '../components/ui/ConfirmModal'

interface AdminUser {
  id: number
  email: string
  role: 'admin' | 'user'
  created_at: string
}

export function Admin() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [syncingId, setSyncingId] = useState<number | null>(null)
  const [syncResult, setSyncResult] = useState<Record<number, string>>({})
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null)
  const [roleChanging, setRoleChanging] = useState<number | null>(null)

  useEffect(() => {
    api.get<AdminUser[]>('/admin/users')
      .then(setUsers)
      .finally(() => setIsLoading(false))
  }, [])

  async function handleSyncGCal(user: AdminUser) {
    setSyncingId(user.id)
    setSyncResult(prev => ({ ...prev, [user.id]: '' }))
    try {
      const result = await api.post<{ scheduled: number }>(`/admin/users/${user.id}/sync-gcal`, {})
      setSyncResult(prev => ({ ...prev, [user.id]: `${result.scheduled} clases encoladas` }))
    } catch (err: unknown) {
      setSyncResult(prev => ({
        ...prev,
        [user.id]: err instanceof Error ? err.message : 'Error al sincronizar',
      }))
    } finally {
      setSyncingId(null)
    }
  }

  async function handleDeleteUser() {
    if (!deleteTarget) return
    await api.delete(`/admin/users/${deleteTarget.id}`)
    setUsers(prev => prev.filter(u => u.id !== deleteTarget.id))
    setDeleteTarget(null)
  }

  async function handleRoleChange(user: AdminUser, newRole: 'admin' | 'user') {
    setRoleChanging(user.id)
    try {
      const updated = await api.put<AdminUser>(`/admin/users/${user.id}/role?role=${newRole}`, {})
      setUsers(prev => prev.map(u => u.id === updated.id ? { ...u, role: updated.role } : u))
    } finally {
      setRoleChanging(null)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-900">Administración</h1>
        <p className="text-slate-500 text-sm mt-1">Gestión de usuarios y sincronización.</p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-slate-400">
          <span className="material-symbols-outlined animate-spin mr-2">refresh</span> Cargando...
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-4 py-3 font-medium text-slate-500">Email</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500">Rol</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500">Registro</th>
                <th className="px-4 py-3 text-right font-medium text-slate-500">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map(user => (
                <tr key={user.id}>
                  <td className="px-4 py-3 font-medium text-slate-800">{user.email}</td>
                  <td className="px-4 py-3">
                    <select
                      value={user.role}
                      disabled={roleChanging === user.id}
                      onChange={e => handleRoleChange(user, e.target.value as 'admin' | 'user')}
                      className="text-xs border border-slate-200 rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="user">user</option>
                      <option value="admin">admin</option>
                    </select>
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {new Date(user.created_at).toLocaleDateString('es-ES')}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      {syncResult[user.id] && (
                        <span className="text-xs text-emerald-600">{syncResult[user.id]}</span>
                      )}
                      <button
                        onClick={() => handleSyncGCal(user)}
                        disabled={syncingId === user.id}
                        title="Forzar sincronización con Google Calendar"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors"
                      >
                        <span className="material-symbols-outlined text-[14px]">
                          {syncingId === user.id ? 'hourglass_empty' : 'calendar_month'}
                        </span>
                        {syncingId === user.id ? 'Sincronizando...' : 'Sync GCal'}
                      </button>
                      <button
                        onClick={() => setDeleteTarget(user)}
                        title="Eliminar usuario y todos sus datos"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-red-200 rounded-lg text-xs font-medium text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <span className="material-symbols-outlined text-[14px]">delete</span>
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmModal
        isOpen={!!deleteTarget}
        message={`¿Eliminar permanentemente a ${deleteTarget?.email} y todos sus datos (clientes, clases, pagos)? Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        onConfirm={handleDeleteUser}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
