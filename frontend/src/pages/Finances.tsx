import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { getClientsDropdownQueryKeys } from '../API/queryKeys/clients/clientsQueryKeys'
import { AccountingTab } from '../components/finance/AccountingTab'
import { AnalyticsTab } from '../components/finance/AnalyticsTab'
import { FinanceFilters } from '../components/finance/FinanceFilters'
import { InvoicesTab } from '../components/finance/InvoicesTab'
import { PaymentsTab } from '../components/finance/PaymentsTab'
import { FINANCE_TABS, type FinanceTab, TabStrip } from '../components/finance/TabStrip'
import { useQueryRequest } from '../hooks/reactQuery'
import { useTranslation } from '../i18n'
import { clientService } from '../services/client.service'

function isFinanceTab(value: string | null): value is FinanceTab {
  return value !== null && (FINANCE_TABS as string[]).includes(value)
}

const PAYMENT_STATUS_VALUES = ['confirmed', 'pending', 'unmatched'] as const
const INVOICE_STATUS_VALUES = ['draft', 'issued', 'sent', 'paid', 'cancelled'] as const

/**
 * Unified Finances page. A single filter bar (period + client + status) sits
 * above a tab strip and drives the three modules at once: Payments, Accounting
 * and Invoices. The status filter is hidden in Accounting (read-only report).
 */
export function Finances() {
  const { t } = useTranslation()
  const [searchParams, setSearchParams] = useSearchParams()
  const now = new Date()

  const tabParam = searchParams.get('tab')
  const [activeTab, setActiveTab] = useState<FinanceTab>(
    isFinanceTab(tabParam) ? tabParam : 'payments',
  )

  // A deep-link to a specific invoice (?focus=) must not be hidden by the month
  // filter, so default to "all months" in that case.
  const yearParam = Number(searchParams.get('year')) || now.getFullYear()
  const clientParam = Number(searchParams.get('client')) || ''
  const [month, setMonth] = useState<number | ''>(
    searchParams.has('focus') ? '' : now.getMonth() + 1,
  )
  const [year, setYear] = useState(yearParam)
  const [client, setClient] = useState<number | ''>(clientParam)
  const [status, setStatus] = useState('')

  const { data: clients = [] } = useQueryRequest({
    queryKey: getClientsDropdownQueryKeys(),
    queryFn: () => clientService.getAll(),
  })

  const handleTabChange = (tab: FinanceTab) => {
    setActiveTab(tab)
    // Payments and Invoices use different status vocabularies, so a value carried
    // across tabs would be meaningless — reset it on every switch.
    setStatus('')
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.set('tab', tab)
        return next
      },
      { replace: true },
    )
  }

  const handlePeriodChange = (nextMonth: number, nextYear: number) => {
    setMonth(nextMonth)
    setYear(nextYear)
  }

  // Accounting and Analytics are read-only reports — no status filter applies.
  const hideStatus = activeTab === 'accounting' || activeTab === 'analytics'
  const statusOptions =
    activeTab === 'invoices'
      ? INVOICE_STATUS_VALUES.map((value) => ({
          value,
          label: t(`invoices.status.${value}`),
        }))
      : PAYMENT_STATUS_VALUES.map((value) => ({
          value,
          label: t(`filters.status${value.charAt(0).toUpperCase()}${value.slice(1)}`),
        }))

  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-2xl font-black text-slate-900'>{t('finances.title')}</h1>
        <p className='text-slate-500 text-sm mt-1'>{t('finances.subtitle')}</p>
      </div>

      <FinanceFilters
        clients={clients}
        month={month}
        year={year}
        client={client}
        onMonthChange={setMonth}
        onYearChange={setYear}
        onClientChange={setClient}
        alwaysShowYear
        status={status}
        onStatusChange={hideStatus ? undefined : setStatus}
        statusOptions={statusOptions}
      />

      <TabStrip activeTab={activeTab} onTabChange={handleTabChange} />

      {activeTab === 'payments' && (
        <PaymentsTab
          month={month}
          year={year}
          client={client}
          status={status}
          onPeriodChange={handlePeriodChange}
        />
      )}
      {activeTab === 'accounting' && <AccountingTab month={month} year={year} client={client} />}
      {activeTab === 'invoices' && (
        <InvoicesTab month={month} year={year} client={client} status={status} />
      )}
      {activeTab === 'analytics' && <AnalyticsTab month={month} year={year} />}
    </div>
  )
}
