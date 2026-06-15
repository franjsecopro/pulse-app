import { useState } from 'react'
import { useTranslation } from '../../i18n'
import type { Client } from '../../types'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'

interface PeriodPayload {
  clientId: number
  month?: number
  year?: number
  endMonth?: number
  endYear?: number
  periodStart?: string
  periodEnd?: string
}

interface GenerateInvoiceModalProps {
  isOpen: boolean
  onClose: () => void
  clients: Client[]
  onSubmit: (data: PeriodPayload) => Promise<void>
  isSubmitting: boolean
}

type Mode = 'month' | 'day'

const FIELD_CLASS =
  'w-full border border-slate-200 rounded-lg py-2 px-3 text-sm text-slate-700 bg-white focus:ring-primary focus:border-primary'

const todayIso = () => new Date().toISOString().slice(0, 10)

export function GenerateInvoiceModal({
  isOpen,
  onClose,
  clients,
  onSubmit,
  isSubmitting,
}: GenerateInvoiceModalProps) {
  const { t } = useTranslation()
  const now = new Date()
  const months = t('common.months.full', { returnObjects: true }) as unknown as string[]
  const years = [now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2]

  const [mode, setMode] = useState<Mode>('month')
  const [clientId, setClientId] = useState<number | ''>('')
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [endMonth, setEndMonth] = useState(now.getMonth() + 1)
  const [endYear, setEndYear] = useState(now.getFullYear())
  const [startDate, setStartDate] = useState(todayIso())
  const [endDate, setEndDate] = useState(todayIso())

  async function handleSubmit() {
    if (clientId === '') return
    const payload: PeriodPayload =
      mode === 'day'
        ? { clientId, periodStart: startDate, periodEnd: endDate }
        : { clientId, month, year, endMonth, endYear }
    await onSubmit(payload)
    onClose()
  }

  function monthYearPair(
    monthValue: number,
    onMonth: (m: number) => void,
    yearValue: number,
    onYear: (y: number) => void,
  ) {
    return (
      <div className='grid grid-cols-2 gap-3'>
        <select
          value={monthValue}
          onChange={(e) => onMonth(parseInt(e.target.value, 10))}
          className={FIELD_CLASS}
        >
          {months.map((name, index) => (
            <option key={name} value={index + 1}>
              {name}
            </option>
          ))}
        </select>
        <select
          value={yearValue}
          onChange={(e) => onYear(parseInt(e.target.value, 10))}
          className={FIELD_CLASS}
        >
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>
    )
  }

  function modeButton(value: Mode, label: string) {
    const active = mode === value
    return (
      <Button
        type='button'
        onClick={() => setMode(value)}
        className={`flex-1 px-3 py-1.5 rounded-md text-sm font-semibold transition-colors ${
          active ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700'
        }`}
      >
        {label}
      </Button>
    )
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('invoices.generateModal.title')}>
      <div className='space-y-4'>
        <label className='block'>
          <span className='text-sm font-medium text-slate-700'>
            {t('invoices.generateModal.client')}
          </span>
          <select
            value={clientId}
            onChange={(e) => setClientId(parseInt(e.target.value, 10) || '')}
            className={`mt-1 ${FIELD_CLASS}`}
          >
            <option value=''>{t('invoices.generateModal.selectClient')}</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
        </label>

        <div className='flex gap-1 bg-slate-100 rounded-lg p-1'>
          {modeButton('month', t('invoices.generateModal.modeMonth'))}
          {modeButton('day', t('invoices.generateModal.modeDay'))}
        </div>

        {mode === 'month' ? (
          <>
            <div>
              <span className='block text-sm font-medium text-slate-700 mb-1'>
                {t('invoices.generateModal.from')}
              </span>
              {monthYearPair(month, setMonth, year, setYear)}
            </div>
            <div>
              <span className='block text-sm font-medium text-slate-700 mb-1'>
                {t('invoices.generateModal.to')}
              </span>
              {monthYearPair(endMonth, setEndMonth, endYear, setEndYear)}
              <p className='text-xs text-slate-400 mt-1'>{t('invoices.generateModal.rangeHint')}</p>
            </div>
          </>
        ) : (
          <div className='grid grid-cols-2 gap-3'>
            <label className='block'>
              <span className='text-sm font-medium text-slate-700'>
                {t('invoices.generateModal.from')}
              </span>
              <input
                type='date'
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className={`mt-1 ${FIELD_CLASS}`}
              />
            </label>
            <label className='block'>
              <span className='text-sm font-medium text-slate-700'>
                {t('invoices.generateModal.to')}
              </span>
              <input
                type='date'
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className={`mt-1 ${FIELD_CLASS}`}
              />
            </label>
            <p className='col-span-2 text-xs text-slate-400'>
              {t('invoices.generateModal.dayHint')}
            </p>
          </div>
        )}

        <div className='flex justify-end gap-2 pt-2'>
          <Button
            type='button'
            onClick={onClose}
            className='px-4 py-2 rounded-lg bg-slate-100 text-slate-700 text-sm font-semibold hover:bg-slate-200 transition-colors'
          >
            {t('invoices.generateModal.cancel')}
          </Button>
          <Button
            type='button'
            onClick={handleSubmit}
            loading={isSubmitting}
            disabled={clientId === ''}
            className='px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold disabled:opacity-40 hover:bg-primary/90 transition-colors'
          >
            {t('invoices.generateModal.submit')}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
