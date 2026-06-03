import { useState, useEffect } from 'react'
import { googleCalendarService } from '../services/google_calendar.service'
import { businessProfileService } from '../services/business_profile.service'
import { LanguageSelector } from '../components/settings/LanguageSelector'
import type { GoogleCalendarStatus } from '../types'

export function Settings() {
  const [status, setStatus] = useState<GoogleCalendarStatus | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isConnecting, setIsConnecting] = useState(false)
  const [isDisconnecting, setIsDisconnecting] = useState(false)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [fiscal, setFiscal] = useState({ business_name: '', tax_id: '', fiscal_address: '' })
  const [isSavingFiscal, setIsSavingFiscal] = useState(false)

  useEffect(() => {
    // Read OAuth callback result from query params
    const params = new URLSearchParams(window.location.search)
    if (params.get('google_connected') === 'true') {
      setToast({ type: 'success', message: 'Google Calendar conectado correctamente.' })
      window.history.replaceState({}, '', '/settings')
    } else if (params.get('google_error') === 'true') {
      setToast({ type: 'error', message: 'Error al conectar con Google Calendar. Inténtalo de nuevo.' })
      window.history.replaceState({}, '', '/settings')
    }

    loadStatus()
  }, [])

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    businessProfileService.get()
      .then(p => setFiscal({
        business_name: p.business_name ?? '',
        tax_id: p.tax_id ?? '',
        fiscal_address: p.fiscal_address ?? '',
      }))
      .catch(() => { /* leave empty defaults */ })
  }, [])

  const handleSaveFiscal = async () => {
    setIsSavingFiscal(true)
    try {
      await businessProfileService.update({
        business_name: fiscal.business_name || null,
        tax_id: fiscal.tax_id || null,
        fiscal_address: fiscal.fiscal_address || null,
      })
      setToast({ type: 'success', message: 'Datos fiscales guardados.' })
    } catch {
      setToast({ type: 'error', message: 'Error al guardar los datos fiscales.' })
    } finally {
      setIsSavingFiscal(false)
    }
  }

  const loadStatus = async () => {
    setIsLoading(true)
    try {
      const data = await googleCalendarService.getStatus()
      setStatus(data)
    } catch {
      setStatus({ connected: false })
    } finally {
      setIsLoading(false)
    }
  }

  const handleConnect = async () => {
    setIsConnecting(true)
    try {
      const { url } = await googleCalendarService.getConnectUrl()
      window.location.href = url
    } catch {
      setToast({ type: 'error', message: 'No se pudo obtener la URL de conexión. Verifica la configuración del servidor.' })
      setIsConnecting(false)
    }
  }

  const handleDisconnect = async () => {
    setIsDisconnecting(true)
    try {
      await googleCalendarService.disconnect()
      setStatus({ connected: false })
      setToast({ type: 'success', message: 'Google Calendar desconectado.' })
    } catch {
      setToast({ type: 'error', message: 'Error al desconectar. Inténtalo de nuevo.' })
    } finally {
      setIsDisconnecting(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-semibold transition-all ${
          toast.type === 'success'
            ? 'bg-emerald-600 text-white'
            : 'bg-red-600 text-white'
        }`}>
          <span className="material-symbols-outlined text-base">
            {toast.type === 'success' ? 'check_circle' : 'error'}
          </span>
          {toast.message}
        </div>
      )}

      <div>
        <h1 className="text-2xl font-bold text-slate-900">Ajustes</h1>
        <p className="text-slate-500 text-sm mt-1">Configura las integraciones de la app.</p>
      </div>

      {/* Language section */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100">
          <div className="w-9 h-9 rounded-lg bg-violet-50 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-violet-500 text-xl">language</span>
          </div>
          <div>
            <p className="font-semibold text-slate-900 text-sm">Idioma</p>
            <p className="text-xs text-slate-500">Elige el idioma de la interfaz.</p>
          </div>
        </div>
        <div className="px-6 py-5">
          <LanguageSelector />
        </div>
      </div>

      {/* Google Calendar section */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100">
          <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-blue-500 text-xl">calendar_month</span>
          </div>
          <div>
            <p className="font-semibold text-slate-900 text-sm">Google Calendar</p>
            <p className="text-xs text-slate-500">Sincroniza las clases automáticamente con tu calendario de Google.</p>
          </div>
        </div>

        <div className="px-6 py-5 space-y-4">
          {isLoading ? (
            <p className="text-sm text-slate-400">Cargando estado...</p>
          ) : status?.connected ? (
            <>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                <p className="text-sm text-slate-700">
                  Conectado como <span className="font-semibold">{status.email}</span>
                </p>
              </div>
              <ul className="text-xs text-slate-500 space-y-1 pl-4 list-disc">
                <li>Las clases nuevas se añaden automáticamente a tu Google Calendar</li>
                <li>Los cambios de hora y fecha se sincronizan al guardar</li>
                <li>Al eliminar una clase, se elimina también del calendario</li>
                <li>Los alumnos con email reciben invitación y recordatorios automáticos</li>
              </ul>
              <button
                onClick={handleDisconnect}
                disabled={isDisconnecting}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                {isDisconnecting
                  ? <span className="material-symbols-outlined text-base animate-spin">sync</span>
                  : <span className="material-symbols-outlined text-base">link_off</span>
                }
                Desconectar cuenta
              </button>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-slate-300 shrink-0" />
                <p className="text-sm text-slate-500">No conectado</p>
              </div>
              <ul className="text-xs text-slate-500 space-y-1 pl-4 list-disc">
                <li>Conecta tu cuenta de Google para sincronizar las clases automáticamente</li>
                <li>Tus alumnos recibirán invitaciones y recordatorios por email</li>
                <li>Puedes incluir links de tareas en la descripción de cada contrato</li>
              </ul>
              <button
                onClick={handleConnect}
                disabled={isConnecting}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary-hover transition-colors disabled:opacity-60 shadow-md shadow-primary/20"
              >
                {isConnecting
                  ? <span className="material-symbols-outlined text-base animate-spin">sync</span>
                  : <span className="material-symbols-outlined text-base">add_link</span>
                }
                Conectar Google Calendar
              </button>
            </>
          )}
        </div>
      </div>

      {/* Fiscal data section */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100">
          <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-amber-500 text-xl">receipt_long</span>
          </div>
          <div>
            <p className="font-semibold text-slate-900 text-sm">Datos fiscales</p>
            <p className="text-xs text-slate-500">Tus datos como emisor. Se usarán en las facturas.</p>
          </div>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Nombre / Razón social</label>
            <input
              value={fiscal.business_name}
              onChange={e => setFiscal(f => ({ ...f, business_name: e.target.value }))}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">NIF / CIF</label>
            <input
              placeholder="B12345678"
              value={fiscal.tax_id}
              onChange={e => setFiscal(f => ({ ...f, tax_id: e.target.value }))}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Dirección fiscal</label>
            <input
              value={fiscal.fiscal_address}
              onChange={e => setFiscal(f => ({ ...f, fiscal_address: e.target.value }))}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm"
            />
          </div>
          <button
            onClick={handleSaveFiscal}
            disabled={isSavingFiscal}
            className="flex items-center gap-2 px-5 py-2 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary-hover transition-colors disabled:opacity-60 shadow-md shadow-primary/20"
          >
            {isSavingFiscal
              ? <span className="material-symbols-outlined text-base animate-spin">sync</span>
              : <span className="material-symbols-outlined text-base">save</span>
            }
            Guardar datos fiscales
          </button>
        </div>
      </div>
    </div>
  )
}
