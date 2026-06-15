import { useState } from 'react'
import { useTranslation } from '../../i18n'
import type { Invoice, SendInvoiceResult } from '../../types'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'

interface SendInvoiceModalProps {
  invoice: Invoice
  onClose: () => void
  onSend: (id: number, data: { email?: string; phone?: string }) => Promise<SendInvoiceResult>
}

const FIELD_CLASS =
  'mt-1 w-full border border-slate-200 rounded-lg py-2 px-3 text-sm text-slate-700 bg-white focus:ring-primary focus:border-primary'

export function SendInvoiceModal({ invoice, onClose, onSend }: SendInvoiceModalProps) {
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [result, setResult] = useState<SendInvoiceResult | null>(null)
  const [isSending, setIsSending] = useState(false)

  async function handleSend() {
    setIsSending(true)
    try {
      const res = await onSend(invoice.id, {
        email: email || undefined,
        phone: phone || undefined,
      })
      setResult(res)
    } catch {
      // Errors surface as a toast from the hook; keep the modal open to retry.
    } finally {
      setIsSending(false)
    }
  }

  return (
    <Modal isOpen onClose={onClose} title={t('invoices.sendModal.title')}>
      {result ? (
        <div className='space-y-4'>
          <div>
            <span className='text-xs font-semibold text-slate-500 uppercase tracking-wide'>
              {t('invoices.sendModal.shareLink')}
            </span>
            <a
              href={result.shareUrl}
              target='_blank'
              rel='noreferrer'
              className='block mt-1 text-sm text-primary break-all hover:underline'
            >
              {result.shareUrl}
            </a>
          </div>

          {result.whatsappUrl && (
            <a
              href={result.whatsappUrl}
              target='_blank'
              rel='noreferrer'
              className='inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-colors'
            >
              <span className='material-symbols-outlined text-base'>chat</span>
              {t('invoices.sendModal.whatsappLink')}
            </a>
          )}

          <div className='text-sm'>
            {result.email.sent ? (
              <span className='inline-flex items-center gap-1 text-emerald-700'>
                <span className='material-symbols-outlined text-base'>mark_email_read</span>
                {t('invoices.sendModal.emailSent')}
              </span>
            ) : result.email.reason === 'not_configured' ? (
              <span className='inline-flex items-center gap-1 text-amber-700'>
                <span className='material-symbols-outlined text-base'>info</span>
                {t('invoices.sendModal.emailNotConfigured')}
              </span>
            ) : null}
          </div>

          <div className='flex justify-end pt-2'>
            <Button
              type='button'
              onClick={onClose}
              className='px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors'
            >
              OK
            </Button>
          </div>
        </div>
      ) : (
        <div className='space-y-4'>
          <label className='block'>
            <span className='text-sm font-medium text-slate-700'>
              {t('invoices.sendModal.email')}
            </span>
            <input
              type='email'
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder='client@example.com'
              className={FIELD_CLASS}
            />
          </label>
          <label className='block'>
            <span className='text-sm font-medium text-slate-700'>
              {t('invoices.sendModal.phone')}
            </span>
            <input
              type='tel'
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder='+33 6 12 34 56 78'
              className={FIELD_CLASS}
            />
          </label>
          <p className='text-xs text-slate-400'>{t('invoices.sendModal.hint')}</p>

          <div className='flex justify-end gap-2 pt-2'>
            <Button
              type='button'
              onClick={onClose}
              className='px-4 py-2 rounded-lg bg-slate-100 text-slate-700 text-sm font-semibold hover:bg-slate-200 transition-colors'
            >
              {t('invoices.sendModal.cancel')}
            </Button>
            <Button
              type='button'
              onClick={handleSend}
              loading={isSending}
              disabled={!email && !phone}
              className='px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold disabled:opacity-40 hover:bg-primary/90 transition-colors'
            >
              {t('invoices.sendModal.submit')}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
