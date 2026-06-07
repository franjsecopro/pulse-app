import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from '../../i18n'
import type { Alert, AlertSeverity } from '../../types'
import { Button } from '../ui/Button'

interface AlertsDrawerProps {
  isOpen: boolean
  onClose: () => void
  alerts: Alert[]
  isLoading: boolean
  title: string
}

const severityStyles: Record<
  AlertSeverity,
  { bg: string; text: string; icon: string; iconColor: string }
> = {
  error: {
    bg: 'bg-red-50 border-red-200',
    text: 'text-red-700',
    icon: 'error',
    iconColor: 'text-red-500',
  },
  info: {
    bg: 'bg-blue-50 border-blue-200',
    text: 'text-blue-700',
    icon: 'info',
    iconColor: 'text-blue-500',
  },
  warning: {
    bg: 'bg-amber-50 border-amber-200',
    text: 'text-amber-700',
    icon: 'warning',
    iconColor: 'text-amber-500',
  },
}

export function AlertsDrawer({ isOpen, onClose, alerts, isLoading, title }: AlertsDrawerProps) {
  const { t } = useTranslation()
  const months: string[] = t('common.months.full', { returnObjects: true }) as unknown as string[]

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = ''
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return createPortal(
    <div className='fixed inset-0 z-50 flex justify-end'>
      <Button
        type='button'
        className='absolute inset-0 bg-black/50 backdrop-blur-sm border-0 cursor-default w-full'
        onClick={onClose}
        aria-label='Close'
      />
      <div className='relative bg-white shadow-2xl w-full max-w-md h-full overflow-y-auto'>
        <div className='sticky top-0 bg-white z-10 flex items-center justify-between p-5 border-b border-slate-200'>
          <h2 className='text-lg font-bold text-slate-900'>{title}</h2>
          <Button
            type='button'
            onClick={onClose}
            className='p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors'
            aria-label='Close'
          >
            <span className='material-symbols-outlined'>close</span>
          </Button>
        </div>
        <div className='p-5 space-y-3'>
          {isLoading ? (
            <div className='flex items-center justify-center py-12 text-slate-400'>
              <span className='material-symbols-outlined text-primary text-3xl animate-spin'>
                sync
              </span>
            </div>
          ) : alerts.length === 0 ? (
            <div className='text-center py-12'>
              <span className='material-symbols-outlined text-5xl text-emerald-400 block mb-2'>
                check_circle
              </span>
              <p className='text-slate-700 font-bold'>{t('alerts.drawer.emptyTitle')}</p>
              <p className='text-slate-500 text-sm mt-1'>{t('alerts.drawer.empty')}</p>
            </div>
          ) : (
            alerts.map((alert, i) => (
              <AlertItem
                key={`${alert.type}-${alert.client_id ?? 'sys'}-${i}`}
                alert={alert}
                months={months}
              />
            ))
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}

function AlertItem({ alert, months }: { alert: Alert; months: string[] }) {
  const { t } = useTranslation()
  const style = severityStyles[alert.severity]
  const monthName = months[alert.month - 1] ?? ''
  const message =
    alert.type === 'debt'
      ? t('alerts.drawer.debtMessage', {
          name: alert.client_name ?? '?',
          month: monthName,
          year: alert.year,
        })
      : alert.type === 'credit'
        ? t('alerts.drawer.creditMessage', {
            name: alert.client_name ?? '?',
            month: monthName,
            year: alert.year,
          })
        : t('alerts.drawer.statementMissingMessage', { month: monthName, year: alert.year })
  const amount = alert.amount > 0 ? `€${alert.amount.toFixed(2)}` : null

  return (
    <div className={`rounded-xl border p-4 flex items-center gap-3 ${style.bg}`}>
      <span className={`material-symbols-outlined ${style.iconColor}`}>{style.icon}</span>
      <div className='flex-1 min-w-0'>
        <p className={`text-sm font-medium ${style.text}`}>{message}</p>
      </div>
      {amount && <span className={`font-black text-sm shrink-0 ${style.text}`}>{amount}</span>}
    </div>
  )
}
