import { type FormEvent, useState } from 'react'
import { useTranslation } from '../../i18n'
import type { Contract, DaySchedule } from '../../types'
import { calcDuration, formatHours } from '../../utils/formatters'
import { Button } from '../ui/Button'

interface ContractFormProps {
  initial?: Partial<Contract>
  onSave: (data: Partial<Contract>) => Promise<void>
  onCancel: () => void
}

export function ContractForm({ initial, onSave, onCancel }: ContractFormProps) {
  const { t } = useTranslation()
  const [form, setForm] = useState({
    description: initial?.description ?? '',
    start_date: initial?.start_date ?? new Date().toISOString().split('T')[0],
    end_date: initial?.end_date ?? '',
    hourly_rate: initial?.hourly_rate ?? 0,
    is_active: initial?.is_active ?? true,
    notes: initial?.notes ?? '',
    phone: initial?.phone ?? '',
    notify: initial?.notify ?? false,
    calendar_description: initial?.calendar_description ?? '',
  })

  const [reminderEmail24h, setReminderEmail24h] = useState(() => {
    const reminders = initial?.calendar_reminders
    return reminders ? reminders.some((r) => r.method === 'email' && r.minutes === 1440) : true
  })
  const [reminderPopup1h, setReminderPopup1h] = useState(() => {
    const reminders = initial?.calendar_reminders
    return reminders ? reminders.some((r) => r.method === 'popup' && r.minutes === 60) : true
  })
  const [scheduleDays, setScheduleDays] = useState<Record<string, DaySchedule>>(
    (initial?.schedule_days as Record<string, DaySchedule> | null) ?? {},
  )
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const weekdays = (t('common.weekdays.short', { returnObjects: true }) as string[]).map(
    (label, i) => ({
      index: String(i),
      label,
    }),
  )

  const toggleDay = (dayIndex: string) => {
    setScheduleDays((prev) => {
      const next = { ...prev }
      if (dayIndex in next) {
        delete next[dayIndex]
      } else {
        next[dayIndex] = { start: '09:00', end: '10:00' }
      }
      return next
    })
  }

  const setDayTime = (dayIndex: string, field: 'start' | 'end', value: string) => {
    setScheduleDays((prev) => ({
      ...prev,
      [dayIndex]: { ...prev[dayIndex], [field]: value },
    }))
  }

  const weeklyHours = Object.values(scheduleDays).reduce(
    (s, d) => s + calcDuration(d.start, d.end),
    0,
  )
  const weeklyRevenue = weeklyHours * form.hourly_rate

  const buildReminders = (): Array<{ method: 'email' | 'popup'; minutes: number }> | null => {
    const result: Array<{ method: 'email' | 'popup'; minutes: number }> = []
    if (reminderEmail24h) result.push({ method: 'email', minutes: 1440 })
    if (reminderPopup1h) result.push({ method: 'popup', minutes: 60 })
    return result.length > 0 ? result : null
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    if (form.end_date && form.start_date > form.end_date) {
      setError(t('contracts.errors.startAfterEnd'))
      return
    }

    const invalidDay = Object.entries(scheduleDays).find(([, d]) => d.start >= d.end)
    if (invalidDay) {
      const label = weekdays.find((w) => w.index === invalidDay[0])?.label ?? invalidDay[0]
      setError(t('contracts.errors.endBeforeStart', { label }))
      return
    }

    setIsSubmitting(true)
    try {
      await onSave({
        ...form,
        end_date: form.end_date || null,
        phone: form.phone || null,
        schedule_days: Object.keys(scheduleDays).length > 0 ? scheduleDays : null,
        calendar_description: form.calendar_description || null,
        calendar_reminders: buildReminders(),
      })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('common.errors.save'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const hasSchedule = Object.keys(scheduleDays).length > 0

  return (
    <form onSubmit={handleSubmit} className='space-y-4'>
      {error && (
        <div className='p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm'>
          {error}
        </div>
      )}

      <div>
        <label
          htmlFor='contract-description'
          className='block text-sm font-semibold text-slate-700 mb-1'
        >
          {t('contracts.form.description')} *
        </label>
        <input
          required
          id='contract-description'
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          placeholder={t('contracts.form.descriptionPlaceholder')}
          className='w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm'
        />
      </div>

      <div className='grid grid-cols-2 gap-4'>
        <div>
          <label
            htmlFor='contract-start-date'
            className='block text-sm font-semibold text-slate-700 mb-1'
          >
            {t('contracts.form.startDate')} *
          </label>
          <input
            required
            type='date'
            lang='es-ES'
            id='contract-start-date'
            value={form.start_date}
            max={form.end_date || undefined}
            onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
            className='w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm'
          />
        </div>
        <div>
          <label
            htmlFor='contract-end-date'
            className='block text-sm font-semibold text-slate-700 mb-1'
          >
            {t('contracts.form.endDate')}
          </label>
          <input
            type='date'
            lang='es-ES'
            id='contract-end-date'
            value={form.end_date}
            min={form.start_date || undefined}
            onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
            className='w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm'
          />
        </div>
        <div>
          <label
            htmlFor='contract-rate'
            className='block text-sm font-semibold text-slate-700 mb-1'
          >
            {t('contracts.form.rate')} *
          </label>
          <input
            required
            id='contract-rate'
            type='number'
            step='0.01'
            min='0'
            value={form.hourly_rate}
            onChange={(e) => setForm((f) => ({ ...f, hourly_rate: parseFloat(e.target.value) }))}
            className='w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm'
          />
        </div>
        <div className='flex items-end pb-2'>
          <label htmlFor='contract-is-active' className='flex items-center gap-2 cursor-pointer'>
            <input
              type='checkbox'
              id='contract-is-active'
              checked={form.is_active}
              onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
              className='w-4 h-4 accent-primary'
            />
            <span className='text-sm font-medium text-slate-700'>
              {t('contracts.form.isActive')}
            </span>
          </label>
        </div>
      </div>

      <div>
        <label
          htmlFor='contract-student-phone'
          className='block text-sm font-semibold text-slate-700 mb-1'
        >
          {t('contracts.form.studentPhone')}
        </label>
        <input
          type='tel'
          id='contract-student-phone'
          value={form.phone}
          onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
          placeholder={t('contracts.form.phonePlaceholder')}
          className='w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm'
        />
      </div>

      <div className='space-y-3'>
        <label
          htmlFor='contract-weekly-schedule'
          className='block text-sm font-semibold text-slate-700'
        >
          {t('contracts.form.weeklySchedule')}
        </label>
        <div className='flex gap-1.5 flex-wrap'>
          {weekdays.map(({ index, label }) => {
            const active = index in scheduleDays
            return (
              <Button
                key={index}
                type='button'
                onClick={() => toggleDay(index)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                  active
                    ? 'bg-primary text-white border-primary'
                    : 'bg-white text-slate-500 border-slate-200 hover:border-primary/40 hover:text-primary'
                }`}
              >
                {label}
              </Button>
            )
          })}
        </div>

        {hasSchedule && (
          <div className='space-y-2'>
            {weekdays
              .filter(({ index }) => index in scheduleDays)
              .map(({ index, label }) => {
                const day = scheduleDays[index]
                const duration = calcDuration(day.start, day.end)
                const isInvalid = day.start >= day.end
                return (
                  <div key={index} className='flex items-center gap-2'>
                    <span className='w-8 text-xs font-bold text-slate-500'>{label}</span>
                    <input
                      type='time'
                      value={day.start}
                      onChange={(e) => setDayTime(index, 'start', e.target.value)}
                      className='px-2 py-1.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none'
                    />
                    <span className='text-xs text-slate-400'>{t('contracts.form.timeTo')}</span>
                    <input
                      type='time'
                      value={day.end}
                      onChange={(e) => setDayTime(index, 'end', e.target.value)}
                      className={`px-2 py-1.5 border rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none ${
                        isInvalid ? 'border-red-300 bg-red-50' : 'border-slate-200'
                      }`}
                    />
                    {!isInvalid && (
                      <span className='text-xs text-slate-400'>{formatHours(duration)}</span>
                    )}
                    {isInvalid && (
                      <span className='text-xs text-red-500'>
                        {t('contracts.form.invalidTime')}
                      </span>
                    )}
                  </div>
                )
              })}

            <div className='flex items-center gap-4 pt-1 px-1 text-xs text-slate-500'>
              <span>
                <span className='font-bold text-slate-700'>{formatHours(weeklyHours)}</span>{' '}
                {t('contracts.form.perWeek')}
              </span>
              {form.hourly_rate > 0 && (
                <span>
                  <span className='font-bold text-primary'>€{weeklyRevenue.toFixed(2)}</span>{' '}
                  {t('contracts.form.perWeek')}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      <div>
        <label htmlFor='contract-notes' className='block text-sm font-semibold text-slate-700 mb-1'>
          {t('contracts.form.notes')}
        </label>
        <textarea
          id='contract-notes'
          value={form.notes}
          onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          rows={2}
          className='w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm resize-none'
        />
      </div>

      <div className='space-y-3 pt-1 border-t border-slate-100'>
        <div className='flex items-center justify-between'>
          <div className='flex items-center gap-2'>
            <span className='material-symbols-outlined text-base text-blue-400'>
              calendar_month
            </span>
            <p className='text-sm font-semibold text-slate-700'>Google Calendar</p>
          </div>
          <label htmlFor='contract-notify' className='flex items-center gap-2 cursor-pointer'>
            <input
              type='checkbox'
              id='contract-notify'
              checked={form.notify}
              onChange={(e) => setForm((f) => ({ ...f, notify: e.target.checked }))}
              className='w-4 h-4 accent-primary'
            />
            <span className='text-sm text-slate-600'>
              {t('contracts.form.enableNotifications')}
            </span>
          </label>
        </div>
        <div>
          <label
            htmlFor='contract-calendar-description'
            className='block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1'
          >
            {t('contracts.form.eventDescription')}
          </label>
          <textarea
            id='contract-calendar-description'
            value={form.calendar_description}
            onChange={(e) => setForm((f) => ({ ...f, calendar_description: e.target.value }))}
            rows={3}
            placeholder={t('contracts.form.eventDescriptionPlaceholder')}
            className='w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm resize-none'
          />
        </div>
        <div>
          <label
            htmlFor='contract-auto-reminders'
            className='block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2'
          >
            {t('contracts.form.autoReminders')}
          </label>
          <div className='space-y-1.5'>
            <label
              htmlFor='contract-reminder-email-24h'
              className='flex items-center gap-2 cursor-pointer'
            >
              <input
                type='checkbox'
                id='contract-reminder-email-24h'
                checked={reminderEmail24h}
                onChange={(e) => setReminderEmail24h(e.target.checked)}
                className='w-4 h-4 accent-primary'
              />
              <span className='text-sm text-slate-700'>{t('contracts.form.reminderEmail24h')}</span>
            </label>
            <label
              htmlFor='contract-reminder-popup-1h'
              className='flex items-center gap-2 cursor-pointer'
            >
              <input
                type='checkbox'
                id='contract-reminder-popup-1h'
                checked={reminderPopup1h}
                onChange={(e) => setReminderPopup1h(e.target.checked)}
                className='w-4 h-4 accent-primary'
              />
              <span className='text-sm text-slate-700'>{t('contracts.form.reminderPopup1h')}</span>
            </label>
          </div>
        </div>
      </div>

      <div className='flex justify-end gap-3 pt-2'>
        <Button
          type='button'
          onClick={onCancel}
          className='px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors'
        >
          {t('actions.cancel')}
        </Button>
        <Button
          type='submit'
          loading={isSubmitting}
          className='px-6 py-2 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary-hover transition-colors disabled:opacity-60 shadow-md shadow-primary/20 flex items-center gap-2'
        >
          {isSubmitting && (
            <span className='material-symbols-outlined text-base animate-spin'>sync</span>
          )}
          {t('contracts.save')}
        </Button>
      </div>
    </form>
  )
}
