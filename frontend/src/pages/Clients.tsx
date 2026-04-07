import { useState, useEffect, useCallback, type FormEvent } from 'react';
import { clientService } from '../services/client.service';
import { Modal } from '../components/ui/Modal';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { formatDate, formatHours, calcDuration } from '../utils/formatters';
import type { Client, Contract, DaySchedule, PaymentIdentifier } from '../types';

const WEEKDAYS = [
  { index: '0', label: 'Lun' },
  { index: '1', label: 'Mar' },
  { index: '2', label: 'Mié' },
  { index: '3', label: 'Jue' },
  { index: '4', label: 'Vie' },
  { index: '5', label: 'Sáb' },
  { index: '6', label: 'Dom' },
]

// --- Client Form ---
function ClientForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: Partial<Client>;
  onSave: (data: Partial<Client>) => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    name: initial?.name ?? '',
    email: initial?.email ?? '',
    phone: initial?.phone ?? '',
    whatsapp_phone: initial?.whatsapp_phone ?? '',
    address: initial?.address ?? '',
    is_active: initial?.is_active ?? true,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditing = !!initial?.id
  const isDirty = !isEditing || (
    form.name          !== (initial?.name          ?? '')   ||
    form.email         !== (initial?.email         ?? '')   ||
    form.phone         !== (initial?.phone         ?? '')   ||
    form.whatsapp_phone !== (initial?.whatsapp_phone ?? '') ||
    form.address       !== (initial?.address       ?? '')   ||
    form.is_active !== (initial?.is_active ?? true)
  )

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await onSave(form);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setIsSubmitting(false);
    }
  };

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
            Nombre *
          </label>
          <input
            required
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">
            Email
          </label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">
            Teléfono
          </label>
          <input
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">
            WhatsApp
          </label>
          <input
            placeholder="+34 600 000 000"
            value={form.whatsapp_phone}
            onChange={(e) => setForm((f) => ({ ...f, whatsapp_phone: e.target.value }))}
            className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm"
          />
          <p className="text-xs text-slate-400 mt-1">Número para recordatorios automáticos</p>
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">
            Dirección
          </label>
          <input
            value={form.address}
            onChange={(e) =>
              setForm((f) => ({ ...f, address: e.target.value }))
            }
            className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm"
          />
        </div>
        <div className="flex items-center gap-3 mt-2">
          <input
            type="checkbox"
            id="is_active"
            checked={form.is_active}
            onChange={(e) =>
              setForm((f) => ({ ...f, is_active: e.target.checked }))
            }
            className="w-4 h-4 accent-primary"
          />
          <label
            htmlFor="is_active"
            className="text-sm font-medium text-slate-700"
          >
            Cliente activo
          </label>
        </div>
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={isSubmitting || !isDirty}
          className="px-6 py-2 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-primary/20 flex items-center gap-2"
        >
          {isSubmitting && (
            <span className="material-symbols-outlined text-base animate-spin">
              sync
            </span>
          )}
          {isEditing && !isDirty ? 'Sin cambios' : 'Guardar'}
        </button>
      </div>
    </form>
  );
}

