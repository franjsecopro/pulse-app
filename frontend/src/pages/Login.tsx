import { useState, type FormEvent } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

type Mode = 'login' | 'register'

export function Login() {
  const { user, isLoading, login, register } = useAuth()
  const navigate = useNavigate()

  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmationSent, setConfirmationSent] = useState(false)

  if (!isLoading && user) return <Navigate to="/" replace />

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)
    try {
      if (mode === 'login') {
        await login(email, password)
        navigate('/')
      } else {
        const { needsEmailConfirmation } = await register(email, password)
        if (needsEmailConfirmation) {
          setConfirmationSent(true)
        } else {
          navigate('/')
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error inesperado. Intenta de nuevo.'
      setError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-background-light flex flex-col">
      <header className="w-full border-b border-slate-200 bg-white sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center">
          <div className="flex items-center gap-3 text-primary font-bold text-xl">
            <span className="material-symbols-outlined text-3xl">account_balance_wallet</span>
            <h1 className="text-slate-900">Pulse</h1>
          </div>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 p-8">

            {confirmationSent ? (
              <div className="text-center">
                <span className="material-symbols-outlined text-5xl text-primary mb-4 block">mark_email_read</span>
                <h2 className="text-2xl font-black text-slate-900 mb-2">Revisa tu email</h2>
                <p className="text-slate-500 mb-6">
                  Te enviamos un enlace de confirmación a <strong>{email}</strong>. Confirma tu cuenta para entrar.
                </p>
                <button
                  onClick={() => { setConfirmationSent(false); setMode('login') }}
                  className="text-sm text-primary hover:underline font-medium"
                >
                  Volver al inicio de sesión
                </button>
              </div>
            ) : (
              <>
                <div className="mb-8">
                  <h2 className="text-3xl font-black text-slate-900 mb-2">
                    {mode === 'login' ? 'Bienvenido' : 'Crear cuenta'}
                  </h2>
                  <p className="text-slate-500">
                    {mode === 'login'
                      ? 'Gestiona tu contabilidad con confianza'
                      : 'Comienza a gestionar tus clases y pagos'}
                  </p>
                </div>

                {error && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 text-sm">
                    <span className="material-symbols-outlined text-base">error</span>
                    {error}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Email
                    </label>
                    <div className="relative">
                      <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">
                        mail
                      </span>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="tu@email.com"
                        className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all placeholder:text-slate-400"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Contraseña
                    </label>
                    <div className="relative">
                      <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">
                        lock
                      </span>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full pl-10 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all placeholder:text-slate-400"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-primary"
                      >
                        <span className="material-symbols-outlined text-lg">
                          {showPassword ? 'visibility_off' : 'visibility'}
                        </span>
                      </button>
                    </div>
                    {mode === 'register' && (
                      <p className="mt-2 text-xs text-slate-500">
                        Mínimo 6 caracteres.
                      </p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-3.5 bg-primary hover:bg-primary-hover text-white font-bold rounded-lg transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2 disabled:opacity-60"
                  >
                    {isSubmitting ? (
                      <span className="material-symbols-outlined animate-spin text-lg">sync</span>
                    ) : (
                      <>
                        {mode === 'login' ? 'Entrar al Dashboard' : 'Crear cuenta'}
                        <span className="material-symbols-outlined">arrow_forward</span>
                      </>
                    )}
                  </button>
                </form>

                <div className="mt-6 text-center">
                  <button
                    onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(null) }}
                    className="text-sm text-primary hover:underline font-medium"
                  >
                    {mode === 'login'
                      ? '¿No tienes cuenta? Regístrate'
                      : '¿Ya tienes cuenta? Entra aquí'}
                  </button>
                </div>
              </>
            )}

          </div>
        </div>
      </main>
    </div>
  )
}
