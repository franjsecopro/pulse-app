import { useEffect, useState } from 'react'
import { useTranslation } from '../../i18n'
import { invoiceService } from '../../services/invoice.service'
import type { Invoice } from '../../types'
import { Button } from '../ui/Button'

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-600',
  issued: 'bg-blue-50 text-blue-700',
  sent: 'bg-emerald-50 text-emerald-700',
  paid: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-red-50 text-red-700',
}

/**
 * Shows whether a class already has invoice(s) associated and lets the user open
 * the invoice preview in a new tab — without leaving the class modal.
 */
export function ClassInvoiceLink({ classId }: { classId: number }) {
  const { t } = useTranslation()
  const [invoices, setInvoices] = useState<Invoice[] | null>(null)

  useEffect(() => {
    let active = true
    invoiceService
      .getByClass(classId)
      .then((data) => active && setInvoices(data))
      .catch(() => active && setInvoices([]))
    return () => {
      active = false
    }
  }, [classId])

  if (invoices === null) return null // still loading — stay quiet

  if (invoices.length === 0) {
    return (
      <div className='flex items-center gap-2 text-xs text-slate-400'>
        <span className='material-symbols-outlined text-sm'>receipt_long</span>
        {t('classes.invoice.none')}
      </div>
    )
  }

  return (
    <div className='rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2'>
      <p className='text-xs font-semibold text-slate-500 uppercase tracking-wide'>
        {t('classes.invoice.linked')}
      </p>
      {invoices.map((invoice) => (
        <div key={invoice.id} className='flex items-center justify-between gap-2'>
          <div className='flex items-center gap-2 min-w-0'>
            <span className='font-medium text-slate-800 text-sm truncate'>
              {invoice.number ?? t('invoices.notNumbered')}
            </span>
            <span
              className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_STYLES[invoice.status] ?? STATUS_STYLES.draft}`}
            >
              {t(`invoices.status.${invoice.status}`)}
            </span>
          </div>
          <Button
            type='button'
            onClick={() => window.open(`/api/invoices/${invoice.id}/preview`, '_blank', 'noopener')}
            className='flex items-center gap-1 px-2.5 py-1 rounded-lg text-primary text-xs font-semibold hover:bg-primary/10 transition-colors shrink-0'
          >
            <span className='material-symbols-outlined text-sm'>visibility</span>
            {t('classes.invoice.view')}
          </Button>
        </div>
      ))}
    </div>
  )
}