// --- Contract Form ---
function ContractForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: Partial<Contract>;
  onSave: (data: Partial<Contract>) => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    description: initial?.description ?? '',
    start_date: initial?.start_date ?? new Date().toISOString().split('T')[0],
    end_date: initial?.end_date ?? '',
    hourly_rate: initial?.hourly_rate ?? 0,
    is_active: initial?.is_active ?? true,
    notes: initial?.notes ?? '',
    calendar_description: initial?.calendar_description ?? '',
  });

  // Reminders: track as two independent booleans mapped to the standard reminder objects
  const [reminderEmail24h, setReminderEmail24h] = useState(() => {
    const reminders = initial?.calendar_reminders
    return reminders ? reminders.some(r => r.method === 'email' && r.minutes === 1440) : true
  })
  const [reminderPopup1h, setReminderPopup1h] = useState(() => {
    const reminders = initial?.calendar_reminders
    return reminders ? reminders.some(r => r.method === 'popup' && r.minutes === 60) : true
  })
  const [scheduleDays, setScheduleDays] = useState<Record<string, DaySchedule>>(
    (initial?.schedule_days as Record<string, DaySchedule> | null) ?? {}
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleDay = (dayIndex: string) => {
    setScheduleDays(prev => {
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
    setScheduleDays(prev => ({
      ...prev,
      [dayIndex]: { ...prev[dayIndex], [field]: value }
    }))
  }

  const weeklyHours = Object.values(scheduleDays).reduce(
    (s, d) => s + calcDuration(d.start, d.end), 0
  )
  const weeklyRevenue = weeklyHours * form.hourly_rate

  const buildReminders = (): Array<{ method: 'email' | 'popup'; minutes: number }> | null => {
    const result: Array<{ method: 'email' | 'popup'; minutes: number }> = []
    if (reminderEmail24h) result.push({ method: 'email', minutes: 1440 })
    if (reminderPopup1h) result.push({ method: 'popup', minutes: 60 })
    return result.length > 0 ? result : null
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (form.end_date && form.start_date > form.end_date) {
      setError('La fecha de inicio no puede ser posterior a la fecha de fin.');
      return;
    }

    const invalidDay = Object.entries(scheduleDays).find(
      ([, d]) => d.start >= d.end
    )
    if (invalidDay) {
      const label = WEEKDAYS.find(w => w.index === invalidDay[0])?.label ?? invalidDay[0]
      setError(`La hora de fin de ${label} debe ser posterior a la hora de inicio.`)
      return
    }

    setIsSubmitting(true);
    try {
      await onSave({
        ...form,
        end_date: form.end_date || null,
        schedule_days: Object.keys(scheduleDays).length > 0 ? scheduleDays : null,
        calendar_description: form.calendar_description || null,
        calendar_reminders: buildReminders(),
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setIsSubmitting(false);
    }
  };

  const hasSchedule = Object.keys(scheduleDays).length > 0

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Descripción */}
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-1">
          Descripción *
        </label>
        <input
          required
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          placeholder="Ej: Clases de inglés"
          className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm"
        />
      </div>

      {/* Fechas y tarifa */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">
            Fecha inicio *
          </label>
          <input
            required
            type="date"
            value={form.start_date}
            max={form.end_date || undefined}
            onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
            className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">
            Fecha fin
          </label>
          <input
            type="date"
            value={form.end_date}
            min={form.start_date || undefined}
            onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
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
            onChange={(e) => setForm((f) => ({ ...f, hourly_rate: parseFloat(e.target.value) }))}
            className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm"
          />
        </div>
        <div className="flex items-end pb-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
              className="w-4 h-4 accent-primary"
            />
            <span className="text-sm font-medium text-slate-700">Contrato activo</span>
          </label>
        </div>
      </div>

      {/* Horario semanal */}
      <div className="space-y-3">
        <label className="block text-sm font-semibold text-slate-700">
          Horario semanal
        </label>
        <div className="flex gap-1.5 flex-wrap">
          {WEEKDAYS.map(({ index, label }) => {
            const active = index in scheduleDays
            return (
              <button
                key={index}
                type="button"
                onClick={() => toggleDay(index)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                  active
                    ? 'bg-primary text-white border-primary'
                    : 'bg-white text-slate-500 border-slate-200 hover:border-primary/40 hover:text-primary'
                }`}
              >
                {label}
              </button>
            )
          })}
        </div>

        {/* Inputs de horario por día activo */}
        {hasSchedule && (
          <div className="space-y-2">
            {WEEKDAYS.filter(({ index }) => index in scheduleDays).map(({ index, label }) => {
              const day = scheduleDays[index]
              const duration = calcDuration(day.start, day.end)
              const isInvalid = day.start >= day.end
              return (
                <div key={index} className="flex items-center gap-2">
                  <span className="w-8 text-xs font-bold text-slate-500">{label}</span>
                  <input
                    type="time"
                    value={day.start}
                    onChange={(e) => setDayTime(index, 'start', e.target.value)}
                    className="px-2 py-1.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                  />
                  <span className="text-xs text-slate-400">a</span>
                  <input
                    type="time"
                    value={day.end}
                    onChange={(e) => setDayTime(index, 'end', e.target.value)}
                    className={`px-2 py-1.5 border rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none ${
                      isInvalid ? 'border-red-300 bg-red-50' : 'border-slate-200'
                    }`}
                  />
                  {!isInvalid && (
                    <span className="text-xs text-slate-400">{formatHours(duration)}</span>
                  )}
                  {isInvalid && (
                    <span className="text-xs text-red-500">Hora inválida</span>
                  )}
                </div>
              )
            })}

            {/* Resumen semanal */}
            <div className="flex items-center gap-4 pt-1 px-1 text-xs text-slate-500">
              <span>
                <span className="font-bold text-slate-700">{formatHours(weeklyHours)}</span> / semana
              </span>
              {form.hourly_rate > 0 && (
                <span>
                  <span className="font-bold text-primary">€{weeklyRevenue.toFixed(2)}</span> / semana
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Notas */}
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-1">
          Notas
        </label>
        <textarea
          value={form.notes}
          onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          rows={2}
          className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm resize-none"
        />
      </div>

      {/* Google Calendar */}
      <div className="space-y-3 pt-1 border-t border-slate-100">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-base text-blue-400">calendar_month</span>
          <p className="text-sm font-semibold text-slate-700">Google Calendar</p>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
            Descripción del evento
          </label>
          <textarea
            value={form.calendar_description}
            onChange={(e) => setForm((f) => ({ ...f, calendar_description: e.target.value }))}
            rows={3}
            placeholder="Aparece en el cuerpo del evento y en los emails de recordatorio. Incluye links de tareas, plataforma, contraseñas de reunión, etc."
            className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm resize-none"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
            Recordatorios automáticos
          </label>
          <div className="space-y-1.5">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={reminderEmail24h}
                onChange={(e) => setReminderEmail24h(e.target.checked)}
                className="w-4 h-4 accent-primary"
              />
              <span className="text-sm text-slate-700">Email 24h antes (al alumno)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={reminderPopup1h}
                onChange={(e) => setReminderPopup1h(e.target.checked)}
                className="w-4 h-4 accent-primary"
              />
              <span className="text-sm text-slate-700">Aviso 1h antes (en tu calendario)</span>
            </label>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex justify-end gap-3 pt-2">
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
            <span className="material-symbols-outlined text-base animate-spin">sync</span>
          )}
          Guardar contrato
        </button>
      </div>
    </form>
  );
}

// --- Payers Manager ---
function PayersManager({
  client,
  onPayersChanged,
}: {
  client: Client;
  onPayersChanged: (clientId: number, payers: PaymentIdentifier[]) => void;
}) {
  const [payers, setPayers] = useState<PaymentIdentifier[]>(
    client.payers ?? [],
  );
  const [newName, setNewName] = useState('');
  const [newInfo, setNewInfo] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync if parent client payers change (e.g. modal reopened with fresh data)
  useEffect(() => {
    setPayers(client.payers ?? []);
  }, [client.id, client.payers]);

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setError(null);
    setIsAdding(true);
    try {
      const created = await clientService.createPayer(client.id, {
        name: newName.trim(),
        info: newInfo.trim() || null,
      });
      const updated = [...payers, created];
      setPayers(updated);
      onPayersChanged(client.id, updated);
      setNewName('');
      setNewInfo('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al añadir');
    } finally {
      setIsAdding(false);
    }
  };

  const handleDelete = async (payerId: number) => {
    try {
      await clientService.deletePayer(client.id, payerId);
      const updated = payers.filter((p) => p.id !== payerId);
      setPayers(updated);
      onPayersChanged(client.id, updated);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al eliminar');
    }
  };

  return (
    <div className="space-y-3 pt-4 border-t border-slate-100">
      <div>
        <p className="text-sm font-semibold text-slate-700">
          Identificadores de pago
        </p>
        <p className="text-xs text-slate-400 mt-0.5">
          Nombres con los que aparece este cliente en las transferencias
          bancarias. Se usan para el matching automático del PDF bancario.
        </p>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex flex-wrap gap-2 min-h-[28px]">
        {payers.map((p) => (
          <span
            key={p.id}
            className="flex items-center gap-1.5 bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-1 rounded-full text-xs font-medium"
          >
            {p.name}
            {p.info && <span className="text-blue-400">· {p.info}</span>}
            <button
              onClick={() => handleDelete(p.id)}
              type="button"
              className="text-blue-400 hover:text-red-500 transition-colors ml-0.5"
            >
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          </span>
        ))}
        {payers.length === 0 && (
          <span className="text-slate-400 text-xs italic self-center">
            Sin identificadores
          </span>
        )}
      </div>

      <form onSubmit={handleAdd} className="flex gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Nombre en banco (ej: García)"
          className="flex-1 px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
        />
        <input
          value={newInfo}
          onChange={(e) => setNewInfo(e.target.value)}
          placeholder="Info (opcional)"
          className="w-28 px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
        />
        <button
          type="submit"
          disabled={isAdding || !newName.trim()}
          className="px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-bold hover:bg-primary-hover transition-colors disabled:opacity-60"
        >
          Añadir
        </button>
      </form>
    </div>
  );
}

// --- Client Card ---
function ClientCard({
  client,
  onEdit,
  onDelete,
  onActivate,
  onManageContracts,
}: {
  client: Client;
  onEdit: () => void;
  onDelete: () => void;
  onActivate: () => void;
  onManageContracts: () => void;
}) {
  const activeContracts = client.contracts?.filter((c) => c.is_active) ?? [];
  const isArchived = !!client.deleted_at;

  return (
    <div
      className={`bg-white border rounded-xl p-5 flex flex-col lg:flex-row lg:items-center gap-5 shadow-sm hover:border-primary/50 transition-colors ${isArchived ? 'opacity-50 border-slate-100' : !client.is_active ? 'opacity-60 border-slate-200' : 'border-slate-200'}`}
    >
      <div className="flex items-center gap-4 flex-1">
        <div
          className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${client.is_active && !isArchived ? 'bg-primary/10 text-primary' : 'bg-slate-100 text-slate-400'}`}
        >
          <span className="material-symbols-outlined text-2xl">person</span>
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-bold text-slate-900 truncate">{client.name}</h3>
            {isArchived ? (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-400 border border-slate-200">
                Archivado
              </span>
            ) : client.is_active ? (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
                Activo
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
                Inactivo
              </span>
            )}
          </div>
          {client.email && (
            <p className="text-sm text-slate-500 truncate">{client.email}</p>
          )}
          {client.phone && (
            <p className="text-sm text-slate-400">{client.phone}</p>
          )}
        </div>
      </div>

      <div className="flex-1 lg:border-x border-slate-100 px-0 lg:px-6">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
          Contratos
        </p>
        {activeContracts.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {activeContracts.map((c) => (
              <span
                key={c.id}
                className="bg-slate-50 text-slate-600 px-2 py-1 rounded text-xs border border-slate-200"
              >
                {c.description} — €{c.hourly_rate}/h
              </span>
            ))}
          </div>
        ) : (
          <span className="text-slate-400 text-xs italic">
            Sin contratos activos
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {!isArchived && (
          <button
            onClick={onManageContracts}
            className="p-2 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors"
            title="Gestionar contratos"
          >
            <span className="material-symbols-outlined">description</span>
          </button>
        )}
        <button
          onClick={onEdit}
          className="p-2 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors"
          title={isArchived ? 'Ver datos' : 'Editar'}
        >
          <span className="material-symbols-outlined">edit</span>
        </button>
        {isArchived ? (
          <button
            onClick={onActivate}
            className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
            title="Activar"
          >
            <span className="material-symbols-outlined">restore</span>
          </button>
        ) : (
          <button
            onClick={onDelete}
            className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
            title="Archivar"
          >
            <span className="material-symbols-outlined">archive</span>
          </button>
        )}
      </div>
    </div>
  );
}

// --- Contract Detail (view + actions, optional edit mode) ---
function ContractDetail({
  contract,
  clientId,
  isEditMode,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onClose,
}: {
  contract: Contract;
  clientId: number;
  isEditMode: boolean;
  onStartEdit: () => void;
  onSaveEdit: (data: Partial<Contract>) => Promise<void>;
  onCancelEdit: () => void;
  onClose: () => void;
}) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateResult, setGenerateResult] = useState<number | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);

  const [pendingDeleteFuture, setPendingDeleteFuture] = useState(false);
  const [isDeletingFuture, setIsDeletingFuture] = useState(false);
  const [deleteResult, setDeleteResult] = useState<number | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const hasSchedule = !!(contract.schedule_days && Object.keys(contract.schedule_days).length > 0);
  const weeklyHours = hasSchedule
    ? Object.values(contract.schedule_days!).reduce((s, d) => s + calcDuration(d.start, d.end), 0)
    : 0;

  const handleGenerate = async () => {
    setIsGenerating(true);
    setGenerateResult(null);
    setGenerateError(null);
    try {
      const { created } = await clientService.generateContractClasses(clientId, contract.id);
      setGenerateResult(created);
    } catch {
      setGenerateError('Error al generar clases. Inténtalo de nuevo.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleConfirmDeleteFuture = async () => {
    setPendingDeleteFuture(false);
    setIsDeletingFuture(true);
    setDeleteResult(null);
    setDeleteError(null);
    try {
      const { deleted } = await clientService.deleteFutureContractClasses(clientId, contract.id);
      setDeleteResult(deleted);
    } catch {
      setDeleteError('Error al eliminar las clases. Inténtalo de nuevo.');
    } finally {
      setIsDeletingFuture(false);
    }
  };

  const actionDisabledTitle = isEditMode ? 'Guarda los cambios primero' : undefined;

  return (
    <div className="space-y-4">
      {/* Modo lectura: datos del contrato */}
      {!isEditMode && (
        <div className="space-y-3">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-0.5">Descripción</p>
            <p className="text-sm font-semibold text-slate-900">{contract.description}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-0.5">Fecha inicio</p>
              <p className="text-sm text-slate-700">{formatDate(contract.start_date)}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-0.5">Fecha fin</p>
              <p className="text-sm text-slate-700">{formatDate(contract.end_date)}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-0.5">Tarifa</p>
              <p className="text-sm text-slate-700">€{contract.hourly_rate}/h</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-0.5">Estado</p>
              {contract.is_active
                ? <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">Activo</span>
                : <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">Inactivo</span>
              }
            </div>
          </div>
          {hasSchedule && (
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Horario semanal</p>
              <div className="flex gap-1.5 flex-wrap mb-1">
                {WEEKDAYS.filter(d => d.index in contract.schedule_days!).map(({ index, label }) => {
                  const day = contract.schedule_days![index]
                  const duration = calcDuration(day.start, day.end)
                  return (
                    <span key={index} className="text-xs font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-md">
                      {label} · {day.start}–{day.end} <span className="font-normal opacity-70">({formatHours(duration)})</span>
                    </span>
                  )
                })}
              </div>
              <p className="text-xs text-slate-500">
                Total: <span className="font-bold text-slate-700">{formatHours(weeklyHours)}/semana</span>
                {contract.hourly_rate > 0 && (
                  <> · <span className="font-bold text-primary">€{(weeklyHours * contract.hourly_rate).toFixed(2)}/semana</span></>
                )}
              </p>
            </div>
          )}
          {contract.notes && (
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-0.5">Notas</p>
              <p className="text-sm text-slate-600">{contract.notes}</p>
            </div>
          )}
        </div>
      )}

      {/* Modo edición: formulario */}
      {isEditMode && (
        <ContractForm
          initial={contract}
          onSave={onSaveEdit}
          onCancel={onCancelEdit}
        />
      )}

      {/* Acciones del calendario — siempre visibles, deshabilitadas en edición */}
      <div className="border-t border-slate-100 pt-4 space-y-2">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Acciones del calendario</p>
        <div className="flex flex-wrap gap-2">
          {hasSchedule && (
            <button
              type="button"
              onClick={handleGenerate}
              disabled={isEditMode || isGenerating}
              title={actionDisabledTitle}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-bold hover:bg-primary/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isGenerating
                ? <span className="material-symbols-outlined text-sm animate-spin">sync</span>
                : <span className="material-symbols-outlined text-sm">calendar_add_on</span>
              }
              Generar clases en el calendario
            </button>
          )}
          <button
            type="button"
            onClick={() => { setPendingDeleteFuture(true); setDeleteResult(null); setDeleteError(null); }}
            disabled={isEditMode || isDeletingFuture}
            title={actionDisabledTitle}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 text-red-500 text-xs font-bold hover:bg-red-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isDeletingFuture
              ? <span className="material-symbols-outlined text-sm animate-spin">sync</span>
              : <span className="material-symbols-outlined text-sm">event_busy</span>
            }
            Eliminar clases futuras
          </button>
        </div>

        {/* Confirmación inline para eliminar clases futuras */}
        {pendingDeleteFuture && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            <span className="material-symbols-outlined text-red-400 text-sm">warning</span>
            <p className="text-xs text-red-700 font-semibold flex-1">
              ¿Eliminar todas las clases futuras de este contrato?
            </p>
            <button
              type="button"
              onClick={() => setPendingDeleteFuture(false)}
              className="text-xs text-slate-500 hover:text-slate-700 font-semibold px-2 py-1 rounded hover:bg-slate-100 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirmDeleteFuture}
              className="text-xs text-white font-bold bg-red-500 hover:bg-red-600 px-2 py-1 rounded transition-colors"
            >
              Eliminar
            </button>
          </div>
        )}

        {generateResult !== null && (
          <p className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
            <span className="material-symbols-outlined text-sm">check_circle</span>
            {generateResult === 0
              ? 'No había clases nuevas que generar'
              : `${generateResult} ${generateResult === 1 ? 'clase creada' : 'clases creadas'} en el calendario`}
          </p>
        )}
        {generateError && (
          <p className="text-xs text-red-500 flex items-center gap-1">
            <span className="material-symbols-outlined text-sm">error</span>
            {generateError}
          </p>
        )}
        {deleteResult !== null && (
          <p className="text-xs text-slate-600 font-semibold flex items-center gap-1">
            <span className="material-symbols-outlined text-sm">check_circle</span>
            {deleteResult === 0
              ? 'No hay clases futuras asociadas a este contrato'
              : `${deleteResult} ${deleteResult === 1 ? 'clase eliminada' : 'clases eliminadas'} del calendario`}
          </p>
        )}
        {deleteError && (
          <p className="text-xs text-red-500 flex items-center gap-1">
            <span className="material-symbols-outlined text-sm">error</span>
            {deleteError}
          </p>
        )}
        {isEditMode && (
          <p className="text-xs text-slate-400 italic">Guarda los cambios para poder usar las acciones del calendario.</p>
        )}
      </div>

      {/* Footer — solo en modo lectura (ContractForm tiene el suyo propio en modo edición) */}
      {!isEditMode && (
        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onStartEdit}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-primary hover:bg-primary/5 transition-colors"
          >
            <span className="material-symbols-outlined text-base">edit</span>
            Editar contrato
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
          >
            Cerrar
          </button>
        </div>
      )}
    </div>
  );
}

// --- Contracts Manager ---
function ContractsManager({
  client,
  onContractsChanged,
  onClose,
}: {
  client: Client;
  onContractsChanged: (clientId: number, contracts: Contract[]) => void;
  onClose: () => void;
}) {
  const [contracts, setContracts] = useState<Contract[]>(client.contracts ?? []);
  const [showNewForm, setShowNewForm] = useState(false);
  const [viewingContractId, setViewingContractId] = useState<number | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [pendingDeleteContractId, setPendingDeleteContractId] = useState<number | null>(null);

  const viewingContract = contracts.find(c => c.id === viewingContractId) ?? null;

  const reload = useCallback(async () => {
    const updated = await clientService.getContracts(client.id);
    setContracts(updated);
    onContractsChanged(client.id, updated);
  }, [client.id]);

  const openDetail = (contractId: number) => {
    setViewingContractId(contractId);
    setIsEditMode(false);
    setShowNewForm(false);
  };

  const closeDetail = () => {
    setViewingContractId(null);
    setIsEditMode(false);
  };

  const handleCreate = async (data: Partial<Contract>) => {
    await clientService.createContract(
      client.id,
      data as Omit<Contract, 'id' | 'client_id' | 'created_at'>,
    );
    await reload();
    setShowNewForm(false);
  };

  const handleUpdate = async (data: Partial<Contract>) => {
    if (!viewingContractId) return;
    await clientService.updateContract(client.id, viewingContractId, data);
    await reload();
    setIsEditMode(false); // vuelve a modo lectura, el detalle permanece abierto
  };

  const confirmDeleteContract = async () => {
    if (!pendingDeleteContractId) return;
    await clientService.deleteContract(client.id, pendingDeleteContractId);
    setPendingDeleteContractId(null);
    if (viewingContractId === pendingDeleteContractId) closeDetail();
    await reload();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-slate-500 text-sm">
          Contratos de <strong>{client.name}</strong>
        </p>
        <button
          onClick={() => { setShowNewForm(true); closeDetail(); }}
          className="flex items-center gap-1 px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-bold hover:bg-primary-hover transition-colors"
        >
          <span className="material-symbols-outlined text-base">add</span> Nuevo
        </button>
      </div>

      {/* Formulario para nuevo contrato */}
      {showNewForm && (
        <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Nuevo contrato</p>
          <ContractForm
            onSave={handleCreate}
            onCancel={() => setShowNewForm(false)}
          />
        </div>
      )}

      {/* Lista de contratos */}
      {contracts.length === 0 && !showNewForm ? (
        <div className="text-center py-8 text-slate-400">
          <span className="material-symbols-outlined text-3xl block mb-2">description</span>
          No hay contratos. Añade uno para empezar.
        </div>
      ) : (
        <div className="space-y-2">
          {contracts.map((c) => (
            <div key={c.id}>
              {/* Card del contrato */}
              <div
                className={`flex items-center justify-between gap-4 p-4 border transition-colors ${
                  viewingContractId === c.id
                    ? 'rounded-t-xl border-primary/30 bg-primary/5'
                    : c.is_active
                      ? 'rounded-xl border-slate-200 bg-white'
                      : 'rounded-xl border-slate-100 bg-slate-50 opacity-60'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-900 text-sm">{c.description}</p>
                  <p className="text-xs text-slate-500">
                    €{c.hourly_rate}/h · Desde {formatDate(c.start_date)}
                    {c.end_date ? ` hasta ${formatDate(c.end_date)}` : ''}
                  </p>
                  {c.schedule_days && Object.keys(c.schedule_days).length > 0 && (
                    <p className="text-xs text-primary/70 mt-0.5">
                      {WEEKDAYS.filter(d => d.index in c.schedule_days!).map(d => d.label).join(', ')}
                      {' · '}
                      {formatHours(Object.values(c.schedule_days).reduce((s, d) => s + calcDuration(d.start, d.end), 0))}/semana
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {c.is_active
                    ? <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">Activo</span>
                    : <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">Inactivo</span>
                  }
                  <button
                    onClick={() => viewingContractId === c.id ? closeDetail() : openDetail(c.id)}
                    className={`p-1.5 rounded-lg transition-colors ${
                      viewingContractId === c.id
                        ? 'text-primary bg-primary/10'
                        : 'text-slate-400 hover:text-primary hover:bg-primary/5'
                    }`}
                    title="Ver detalle"
                  >
                    <span className="material-symbols-outlined text-base">
                      {viewingContractId === c.id ? 'expand_less' : 'expand_more'}
                    </span>
                  </button>
                  <button
                    onClick={() => setPendingDeleteContractId(c.id)}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Eliminar contrato"
                  >
                    <span className="material-symbols-outlined text-base">delete</span>
                  </button>
                </div>
              </div>

              {/* Panel de detalle expandible */}
              {viewingContractId === c.id && viewingContract && (
                <div className="bg-slate-50 rounded-b-xl border-x border-b border-primary/30 p-4">
                  <ContractDetail
                    contract={viewingContract}
                    clientId={client.id}
                    isEditMode={isEditMode}
                    onStartEdit={() => setIsEditMode(true)}
                    onSaveEdit={handleUpdate}
                    onCancelEdit={() => setIsEditMode(false)}
                    onClose={closeDetail}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-end pt-2">
        <button
          onClick={onClose}
          className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
        >
          Cerrar
        </button>
      </div>

      <ConfirmModal
        isOpen={pendingDeleteContractId !== null}
        message="¿Eliminar este contrato? Esta acción no se puede deshacer."
        onConfirm={confirmDeleteContract}
        onCancel={() => setPendingDeleteContractId(null)}
      />

    </div>
  );
}

// --- Confirmation Modal ---
function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  isDangerous = false,
  isLoading = false,
  onConfirm,
  onCancel,
}: {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDangerous?: boolean;
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-lg max-w-sm mx-4">
        <div className="p-6 space-y-4">
          <h2 className="text-lg font-bold text-slate-900">{title}</h2>
          <p className="text-sm text-slate-600">{message}</p>
        </div>
        <div className="flex gap-3 p-6 border-t border-slate-100 justify-end">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-60"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className={`px-4 py-2 rounded-lg text-sm font-semibold text-white transition-colors disabled:opacity-60 ${isDangerous ? 'bg-red-500 hover:bg-red-600' : 'bg-primary hover:bg-primary-hover'}`}
          >
            {isLoading ? (
              <span className="material-symbols-outlined inline animate-spin">
                sync
              </span>
            ) : (
              confirmText
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Main Page ---
export function Clients() {
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterActive, setFilterActive] = useState<
    'all' | 'active' | 'archived'
  >('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [contractsClient, setContractsClient] = useState<Client | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    action: 'archive' | 'activate';
    client: Client;
  } | null>(null);
  const [isConfirmingAction, setIsConfirmingAction] = useState(false);

  const loadClients = useCallback(async () => {
    setIsLoading(true);
    try {
      let is_active: boolean | undefined;
      let deleted_filter: 'exclude' | 'include' | 'only';

      if (filterActive === 'active') {
        is_active = true;
        deleted_filter = 'exclude';
      } else if (filterActive === 'archived') {
        is_active = undefined;
        deleted_filter = 'only';
      } else {
        // 'all' - show everything
        is_active = undefined;
        deleted_filter = 'include';
      }

      const data = await clientService.getAll({
        search: search || undefined,
        is_active,
        deleted_filter,
      });
      const dataSorted = data.sort(
        (a, b) => Number(b.is_active) - Number(a.is_active),
      );
      setClients(dataSorted);
    } finally {
      setIsLoading(false);
    }
  }, [search, filterActive]);

  useEffect(() => {
    loadClients();
  }, [loadClients]);

  const handleCreate = async (data: Partial<Client>) => {
    const created = await clientService.create(
      data as Omit<Client, 'id' | 'created_at' | 'updated_at' | 'deleted_at' | 'contracts'>,
    );
    setClients((prev) => [created, ...prev]);
    setShowCreateModal(false);
  };

  const handleUpdate = async (data: Partial<Client>) => {
    if (!editingClient) return;
    const updated = await clientService.update(editingClient.id, data);
    // Preserve payers since update endpoint doesn't return them in the same call
    const withPayers = { ...updated, payers: editingClient.payers };
    setClients((prev) =>
      prev.map((c) => (c.id === editingClient.id ? withPayers : c)),
    );
    setEditingClient(null);
  };

  const handleDelete = async (client: Client) => {
    setConfirmDialog({ action: 'archive', client });
  };

  const handleActivate = async (client: Client) => {
    setConfirmDialog({ action: 'activate', client });
  };

  const handleConfirmAction = async () => {
    if (!confirmDialog) return;
    setIsConfirmingAction(true);
    try {
      if (confirmDialog.action === 'archive') {
        await clientService.delete(confirmDialog.client.id);
        setClients((prev) =>
          prev.map((c) =>
            c.id === confirmDialog.client.id
              ? { ...c, is_active: false, deleted_at: new Date().toISOString() }
              : c,
          ),
        );
      } else if (confirmDialog.action === 'activate') {
        const updated = await clientService.update(confirmDialog.client.id, {
          is_active: true,
          deleted_at: null as any,
        });
        const withPayers = { ...updated, payers: confirmDialog.client.payers };
        setClients((prev) =>
          prev.map((c) => (c.id === confirmDialog.client.id ? withPayers : c)),
        );
      }
      setConfirmDialog(null);
    } finally {
      setIsConfirmingAction(false);
    }
  };

  const handleContractsChanged = (clientId: number, contracts: Contract[]) => {
    setClients((prev) =>
      prev.map((c) => (c.id === clientId ? { ...c, contracts } : c)),
    );
    setContractsClient((prev) =>
      prev?.id === clientId ? { ...prev, contracts } : prev,
    );
  };

  const handlePayersChanged = (
    clientId: number,
    payers: PaymentIdentifier[],
  ) => {
    setClients((prev) =>
      prev.map((c) => (c.id === clientId ? { ...c, payers } : c)),
    );
    setEditingClient((prev) =>
      prev?.id === clientId ? { ...prev, payers } : prev,
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Clientes</h1>
          <p className="text-slate-500 text-sm mt-1">
            Administra tu cartera de clientes y contratos.
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 bg-primary hover:bg-primary-hover text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-primary/20 transition-all"
        >
          <span className="material-symbols-outlined">add</span>
          Nuevo cliente
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">
            search
          </span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre..."
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
          />
        </div>
        <select
          value={filterActive}
          onChange={(e) =>
            setFilterActive(e.target.value as typeof filterActive)
          }
          className="border border-slate-200 rounded-lg py-2 pl-3 pr-8 text-sm focus:ring-primary focus:border-primary text-slate-600 bg-white"
        >
          <option value="active">Activos</option>
          <option value="archived">Archivados</option>
          <option value="all">Todos</option>
        </select>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex items-center justify-center h-32">
          <span className="material-symbols-outlined text-primary text-3xl animate-spin">
            sync
          </span>
        </div>
      ) : clients.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-slate-200">
          <span className="material-symbols-outlined text-5xl text-slate-300 block mb-3">
            group
          </span>
          <p className="text-slate-500 font-medium">No hay clientes</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="mt-4 text-primary text-sm font-semibold hover:underline"
          >
            Añade tu primer cliente
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {clients.map((client) => (
            <ClientCard
              key={client.id}
              client={client}
              onEdit={async () => {
                // Load full client data to avoid missing fields
                // Include deleted clients in case we're editing an archived client
                const fullClient = await clientService.getById(
                  client.id,
                  !!client.deleted_at,
                );
                setEditingClient(fullClient);
              }}
              onDelete={() => handleDelete(client)}
              onActivate={() => handleActivate(client)}
              onManageContracts={() => setContractsClient(client)}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Nuevo cliente"
      >
        <ClientForm
          onSave={handleCreate}
          onCancel={() => setShowCreateModal(false)}
        />
      </Modal>

      <Modal
        isOpen={!!editingClient}
        onClose={() => setEditingClient(null)}
        title="Editar cliente"
        size="lg"
      >
        {editingClient && (
          <div className="space-y-0">
            <ClientForm
              initial={editingClient}
              onSave={handleUpdate}
              onCancel={() => setEditingClient(null)}
            />
            <PayersManager
              client={editingClient}
              onPayersChanged={handlePayersChanged}
            />
          </div>
        )}
      </Modal>

      <Modal
        isOpen={!!contractsClient}
        onClose={() => setContractsClient(null)}
        title="Contratos"
        size="lg"
      >
        {contractsClient && (
          <ContractsManager
            client={contractsClient}
            onContractsChanged={handleContractsChanged}
            onClose={() => setContractsClient(null)}
          />
        )}
      </Modal>

      <ConfirmDialog
        isOpen={!!confirmDialog}
        title={
          confirmDialog?.action === 'archive'
            ? `Archivar a ${confirmDialog?.client.name}`
            : `Activar a ${confirmDialog?.client.name}`
        }
        message={
          confirmDialog?.action === 'archive'
            ? 'El cliente quedará inactivo y se ocultará de la lista de activos. Podrás recuperarlo en la sección de Archivados.'
            : 'El cliente volverá a estar activo y visible en tu cartera principal.'
        }
        confirmText={
          confirmDialog?.action === 'archive' ? 'Archivar' : 'Activar'
        }
        isDangerous={confirmDialog?.action === 'archive'}
        isLoading={isConfirmingAction}
        onConfirm={handleConfirmAction}
        onCancel={() => setConfirmDialog(null)}
      />
    </div>
  );
}
