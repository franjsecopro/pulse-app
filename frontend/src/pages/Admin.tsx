import { useCallback, useEffect, useState } from 'react'
import { ConfirmModal } from '../components/ui/ConfirmModal'
import { DoubleConfirmModal } from '../components/ui/DoubleConfirmModal'
import { useAuth } from '../context/AuthContext'
import i18n, { useTranslation } from '../i18n'
import { adminService } from '../services/admin.service'
import type { AdminClient } from '../types'

type Tab = 'users' | 'clients' | 'demo'

interface AdminUser {
  id: number
  email: string
  role: 'admin' | 'user'
  created_at: string
}

interface PendingRoleChange {
  user: AdminUser
  newRole: 'admin' | 'user'
}

// Users tab

function UsersTab({ t }: { t: (key: string, options?: Record<string, unknown>) => string }) {
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
      setUsers((prev) => prev.filter((u) => u.id !== deleteTarget.id))
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
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? { ...u, role: updated.role } : u)))
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
                      setPendingRoleChange({ user, newRole: e.target.value as 'admin' | 'user' })
                    }
                    className='text-xs border border-slate-200 rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500'
                  >
                    <option value='user'>user</option>
                    <option value='admin'>admin</option>
                  </select>
                </td>
                <td className='px-4 py-3 text-slate-500'>
                  {new Date(user.created_at).toLocaleDateString(i18n.language)}
                </td>
                <td className='px-4 py-3'>
                  <div className='flex items-center justify-end gap-2'>
                    {syncResult[user.id] && (
                      <span className='text-xs text-emerald-600'>{syncResult[user.id]}</span>
                    )}
                    <button
                      onClick={() => handleSyncGCal(user)}
                      disabled={syncingId === user.id}
                      title={t('admin.users.syncTooltip')}
                      className='inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors'
                    >
                      <span className='material-symbols-outlined text-[14px]'>
                        {syncingId === user.id ? 'hourglass_empty' : 'calendar_month'}
                      </span>
                      {syncingId === user.id ? t('admin.users.syncing') : t('admin.users.syncGCal')}
                    </button>
                    <button
                      onClick={() => setDeleteTarget(user)}
                      title={t('admin.users.deleteTooltip')}
                      className='inline-flex items-center gap-1.5 px-3 py-1.5 border border-red-200 rounded-lg text-xs font-medium text-red-600 hover:bg-red-50 transition-colors'
                    >
                      <span className='material-symbols-outlined text-[14px]'>delete</span>
                      {t('actions.delete')}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ConfirmModal
        isOpen={!!deleteTarget}
        message={t('admin.users.deleteMessage', { email: deleteTarget?.email })}
        confirmLabel={t('actions.delete')}
        onConfirm={handleDeleteUser}
        onCancel={() => setDeleteTarget(null)}
      />
      <ConfirmModal
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

// Clients tab

