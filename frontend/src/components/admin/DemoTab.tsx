import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useTranslation } from '../../i18n'
import { adminService } from '../../services/admin.service'
import { Button } from '../ui/Button'
import { ConfirmationModal } from '../ui/ConfirmationModal'

export function DemoTab() {
  const { t } = useTranslation()
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
          clients: result.clientsCount,
          classes: result.classesCount,
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
            <Button
              type='button'
              onClick={handleExit}
              loading={isWorking}
              className='inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white text-sm font-medium transition-colors'
            >
              <span className='material-symbols-outlined text-[16px]'>logout</span>
              {t('admin.demo.exit')}
            </Button>
          ) : (
            <Button
              type='button'
              onClick={handleEnter}
              loading={isWorking}
              className='inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-medium transition-colors'
            >
              <span className='material-symbols-outlined text-[16px]'>science</span>
              {t('admin.demo.enter')}
            </Button>
          )}

          <Button
            type='button'
            onClick={() => setConfirmReset(true)}
            loading={isWorking}
            className='inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-red-200 hover:bg-red-50 disabled:opacity-50 text-red-600 text-sm font-medium transition-colors'
          >
            <span className='material-symbols-outlined text-[16px]'>restart_alt</span>
            {t('admin.demo.reset')}
          </Button>
        </div>

        {resetResult && <p className='text-sm text-emerald-600 font-medium'>{resetResult}</p>}
      </div>

      <ConfirmationModal
        isOpen={confirmReset}
        variant='danger'
        title={t('admin.demo.resetTitle')}
        message={t('admin.demo.resetMessage')}
        confirmLabel={t('actions.reset')}
        onConfirm={handleReset}
        onCancel={() => setConfirmReset(false)}
      />
    </div>
  )
}
