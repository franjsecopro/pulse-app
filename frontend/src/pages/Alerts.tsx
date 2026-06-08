import { useState } from 'react'
import { AlertsDrawer } from '../components/alerts/AlertsDrawer'
import { MonthYearSelect } from '../components/notifications/MonthYearSelect'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { useAlerts } from '../hooks/useAlerts'
import { useTranslation } from '../i18n'

const now = new Date()
const CURRENT_YEAR = now.getFullYear()
const YEARS = [CURRENT_YEAR - 1, CURRENT_YEAR]

export function Alerts() {
  const { t } = useTranslation()
  const months: string[] = t('common.months.full', {
    returnObjects: true,
  }) as unknown as string[]
  const [filterMonth, setFilterMonth] = useState(now.getMonth() + 1)
  const [filterYear, setFilterYear] = useState(CURRENT_YEAR)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const { alerts, isLoading, count } = useAlerts({
    month: filterMonth,
    year: filterYear,
  })

  const debtAlerts = alerts.filter((a) => a.type === 'debt')
  const creditAlerts = alerts.filter((a) => a.type === 'credit')
  const systemAlerts = alerts.filter((a) => a.type === 'statement_missing')

  return (
    <div className='space-y-6'>
      <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-4'>
        <div>
          <h1 className='text-2xl font-black text-slate-900'>{t('alerts.title')}</h1>
          <p className='text-slate-500 text-sm mt-1'>{t('alerts.subtitle')}</p>
        </div>
        <div className='flex items-center gap-2'>
          <MonthYearSelect
            month={filterMonth}
            year={filterYear}
            onMonthChange={setFilterMonth}
            onYearChange={setFilterYear}
            years={YEARS}
            labels={{ month: t('alerts.month'), year: t('alerts.year') }}
          />
          <Button
            type='button'
            onClick={() => setIsDrawerOpen(true)}
            disabled={count === 0}
            className='inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold disabled:opacity-40 hover:bg-primary-hover transition-colors'
          >
            <span className='material-symbols-outlined text-base'>open_in_new</span>
            Ver detalle
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className='flex items-center justify-center h-32'>
          <span className='material-symbols-outlined text-primary text-3xl animate-spin'>sync</span>
        </div>
      ) : alerts.length === 0 ? (
        <div className='text-center py-20 bg-white rounded-xl border border-slate-200'>
          <span className='material-symbols-outlined text-5xl text-emerald-400 block mb-3'>
            check_circle
          </span>
          <p className='text-slate-700 font-bold text-lg'>{t('alerts.allOk.title')}</p>
          <p className='text-slate-500 text-sm mt-1'>{t('alerts.allOk.description')}</p>
        </div>
      ) : (
        <div className='space-y-6'>
          {systemAlerts.length > 0 && (
            <div>
              <h2 className='text-base font-bold text-slate-900 mb-3 flex items-center gap-2'>
                <span className='inline-block w-3 h-3 rounded-full bg-amber-500'></span>
                {t('alerts.section.systemAlerts')}
              </h2>
              <div className='space-y-3'>
                {systemAlerts.map((alert) => (
                  <div
                    key={`${alert.type}-${alert.month}-${alert.year}`}
                    className='rounded-xl border border-amber-200 bg-amber-50 p-4 flex items-center gap-3'
                  >
                    <span className='material-symbols-outlined text-amber-500'>warning</span>
                    <p className='text-sm text-amber-800 font-medium'>
                      {t('alerts.drawer.statementMissingMessage', {
                        month: months[alert.month - 1],
                        year: alert.year,
                      })}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className='grid grid-cols-1 sm:grid-cols-3 gap-4'>
            <SummaryCard
              label={t('alerts.summary.totalAlerts')}
              value={alerts.length}
              color='slate'
            />
            <SummaryCard label={t('alerts.summary.debts')} value={debtAlerts.length} color='red' />
            <SummaryCard
              label={t('alerts.summary.credits')}
              value={creditAlerts.length}
              color='blue'
            />
          </div>

          {debtAlerts.length > 0 && (
            <AlertList
              title={t('alerts.section.debtClients')}
              alerts={debtAlerts}
              dotColor='red'
              months={months}
              t={t}
            />
          )}

          {creditAlerts.length > 0 && (
            <>
              <p className='text-xs text-slate-500 -mb-2'>
                {t('alerts.section.creditExplanation')}
              </p>
              <AlertList
                title={t('alerts.section.creditClients')}
                alerts={creditAlerts}
                dotColor='blue'
                months={months}
                t={t}
              />
            </>
          )}
        </div>
      )}

      <AlertsDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        alerts={alerts}
        isLoading={isLoading}
        title={t('alerts.drawer.titleAll')}
      />
    </div>
  )
}

function SummaryCard({
  label,
  value,
  color,
}: {
  label: string
  value: number
  color: 'slate' | 'red' | 'blue'
}) {
  const colorMap: Record<typeof color, string> = {
    slate: 'bg-white border-slate-200 text-slate-900',
    red: 'bg-red-50 border-red-200 text-red-900',
    blue: 'bg-blue-50 border-blue-200 text-blue-900',
  }
  return (
    <div className={`rounded-xl border p-5 text-center shadow-sm ${colorMap[color]}`}>
      <p className='text-sm font-medium opacity-70'>{label}</p>
      <p className='text-3xl font-black mt-1'>{value}</p>
    </div>
  )
}

function AlertList({
  title,
  alerts,
  dotColor,
  months,
  t,
}: {
  title: string
  alerts: ReturnType<typeof useAlerts>['alerts']
  dotColor: 'red' | 'blue'
  months: string[]
  t: (key: string, options?: Record<string, unknown>) => string
}) {
  const isDebt = dotColor === 'red'
  return (
    <div>
      <h2 className='text-base font-bold text-slate-900 mb-3 flex items-center gap-2'>
        <span
          className={`inline-block w-3 h-3 rounded-full ${isDebt ? 'bg-red-500' : 'bg-blue-500'}`}
        ></span>
        {title}
      </h2>
      <div className='space-y-3'>
        {alerts.map((alert) => {
          const monthName = months[alert.month - 1]
          const message = isDebt
            ? t('alerts.drawer.debtMessage', {
                name: alert.clientName ?? '?',
                month: monthName,
                year: alert.year,
              })
            : t('alerts.drawer.creditMessage', {
                name: alert.clientName ?? '?',
                month: monthName,
                year: alert.year,
              })
          return (
            <div
              key={alert.clientId}
              className={`rounded-xl border p-5 ${isDebt ? 'border-red-200 bg-red-50' : 'border-blue-200 bg-blue-50'}`}
            >
              <div className='flex items-center justify-between gap-4'>
                <div className='flex items-center gap-3 min-w-0'>
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white shrink-0 ${isDebt ? 'bg-red-500' : 'bg-blue-500'}`}
                  >
                    {(alert.clientName ?? '??').slice(0, 2).toUpperCase()}
                  </div>
                  <div className='min-w-0'>
                    <p className={`font-bold ${isDebt ? 'text-red-900' : 'text-blue-900'}`}>
                      {alert.clientName}
                    </p>
                    <p className={`text-sm ${isDebt ? 'text-red-700' : 'text-blue-700'}`}>
                      {message}
                    </p>
                  </div>
                </div>
                <Badge variant={isDebt ? 'danger' : 'info'}>
                  {isDebt ? '-' : '+'}€{alert.amount.toFixed(2)}
                </Badge>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
