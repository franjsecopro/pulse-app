import { useEffect, useState } from 'react'
import i18n, { useTranslation } from '../../i18n'
import { adminService } from '../../services/admin.service'
import { Button } from '../ui/Button'
import { ConfirmationModal } from '../ui/ConfirmationModal'

interface AdminUser {
  id: number
  email: string
  role: 'admin' | 'user'
  createdAt: string
}

interface PendingRoleChange {
  user: AdminUser
  newRole: 'admin' | 'user'
}

export function UsersTab() {
  const { t } = useTranslation()
  const [users, setUsers] = useState<AdminUser[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [syncingId, setSyncingId] = useState<number | null>(null)
  const [syncResult, setSyncResult] = useState<Record<number, string>>({})
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null)
  const [roleChanging, setRoleChanging] = useState<number | null>(null)
  const [pendingRoleChange, setPendingRoleChange] = useState<PendingRoleChange | null>(null)

  useEffect(() => {
    adminService
      .listUsers()
      .then(setUsers)
      .finally(() => setIsLoading(false))
  }, [])

  async function handleSyncGCal(user: AdminUser) {
    setSyncingId(user.id)
    setSyncResult((prev) => ({ ...prev, [user.id]: '' }))
    try {
      const result = await adminService.syncGCal(user.id)
      setSyncResult((prev) => ({
        ...prev,
        [user.id]: `${result.scheduled} ${t('admin.users.syncedClasses')}`,
      }))
    } catch (err: unknown) {
      setSyncResult((prev) => ({
        ...prev,
        [user.id]: err instanceof Error ? err.message : t('admin.users.syncError'),
      }))
    } finally {
      setSyncingId(null)
    }
  }

  async function handleDeleteUser() {
    if (!deleteTarget) return
    try {
      await adminService.deleteUser(deleteTarget.id)
      setUsers((prev) => prev.filter((user) => user.id !== deleteTarget.id))
    } finally {
      setDeleteTarget(null)
    }
  }

  async function confirmRoleChange() {
    if (!pendingRoleChange) return
    const { user, newRole } = pendingRoleChange
    setPendingRoleChange(null)
    setRoleChanging(user.id)
    try {
      const updated = await adminService.setUserRole(user.id, newRole)
      setUsers((prev) =>
        prev.map((user) => (user.id === updated.id ? { ...user, role: updated.role } : user)),
      )
    } finally {
      setRoleChanging(null)
    }
  }

  if (isLoading) {
    return (
      <div className='flex items-center justify-center py-16 text-slate-400'>
        <span className='material-symbols-outlined animate-spin mr-2'>refresh</span>{' '}
        {t('common.loading')}
      </div>
    )
  }

  return (
    <>
      <div className='bg-white rounded-xl border border-slate-200 overflow-hidden'>
        <table className='w-full text-sm'>
          <thead>
            <tr className='border-b border-slate-100 bg-slate-50'>
              <th className='text-left px-4 py-3 font-medium text-slate-500'>
                {t('admin.users.table.email')}
              </th>
              <th className='text-left px-4 py-3 font-medium text-slate-500'>
                {t('admin.users.table.role')}
              </th>
              <th className='text-left px-4 py-3 font-medium text-slate-500'>
                {t('admin.users.table.registered')}
              </th>
              <th className='px-4 py-3 text-right font-medium text-slate-500'>
                {t('admin.users.table.actions')}
              </th>
            </tr>
          </thead>
          <tbody className='divide-y divide-slate-100'>
            {users.map((user) => (
              <tr key={user.id}>
                <td className='px-4 py-3 font-medium text-slate-800'>{user.email}</td>
                <td className='px-4 py-3'>
                  <select
                    value={user.role}
                    disabled={roleChanging === user.id}
                    onChange={(e) =>
                      setPendingRoleChange({
                        user,
                        newRole: e.target.value as 'admin' | 'user',
                      })
                    }
                    className='text-xs border border-slate-200 rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500'
                  >
                    <option value='user'>user</option>
                    <option value='admin'>admin</option>
                  </select>
                </td>
                <td className='px-4 py-3 text-slate-500'>
                  {new Date(user.createdAt).toLocaleDateString(i18n.language)}
                </td>
                <td className='px-4 py-3'>
                  <div className='flex items-center justify-end gap-2'>
                    {syncResult[user.id] && (
                      <span className='text-xs text-emerald-600'>{syncResult[user.id]}</span>
                    )}
                    <Button
                      type='button'
                      onClick={() => handleSyncGCal(user)}
                      loading={syncingId === user.id}
                      title={t('admin.users.syncTooltip')}
                      className='inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors'
                    >
                      <span className='material-symbols-outlined text-[14px]'>
                        {syncingId === user.id ? 'hourglass_empty' : 'calendar_month'}
                      </span>
                      {syncingId === user.id ? t('admin.users.syncing') : t('admin.users.syncGCal')}
                    </Button>
                    <Button
                      type='button'
                      onClick={() => setDeleteTarget(user)}
                      title={t('admin.users.deleteTooltip')}
                      className='inline-flex items-center gap-1.5 px-3 py-1.5 border border-red-200 rounded-lg text-xs font-medium text-red-600 hover:bg-red-50 transition-colors'
                    >
                      <span className='material-symbols-outlined text-[14px]'>delete</span>
                      {t('actions.delete')}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ConfirmationModal
        isOpen={!!deleteTarget}
        variant='danger'
        message={t('admin.users.deleteMessage', { email: deleteTarget?.email })}
        confirmLabel={t('actions.delete')}
        onConfirm={handleDeleteUser}
        onCancel={() => setDeleteTarget(null)}
      />
      <ConfirmationModal
        isOpen={!!pendingRoleChange}
        title={t('admin.users.confirmRoleTitle')}
        message={t('admin.users.confirmRoleMessage', {
          email: pendingRoleChange?.user.email,
          role: pendingRoleChange?.newRole,
        })}
        confirmLabel={t('actions.confirm')}
        onConfirm={confirmRoleChange}
        onCancel={() => setPendingRoleChange(null)}
      />
    </>
  )
}
