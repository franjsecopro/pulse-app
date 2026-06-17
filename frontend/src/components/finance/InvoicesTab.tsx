import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useToast } from '../../context/ToastContext'
import { useInvoices } from '../../hooks/useInvoices'
import { useTranslation } from '../../i18n'
import { invoiceService } from '../../services/invoice.service'
import type { Invoice } from '../../types'
import { GenerateInvoiceModal } from '../invoices/GenerateInvoiceModal'
import { SendInvoiceModal } from '../invoices/SendInvoiceModal'
import { Button } from '../ui/Button'
import { ConfirmationModal } from '../ui/ConfirmationModal'

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-600',
  issued: 'bg-blue-50 text-blue-700',
  sent: 'bg-emerald-50 text-emerald-700',
  paid: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-red-50 text-red-700',
}

function formatPeriod(invoice: Invoice): string {
  if (!invoice.periodStart) return '—'
  if (!invoice.periodEnd || invoice.periodEnd === invoice.periodStart) return invoice.periodStart
  return `${invoice.periodStart} → ${invoice.periodEnd}`
}

interface InvoicesTabProps {
  /** Shared filters — controlled by the Finanzas container. */
  month: number | ''
  year: number
  client: number | ''
  status: string
}

export function InvoicesTab({ month, year, client, status }: InvoicesTabProps) {
  const { t } = useTranslation()
  const { addToast } = useToast()

  // "Ir a factura" from a class deep-links here with ?focus= to highlight the
  // exact row (the client filter is pre-set by the Finanzas container via ?client=).
  const [searchParams] = useSearchParams()
  const focusId = Number(searchParams.get('focus')) || null

  const {
    invoices,
    clients,
    isLoading,
    page,
    pageCount,
    goToPage,
    createFromPeriod,
    issueInvoice,
    sendInvoice,
    deleteInvoice,
    isCreating,
    isDeleting,
  } = useInvoices({
    filterClient: client,
    filterStatus: status,
    filterMonth: month,
    filterYear: year,
  })

  const [isGenerateOpen, setIsGenerateOpen] = useState(false)
  const [sendTarget, setSendTarget] = useState<Invoice | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Invoice | null>(null)

  // Drafts have no frozen clientName yet — fall back to the live client list.
  const clientNameById = new Map(clients.map((c) => [c.id, c.name]))

  async function confirmDelete() {
    if (!deleteTarget) return
    await deleteInvoice(deleteTarget.id)
    setDeleteTarget(null)
  }

  function openPreview(id: number) {
    window.open(`/api/invoices/${id}/preview`, '_blank', 'noopener')
  }

  async function downloadPdf(invoice: Invoice) {
    try {
      const blob = await invoiceService.downloadPdf(invoice.id)
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `facture_${invoice.number ?? invoice.id}.pdf`
      anchor.click()
      URL.revokeObjectURL(url)
    } catch (err: unknown) {
      addToast(
        'toasts.reportExportError',
        'error',
        undefined,
        err instanceof Error ? err.message : undefined,
      )
    }
  }

  return (
    <div className='space-y-6'>
      <div className='flex items-center justify-end'>
        <Button
          type='button'
          onClick={() => setIsGenerateOpen(true)}
          className='flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors'
        >
          <span className='material-symbols-outlined text-sm'>add</span>
          {t('invoices.generate')}
        </Button>
      </div>

      {isLoading ? (
        <div className='flex items-center justify-center h-32'>
          <span className='material-symbols-outlined text-primary text-3xl animate-spin'>sync</span>
        </div>
      ) : invoices.length === 0 ? (
        <div className='text-center py-20 bg-white rounded-xl border border-slate-200'>
          <span className='material-symbols-outlined text-5xl text-slate-300 block mb-3'>
            receipt_long
          </span>
          <p className='text-slate-700 font-bold text-lg'>{t('invoices.empty.title')}</p>
          <p className='text-slate-500 text-sm mt-1'>{t('invoices.empty.description')}</p>
        </div>
      ) : (
        <div className='bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden'>
          <table className='w-full text-sm'>
            <thead className='bg-slate-50 border-b border-slate-200'>
              <tr>
                <th className='text-left px-5 py-3 font-semibold text-slate-600'>
                  {t('invoices.table.number')}
                </th>
                <th className='text-left px-4 py-3 font-semibold text-slate-600'>
                  {t('invoices.table.client')}
                </th>
                <th className='text-left px-4 py-3 font-semibold text-slate-600'>
                  {t('invoices.table.period')}
                </th>
                <th className='text-right px-4 py-3 font-semibold text-slate-600'>
                  {t('invoices.table.total')}
                </th>
                <th className='text-center px-4 py-3 font-semibold text-slate-600'>
                  {t('invoices.table.status')}
                </th>
                <th className='text-right px-5 py-3 font-semibold text-slate-600'>
                  {t('invoices.table.actions')}
                </th>
              </tr>
            </thead>
            <tbody className='divide-y divide-slate-100'>
              {invoices.map((invoice) => (
                <tr
                  key={invoice.id}
                  className={`transition-colors ${focusId === invoice.id ? 'bg-primary/10' : 'hover:bg-slate-50'}`}
                >
                  <td className='px-5 py-4 font-medium text-slate-900'>
                    {invoice.number ?? (
                      <span className='text-slate-400 italic font-normal'>
                        {t('invoices.notNumbered')}
                      </span>
                    )}
                  </td>
                  <td className='px-4 py-4 text-slate-700'>
                    <div>{invoice.clientName ?? clientNameById.get(invoice.clientId) ?? '—'}</div>
                    {invoice.contractLabel && (
                      <div className='text-xs text-slate-400'>{invoice.contractLabel}</div>
                    )}
                  </td>
                  <td className='px-4 py-4 text-slate-500 text-xs'>{formatPeriod(invoice)}</td>
                  <td className='px-4 py-4 text-right text-slate-700'>
                    €{invoice.totalHt.toFixed(2)}
                  </td>
                  <td className='px-4 py-4 text-center'>
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_STYLES[invoice.status] ?? STATUS_STYLES.draft}`}
                    >
                      {t(`invoices.status.${invoice.status}`)}
                    </span>
                  </td>
                  <td className='px-5 py-4'>
                    <div className='flex items-center justify-end gap-1'>
                      <IconAction
                        icon='visibility'
                        title={t('invoices.actions.preview')}
                        onClick={() => openPreview(invoice.id)}
                      />
                      {invoice.status === 'draft' && (
                        <Button
                          type='button'
                          onClick={() => issueInvoice(invoice.id)}
                          title={t('invoices.actions.issue')}
                          className='px-2.5 py-1 rounded-lg bg-primary/10 text-primary text-xs font-bold hover:bg-primary/20 transition-colors'
                        >
                          {t('invoices.actions.issue')}
                        </Button>
                      )}
                      <IconAction
                        icon='download'
                        title={t('invoices.actions.download')}
                        onClick={() => downloadPdf(invoice)}
                      />
                      <IconAction
                        icon='send'
                        title={t('invoices.actions.send')}
                        onClick={() => setSendTarget(invoice)}
                      />
                      {invoice.status === 'draft' && (
                        <IconAction
                          icon='delete'
                          title={t('invoices.actions.discard')}
                          onClick={() => setDeleteTarget(invoice)}
                          danger
                        />
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pageCount > 1 && (
        <div className='flex items-center justify-center gap-2'>
          <Button
            type='button'
            onClick={() => goToPage(Math.max(1, page - 1))}
            disabled={page <= 1}
            className='px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-sm disabled:opacity-40'
          >
            ←
          </Button>
          <span className='text-sm text-slate-500'>
            {page} / {pageCount}
          </span>
          <Button
            type='button'
            onClick={() => goToPage(Math.min(pageCount, page + 1))}
            disabled={page >= pageCount}
            className='px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-sm disabled:opacity-40'
          >
            →
          </Button>
        </div>
      )}

      <GenerateInvoiceModal
        isOpen={isGenerateOpen}
        onClose={() => setIsGenerateOpen(false)}
        clients={clients}
        onSubmit={createFromPeriod}
        isSubmitting={isCreating}
      />

      {sendTarget && (
        <SendInvoiceModal
          invoice={sendTarget}
          onClose={() => setSendTarget(null)}
          onSend={sendInvoice}
        />
      )}

      <ConfirmationModal
        isOpen={deleteTarget !== null}
        variant='danger'
        message={t('invoices.discardConfirm')}
        isLoading={isDeleting}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}

function IconAction({
  icon,
  title,
  onClick,
  danger = false,
}: {
  icon: string
  title: string
  onClick: () => void
  danger?: boolean
}) {
  const hoverClass = danger ? 'hover:text-red-600' : 'hover:text-primary'
  return (
    <Button
      type='button'
      onClick={onClick}
      title={title}
      className={`p-1.5 rounded-lg text-slate-400 ${hoverClass} hover:bg-slate-100 transition-colors`}
    >
      <span className='material-symbols-outlined text-lg'>{icon}</span>
    </Button>
  )
}
