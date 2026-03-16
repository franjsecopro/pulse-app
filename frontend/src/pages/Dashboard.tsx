import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { dashboardService } from '../services/dashboard.service'
import { paymentService } from '../services/payment.service'
import type { DashboardSummary, Alert, Payment } from '../types'

const MONTH_NAMES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
]

function StatCard({ label, value, icon, iconColor }: {
  label: string; value: string; icon: string; iconColor: string
}) {
  return (
    <div className="flex flex-col gap-2 rounded-xl p-6 bg-white border border-slate-200 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-slate-500 text-sm font-medium">{label}</p>
        <span className={`material-symbols-outlined text-sm ${iconColor}`}>{icon}</span>
      </div>
      <p className="text-slate-900 text-2xl font-bold">{value}</p>
    </div>
  )
}

export function Dashboard() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [recentPayments, setRecentPayments] = useState<Payment[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      dashboardService.getSummary(),
      dashboardService.getAlerts(),
      paymentService.getAll(),
    ]).then(([s, a, p]) => {
      setSummary(s)
      setAlerts(a)
      setRecentPayments(p.slice(0, 5))
    }).finally(() => setIsLoading(false))
  }, [])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="material-symbols-outlined text-primary text-4xl animate-spin">sync</span>
      </div>
    )
  }

  const debtAlerts = alerts.filter(a => a.type === 'debt')

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-black text-slate-900">Dashboard</h1>
        <p className="text-slate-500 text-sm mt-1">
          Resumen de {summary ? MONTH_NAMES[summary.month - 1] : ''} {summary?.year}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Esperado" value={`€${summary?.total_expected.toFixed(2) ?? '0.00'}`} icon="trending_up" iconColor="text-emerald-600" />
        <StatCard label="Pagado" value={`€${summary?.total_paid.toFixed(2) ?? '0.00'}`} icon="check_circle" iconColor="text-primary" />
        <StatCard label="Pendiente" value={`€${summary?.total_pending.toFixed(2) ?? '0.00'}`} icon="schedule" iconColor="text-amber-600" />
        <StatCard label="Clientes activos" value={String(summary?.active_clients ?? 0)} icon="groups" iconColor="text-slate-500" />
      </div>

      {/* Debt Alerts */}
      {debtAlerts.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-base font-bold text-slate-900">Alertas de pago</h2>
          {debtAlerts.map((alert) => (
            <div
              key={alert.client_id}
              className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 rounded-xl border border-red-200 bg-red-50 p-5"
            >
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-red-600">error</span>
                <div>
                  <p className="text-red-900 font-bold">{alert.client_name}</p>
                  <p className="text-red-700 text-sm">{alert.message}</p>
                </div>
              </div>
              <Link
                to="/alerts"
                className="shrink-0 flex items-center gap-2 rounded-lg h-9 px-4 bg-primary text-white text-sm font-semibold hover:bg-primary-hover transition-colors"
              >
                Ver detalle
              </Link>
            </div>
          ))}
        </div>
      )}

      {/* Recent Payments */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-slate-900 font-bold">Pagos recientes</h3>
          <Link to="/payments" className="text-primary text-sm font-semibold hover:underline">
            Ver todos
          </Link>
        </div>
        {recentPayments.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <span className="material-symbols-outlined text-4xl block mb-2">payments</span>
            No hay pagos registrados aún.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-slate-500 text-xs font-bold uppercase tracking-wider">Cliente</th>
                  <th className="px-6 py-3 text-slate-500 text-xs font-bold uppercase tracking-wider">Monto</th>
                  <th className="px-6 py-3 text-slate-500 text-xs font-bold uppercase tracking-wider">Fecha</th>
                  <th className="px-6 py-3 text-slate-500 text-xs font-bold uppercase tracking-wider">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentPayments.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                          {(p.client_name ?? '?').slice(0, 2).toUpperCase()}
                        </div>
                        <span className="font-medium text-slate-900">{p.client_name ?? 'Sin cliente'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-semibold text-slate-900">€{p.amount.toFixed(2)}</td>
                    <td className="px-6 py-4 text-slate-500">{p.payment_date}</td>
                    <td className="px-6 py-4">
                      {p.status === 'confirmed' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
                          <span className="material-symbols-outlined text-[12px]">check_circle</span>
                          Confirmado
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
                          <span className="material-symbols-outlined text-[12px]">schedule</span>
                          Pendiente
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { to: '/clients', icon: 'group_add', label: 'Nuevo cliente', desc: 'Añade un cliente con sus contratos' },
          { to: '/classes', icon: 'event', label: 'Registrar clase', desc: 'Anota una clase impartida' },
          { to: '/payments', icon: 'add_card', label: 'Registrar pago', desc: 'Registra un cobro recibido' },
        ].map(({ to, icon, label, desc }) => (
          <Link
            key={to}
            to={to}
            className="flex items-center gap-4 p-5 bg-white rounded-xl border border-slate-200 shadow-sm hover:border-primary/50 hover:shadow-md transition-all group"
          >
            <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 group-hover:bg-primary group-hover:text-white transition-colors">
              <span className="material-symbols-outlined">{icon}</span>
            </div>
            <div>
              <p className="font-bold text-slate-900">{label}</p>
              <p className="text-slate-500 text-sm">{desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