function ClientsTab({ t }: { t: (key: string, options?: Record<string, unknown>) => string }) {
  const { isDemoActive } = useAuth()
  const [clients, setClients] = useState<AdminClient[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showArchivedOnly, setShowArchivedOnly] = useState(false)
  const [showDemoOnly, setShowDemoOnly] = useState(isDemoActive)
  const [deleteTarget, setDeleteTarget] = useState<AdminClient | null>(null)
  const [movingToDemo, setMovingToDemo] = useState<number | null>(null)
  const [movingFromDemo, setMovingFromDemo] = useState<number | null>(null)

  const loadClients = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await adminService.listClients({
        archivedOnly: showArchivedOnly || undefined,
        demoOnly: showDemoOnly || undefined,
      })
      setClients(data)
    } finally {
      setIsLoading(false)
    }
  }, [showArchivedOnly, showDemoOnly])

  useEffect(() => {
    loadClients()
  }, [loadClients])

  async function handleDelete() {
    if (!deleteTarget) return
    try {
      await adminService.hardDeleteClient(deleteTarget.id)
      setClients((prev) => prev.filter((c) => c.id !== deleteTarget.id))
    } finally {
      setDeleteTarget(null)
    }
  }

  async function handleMoveToDemo(client: AdminClient) {
    setMovingToDemo(client.id)
    try {
      await adminService.moveClientToDemo(client.id)
      setClients((prev) => prev.filter((c) => c.id !== client.id))
    } finally {
      setMovingToDemo(null)
    }
  }

  async function handleMoveFromDemo(client: AdminClient) {
    setMovingFromDemo(client.id)
    try {
      await adminService.moveClientFromDemo(client.id)
      setClients((prev) => prev.filter((c) => c.id !== client.id))
    } finally {
      setMovingFromDemo(null)
    }
  }

  return (
    <>
      <div className='flex items-center gap-4 mb-4'>
        <label className='flex items-center gap-2 text-sm text-slate-600 cursor-pointer select-none'>
          <input
            type='checkbox'
            checked={showArchivedOnly}
            onChange={(e) => {
              setShowArchivedOnly(e.target.checked)
              setShowDemoOnly(false)
            }}
            className='rounded border-slate-300 text-indigo-600 focus:ring-indigo-500'
          />
          {t('admin.clients.archivedOnly')}
        </label>
        <label className='flex items-center gap-2 text-sm text-orange-600 cursor-pointer select-none'>
          <input
            type='checkbox'
            checked={showDemoOnly}
            onChange={(e) => {
              setShowDemoOnly(e.target.checked)
              setShowArchivedOnly(false)
            }}
            className='rounded border-orange-300 text-orange-500 focus:ring-orange-400'
          />
          {t('admin.clients.demoOnly')}
        </label>
      </div>

      {isLoading ? (
        <div className='flex items-center justify-center py-16 text-slate-400'>
          <span className='material-symbols-outlined animate-spin mr-2'>refresh</span>{' '}
          {t('common.loading')}
        </div>
      ) : clients.length === 0 ? (
        <div className='text-center py-16 text-slate-400 text-sm'>{t('admin.clients.empty')}</div>
      ) : (
        <div className='bg-white rounded-xl border border-slate-200 overflow-hidden'>
          <table className='w-full text-sm'>
            <thead>
              <tr className='border-b border-slate-100 bg-slate-50'>
                <th className='text-left px-4 py-3 font-medium text-slate-500'>
                  {t('admin.clients.table.client')}
                </th>
                <th className='text-left px-4 py-3 font-medium text-slate-500'>
                  {t('admin.clients.table.owner')}
                </th>
                <th className='text-left px-4 py-3 font-medium text-slate-500'>
                  {t('admin.clients.table.status')}
                </th>
                <th className='px-4 py-3 text-right font-medium text-slate-500'>
                  {t('admin.clients.table.actions')}
                </th>
              </tr>
            </thead>
            <tbody className='divide-y divide-slate-100'>
              {clients.map((client) => (
                <tr key={client.id}>
                  <td className='px-4 py-3 font-medium text-slate-800'>{client.name}</td>
                  <td className='px-4 py-3 text-slate-500 text-xs'>{client.owner_email}</td>
                  <td className='px-4 py-3'>
                    {client.archived_at ? (
                      <span className='inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5'>
                        {t('admin.clients.archived')}
                      </span>
                    ) : (
                      <span className='inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5'>
                        {t('admin.clients.active')}
                      </span>
                    )}
                  </td>
                  <td className='px-4 py-3 text-right'>
                    <div className='flex items-center justify-end gap-2'>
                      {showDemoOnly ? (
                        <button
                          onClick={() => handleMoveFromDemo(client)}
                          disabled={movingFromDemo === client.id}
                          className='inline-flex items-center gap-1.5 px-3 py-1.5 border border-indigo-200 rounded-lg text-xs font-medium text-indigo-600 hover:bg-indigo-50 disabled:opacity-50 transition-colors'
                        >
                          <span className='material-symbols-outlined text-[14px]'>move_up</span>
                          {movingFromDemo === client.id
                            ? t('admin.clients.moving')
                            : t('admin.clients.moveToProd')}
                        </button>
                      ) : (
                        <button
                          onClick={() => handleMoveToDemo(client)}
                          disabled={movingToDemo === client.id}
                          className='inline-flex items-center gap-1.5 px-3 py-1.5 border border-orange-200 rounded-lg text-xs font-medium text-orange-600 hover:bg-orange-50 disabled:opacity-50 transition-colors'
                        >
                          <span className='material-symbols-outlined text-[14px]'>science</span>
                          {movingToDemo === client.id
                            ? t('admin.clients.moving')
                            : t('admin.clients.moveToDemo')}
                        </button>
                      )}
                      <button
                        onClick={() => setDeleteTarget(client)}
                        className='inline-flex items-center gap-1.5 px-3 py-1.5 border border-red-200 rounded-lg text-xs font-medium text-red-600 hover:bg-red-50 transition-colors'
                      >
                        <span className='material-symbols-outlined text-[14px]'>
                          delete_forever
                        </span>
                        {t('actions.delete')}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <DoubleConfirmModal
        isOpen={!!deleteTarget}
        entityName={deleteTarget?.name ?? ''}
        warningMessage={t('admin.clients.deleteWarn', {
          name: deleteTarget?.name,
          owner: deleteTarget?.owner_email,
        })}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  )
}

// Demo tab

function DemoTab({ t }: { t: (key: string, options?: Record<string, unknown>) => string }) {
  const { isDemoActive, reloadUser } = useAuth()
  const [isWorking, setIsWorking] = useState(false)
  const [resetResult, setResetResult] = useState<string | null>(null)
  const [confirmReset, setConfirmReset] = useState(false)

  async function handleEnter() {
    setIsWorking(true)
    try {
      await adminService.demoEnter()
      await reloadUser()
    } finally {
      setIsWorking(false)
    }
  }

  async function handleExit() {
    setIsWorking(true)
    try {
      await adminService.demoExit()
      await reloadUser()
    } finally {
      setIsWorking(false)
    }
  }

  async function handleReset() {
    setConfirmReset(false)
    setIsWorking(true)
    setResetResult(null)
    try {
      const result = await adminService.demoReset()
      setResetResult(
        t('admin.demo.resetResult', {
          clients: result.clients_count,
          classes: result.classes_count,
        }),
      )
    } finally {
      setIsWorking(false)
    }
  }

  return (
    <div className='max-w-lg space-y-4'>
      <div className='bg-white rounded-xl border border-slate-200 p-6 space-y-4'>
        <div className='flex items-center gap-3'>
          <span
            className={`w-3 h-3 rounded-full ${isDemoActive ? 'bg-orange-500' : 'bg-slate-300'}`}
          />
          <span className='font-semibold text-slate-800'>
            {t('admin.demo.status', {
              status: isDemoActive ? t('admin.demo.active') : t('admin.demo.inactive'),
            })}
          </span>
        </div>

        <p className='text-sm text-slate-500'>{t('admin.demo.description')}</p>

        <div className='flex flex-wrap gap-2'>
          {isDemoActive ? (
            <button
              onClick={handleExit}
              disabled={isWorking}
              className='inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white text-sm font-medium transition-colors'
            >
              <span className='material-symbols-outlined text-[16px]'>logout</span>
              {t('admin.demo.exit')}
            </button>
          ) : (
            <button
              onClick={handleEnter}
              disabled={isWorking}
              className='inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-medium transition-colors'
            >
              <span className='material-symbols-outlined text-[16px]'>science</span>
              {t('admin.demo.enter')}
            </button>
          )}

          <button
            onClick={() => setConfirmReset(true)}
            disabled={isWorking}
            className='inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-red-200 hover:bg-red-50 disabled:opacity-50 text-red-600 text-sm font-medium transition-colors'
          >
            <span className='material-symbols-outlined text-[16px]'>restart_alt</span>
            {t('admin.demo.reset')}
          </button>
        </div>

        {resetResult && <p className='text-sm text-emerald-600 font-medium'>{resetResult}</p>}
      </div>

      <ConfirmModal
        isOpen={confirmReset}
        title={t('admin.demo.resetTitle')}
        message={t('admin.demo.resetMessage')}
        confirmLabel={t('actions.reset')}
        onConfirm={handleReset}
        onCancel={() => setConfirmReset(false)}
      />
    </div>
  )
}

// Page

export function Admin() {
  const { t } = useTranslation()
  const [tab, setTab] = useState<Tab>('users')

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'users', label: t('admin.tab.users'), icon: 'manage_accounts' },
    { id: 'clients', label: t('admin.tab.clients'), icon: 'people' },
    { id: 'demo', label: t('admin.tab.demo'), icon: 'science' },
  ]

  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-2xl font-black text-slate-900'>{t('admin.title')}</h1>
        <p className='text-slate-500 text-sm mt-1'>{t('admin.subtitle')}</p>
      </div>

      <div className='flex gap-1 border-b border-slate-200'>
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === t.id
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <span className='material-symbols-outlined text-[16px]'>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'users' && <UsersTab t={t} />}
      {tab === 'clients' && <ClientsTab t={t} />}
      {tab === 'demo' && <DemoTab t={t} />}
    </div>
  )
}
