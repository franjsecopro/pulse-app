import { useClients } from '../../hooks/useClients'
import { useTranslation } from '../../i18n'
import type { NotificationChannel, NotificationStatus } from '../../types'

type StatusFilter = NotificationStatus | 'all'
type ChannelFilter = NotificationChannel | 'all'

export interface NotificationFilterValues {
  status: StatusFilter
  clientId: number | 'all'
  channel: ChannelFilter
}

interface NotificationFiltersProps {
  values: NotificationFilterValues
  onChange: (next: NotificationFilterValues) => void
  /**
   * Which status options to expose. The history tab shows all four statuses;
   * the pending tab only needs to filter the visible pending/skipped rows.
   */
  showStatus?: boolean
  showClient?: boolean
  showChannel?: boolean
  /**
   * When true, the status select is rendered as disabled and locked to its
   * current value. Used by the pending tab to communicate that only pending
   * notifications can appear there.
   */
  statusLocked?: boolean
}

export function NotificationFilters({
  values,
  onChange,
  showStatus = true,
  showClient = true,
  showChannel = true,
  statusLocked = false,
}: NotificationFiltersProps) {
  const { t } = useTranslation()
  const { clients } = useClients('', 'all')

  function setStatus(status: StatusFilter) {
    onChange({ ...values, status })
  }
  function setClientId(clientId: number | 'all') {
    onChange({ ...values, clientId })
  }
  function setChannel(channel: ChannelFilter) {
    onChange({ ...values, channel })
  }

  return (
    <fieldset className='flex flex-wrap items-end gap-3 border-0 p-0 m-0'>
      <legend className='sr-only'>{t('notifications.filters.legend')}</legend>

      {showStatus && (
        <div className='flex flex-col gap-1'>
          <label htmlFor='notif-filter-status' className='text-xs font-medium text-slate-500'>
            {t('notifications.filters.status')}
          </label>
          <select
            id='notif-filter-status'
            value={values.status}
            onChange={(e) => setStatus(e.target.value as StatusFilter)}
            disabled={statusLocked}
            className='border border-slate-200 rounded-lg px-3 py-2.5 text-sm min-h-[44px] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed'
          >
            <option value='all'>{t('notifications.filters.allStatuses')}</option>
            <option value='pending'>{t('notifications.status.pending')}</option>
            <option value='sent'>{t('notifications.status.sent')}</option>
            <option value='skipped'>{t('notifications.status.skipped')}</option>
          </select>
        </div>
      )}

      {showClient && (
        <div className='flex flex-col gap-1'>
          <label htmlFor='notif-filter-client' className='text-xs font-medium text-slate-500'>
            {t('notifications.filters.client')}
          </label>
          <select
            id='notif-filter-client'
            value={values.clientId === 'all' ? 'all' : String(values.clientId)}
            onChange={(e) =>
              setClientId(e.target.value === 'all' ? 'all' : Number.parseInt(e.target.value, 10))
            }
            className='border border-slate-200 rounded-lg px-3 py-2.5 text-sm min-h-[44px] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1'
          >
            <option value='all'>{t('notifications.filters.allClients')}</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {showChannel && (
        <div className='flex flex-col gap-1'>
          <label htmlFor='notif-filter-channel' className='text-xs font-medium text-slate-500'>
            {t('notifications.filters.channel')}
          </label>
          <select
            id='notif-filter-channel'
            value={values.channel}
            onChange={(e) => setChannel(e.target.value as ChannelFilter)}
            className='border border-slate-200 rounded-lg px-3 py-2.5 text-sm min-h-[44px] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1'
          >
            <option value='all'>{t('notifications.filters.allChannels')}</option>
            <option value='whatsapp'>{t('notifications.settings.whatsapp')}</option>
            <option value='email'>{t('notifications.settings.email')}</option>
          </select>
        </div>
      )}
    </fieldset>
  )
}
