import { useState, useEffect } from 'react'
import { Modal } from '../ui/Modal'
import { googleService, type EventPreview, type ConfirmEventItem } from '../../services/google.service'
import type { Client } from '../../types'

const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

interface Props {
  isOpen: boolean
  onClose: () => void
  clients: Client[]
  defaultMonth: number
  defaultYear: number
  onSynced: () => void
}

export function GoogleSyncModal({ isOpen, onClose, clients, defaultMonth, defaultYear, onSynced }: Props) {
  const [month, setMonth] = useState(defaultMonth)
  const [year, setYear] = useState(defaultYear)
  const [events, setEvents] = useState<EventPreview[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isConfirming, setIsConfirming] = useState(false)

  // Per-event state: client selection, hourly rate, selected
  const [eventConfig, setEventConfig] = useState<Record<string, {
    selected: boolean
    clientId: number | null
    hourlyRate: number
  }>>({})

  const activeClients = clients.filter(c => c.is_active)
  const years = Array.from({ length: 3 }, (_, i) => new Date().getFullYear() - i)

  const handleFetch = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await googleService.previewSync(month, year)
      setEvents(data)
      // Init per-event config
      const config: typeof eventConfig = {}
      for (const ev of data) {
        const defaultClient = activeClients.find(c => c.id === ev.suggested_client_id)
        const hourlyRate = defaultClient?.contracts?.find(c => c.is_active)?.hourly_rate ?? 0
        config[ev.google_event_id] = {
          selected: !ev.already_imported && ev.suggested_client_id !== null,
          clientId: ev.suggested_client_id,
          hourlyRate,
        }
      }
      setEventConfig(config)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al obtener eventos')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen) handleFetch()
  }, [isOpen, month, year])

  const updateConfig = (eventId: string, patch: Partial<typeof eventConfig[string]>) => {
    setEventConfig(prev => ({ ...prev, [eventId]: { ...prev[eventId], ...patch } }))
  }

  const handleClientChange = (eventId: string, clientId: number | null) => {
    const client = activeClients.find(c => c.id === clientId)
    const hourlyRate = client?.contracts?.find(c => c.is_active)?.hourly_rate ?? 0
    updateConfig(eventId, { clientId, hourlyRate })
  }

  const selectedEvents = events.filter(ev => eventConfig[ev.google_event_id]?.selected && eventConfig[ev.google_event_id]?.clientId)

  const handleConfirm = async () => {
    if (selectedEvents.length === 0) return
    setIsConfirming(true)
    try {
      const toCreate: ConfirmEventItem[] = selectedEvents.map(ev => ({
        google_event_id: ev.google_event_id,
        class_date: ev.class_date,
        class_time: ev.class_time,
        duration_hours: ev.duration_hours,
        client_id: eventConfig[ev.google_event_id].clientId!,
        hourly_rate: eventConfig[ev.google_event_id].hourlyRate,
      }))
      await googleService.confirmSync(toCreate)
      onSynced()
      onClose()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al confirmar')
    } finally {
      setIsConfirming(false)
    }
  }

  const matchBadge = (ev: EventPreview) => {
    if (ev.already_imported) return <span className="text-xs text-slate-400 font-medium">Ya importado</span>
    if (ev.match_type === 'exact') return <span className="text-xs text-emerald-600 font-semibold">Coincidencia exacta</span>
    if (ev.match_type === 'partial') return <span className="text-xs text-amber-600 font-semibold">Coincidencia parcial ({Math.round(ev.confidence * 100)}%)</span>
    return <span className="text-xs text-slate-400">Sin coincidencia</span>
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Sincronizar con Google Calendar" size="xl">
      <div className="space-y-4">
        {/* Month/year selector */}
        <div className="flex items-center gap-3">
          <select value={month} onChange={e => setMonth(parseInt(e.target.value))}
            className="border border-slate-200 rounded-lg py-2 pl-3 pr-8 text-sm bg-white focus:ring-primary focus:border-primary">
            {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <select value={year} onChange={e => setYear(parseInt(e.target.value))}
            className="border border-slate-200 rounded-lg py-2 pl-3 pr-8 text-sm bg-white focus:ring-primary focus:border-primary">
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button onClick={handleFetch} disabled={isLoading}
            className="px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50">
            <span className={`material-symbols-outlined text-base ${isLoading ? 'animate-spin' : ''}`}>refresh</span>
          </button>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <span className="material-symbols-outlined text-primary text-3xl animate-spin">sync</span>
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-12">
            <span className="material-symbols-outlined text-4xl text-slate-300 block mb-2">event_busy</span>
            <p className="text-slate-500">No hay eventos en este período</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
            {events.map(ev => {
              const cfg = eventConfig[ev.google_event_id]
              if (!cfg) return null
              return (
                <div key={ev.google_event_id}
                  className={`rounded-xl border p-3 transition-colors ${ev.already_imported ? 'bg-slate-50 border-slate-100 opacity-60' : cfg.selected ? 'bg-primary/5 border-primary/20' : 'bg-white border-slate-200'}`}>
                  <div className="flex items-start gap-3">
                    {!ev.already_imported && (
                      <input type="checkbox" checked={cfg.selected}
                        onChange={e => updateConfig(ev.google_event_id, { selected: e.target.checked })}
                        className="mt-1 accent-primary" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <p className="font-semibold text-slate-800 text-sm truncate">{ev.summary}</p>
                        {matchBadge(ev)}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {ev.class_date}{ev.class_time ? ` · ${ev.class_time}` : ''} · {ev.duration_hours}h
                      </p>
                      {!ev.already_imported && cfg.selected && (
                        <div className="flex items-center gap-2 mt-2">
                          <select value={cfg.clientId ?? ''}
                            onChange={e => handleClientChange(ev.google_event_id, parseInt(e.target.value) || null)}
                            className="flex-1 border border-slate-200 rounded-lg py-1.5 pl-2 pr-6 text-xs bg-white focus:ring-primary focus:border-primary">
                            <option value="">Sin cliente</option>
                            {activeClients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                          <input type="number" step="0.01" min="0" value={cfg.hourlyRate}
                            onChange={e => updateConfig(ev.google_event_id, { hourlyRate: parseFloat(e.target.value) || 0 })}
                            className="w-20 border border-slate-200 rounded-lg py-1.5 px-2 text-xs focus:ring-primary focus:border-primary"
                            placeholder="€/h" />
                          <span className="text-xs text-slate-500 font-medium whitespace-nowrap">
                            = €{(cfg.hourlyRate * ev.duration_hours).toFixed(2)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          <p className="text-sm text-slate-500">
            {selectedEvents.length} evento{selectedEvents.length !== 1 ? 's' : ''} seleccionado{selectedEvents.length !== 1 ? 's' : ''}
          </p>
          <div className="flex gap-2">
            <button onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors">
              Cancelar
            </button>
            <button onClick={handleConfirm} disabled={selectedEvents.length === 0 || isConfirming}
              className="px-5 py-2 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary-hover transition-colors disabled:opacity-50 flex items-center gap-2 shadow-md shadow-primary/20">
              {isConfirming && <span className="material-symbols-outlined text-base animate-spin">sync</span>}
              Importar {selectedEvents.length > 0 ? `(${selectedEvents.length})` : ''}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
