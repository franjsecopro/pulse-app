import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertButton } from '../components/alerts/AlertButton'
import { AlertsDrawer } from '../components/alerts/AlertsDrawer'
import { OnboardingModal } from '../components/onboarding/OnboardingModal'
import { useAlerts } from '../hooks/useAlerts'
import { useTranslation } from '../i18n'
import { dashboardService } from '../services/dashboard.service'
import { paymentService } from '../services/payment.service'
import type { DashboardSummary, Payment, UpcomingClasses } from '../types'

function StatCard({
  label,
  value,
  icon,
  iconColor,
}: {
  label: string
  value: string
  icon: string
  iconColor: string
}) {
  return (
    <div className='flex flex-col gap-2 rounded-xl p-6 bg-white border border-slate-200 shadow-sm'>
      <div className='flex items-center justify-between'>
        <p className='text-slate-500 text-sm font-medium'>{label}</p>
        <span className={`material-symbols-outlined text-sm ${iconColor}`}>{icon}</span>
      </div>
      <p className='text-slate-900 text-2xl font-bold'>{value}</p>
    </div>
  )
}

const ONBOARDING_SEEN_KEY = 'onboarding_seen'

export function Dashboard() {
  const { t } = useTranslation()
  const months: string[] = t('common.months.full', {
    returnObjects: true,
  }) as unknown as string[]
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [recentPayments, setRecentPayments] = useState<Payment[]>([])
  const [upcoming, setUpcoming] = useState<UpcomingClasses | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isAlertsOpen, setIsAlertsOpen] = useState(false)
  const [onboardingDismissed, setOnboardingDismissed] = useState(
    () => localStorage.getItem(ONBOARDING_SEEN_KEY) === '1',
  )

  const dismissOnboarding = () => {
    localStorage.setItem(ONBOARDING_SEEN_KEY, '1')
    setOnboardingDismissed(true)
  }

  const now = new Date()
  const currentMonth = now.getMonth() + 1
  const currentYear = now.getFullYear()
  const { alerts, isLoading: isAlertsLoading } = useAlerts({
    month: currentMonth,
    year: currentYear,
    types: ['debt'],
  })

  useEffect(() => {
    Promise.allSettled([
      dashboardService.getSummary(currentMonth, currentYear),
      paymentService.getAll({ limit: 5 }),
      dashboardService.getUpcoming(),
    ])
      .then(([summaryResult, paymentsResult, upcomingResult]) => {
        if (summaryResult.status === 'fulfilled') setSummary(summaryResult.value)
        if (paymentsResult.status === 'fulfilled') setRecentPayments(paymentsResult.value.data)
        if (upcomingResult.status === 'fulfilled') setUpcoming(upcomingResult.value)
      })
      .finally(() => setIsLoading(false))
  }, [currentYear, currentMonth])

  if (isLoading) {
    return (
      <div className='flex items-center justify-center h-64'>
        <span className='material-symbols-outlined text-primary text-4xl animate-spin'>sync</span>
      </div>
    )
  }

  return (
    <div className='space-y-8'>
      <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-4'>
        <div>
          <h1 className='text-2xl font-black text-slate-900'>{t('dashboard.title')}</h1>
          <p className='text-slate-500 text-sm mt-1'>
            {summary
              ? t('dashboard.summary.title', {
                  month: months[summary.month - 1],
                  year: summary.year,
                })
              : ''}
          </p>
        </div>
        <AlertButton alerts={alerts} onClick={() => setIsAlertsOpen(true)} />
      </div>

      {/* Stats */}
      <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4'>
        <StatCard
          label={t('dashboard.stats.expected')}
          value={`€${summary?.totalExpected.toFixed(2) ?? '0.00'}`}
          icon='trending_up'
          iconColor='text-emerald-600'
        />
        <StatCard
          label={t('dashboard.stats.paid')}
          value={`€${summary?.totalPaid.toFixed(2) ?? '0.00'}`}
          icon='check_circle'
          iconColor='text-primary'
        />
        <StatCard
          label={t('dashboard.stats.pending')}
          value={`€${summary?.totalPending.toFixed(2) ?? '0.00'}`}
          icon='schedule'
          iconColor='text-amber-600'
        />
        <StatCard
          label={t('dashboard.stats.activeClients')}
          value={String(summary?.activeClients ?? 0)}
          icon='groups'
          iconColor='text-slate-500'
        />
      </div>

      {/* Upcoming Classes */}
      {upcoming && (upcoming.today.length > 0 || upcoming.tomorrow.length > 0) && (
        <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
          {(['today', 'tomorrow'] as const).map((day) => {
            const classes = upcoming[day]
            const label =
              day === 'today' ? t('dashboard.upcoming.today') : t('dashboard.upcoming.tomorrow')
            return (
              <div
                key={day}
                className='bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden'
              >
                <div className='px-5 py-3 border-b border-slate-100 flex items-center justify-between'>
                  <h3 className='font-bold text-slate-900 text-sm'>{label}</h3>
                  <span className='text-xs font-semibold text-slate-400'>
                    {t('dashboard.upcoming.classCount', {
                      count: classes.length,
                    })}
                  </span>
                </div>
                {classes.length === 0 ? (
                  <div className='px-5 py-6 text-center text-slate-400 text-sm'>
                    {t('dashboard.upcoming.empty')}
                  </div>
                ) : (
                  <ul className='divide-y divide-slate-100'>
                    {classes.map((classSession) => (
                      <li
                        key={classSession.id}
                        className='px-5 py-3 flex items-center justify-between gap-3'
                      >
                        <div className='flex items-center gap-3 min-w-0'>
                          <div className='w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0'>
                            {(classSession.clientName ?? '?').slice(0, 2).toUpperCase()}
                          </div>
                          <div className='min-w-0'>
                            <p className='text-sm font-semibold text-slate-900 truncate'>
                              {classSession.clientName ?? t('dashboard.upcoming.noClient')}
                            </p>
                            {classSession.contractDescription && (
                              <p className='text-xs text-slate-400 truncate'>
                                {classSession.contractDescription}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className='text-right shrink-0'>
                          <p className='text-sm font-bold text-slate-900'>
                            {classSession.classTime ? classSession.classTime.slice(0, 5) : '—'}
                          </p>
                          <p className='text-xs text-slate-400'>
                            {classSession.durationHours ?? '—'}
                            {t('common.units.hoursShort')} · €
                            {(classSession.effectiveRevenue ?? 0).toFixed(2)}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Debt Alerts */}
      {alerts.length > 0 && (
        <div className='space-y-3'>
          <h2 className='text-base font-bold text-slate-900'>
            {t('dashboard.alerts.paymentAlerts')}
          </h2>
          {alerts.map((alert) => (
            <div
              key={alert.clientId}
              className='flex flex-col md:flex-row items-start md:items-center justify-between gap-4 rounded-xl border border-red-200 bg-red-50 p-5'
            >
              <div className='flex items-center gap-3'>
                <span className='material-symbols-outlined text-red-600'>error</span>
                <div>
                  <p className='text-red-900 font-bold'>{alert.clientName}</p>
                  <p className='text-red-700 text-sm'>
                    {t('alerts.drawer.debtMessage', {
                      name: alert.clientName ?? '?',
                      month: months[alert.month - 1],
                      year: alert.year,
                    })}{' '}
                    — €{alert.amount.toFixed(2)}
                  </p>
                </div>
              </div>
              <Link
                to='/alerts'
                className='shrink-0 flex items-center gap-2 rounded-lg h-9 px-4 bg-primary text-white text-sm font-semibold hover:bg-primary-hover transition-colors'
              >
                {t('dashboard.alerts.viewDetail')}
              </Link>
            </div>
          ))}
        </div>
      )}

      {/* Recent Payments */}
      <div className='bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden'>
        <div className='px-6 py-4 border-b border-slate-200 flex items-center justify-between'>
          <h3 className='text-slate-900 font-bold'>{t('dashboard.recentPayments.title')}</h3>
          <Link
            to='/finances?tab=payments'
            className='text-primary text-sm font-semibold hover:underline'
          >
            {t('dashboard.recentPayments.viewAll')}
          </Link>
        </div>
        {recentPayments.length === 0 ? (
          <div className='p-12 text-center text-slate-400'>
            <span className='material-symbols-outlined text-4xl block mb-2'>payments</span>
            {t('dashboard.recentPayments.empty')}
          </div>
        ) : (
          <div className='overflow-x-auto'>
            <table className='w-full text-left'>
              <thead className='bg-slate-50'>
                <tr>
                  <th className='px-6 py-3 text-slate-500 text-xs font-bold uppercase tracking-wider'>
                    {t('dashboard.recentPayments.table.client')}
                  </th>
                  <th className='px-6 py-3 text-slate-500 text-xs font-bold uppercase tracking-wider'>
                    {t('dashboard.recentPayments.table.amount')}
                  </th>
                  <th className='px-6 py-3 text-slate-500 text-xs font-bold uppercase tracking-wider'>
                    {t('dashboard.recentPayments.table.date')}
                  </th>
                  <th className='px-6 py-3 text-slate-500 text-xs font-bold uppercase tracking-wider'>
                    {t('dashboard.recentPayments.table.status')}
                  </th>
                </tr>
              </thead>
              <tbody className='divide-y divide-slate-100'>
                {recentPayments.map((payment) => (
                  <tr key={payment.id} className='hover:bg-slate-50 transition-colors'>
                    <td className='px-6 py-4'>
                      <div className='flex items-center gap-3'>
                        <div className='w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold'>
                          {(payment.clientName ?? '?').slice(0, 2).toUpperCase()}
                        </div>
                        <span className='font-medium text-slate-900'>
                          {payment.clientName ?? t('dashboard.upcoming.noClient')}
                        </span>
                      </div>
                    </td>
                    <td className='px-6 py-4 font-semibold text-slate-900'>
                      €{payment.amount.toFixed(2)}
                    </td>
                    <td className='px-6 py-4 text-slate-500'>{payment.paymentDate}</td>
                    <td className='px-6 py-4'>
                      {payment.status === 'confirmed' ? (
                        <span className='inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700'>
                          <span className='material-symbols-outlined text-[12px]'>
                            check_circle
                          </span>
                          {t('payments.status.confirmed')}
                        </span>
                      ) : (
                        <span className='inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700'>
                          <span className='material-symbols-outlined text-[12px]'>schedule</span>
                          {t('payments.status.pending')}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Quick links */}
      <div className='grid grid-cols-1 sm:grid-cols-3 gap-4'>
        {[
          {
            to: '/clients',
            icon: 'group_add',
            label: t('dashboard.quickLinks.newClient'),
            desc: t('dashboard.quickLinks.newClientDesc'),
          },
          {
            to: '/classes',
            icon: 'event',
            label: t('dashboard.quickLinks.newClass'),
            desc: t('dashboard.quickLinks.newClassDesc'),
          },
          {
            to: '/finances?tab=payments',
            icon: 'add_card',
            label: t('dashboard.quickLinks.newPayment'),
            desc: t('dashboard.quickLinks.newPaymentDesc'),
          },
        ].map(({ to, icon, label, desc }) => (
          <Link
            key={to}
            to={to}
            className='flex items-center gap-4 p-5 bg-white rounded-xl border border-slate-200 shadow-sm hover:border-primary/50 hover:shadow-md transition-all group'
          >
            <div className='w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 group-hover:bg-primary group-hover:text-white transition-colors'>
              <span className='material-symbols-outlined'>{icon}</span>
            </div>
            <div>
              <p className='font-bold text-slate-900'>{label}</p>
              <p className='text-slate-500 text-sm'>{desc}</p>
            </div>
          </Link>
        ))}
      </div>

      <AlertsDrawer
        isOpen={isAlertsOpen}
        onClose={() => setIsAlertsOpen(false)}
        alerts={alerts}
        isLoading={isAlertsLoading}
        title={t('alerts.drawer.titleDebts')}
      />

      <OnboardingModal
        isOpen={!onboardingDismissed && summary?.activeClients === 0}
        onClose={dismissOnboarding}
      />
    </div>
  )
}
