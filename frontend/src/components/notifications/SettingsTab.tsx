import { useEffect, useState } from 'react'
import { useTranslation } from '../../i18n'
import { notificationsService } from '../../services/notifications.service'
import type { NotificationSettings } from '../../types'
import { Button } from '../ui/Button'

const SAMPLE_VARS = {
  nombre: 'Sofia',
  hora: '10:00',
  dia: 'martes 14 de abril',
  materia: 'Ingles',
}

function renderPreview(template: string): string {
  return template
    .replace('{nombre}', SAMPLE_VARS.nombre)
    .replace('{hora}', SAMPLE_VARS.hora)
    .replace('{dia}', SAMPLE_VARS.dia)
    .replace('{materia}', SAMPLE_VARS.materia)
}

export function SettingsTab() {
  const { t } = useTranslation()
  const [settings, setSettings] = useState<NotificationSettings>({
    defaultChannel: 'whatsapp',
    messageTemplate: '',
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    notificationsService
      .getSettings()
      .then(setSettings)
      .finally(() => setIsLoading(false))
  }, [])

  async function handleSave() {
    setIsSaving(true)
    setSaved(false)
    try {
      const updated = await notificationsService.updateSettings(settings)
      setSettings(updated)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading)
    return (
      <div className='flex items-center justify-center py-16 text-slate-400'>
        <span className='material-symbols-outlined animate-spin mr-2'>refresh</span>{' '}
        {t('common.loading')}
      </div>
    )

  return (
    <div className='max-w-xl space-y-6'>
      <div className='bg-white rounded-xl border border-slate-200 p-5 space-y-3'>
        <h3 className='font-semibold text-slate-800'>
          {t('notifications.settings.defaultChannel')}
        </h3>
        <div className='flex gap-4'>
          {(['whatsapp', 'email'] as const).map((channel) => (
            <label
              htmlFor={`channel-${channel}`}
              key={channel}
              className='flex items-center gap-2 cursor-pointer'
            >
              <input
                type='radio'
                id={`channel-${channel}`}
                name='channel'
                value={channel}
                checked={settings.defaultChannel === channel}
                onChange={() => setSettings((prev) => ({ ...prev, defaultChannel: channel }))}
                className='accent-indigo-600'
              />
              <span className='text-sm font-medium text-slate-700'>
                {channel === 'whatsapp'
                  ? t('notifications.settings.whatsapp')
                  : t('notifications.settings.email')}
              </span>
            </label>
          ))}
        </div>
      </div>

      <div className='bg-white rounded-xl border border-slate-200 p-5 space-y-3'>
        <h3 className='font-semibold text-slate-800'>
          {t('notifications.settings.templateLabel')}
        </h3>
        <p className='text-xs text-slate-500'>
          {t('notifications.settings.variablesHint')}{' '}
          <code className='bg-slate-100 px-1 rounded'>{'{nombre}'}</code>{' '}
          <code className='bg-slate-100 px-1 rounded'>{'{hora}'}</code>{' '}
          <code className='bg-slate-100 px-1 rounded'>{'{dia}'}</code>{' '}
          <code className='bg-slate-100 px-1 rounded'>{'{materia}'}</code>
        </p>
        <textarea
          rows={4}
          value={settings.messageTemplate}
          onChange={(e) =>
            setSettings((prev) => ({
              ...prev,
              messageTemplate: e.target.value,
            }))
          }
          className='w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none'
        />
        {settings.messageTemplate && (
          <div className='bg-slate-50 border border-slate-200 rounded-lg p-3'>
            <p className='text-xs font-medium text-slate-500 mb-1'>
              {t('notifications.settings.preview')}
            </p>
            <p className='text-sm text-slate-700'>{renderPreview(settings.messageTemplate)}</p>
          </div>
        )}
      </div>

      <Button
        type='button'
        onClick={handleSave}
        loading={isSaving}
        className='inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-60 transition-colors'
      >
        <span className='material-symbols-outlined text-[16px]'>{saved ? 'check' : 'save'}</span>
        {saved
          ? t('notifications.settings.saved')
          : isSaving
            ? t('notifications.settings.saving')
            : t('actions.save')}
      </Button>
    </div>
  )
}
