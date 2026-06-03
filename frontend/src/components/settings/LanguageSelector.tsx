import { useAuth } from '../../context/AuthContext'
import { type Locale, SUPPORTED_LOCALES, useTranslation } from '../../i18n'

export function LanguageSelector() {
  const { t } = useTranslation()
  const { user, setLocale } = useAuth()

  return (
    <div className='flex flex-col gap-2'>
      <label htmlFor='locale-select' className='block text-sm font-semibold text-slate-700'>
        {t('settings.language.label')}
      </label>
      <select
        id='locale-select'
        value={user?.locale ?? 'es-ES'}
        onChange={(e) => setLocale(e.target.value as Locale)}
        className='w-full max-w-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none'
      >
        {SUPPORTED_LOCALES.map((loc) => (
          <option key={loc} value={loc}>
            {t(`settings.language.options.${loc}`)}
          </option>
        ))}
      </select>
    </div>
  )
}
