import { useEffect, useState } from 'react'
import { useToast } from '../../context/ToastContext'
import { useAlerts } from '../../hooks/useAlerts'
import { useTranslation } from '../../i18n'
import { accountingService } from '../../services/accounting.service'
import type { AccountingSummaryEntry } from '../../types'
import { AlertButton } from '../alerts/AlertButton'
import { AlertsDrawer } from '../alerts/AlertsDrawer'
import { Button } from '../ui/Button'
import { ClientRow } from './accounting/ClientRow'
import { SummaryCard } from './accounting/SummaryCard'

interface AccountingTabProps {
  /** Shared filters — controlled by the Finances container. */
  month: number | ''
  year: number
  client: number | ''
}

export function AccountingTab({ month, year, client }: AccountingTabProps) {
  const { t } = useTranslation()
  const { addToast } = useToast()
  const months = t('common.months.full', { returnObjects: true }) as unknown as string[]
  const monthsLower = t('common.months.lowercase', { returnObjects: true }) as unknown as string[]
  // Accounting reports on a single month — "all months" is not a valid period here.
  const activeMonth = typeof month === 'number' ? month : null

  const [summary, setSummary] = useState<AccountingSummaryEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isExporting, setIsExporting] = useState(false)
  const [isAlertsOpen, setIsAlertsOpen] = useState(false)
  const { alerts, isLoading: isAlertsLoading } = useAlerts({
    month: activeMonth ?? undefined,
    year,
    types: ['debt', 'credit'],
  })

  useEffect(() => {
    if (activeMonth === null) {
      setSummary([])
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    accountingService
      .getMonthlySummary(activeMonth, year)
      .then(setSummary)
      .finally(() => setIsLoading(false))
  }, [activeMonth, year])

  // Client filter is applied on the client side (the summary endpoint is per-month).
  const visibleSummary = client === '' ? summary : summary.filter((e) => e.clientId === client)
  const totalExpected = visibleSummary.reduce((sum, e) => sum + e.expected, 0)
  const totalPaid = visibleSummary.reduce((sum, e) => sum + e.paid, 0)
  const totalBalance = visibleSummary.reduce((sum, e) => sum + e.balance, 0)

  async function exportExcel() {
    if (activeMonth === null) return
    setIsExporting(true)
    try {
      const blob = await accountingService.getReport(activeMonth, year, client)
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `accounting_${monthsLower[activeMonth - 1]}_${year}.xlsx`
      anchor.click()
      URL.revokeObjectURL(url)
    } catch (err: unknown) {
      addToast(
        'toasts.reportExportError',
        'error',
        undefined,
        err instanceof Error ? err.message : undefined,
      )
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className='space-y-6'>
      <div className='flex items-center justify-end gap-2'>
        <AlertButton alerts={alerts} onClick={() => setIsAlertsOpen(true)} />
        <Button
          type='button'
          onClick={exportExcel}
          loading={isExporting}
          disabled={visibleSummary.length === 0}
          className='flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold disabled:opacity-40 hover:bg-primary/90 transition-colors'
        >
          <span
            className={`material-symbols-outlined text-sm ${isExporting ? 'animate-spin' : ''}`}
          >
            {isExporting ? 'sync' : 'download'}
          </span>
          {isExporting ? t('accounting.exporting') : t('accounting.exportExcel')}
        </Button>
      </div>

      {activeMonth === null ? (
        <div className='text-center py-20 bg-white rounded-xl border border-slate-200'>
          <span className='material-symbols-outlined text-5xl text-slate-300 block mb-3'>
            calendar_month
          </span>
          <p className='text-slate-700 font-bold text-lg'>{t('accounting.pickMonth.title')}</p>
          <p className='text-slate-500 text-sm mt-1'>{t('accounting.pickMonth.description')}</p>
        </div>
      ) : isLoading ? (
        <div className='flex items-center justify-center h-32'>
          <span className='material-symbols-outlined text-primary text-3xl animate-spin'>sync</span>
        </div>
      ) : visibleSummary.length === 0 ? (
        <div className='text-center py-20 bg-white rounded-xl border border-slate-200'>
          <span className='material-symbols-outlined text-5xl text-slate-300 block mb-3'>
            account_balance
          </span>
          <p className='text-slate-700 font-bold text-lg'>{t('accounting.empty.title')}</p>
          <p className='text-slate-500 text-sm mt-1'>
            {t('accounting.empty.description', {
              month: months[activeMonth - 1],
              year,
            })}
          </p>
        </div>
      ) : (
        <div className='space-y-4'>
          <div className='grid grid-cols-1 sm:grid-cols-3 gap-4'>
            <SummaryCard
              label={t('accounting.summary.expected')}
              value={totalExpected}
              color='slate'
            />
            <SummaryCard label={t('accounting.summary.paid')} value={totalPaid} color='emerald' />
            <SummaryCard
              label={t('accounting.summary.balance')}
              value={totalBalance}
              color={totalBalance < 0 ? 'red' : totalBalance > 0 ? 'blue' : 'slate'}
            />
          </div>

          <div className='bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden'>
            <table className='w-full text-sm'>
              <thead className='bg-slate-50 border-b border-slate-200'>
                <tr>
                  <th className='text-left px-5 py-3 font-semibold text-slate-600'>
                    {t('accounting.table.client')}
                  </th>
                  <th className='text-right px-4 py-3 font-semibold text-slate-600'>
                    {t('accounting.table.expected')}
                  </th>
                  <th className='text-right px-4 py-3 font-semibold text-slate-600'>
                    {t('accounting.table.paid')}
                  </th>
                  <th className='text-right px-4 py-3 font-semibold text-slate-600'>
                    {t('accounting.table.previousCredit')}
                  </th>
                  <th className='text-right px-5 py-3 font-semibold text-slate-600'>
                    {t('accounting.table.balance')}
                  </th>
                </tr>
              </thead>
              <tbody className='divide-y divide-slate-100'>
                {visibleSummary.map((entry) => (
                  <ClientRow key={entry.clientId} entry={entry} t={t} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <AlertsDrawer
        isOpen={isAlertsOpen}
        onClose={() => setIsAlertsOpen(false)}
        alerts={alerts}
        isLoading={isAlertsLoading}
        title={t('alerts.drawer.titleDebts')}
      />
    </div>
  )
}
