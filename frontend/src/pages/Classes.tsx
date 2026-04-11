import { useState } from 'react'
import { Modal } from '../components/ui/Modal'
import { ConfirmModal } from '../components/ui/ConfirmModal'
import { CalendarView } from '../components/classes/CalendarView'
import { DayView } from '../components/classes/DayView'
import { ClassForm } from '../components/classes/ClassForm'
import { CLASS_STATUS_CONFIG } from '../components/classes/constants'
import { MONTHS } from '../utils/constants'
import { useClasses } from '../hooks/useClasses'
import { Pagination } from '../components/ui/Pagination'
import { useAuth } from '../context/AuthContext'
import type { ClassSession } from '../types'

type ViewMode = 'list' | 'calendar'

function formatDayTitle(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('es-ES', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

export function Classes() {
  const now = new Date()
  const { user } = useAuth()

  const [filterMonth, setFilterMonth] = useState(now.getMonth() + 1)
  const [filterYear, setFilterYear] = useState(now.getFullYear())
  const [filterClient, setFilterClient] = useState<number | ''>('')
  const [viewMode, setViewMode] = useState<ViewMode>(
    () => (localStorage.getItem('classes-view') as ViewMode) ?? 'list',
  )
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingClass, setEditingClass] = useState<ClassSession | null>(null)
  const [newClassDate, setNewClassDate] = useState<string | null>(null)
  const [dayDetailDate, setDayDetailDate] = useState<string | null>(null)

  const {
    classes, clients, isLoading, isSyncing,
    pendingDeleteId, totalRevenue,
    page, pageCount, totalCount, goToPage,
    createClass, updateClass, requestDelete, confirmDelete, cancelDelete, syncGCal,
  } = useClasses({ filterMonth, filterYear, filterClient })

  const dayDetailClasses = dayDetailDate
    ? classes.filter(c => c.class_date === dayDetailDate)
    : []

  const handleViewMode = (mode: ViewMode) => {
    setViewMode(mode)
    localStorage.setItem('classes-view', mode)
  }

  const handleCreate = async (data: Partial<ClassSession>) => {
    await createClass(data)
    setShowCreateModal(false)
    setNewClassDate(null)
  }

  const handleUpdate = async (data: Partial<ClassSession>) => {
    if (!editingClass) return
    await updateClass(editingClass.id, data)
    setEditingClass(null)
  }

  const handleNewClassFromCalendar = (date: string) => {
    setNewClassDate(date)
    setShowCreateModal(true)
  }

  const years = Array.from({ length: 3 }, (_, i) => now.getFullYear() - i)

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Clases</h1>
          <p className="text-slate-500 text-sm mt-1">Registro de clases impartidas.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-slate-100 rounded-xl p-1 gap-1">
            <button
              onClick={() => handleViewMode('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-all
                ${viewMode === 'list' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <span className="material-symbols-outlined text-base">view_list</span>
              Lista
            </button>
            <button
              onClick={() => handleViewMode('calendar')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-all
                ${viewMode === 'calendar' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <span className="material-symbols-outlined text-base">calendar_month</span>
              Calendario
            </button>
          </div>
          <button
            onClick={() => user && syncGCal(user.id)}
            disabled={isSyncing}
            title="Sincronizar clases futuras con Google Calendar"
            className="flex items-center gap-2 border border-slate-200 text-slate-600 hover:bg-slate-50 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all disabled:opacity-50"
          >
            <span className={`material-symbols-outlined text-base ${isSyncing ? 'animate-spin' : ''}`}>
              {isSyncing ? 'refresh' : 'calendar_month'}
            </span>
            {isSyncing ? 'Sincronizando...' : 'Sync GCal'}
          </button>
          <button
            onClick={() => { setNewClassDate(null); setShowCreateModal(true) }}
            className="flex items-center gap-2 bg-primary hover:bg-primary-hover text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-primary/20 transition-all"
          >
            <span className="material-symbols-outlined">add</span>
            Nueva clase
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap items-center gap-3">
        <select
          value={filterMonth}
          onChange={(e) => setFilterMonth(parseInt(e.target.value))}
          className="border border-slate-200 rounded-lg py-2 pl-3 pr-8 text-sm text-slate-600 bg-white focus:ring-primary focus:border-primary"
        >
          {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
        </select>
        <select
          value={filterYear}
          onChange={(e) => setFilterYear(parseInt(e.target.value))}
          className="border border-slate-200 rounded-lg py-2 pl-3 pr-8 text-sm text-slate-600 bg-white focus:ring-primary focus:border-primary"
        >
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <select
          value={filterClient}
          onChange={(e) => setFilterClient(parseInt(e.target.value) || '')}
          className="border border-slate-200 rounded-lg py-2 pl-3 pr-8 text-sm text-slate-600 bg-white focus:ring-primary focus:border-primary"
        >
          <option value="">Todos los clientes</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {classes.length > 0 && (
          <div className="ml-auto bg-primary/5 border border-primary/20 rounded-xl px-4 py-2 text-sm font-bold text-primary">
            Total: €{totalRevenue.toFixed(2)}
          </div>
        )}
      </div>

      {/* Calendar view */}
      {viewMode === 'calendar' && !isLoading && (
        <CalendarView
          classes={classes}
          year={filterYear}
          month={filterMonth}
          onEdit={setEditingClass}
          onNewClass={handleNewClassFromCalendar}
          onDayDetail={(date) => setDayDetailDate(date)}
        />
      )}

      {/* List view */}
      {viewMode === 'list' && isLoading ? (
        <div className="flex items-center justify-center h-32">
          <span className="material-symbols-outlined text-primary text-3xl animate-spin">sync</span>
        </div>
      ) : viewMode === 'list' && classes.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-slate-200">
          <span className="material-symbols-outlined text-5xl text-slate-300 block mb-3">event</span>
          <p className="text-slate-500 font-medium">No hay clases en este período</p>
          <button
            onClick={() => { setNewClassDate(null); setShowCreateModal(true) }}
            className="mt-4 text-primary text-sm font-semibold hover:underline"
          >
            Registrar primera clase
          </button>
        </div>
      ) : viewMode === 'list' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left" id="classes-table">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 text-slate-500 text-xs font-bold uppercase tracking-wider">Fecha</th>
                  <th className="px-6 py-3 text-slate-500 text-xs font-bold uppercase tracking-wider">Cliente</th>
                  <th className="px-6 py-3 text-slate-500 text-xs font-bold uppercase tracking-wider">Duración</th>
                  <th className="px-6 py-3 text-slate-500 text-xs font-bold uppercase tracking-wider">Tarifa</th>
                  <th className="px-6 py-3 text-slate-500 text-xs font-bold uppercase tracking-wider">Total</th>
                  <th className="px-6 py-3 text-slate-500 text-xs font-bold uppercase tracking-wider">Estado</th>
                  <th className="px-6 py-3 text-slate-500 text-xs font-bold uppercase tracking-wider">Notas</th>
                  <th className="px-6 py-3 text-right text-slate-500 text-xs font-bold uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {classes.map((c) => {
                  const cfg = CLASS_STATUS_CONFIG[c.status] ?? CLASS_STATUS_CONFIG.normal
                  return (
                    <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <p className="font-medium text-slate-900">{c.class_date}</p>
                        {c.class_time && <p className="text-xs text-slate-400">{c.class_time.slice(0, 5)}</p>}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                            {(c.client_name ?? '?').slice(0, 2).toUpperCase()}
                          </div>
                          <span className="font-medium text-slate-900">{c.client_name ?? '—'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-700">{c.duration_hours}h</td>
                      <td className="px-6 py-4 text-slate-700">€{c.hourly_rate}/h</td>
                      <td className="px-6 py-4 font-bold text-slate-900">€{(c.total_amount ?? 0).toFixed(2)}</td>
                      <td className="px-6 py-4">
                        {c.status !== 'normal' ? (
                          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${cfg.className}`}>
                            {cfg.label}
                          </span>
                        ) : <span className="text-slate-300 text-xs">—</span>}
                      </td>
                      <td className="px-6 py-4 text-slate-500 text-sm max-w-[160px] truncate">{c.notes ?? '—'}</td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <span
                            title={c.google_calendar_id ? 'Sincronizado con Google Calendar' : 'No sincronizado con Google Calendar'}
                            className={`material-symbols-outlined text-base ${c.google_calendar_id ? 'text-emerald-400' : 'text-slate-200'}`}
                          >
                            {c.google_calendar_id ? 'event_available' : 'calendar_month'}
                          </span>
                          <button
                            onClick={() => setEditingClass(c)}
                            className="p-1.5 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors"
                          >
                            <span className="material-symbols-outlined text-base">edit</span>
                          </button>
                          <button
                            onClick={() => requestDelete(c.id)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <span className="material-symbols-outlined text-base">delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <Pagination page={page} pageCount={pageCount} totalCount={totalCount} onPage={goToPage} />
        </div>
      )}

      {/* Day detail modal */}
      <Modal
        isOpen={!!dayDetailDate}
        onClose={() => setDayDetailDate(null)}
        title={dayDetailDate ? formatDayTitle(dayDetailDate) : ''}
        size="lg"
      >
        {dayDetailDate && (
          <DayView
            date={dayDetailDate}
            classes={dayDetailClasses}
            onEdit={(c) => setEditingClass(c)}
            onNewClass={handleNewClassFromCalendar}
            onDelete={async (id) => { requestDelete(id) }}
          />
        )}
      </Modal>

      <Modal
        isOpen={showCreateModal}
        onClose={() => { setShowCreateModal(false); setNewClassDate(null) }}
        title="Nueva clase"
        size="lg"
      >
        <ClassForm
          clients={clients}
          initial={newClassDate ? { class_date: newClassDate } : undefined}
          onSave={handleCreate}
          onCancel={() => { setShowCreateModal(false); setNewClassDate(null) }}
        />
      </Modal>

      <Modal
        isOpen={!!editingClass}
        onClose={() => setEditingClass(null)}
        title="Editar clase"
        size="lg"
      >
        {editingClass && (
          <ClassForm
            initial={editingClass}
            clients={clients}
            onSave={handleUpdate}
            onCancel={() => setEditingClass(null)}
            onDelete={async () => { requestDelete(editingClass.id) }}
          />
        )}
      </Modal>

      <ConfirmModal
        isOpen={pendingDeleteId !== null}
        message="¿Seguro que quieres eliminar esta clase? Esta acción no se puede deshacer."
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
      />
    </div>
  )
}
