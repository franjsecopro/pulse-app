import { useTranslation } from '../../i18n'
import type { NotificationStatus } from '../../types'

export function StatusBadge({ status }: { status: NotificationStatus }) {
  const { t } = useTranslation()

  if (status === 'sent') {
    return (
      <span className='inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700'>
        <span className='material-symbols-outlined text-[12px]'>check_circle</span>{' '}
        {t('notifications.status.sent')}
      </span>
    )
  }
  if (status === 'skipped') {
    return (
      <span className='inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500'>
        <span className='material-symbols-outlined text-[12px]'>block</span>{' '}
        {t('notifications.status.skipped')}
      </span>
    )
  }
  return (
    <span className='inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700'>
      <span className='material-symbols-outlined text-[12px]'>schedule</span>{' '}
      {t('notifications.status.pending')}
    </span>
  )
}
