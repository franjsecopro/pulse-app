import { useState, useEffect, useCallback, type FormEvent } from 'react';
import { classService } from '../services/class.service';
import { clientService } from '../services/client.service';
import { Modal } from '../components/ui/Modal';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { CalendarView } from '../components/classes/CalendarView';
import { DayView } from '../components/classes/DayView';
import type { ClassSession, ClassStatus, Client, Contract } from '../types';

type ViewMode = 'list' | 'calendar';

const MONTHS = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

function ClassForm({
  initial,
  clients,
  onSave,
  onCancel,
  onDelete,
}: {
  initial?: Partial<ClassSession>;
  clients: Client[];
  onSave: (data: Partial<ClassSession>) => Promise<void>;
  onCancel: () => void;
  onDelete?: () => Promise<void>;
}) {
  const [selectedClientId, setSelectedClientId] = useState<number | ''>(
    initial?.client_id ?? '',
  );
  const [form, setForm] = useState({
    contract_id: initial?.contract_id ?? null,
    class_date: initial?.class_date ?? new Date().toISOString().split('T')[0],
    class_time: initial?.class_time ?? '',
    duration_hours: initial?.duration_hours ?? 1,
    hourly_rate: initial?.hourly_rate ?? 0,
    status: (initial?.status ?? 'normal') as ClassStatus,
    notes: initial?.notes ?? '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedClient = clients.find((c) => c.id === selectedClientId);
  const activeContracts: Contract[] =
    selectedClient?.contracts?.filter((c) => c.is_active) ?? [];

  // Auto-seleccionar contrato si el cliente solo tiene uno activo
  const handleClientChange = (clientId: string) => {
    const cid = parseInt(clientId) || '';
    setSelectedClientId(cid);
    const client = clients.find((c) => c.id === cid);
    const contracts = client?.contracts?.filter((c) => c.is_active) ?? [];
    if (contracts.length === 1) {
      setForm((f) => ({
        ...f,
        contract_id: contracts[0].id,
        hourly_rate: contracts[0].hourly_rate,
      }));
    } else {
      setForm((f) => ({ ...f, contract_id: null }));
    }
  };

  const handleContractChange = (contractId: string) => {
    const cid = contractId ? parseInt(contractId) : null;
    setForm((f) => {
      const contract = activeContracts.find((c) => c.id === cid);
      return {
        ...f,
        contract_id: cid,
        hourly_rate: contract?.hourly_rate ?? f.hourly_rate,
      };
    });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedClientId) {
      setError('Selecciona un cliente');
      return;
    }
    if (activeContracts.length > 1 && !form.contract_id) {
      setError('Este cliente tiene varios contratos. Selecciona uno.');
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      await onSave({
        client_id: selectedClientId as number,
        ...form,
        class_time: form.class_time || null,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalAmount = form.duration_hours * form.hourly_rate;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className="block text-sm font-semibold text-slate-700 mb-1">
            Cliente *
          </label>
          <select
            required
            value={selectedClientId}
            onChange={(e) => handleClientChange(e.target.value)}
            className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm bg-white"
          >
            <option value="">Seleccionar cliente</option>
            {clients
              .filter((c) => c.is_active)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </select>
        </div>
        {activeContracts.length === 1 && (
          <div className="sm:col-span-2">
            <p className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
              Contrato: <span className="font-semibold text-slate-700">{activeContracts[0].description}</span> — €{activeContracts[0].hourly_rate}/h
            </p>
          </div>
        )}
        {activeContracts.length > 1 && (
          <div className="sm:col-span-2">
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              Contrato <span className="text-red-500">*</span>
            </label>
            <select
              required
              value={form.contract_id ?? ''}
              onChange={(e) => handleContractChange(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm bg-white"
            >
              <option value="">Seleccionar contrato...</option>
              {activeContracts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.description} — €{c.hourly_rate}/h
                </option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">
            Fecha *
          </label>
          <input
            required
            type="date"
            value={form.class_date}
            onChange={(e) =>
              setForm((f) => ({ ...f, class_date: e.target.value }))
            }
            className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">
            Hora
          </label>
          <input
            type="time"
            value={form.class_time}
            onChange={(e) =>
              setForm((f) => ({ ...f, class_time: e.target.value }))
            }
            className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">
            Duración (horas) *
          </label>
          <input
            required
            type="number"
            step="0.5"
            min="0.5"
            value={form.duration_hours}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                duration_hours: parseFloat(e.target.value) || 0,
              }))
            }
            className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">
            Tarifa €/hora *
          </label>
          <input
            required
            type="number"
            step="0.01"
            min="0"
            value={form.hourly_rate}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                hourly_rate: parseFloat(e.target.value) || 0,
              }))
            }
            className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-sm font-semibold text-slate-700 mb-1">
            Estado de la clase
          </label>
          <select
            value={form.status}
            onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as ClassStatus }))}
            className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm bg-white"
          >
            <option value="normal">Normal — clase celebrada</option>
            <option value="cancelled_with_payment">Cancelada con pago (menos de 24h)</option>
            <option value="cancelled_without_payment">Cancelada sin pago (más de 24h)</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="block text-sm font-semibold text-slate-700 mb-1">
            Notas
          </label>
          <input
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm"
          />
        </div>
      </div>
      {form.duration_hours > 0 && form.hourly_rate > 0 && (
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex items-center justify-between">
          <span className="text-sm text-slate-600 font-medium">
            Total de la clase
          </span>
          <span className="text-primary font-black text-xl">
            €{totalAmount.toFixed(2)}
          </span>
        </div>
      )}
      <div className="flex items-center justify-between gap-3 pt-2">
        {onDelete ? (
          <button
            type="button"
            onClick={onDelete}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-red-500 hover:bg-red-50 transition-colors disabled:opacity-60 flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-base">delete</span>
            Eliminar clase
          </button>
        ) : <span />}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-2 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary-hover transition-colors disabled:opacity-60 shadow-md shadow-primary/20 flex items-center gap-2"
          >
            {isSubmitting && (
              <span className="material-symbols-outlined text-base animate-spin">
                sync
              </span>
            )}
            Guardar clase
          </button>
        </div>
      </div>
    </form>
  );
}

