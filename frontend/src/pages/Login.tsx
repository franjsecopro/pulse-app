import { type FormEvent, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTranslation } from '../i18n'
import { ApiError } from '../services/api'

type Mode = 'login' | 'register'

export function Login() {
  const { user, isLoading, login, register } = useAuth()
  const navigate = useNavigate()
  const { t } = useTranslation()

  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isLoading && user) return <Navigate to='/' replace />

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)
    try {
      if (mode === 'login') {
        await login(email, password)
      } else {
        await register(email, password)
      }
      navigate('/')
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError(t('auth.errorUnexpected'))
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className='min-h-screen bg-background-light flex flex-col'>
      <header className='w-full border-b border-slate-200 bg-white sticky top-0 z-50'>
        <div className='max-w-7xl mx-auto px-6 h-16 flex items-center'>
          <div className='flex items-center gap-3 text-primary font-bold text-xl'>
            <span className='material-symbols-outlined text-3xl'>account_balance_wallet</span>
            <h1 className='text-slate-900'>Pulse</h1>
          </div>
        </div>
      </header>

      <main className='flex-1 flex items-center justify-center p-6'>
        <div className='w-full max-w-md'>
          <div className='bg-white rounded-xl shadow-xl border border-slate-200 p-8'>
            <div className='mb-8'>
              <h2 className='text-3xl font-black text-slate-900 mb-2'>
                {mode === 'login' ? t('auth.login.welcome') : t('auth.register.title')}
              </h2>
              <p className='text-slate-500'>
                {mode === 'login' ? t('auth.login.subtitle') : t('auth.register.subtitle')}
              </p>
            </div>

            {error && (
              <div className='mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 text-sm'>
                <span className='material-symbols-outlined text-base'>error</span>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className='space-y-5'>
              <div>
                <label htmlFor='email' className='block text-sm font-semibold text-slate-700 mb-2'>
                  {t('auth.fields.email')}
                </label>
                <div className='relative'>
                  <span className='material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg'>
                    mail
                  </span>
                  <input
                    type='email'
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t('auth.fields.emailPlaceholder')}
                    className='w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all placeholder:text-slate-400'
                  />
                </div>
              </div>

              <div>
                <label htmlFor='password' className='block text-sm font-semibold text-slate-700 mb-2'>
                  {t('auth.fields.password')}
                </label>
                <div className='relative'>
                  <span className='material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg'>
                    lock
                  </span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder='••••••••'
                    className='w-full pl-10 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all placeholder:text-slate-400'
                  />
                  <button
                    type='button'
                    onClick={() => setShowPassword(!showPassword)}
                    className='absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-primary'
                  >
                    <span className='material-symbols-outlined text-lg'>
                      {showPassword ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
                {mode === 'register' && (
                  <p className='mt-2 text-xs text-slate-500'>{t('auth.passwordHint')}</p>
                )}
              </div>

              <button
                type='submit'
                disabled={isSubmitting}
                className='w-full py-3.5 bg-primary hover:bg-primary-hover text-white font-bold rounded-lg transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2 disabled:opacity-60'
              >
                {isSubmitting ? (
                  <span className='material-symbols-outlined animate-spin text-lg'>sync</span>
                ) : (
                  <>
                    {mode === 'login' ? t('auth.login.submit') : t('auth.register.submit')}
                    <span className='material-symbols-outlined'>arrow_forward</span>
                  </>
                )}
              </button>
            </form>

            <div className='mt-6 text-center'>
              <button
                type='button'
                onClick={() => {
                  setMode(mode === 'login' ? 'register' : 'login')
                  setError(null)
                }}
                className='text-sm text-primary hover:underline font-medium'
              >
                {mode === 'login' ? t('auth.toggleToRegister') : t('auth.toggleToLogin')}
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
