import { useTranslation } from '../../i18n'
import type { Alert } from '../../types'
import { Button } from '../ui/Button'
import { Tooltip } from '../ui/Tooltip'
import { formatMonthLabels } from './utils'

interface AlertButtonProps {
  alerts: Alert[]
  onClick: () => void
}

const colorClasses = {
  ok: 'bg-emerald-600 text-white hover:bg-emerald-700',
  alert: 'bg-red-600 text-white hover:bg-red-700',
}

export function AlertButton({ alerts, onClick }: AlertButtonProps) {
  const { t } = useTranslation()
  const months: string[] = t('common.months.lowercase', {
    returnObjects: true,
  }) as unknown as string[]

  const count = alerts.length
  const isOk = count === 0
  const tooltipContent = isOk
    ? t('alerts.button.tooltipOk')
    : t('alerts.button.tooltipWithMonths', {
        count,
        months: formatMonthLabels(alerts, months),
      })

  return (
    <Tooltip content={tooltipContent} position='top'>
      <Button
        type='button'
        onClick={onClick}
        disabled={isOk}
        className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${colorClasses[isOk ? 'ok' : 'alert']}`}
      >
        <span className='material-symbols-outlined text-base'>
          {isOk ? 'notifications' : 'notifications_active'}
        </span>
        <span>{t('alerts.button.label')}</span>
        {count > 0 && (
          <span className='inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-white/20 text-xs font-black'>
            {count}
          </span>
        )}
      </Button>
    </Tooltip>
  )
}