const CLASS_STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  normal: { label: 'Normal', className: 'bg-emerald-100 text-emerald-700' },
  cancelled_with_payment: { label: 'Cancelada · con pago', className: 'bg-amber-100 text-amber-700' },
  cancelled_without_payment: { label: 'Cancelada · sin pago', className: 'bg-slate-100 text-slate-500' },
}

export function Classes() {
  const now = new Date();
  const [classes, setClasses] = useState<ClassSession[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterMonth, setFilterMonth] = useState(now.getMonth() + 1);
  const [filterYear, setFilterYear] = useState(now.getFullYear());
  const [filterClient, setFilterClient] = useState<number | ''>('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingClass, setEditingClass] = useState<ClassSession | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>(
    () => (localStorage.getItem('classes-view') as ViewMode) ?? 'list',
  );
  const [newClassDate, setNewClassDate] = useState<string | null>(null);
  const [dayDetailDate, setDayDetailDate] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);

  // Clases del día seleccionado — siempre frescas tras cualquier recarga
  const dayDetailClasses = dayDetailDate
    ? classes.filter(c => c.class_date === dayDetailDate)
    : []

  const handleViewMode = (mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem('classes-view', mode);
  };

  const handleNewClassFromCalendar = (date: string) => {
    setNewClassDate(date);
    setShowCreateModal(true);
  };

  const handleDayDetail = (date: string) => {
    setDayDetailDate(date)
  }

  function formatDate(dateStr: string): string {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('es-ES', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });
  }

  const loadClasses = useCallback(async () => {
    setIsLoading(true);
    const data = await classService.getAll({
      month: filterMonth,
      year: filterYear,
      client_id: filterClient || undefined,
    });
    setClasses(data);
    setIsLoading(false);
  }, [filterMonth, filterYear, filterClient]);

  useEffect(() => {
    clientService.getAll().then(setClients);
  }, []);

  useEffect(() => {
    loadClasses();
  }, [loadClasses]);

  const handleCreate = async (data: Partial<ClassSession>) => {
    await classService.create(
      data as Parameters<typeof classService.create>[0],
    );
    setShowCreateModal(false);
    loadClasses();
  };

  const handleUpdate = async (data: Partial<ClassSession>) => {
    if (!editingClass) return;
    await classService.update(editingClass.id, data);
    setEditingClass(null);
    loadClasses();
  };

  const handleDelete = (id: number) => {
    setPendingDeleteId(id)
  }

  const confirmDelete = async () => {
    if (!pendingDeleteId) return
    await classService.delete(pendingDeleteId)
    setPendingDeleteId(null)
    setEditingClass(null)
    loadClasses()
  }

  const totalRevenue = classes.reduce(
    (sum, c) => sum + (c.total_amount ?? 0),
    0,
  );

  const years = Array.from({ length: 3 }, (_, i) => now.getFullYear() - i);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Clases</h1>
          <p className="text-slate-500 text-sm mt-1">
            Registro de clases impartidas.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* View toggle */}
          <div className="flex items-center bg-slate-100 rounded-xl p-1 gap-1">
            <button
              onClick={() => handleViewMode('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-all
                ${viewMode === 'list' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <span className="material-symbols-outlined text-base">
                view_list
              </span>
              Lista
            </button>
            <button
              onClick={() => handleViewMode('calendar')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-all
                ${viewMode === 'calendar' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <span className="material-symbols-outlined text-base">
                calendar_month
              </span>
              Calendario
            </button>
          </div>
          <button
            onClick={() => {
              setNewClassDate(null);
              setShowCreateModal(true);
            }}
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
          {MONTHS.map((m, i) => (
            <option key={i} value={i + 1}>
              {m}
            </option>
          ))}
        </select>
        <select
          value={filterYear}
          onChange={(e) => setFilterYear(parseInt(e.target.value))}
          className="border border-slate-200 rounded-lg py-2 pl-3 pr-8 text-sm text-slate-600 bg-white focus:ring-primary focus:border-primary"
        >
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
        <select
          value={filterClient}
          onChange={(e) => setFilterClient(parseInt(e.target.value) || '')}
          className="border border-slate-200 rounded-lg py-2 pl-3 pr-8 text-sm text-slate-600 bg-white focus:ring-primary focus:border-primary"
        >
          <option value="">Todos los clientes</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        {classes.length > 0 && (
          <div className="ml-auto bg-primary/5 border border-primary/20 rounded-xl px-4 py-2 text-sm font-bold text-primary">
            Total: €{totalRevenue.toFixed(2)}
          </div>
        )}
      </div>

      {/* Calendar / List view */}
      {viewMode === 'calendar' && !isLoading && (
        <CalendarView
          classes={classes}
          year={filterYear}
          month={filterMonth}
          onEdit={setEditingClass}
          onNewClass={handleNewClassFromCalendar}
          onDayDetail={(date) => handleDayDetail(date)}
        />
      )}

      {/* Table */}
      {viewMode === 'list' && isLoading ? (
        <div className="flex items-center justify-center h-32">
          <span className="material-symbols-outlined text-primary text-3xl animate-spin">
            sync
          </span>
        </div>
      ) : viewMode === 'list' && classes.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-slate-200">
          <span className="material-symbols-outlined text-5xl text-slate-300 block mb-3">
            event
          </span>
          <p className="text-slate-500 font-medium">
            No hay clases en este período
          </p>
          <button
            onClick={() => {
              setNewClassDate(null);
              setShowCreateModal(true);
            }}
            className="mt-4 text-primary text-sm font-semibold hover:underline"
          >
            Registrar primera clase
          </button>
        </div>
      ) : (
        viewMode === 'list' && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3 text-slate-500 text-xs font-bold uppercase tracking-wider">
                      Fecha
                    </th>
                    <th className="px-6 py-3 text-slate-500 text-xs font-bold uppercase tracking-wider">
                      Cliente
                    </th>
                    <th className="px-6 py-3 text-slate-500 text-xs font-bold uppercase tracking-wider">
                      Duración
                    </th>
                    <th className="px-6 py-3 text-slate-500 text-xs font-bold uppercase tracking-wider">
                      Tarifa
                    </th>
                    <th className="px-6 py-3 text-slate-500 text-xs font-bold uppercase tracking-wider">
                      Total
                    </th>
                    <th className="px-6 py-3 text-slate-500 text-xs font-bold uppercase tracking-wider">
                      Estado
                    </th>
                    <th className="px-6 py-3 text-slate-500 text-xs font-bold uppercase tracking-wider">
                      Notas
                    </th>
                    <th className="px-6 py-3 text-right text-slate-500 text-xs font-bold uppercase tracking-wider">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {classes.map((c) => (
                    <tr
                      key={c.id}
                      className="hover:bg-slate-50 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <p className="font-medium text-slate-900">
                          {c.class_date}
                        </p>
                        {c.class_time && (
                          <p className="text-xs text-slate-400">
                            {c.class_time.slice(0, 5)}
                          </p>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                            {(c.client_name ?? '?').slice(0, 2).toUpperCase()}
                          </div>
                          <span className="font-medium text-slate-900">
                            {c.client_name ?? '—'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-700">
                        {c.duration_hours}h
                      </td>
                      <td className="px-6 py-4 text-slate-700">
                        €{c.hourly_rate}/h
                      </td>
                      <td className="px-6 py-4 font-bold text-slate-900">
                        €{(c.total_amount ?? 0).toFixed(2)}
                      </td>
                      <td className="px-6 py-4">
                        {(() => {
                          const cfg = CLASS_STATUS_CONFIG[c.status] ?? CLASS_STATUS_CONFIG.normal
                          return c.status !== 'normal' ? (
                            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${cfg.className}`}>
                              {cfg.label}
                            </span>
                          ) : <span className="text-slate-300 text-xs">—</span>
                        })()}
                      </td>
                      <td className="px-6 py-4 text-slate-500 text-sm max-w-[160px] truncate">
                        {c.notes ?? '—'}
                      </td>
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
                            <span className="material-symbols-outlined text-base">
                              edit
                            </span>
                          </button>
                          <button
                            onClick={() => handleDelete(c.id)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <span className="material-symbols-outlined text-base">
                              delete
                            </span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {/* Day detail — se renderiza primero para que los modales de edición/creación queden encima */}
      <Modal
        isOpen={!!dayDetailDate}
        onClose={() => setDayDetailDate(null)}
        title={dayDetailDate ? formatDate(dayDetailDate) : ''}
        size="lg"
      >
        {dayDetailDate && (
          <DayView
            date={dayDetailDate}
            classes={dayDetailClasses}
            onEdit={(c) => setEditingClass(c)}
            onNewClass={(date) => handleNewClassFromCalendar(date)}
            onDelete={async (id) => { handleDelete(id) }}
          />
        )}
      </Modal>

      <Modal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          setNewClassDate(null);
        }}
        title="Nueva clase"
        size="lg"
      >
        <ClassForm
          clients={clients}
          initial={newClassDate ? { class_date: newClassDate } : undefined}
          onSave={handleCreate}
          onCancel={() => {
            setShowCreateModal(false);
            setNewClassDate(null);
          }}
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
            onDelete={async () => { handleDelete(editingClass.id) }}
          />
        )}
      </Modal>

      <ConfirmModal
        isOpen={pendingDeleteId !== null}
        message="¿Seguro que quieres eliminar esta clase? Esta acción no se puede deshacer."
        onConfirm={confirmDelete}
        onCancel={() => setPendingDeleteId(null)}
      />
    </div>
  );
}
