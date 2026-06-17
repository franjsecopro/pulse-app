import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useAlerts } from '../../hooks/useAlerts'
import { usePayments } from '../../hooks/usePayments'
import { useTranslation } from '../../i18n'
import type { Payment } from '../../types'
import { AlertButton } from '../alerts/AlertButton'
import { AlertsDrawer } from '../alerts/AlertsDrawer'
import { PAYMENT_STATUS_CONFIG } from '../payments/constants'
import { ImportStatementModal } from '../payments/ImportStatementModal'
import { PaymentForm } from '../payments/PaymentForm'
import { StatementHistoryView } from '../payments/StatementHistoryView'
import { Button } from '../ui/Button'
import { ConfirmationModal } from '../ui/ConfirmationModal'
import { Modal } from '../ui/Modal'
import { Pagination } from '../ui/Pagination'

interface PaymentsTabProps {
  /** Shared filters — controlled by the Finances container. */
  month: number | ''
  year: number
  client: number | ''
  status: string
  /** Bubble a detected statement period up to the shared selector after import. */
  onPeriodChange: (month: number, year: number) => void
}

export function PaymentsTab({ month, year, client, status, onPeriodChange }: PaymentsTabProps) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'

  const [activeTab, setActiveTab] = useState<'payments' | 'history'>('payments')
  const [pendingStatementId, setPendingStatementId] = useState<number | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null)
  const [isAlertsOpen, setIsAlertsOpen] = useState(false)
  const { alerts, isLoading: isAlertsLoading } = useAlerts({
    month: typeof month === 'number' ? month : undefined,
    year,
    types: ['statement_missing'],
  })

  const {
    payments,
    clients,
    statementHistory,
    isLoading,
    isStatementHistoryLoading,
    totalAmount,
    pendingDeleteId,
    page,
    pageCount,
    totalCount,
    goToPage,
    loadStatementHistory,
    createPayment,
    updatePayment,
    requestDelete,
    confirmDelete,
    cancelDelete,
    handleImported,
    deleteStatementImport,
  } = usePayments({
    filterMonth: month,
    filterYear: year,
    filterClient: client,
    filterStatus: status,
  })

  useEffect(() => {
    if (activeTab === 'history') loadStatementHistory()
  }, [activeTab, loadStatementHistory])

  const handleCreate = async (data: Partial<Payment>) => {
    await createPayment(data as Parameters<typeof createPayment>[0])
    setShowCreateModal(false)
  }

  const handleUpdate = async (data: Partial<Payment>) => {
    if (!editingPayment) return
    await updatePayment(editingPayment.id, data)
    setEditingPayment(null)
  }

  return (
    <div className='space-y-6'>
      <div className='flex items-center justify-end gap-2'>
        <AlertButton alerts={alerts} onClick={() => setIsAlertsOpen(true)} />
        <Button
          type='button'
          onClick={() => setShowImportModal(true)}
          className='flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2.5 rounded-xl font-bold text-sm transition-all border border-slate-200'
        >
          <span className='material-symbols-outlined text-base'>upload_file</span>
          {t('payments.importStatement')}
        </Button>
        <Button
          type='button'
          onClick={() => setShowCreateModal(true)}
          className='flex items-center gap-2 bg-primary hover:bg-primary-hover text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-primary/20 transition-all'
        >
          <span className='material-symbols-outlined'>add</span>
          {t('payments.newPayment')}
        </Button>
      </div>

      {/* Sub-tabs */}
      <div className='flex gap-1 bg-slate-100 rounded-xl p-1 w-fit'>
        {(['payments', 'history'] as const).map((tab) => (
          <Button
            type='button'
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === tab
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab === 'payments' ? t('payments.tab.payments') : t('payments.tab.history')}
          </Button>
        ))}
      </div>

      {activeTab === 'history' && (
        <StatementHistoryView
          records={statementHistory}
          isLoading={isStatementHistoryLoading}
          isAdmin={isAdmin}
          onDelete={setPendingStatementId}
        />
      )}

      {activeTab === 'payments' && (
        <>
          {payments.length > 0 && (
            <div className='flex justify-end'>
              <div className='bg-primary/5 border border-primary/20 rounded-xl px-4 py-2 text-sm font-bold text-primary'>
                {t('payments.totalAmount', { amount: totalAmount.toFixed(2) })}
              </div>
            </div>
          )}

          {isLoading ? (
            <div className='flex items-center justify-center h-32'>
              <span className='material-symbols-outlined text-primary text-3xl animate-spin'>
                sync
              </span>
            </div>
          ) : payments.length === 0 ? (
            <div className='text-center py-16 bg-white rounded-xl border border-slate-200'>
              <span className='material-symbols-outlined text-5xl text-slate-300 block mb-3'>
                payments
              </span>
              <p className='text-slate-500 font-medium'>{t('payments.empty')}</p>
              <Button
                type='button'
                onClick={() => setShowCreateModal(true)}
                className='mt-4 text-primary text-sm font-semibold hover:underline'
              >
                {t('payments.registerFirst')}
              </Button>
            </div>
          ) : (
            <div className='bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden'>
              <div className='overflow-x-auto'>
                <table className='w-full text-left'>
                  <thead className='bg-slate-50 border-b border-slate-200'>
                    <tr>
                      <th className='px-6 py-3 text-slate-500 text-xs font-bold uppercase tracking-wider'>
                        {t('payments.table.client')}
                      </th>
                      <th className='px-6 py-3 text-slate-500 text-xs font-bold uppercase tracking-wider'>
                        {t('payments.table.concept')}
                      </th>
                      <th className='px-6 py-3 text-slate-500 text-xs font-bold uppercase tracking-wider'>
                        {t('payments.table.amount')}
                      </th>
                      <th className='px-6 py-3 text-slate-500 text-xs font-bold uppercase tracking-wider'>
                        {t('payments.table.date')}
                      </th>
                      <th className='px-6 py-3 text-slate-500 text-xs font-bold uppercase tracking-wider'>
                        {t('payments.table.status')}
                      </th>
                      <th className='px-6 py-3 text-right text-slate-500 text-xs font-bold uppercase tracking-wider'>
                        {t('payments.table.actions')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className='divide-y divide-slate-100'>
                    {payments.map((payment) => {
                      const paymentStatus =
                        PAYMENT_STATUS_CONFIG[payment.status] ?? PAYMENT_STATUS_CONFIG.pending
                      return (
                        <tr key={payment.id} className='hover:bg-slate-50 transition-colors'>
                          <td className='px-6 py-4'>
                            <div className='flex items-center gap-3'>
                              <div className='w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold'>
                                {(payment.clientName ?? '?').slice(0, 2).toUpperCase()}
                              </div>
                              <span className='font-medium text-slate-900'>
                                {payment.clientName ?? t('payments.table.noClient')}
                              </span>
                            </div>
                          </td>
                          <td className='px-6 py-4 text-slate-600'>{payment.concept ?? '—'}</td>
                          <td className='px-6 py-4 font-bold text-slate-900'>
                            €{payment.amount.toFixed(2)}
                          </td>
                          <td className='px-6 py-4 text-slate-500 text-sm whitespace-nowrap'>
                            {payment.paymentDate}
                          </td>
                          <td className='px-6 py-4'>
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${paymentStatus.className}`}
                            >
                              <span className='material-symbols-outlined text-[12px]'>
                                {paymentStatus.icon}
                              </span>
                              {t(paymentStatus.label)}
                            </span>
                          </td>
                          <td className='px-6 py-4 text-right'>
                            <div className='flex items-center justify-end gap-1'>
                              <Button
                                type='button'
                                onClick={() => setEditingPayment(payment)}
                                className='p-1.5 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors'
                              >
                                <span className='material-symbols-outlined text-base'>edit</span>
                              </Button>
                              <Button
                                type='button'
                                onClick={() => requestDelete(payment.id)}
                                className='p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors'
                              >
                                <span className='material-symbols-outlined text-base'>delete</span>
                              </Button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <Pagination
                page={page}
                pageCount={pageCount}
                totalCount={totalCount}
                onPage={goToPage}
              />
            </div>
          )}
        </>
      )}

      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title={t('payments.create')}
      >
        <PaymentForm
          clients={clients}
          onSave={handleCreate}
          onCancel={() => setShowCreateModal(false)}
        />
      </Modal>

      <Modal
        isOpen={!!editingPayment}
        onClose={() => setEditingPayment(null)}
        title={t('payments.edit')}
      >
        {editingPayment && (
          <PaymentForm
            initial={editingPayment}
            clients={clients}
            onSave={handleUpdate}
            onCancel={() => setEditingPayment(null)}
          />
        )}
      </Modal>

      <ConfirmationModal
        isOpen={pendingDeleteId !== null}
        variant='danger'
        title={t('payments.deleteTitle')}
        message={t('payments.deleteMessage')}
        confirmLabel={t('actions.delete')}
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
      />

      <ConfirmationModal
        isOpen={pendingStatementId !== null}
        variant='danger'
        title={t('statements.deleteTitle')}
        message={t('statements.deleteMessage')}
        confirmLabel={t('statements.deleteConfirm')}
        onConfirm={async () => {
          if (pendingStatementId !== null) await deleteStatementImport(pendingStatementId)
          setPendingStatementId(null)
        }}
        onCancel={() => setPendingStatementId(null)}
      />

      <Modal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        title={t('import.importStatement')}
        size='xl'
      >
        <ImportStatementModal
          clients={clients}
          onClose={() => setShowImportModal(false)}
          onImported={(importedMonth, importedYear) => {
            if (importedMonth && importedYear) onPeriodChange(importedMonth, importedYear)
            handleImported()
          }}
        />
      </Modal>

      <AlertsDrawer
        isOpen={isAlertsOpen}
        onClose={() => setIsAlertsOpen(false)}
        alerts={alerts}
        isLoading={isAlertsLoading}
        title={t('alerts.drawer.titleStatements')}
      />
    </div>
  )
}
