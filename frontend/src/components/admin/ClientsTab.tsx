import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useTranslation } from '../../i18n'
import { adminService } from '../../services/admin.service'
import type { AdminClient } from '../../types'
import { Button } from '../ui/Button'
import { ConfirmationModal } from '../ui/ConfirmationModal'

export function ClientsTab() {
  const { t } = useTranslation()
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
      setClients((prev) => prev.filter((client) => client.id !== deleteTarget.id))
    } finally {
      setDeleteTarget(null)
    }
  }

  async function handleMoveToDemo(client: AdminClient) {
    setMovingToDemo(client.id)
    try {
      await adminService.moveClientToDemo(client.id)
      setClients((prev) => prev.filter((existingClient) => existingClient.id !== client.id))
    } finally {
      setMovingToDemo(null)
    }
  }

  async function handleMoveFromDemo(client: AdminClient) {
    setMovingFromDemo(client.id)
    try {
      await adminService.moveClientFromDemo(client.id)
      setClients((prev) => prev.filter((existingClient) => existingClient.id !== client.id))
    } finally {
      setMovingFromDemo(null)
    }
  }

  return (
    <>
      <div className='flex items-center gap-4 mb-4'>
        <label
          htmlFor='show-archived'
          className='flex items-center gap-2 text-sm text-slate-600 cursor-pointer select-none'
        >
          <input
            id='show-archived'
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
        <label
          htmlFor='show-demo'
          className='flex items-center gap-2 text-sm text-orange-600 cursor-pointer select-none'
        >
          <input
            id='show-demo'
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
                  <td className='px-4 py-3 text-slate-500 text-xs'>{client.ownerEmail}</td>
                  <td className='px-4 py-3'>
                    {client.archivedAt ? (
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
                        <Button
                          type='button'
                          onClick={() => handleMoveFromDemo(client)}
                          loading={movingFromDemo === client.id}
                          className='inline-flex items-center gap-1.5 px-3 py-1.5 border border-indigo-200 rounded-lg text-xs font-medium text-indigo-600 hover:bg-indigo-50 disabled:opacity-50 transition-colors'
                        >
                          <span className='material-symbols-outlined text-[14px]'>move_up</span>
                          {movingFromDemo === client.id
                            ? t('admin.clients.moving')
                            : t('admin.clients.moveToProd')}
                        </Button>
                      ) : (
                        <Button
                          type='button'
                          onClick={() => handleMoveToDemo(client)}
                          loading={movingToDemo === client.id}
                          className='inline-flex items-center gap-1.5 px-3 py-1.5 border border-orange-200 rounded-lg text-xs font-medium text-orange-600 hover:bg-orange-50 disabled:opacity-50 transition-colors'
                        >
                          <span className='material-symbols-outlined text-[14px]'>science</span>
                          {movingToDemo === client.id
                            ? t('admin.clients.moving')
                            : t('admin.clients.moveToDemo')}
                        </Button>
                      )}
                      <Button
                        type='button'
                        onClick={() => setDeleteTarget(client)}
                        className='inline-flex items-center gap-1.5 px-3 py-1.5 border border-red-200 rounded-lg text-xs font-medium text-red-600 hover:bg-red-50 transition-colors'
                      >
                        <span className='material-symbols-outlined text-[14px]'>
                          delete_forever
                        </span>
                        {t('actions.delete')}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmationModal
        isOpen={!!deleteTarget}
        variant='typed'
        entityName={deleteTarget?.name ?? ''}
        message={t('admin.clients.deleteWarn', {
          name: deleteTarget?.name,
          owner: deleteTarget?.ownerEmail,
        })}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  )
}
