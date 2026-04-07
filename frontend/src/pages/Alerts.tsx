import { useState, useEffect } from 'react'
import { dashboardService } from '../services/dashboard.service'
import type { Alert } from '../types'

const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

export function Alerts() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    dashboardService.getAlerts()
      .then(setAlerts)
      .finally(() => setIsLoading(false))
  }, [])

  const debtAlerts = alerts.filter(a => a.type === 'debt')
  const creditAlerts = alerts.filter(a => a.type === 'credit')
  const systemAlerts = alerts.filter(a => a.type === 'pdf_missing')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-900">Centro de Alertas</h1>
        <p className="text-slate-500 text-sm mt-1">
          Discrepancias entre clases impartidas y pagos recibidos.
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-32">
          <span className="material-symbols-outlined text-primary text-3xl animate-spin">sync</span>
        </div>
      ) : alerts.filter(a => a.type !== 'pdf_missing').length === 0 && systemAlerts.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border border-slate-200">
          <span className="material-symbols-outlined text-5xl text-emerald-400 block mb-3">check_circle</span>
          <p className="text-slate-700 font-bold text-lg">Todo al día</p>
          <p className="text-slate-500 text-sm mt-1">No hay discrepancias entre clases y pagos este mes.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* System alerts */}
          {systemAlerts.length > 0 && (
            <div>
              <h2 className="text-base font-bold text-slate-900 mb-3 flex items-center gap-2">
                <span className="inline-block w-3 h-3 rounded-full bg-amber-500"></span>
                Avisos del sistema
              </h2>
              <div className="space-y-3">
                {systemAlerts.map((alert, i) => (
                  <div key={i} className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex items-center gap-3">
                    <span className="material-symbols-outlined text-amber-500">warning</span>
                    <p className="text-sm text-amber-800 font-medium">{alert.message}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-slate-200 p-5 text-center shadow-sm">
              <p className="text-slate-500 text-sm font-medium">Total alertas</p>
              <p className="text-3xl font-black text-slate-900 mt-1">{alerts.length}</p>
            </div>
            <div className="bg-red-50 rounded-xl border border-red-200 p-5 text-center shadow-sm">
              <p className="text-red-700 text-sm font-medium">🔴 Deudas</p>
              <p className="text-3xl font-black text-red-900 mt-1">{debtAlerts.length}</p>
            </div>
            <div className="bg-blue-50 rounded-xl border border-blue-200 p-5 text-center shadow-sm">
              <p className="text-blue-700 text-sm font-medium">🔵 Créditos</p>
              <p className="text-3xl font-black text-blue-900 mt-1">{creditAlerts.length}</p>
            </div>
          </div>

          {/* Debt alerts */}
          {debtAlerts.length > 0 && (
            <div>
              <h2 className="text-base font-bold text-slate-900 mb-3 flex items-center gap-2">
                <span className="inline-block w-3 h-3 rounded-full bg-red-500"></span>
                Clientes con deuda
              </h2>
              <div className="space-y-3">
                {debtAlerts.map(alert => (
                  <AlertCard key={alert.client_id} alert={alert} />
                ))}
              </div>
            </div>
          )}

          {/* Credit alerts */}
          {creditAlerts.length > 0 && (
            <div>
              <h2 className="text-base font-bold text-slate-900 mb-3 flex items-center gap-2">
                <span className="inline-block w-3 h-3 rounded-full bg-blue-500"></span>
                Clientes con crédito a favor
              </h2>
              <p className="text-xs text-slate-500 mb-3">
                Estos clientes han pagado más de lo esperado. El exceso se aplicará automáticamente el próximo mes en Contabilidad.
              </p>
              <div className="space-y-3">
                {creditAlerts.map(alert => (
                  <AlertCard key={alert.client_id} alert={alert} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function AlertCard({ alert }: { alert: Alert }) {
  const isDebt = alert.type === 'debt'
  const monthName = MONTHS[alert.month - 1]

  return (
    <div className={`rounded-xl border p-5 ${isDebt ? 'border-red-200 bg-red-50' : 'border-blue-200 bg-blue-50'}`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white shrink-0 ${isDebt ? 'bg-red-500' : 'bg-blue-500'}`}>
            {(alert.client_name ?? '??').slice(0, 2).toUpperCase()}
          </div>
          <div>
            <p className={`font-bold ${isDebt ? 'text-red-900' : 'text-blue-900'}`}>
              {alert.client_name}
            </p>
            <p className={`text-sm ${isDebt ? 'text-red-700' : 'text-blue-700'}`}>
              {alert.message} — {monthName} {alert.year}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4 sm:gap-6 text-center shrink-0">
          <div>
            <p className="text-xs text-slate-500 font-medium">Esperado</p>
            <p className="font-bold text-slate-900">€{alert.expected.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Pagado</p>
            <p className="font-bold text-slate-900">€{alert.paid.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Diferencia</p>
            <p className={`font-black ${isDebt ? 'text-red-700' : 'text-blue-700'}`}>
              {isDebt ? '-' : '+'}€{Math.abs(alert.diff).toFixed(2)}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
