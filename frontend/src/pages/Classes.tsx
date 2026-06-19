import { useState } from 'react'
import { CalendarView } from '../components/classes/CalendarView'
import { ClassForm } from '../components/classes/ClassForm'
import { CLASS_STATUS_CONFIG } from '../components/classes/constants'
import { DayView } from '../components/classes/DayView'
import { Button } from '../components/ui/Button'
import { ConfirmationModal } from '../components/ui/ConfirmationModal'
import { Modal } from '../components/ui/Modal'
import { Pagination } from '../components/ui/Pagination'
import { useToast } from '../context/ToastContext'
import { useClasses } from '../hooks/useClasses'
import i18n, { useTranslation } from '../i18n'
import { invoiceService } from '../services/invoice.service'
import type { ClassSession } from '../types'

type ViewMode = 'list' | 'calendar'

export function Classes() {
  const { t } = useTranslation()
  const { addToast } = useToast()
  const months: string[] = t('common.months.full', {
    returnObjects: true,
  }) as unknown as string[]
  const now = new Date()

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
    classes,
    clients,
    isLoading,
    isSyncing,
    pendingDeleteId,
    classStats,
    page,
    pageCount,
    totalCount,
    goToPage,
    createClass,
    updateClass,
    requestDelete,
    confirmDelete,
    cancelDelete,
    syncGCal,
    retrySync,
  } = useClasses({ filterMonth, filterYear, filterClient })

  const dayDetailClasses = dayDetailDate
    ? classes.filter((classSession) => classSession.classDate === dayDetailDate)
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

  const handleGenerateInvoiceFromClass = async () => {
    if (!editingClass) return
    try {
      await invoiceService.createFromClass(editingClass.id)
      addToast('toasts.invoiceCreated', 'success')
      setEditingClass(null)
    } catch (err: unknown) {
      addToast(
        'toasts.invoiceCreateError',
        'error',
        undefined,
        err instanceof Error ? err.message : undefined,
      )
    }
  }

  const handleNewClassFromCalendar = (date: string) => {
    setNewClassDate(date)
    setShowCreateModal(true)
  }

  function formatDayTitle(dateStr: string): string {
    return new Date(`${dateStr}T00:00:00`).toLocaleDateString(i18n.language, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  }

  const years = Array.from({ length: 3 }, (_, i) => now.getFullYear() - i)

  return (
    <div className='space-y-6'>
      <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-4'>
        <div>
          <h1 className='text-2xl font-black text-slate-900'>{t('classes.title')}</h1>
          <p className='text-slate-500 text-sm mt-1'>{t('classes.subtitle')}</p>
        </div>
        <div className='flex items-center gap-3'>
          <div className='flex items-center bg-slate-100 rounded-xl p-1 gap-1'>
            <Button
              type='button'
              onClick={() => handleViewMode('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-all
                ${viewMode === 'list' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <span className='material-symbols-outlined text-base'>view_list</span>
              {t('classes.view.list')}
            </Button>
            <Button
              type='button'
              onClick={() => handleViewMode('calendar')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-all
                ${viewMode === 'calendar' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <span className='material-symbols-outlined text-base'>calendar_month</span>
              {t('classes.view.calendar')}
            </Button>
          </div>
          <Button
            type='button'
            onClick={() => syncGCal()}
            loading={isSyncing}
            title={t('classes.gcalSynced')}
            className='flex items-center gap-2 border border-slate-200 text-slate-600 hover:bg-slate-50 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all disabled:opacity-50'
          >
            <span
              className={`material-symbols-outlined text-base ${isSyncing ? 'animate-spin' : ''}`}
            >
              {isSyncing ? 'refresh' : 'calendar_month'}
            </span>
            {isSyncing ? t('classes.syncing') : t('classes.syncGCal')}
          </Button>
          <Button
            type='button'
            onClick={() => {
              setNewClassDate(null)
              setShowCreateModal(true)
            }}
            className='flex items-center gap-2 bg-primary hover:bg-primary-hover text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-primary/20 transition-all'
          >
            <span className='material-symbols-outlined'>add</span>
            {t('classes.newClass')}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className='bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap items-center gap-3'>
        <select
          value={filterMonth}
          onChange={(e) => setFilterMonth(parseInt(e.target.value, 10))}
          className='border border-slate-200 rounded-lg py-2 pl-3 pr-8 text-sm text-slate-600 bg-white focus:ring-primary focus:border-primary'
        >
          {months.map((m, i) => (
            <option key={m} value={i + 1}>
              {m}
            </option>
          ))}
        </select>
        <select
          value={filterYear}
          onChange={(e) => setFilterYear(parseInt(e.target.value, 10))}
          className='border border-slate-200 rounded-lg py-2 pl-3 pr-8 text-sm text-slate-600 bg-white focus:ring-primary focus:border-primary'
        >
          {years.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
        <select
          value={filterClient}
          onChange={(e) => setFilterClient(parseInt(e.target.value, 10) || '')}
          className='border border-slate-200 rounded-lg py-2 pl-3 pr-8 text-sm text-slate-600 bg-white focus:ring-primary focus:border-primary'
        >
          <option value=''>{t('classes.filter.allClients')}</option>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.name}
            </option>
          ))}
        </select>
        {classStats.count > 0 && (
          <div className='ml-auto flex items-center gap-2'>
            <div className='relative group'>
              <div className='flex items-center gap-1.5 bg-slate-100 border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold text-slate-600'>
                <span className='material-symbols-outlined text-base'>schedule</span>
                {t('classes.totalHours', {
                  worked: classStats.workedHours,
                  planned: classStats.totalHours,
                })}
              </div>
              <div className='pointer-events-none absolute right-0 top-full mt-1 hidden group-hover:block whitespace-nowrap rounded-lg bg-slate-800 text-white text-xs px-2 py-1 shadow-lg z-50'>
                {t('classes.totalHoursTitle')}
              </div>
            </div>
            <div className='bg-primary/5 border border-primary/20 rounded-xl px-4 py-2 text-sm font-bold text-primary'>
              {t('classes.totalRevenue', { amount: classStats.totalRevenue.toFixed(2) })}
            </div>
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
        <div className='flex items-center justify-center h-32'>
          <span className='material-symbols-outlined text-primary text-3xl animate-spin'>sync</span>
        </div>
      ) : viewMode === 'list' && classes.length === 0 ? (
        <div className='text-center py-16 bg-white rounded-xl border border-slate-200'>
          <span className='material-symbols-outlined text-5xl text-slate-300 block mb-3'>
            event
          </span>
          <p className='text-slate-500 font-medium'>{t('classes.empty.list')}</p>
          <Button
            type='button'
            onClick={() => {
              setNewClassDate(null)
              setShowCreateModal(true)
            }}
            className='mt-4 text-primary text-sm font-semibold hover:underline'
          >
            {t('classes.registerFirst')}
          </Button>
        </div>
      ) : (
        viewMode === 'list' && (
          <div className='bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden'>
            <div className='overflow-x-auto'>
              <table className='w-full text-left' id='classes-table'>
                <thead className='bg-slate-50 border-b border-slate-200'>
                  <tr>
                    <th className='px-6 py-3 text-slate-500 text-xs font-bold uppercase tracking-wider'>
                      {t('classes.table.date')}
                    </th>
                    <th className='px-6 py-3 text-slate-500 text-xs font-bold uppercase tracking-wider'>
                      {t('classes.table.client')}
                    </th>
                    <th className='px-6 py-3 text-slate-500 text-xs font-bold uppercase tracking-wider'>
                      {t('classes.table.duration')}
                    </th>
                    <th className='px-6 py-3 text-slate-500 text-xs font-bold uppercase tracking-wider'>
                      {t('classes.table.rate')}
                    </th>
                    <th className='px-6 py-3 text-slate-500 text-xs font-bold uppercase tracking-wider'>
                      {t('classes.table.total')}
                    </th>
                    <th className='px-6 py-3 text-slate-500 text-xs font-bold uppercase tracking-wider'>
                      {t('classes.table.status')}
                    </th>
                    <th className='px-6 py-3 text-slate-500 text-xs font-bold uppercase tracking-wider'>
                      {t('classes.table.notes')}
                    </th>
                    <th className='px-6 py-3 text-right text-slate-500 text-xs font-bold uppercase tracking-wider'>
                      {t('classes.table.actions')}
                    </th>
                  </tr>
                </thead>
                <tbody className='divide-y divide-slate-100'>
                  {classes.map((classSession) => {
                    const cfg =
                      CLASS_STATUS_CONFIG[classSession.status] ?? CLASS_STATUS_CONFIG.normal
                    return (
                      <tr key={classSession.id} className='hover:bg-slate-50 transition-colors'>
                        <td className='px-6 py-4'>
                          <p className='font-medium text-slate-900'>{classSession.classDate}</p>
                          {classSession.classTime && (
                            <p className='text-xs text-slate-400'>
                              {classSession.classTime.slice(0, 5)}
                            </p>
                          )}
                        </td>
                        <td className='px-6 py-4'>
                          <div className='flex items-center gap-2'>
                            <div className='w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold'>
                              {(classSession.clientName ?? '?').slice(0, 2).toUpperCase()}
                            </div>
                            <span className='font-medium text-slate-900'>
                              {classSession.clientName ?? '—'}
                            </span>
                          </div>
                        </td>
                        <td className='px-6 py-4 text-slate-700'>
                          {classSession.durationHours}
                          {t('common.units.hoursShort')}
                        </td>
                        <td className='px-6 py-4 text-slate-700'>
                          €{classSession.hourlyRate}/{t('common.units.hoursShort')}
                        </td>
                        <td className='px-6 py-4 font-bold text-slate-900'>
                          €{(classSession.effectiveRevenue ?? 0).toFixed(2)}
                        </td>
                        <td className='px-6 py-4'>
                          {classSession.status !== 'normal' ? (
                            <span
                              className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${cfg.className}`}
                            >
                              {t(cfg.label)}
                            </span>
                          ) : (
                            <span className='text-slate-300 text-xs'>—</span>
                          )}
                        </td>
                        <td className='px-6 py-4 text-slate-500 text-sm max-w-[160px] truncate'>
                          {classSession.notes ?? '—'}
                        </td>
                        <td className='px-6 py-4 text-right'>
                          <div className='flex items-center justify-end gap-1'>
                            {classSession.gcalSyncStatus === 'failed' ? (
                              <Button
                                type='button'
                                onClick={() => retrySync(classSession.id)}
                                title={t('classes.gcalSyncFailed')}
                                className='p-1.5 text-red-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors'
                              >
                                <span className='material-symbols-outlined text-base'>
                                  sync_problem
                                </span>
                              </Button>
                            ) : (
                              <span
                                title={
                                  classSession.googleCalendarId
                                    ? t('classes.gcalSynced')
                                    : t('classes.gcalNotSynced')
                                }
                                className={`material-symbols-outlined text-base ${classSession.googleCalendarId ? 'text-emerald-400' : 'text-slate-200'}`}
                              >
                                {classSession.googleCalendarId
                                  ? 'event_available'
                                  : 'calendar_month'}
                              </span>
                            )}
                            <Button
                              type='button'
                              onClick={() => setEditingClass(classSession)}
                              className='p-1.5 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors'
                            >
                              <span className='material-symbols-outlined text-base'>edit</span>
                            </Button>
                            <Button
                              type='button'
                              onClick={() => requestDelete(classSession.id)}
                              className='p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors'
                            >
                              <span className='material-symbols-outlined text-base'>delete</span>
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <Pagination
              page={page}
              pageCount={pageCount}
              totalCount={totalCount}
              onPage={goToPage}
            />
          </div>
        )
      )}

      {/* Day detail modal */}
      <Modal
        isOpen={!!dayDetailDate}
        onClose={() => setDayDetailDate(null)}
        title={dayDetailDate ? formatDayTitle(dayDetailDate) : ''}
        size='lg'
      >
        {dayDetailDate && (
          <DayView
            date={dayDetailDate}
            classes={dayDetailClasses}
            onEdit={(classSession) => setEditingClass(classSession)}
            onNewClass={handleNewClassFromCalendar}
            onDelete={async (id) => {
              requestDelete(id)
            }}
          />
        )}
      </Modal>

      <Modal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false)
          setNewClassDate(null)
        }}
        title={t('classes.newClass')}
        size='lg'
      >
        <ClassForm
          clients={clients}
          initial={newClassDate ? { classDate: newClassDate } : undefined}
          onSave={handleCreate}
          onCancel={() => {
            setShowCreateModal(false)
            setNewClassDate(null)
          }}
        />
      </Modal>

      <Modal
        isOpen={!!editingClass}
        onClose={() => setEditingClass(null)}
        title={t('classes.editClass')}
        size='lg'
      >
        {editingClass && (
          <ClassForm
            initial={editingClass}
            clients={clients}
            onSave={handleUpdate}
            onCancel={() => setEditingClass(null)}
            onDelete={async () => {
              requestDelete(editingClass.id)
            }}
            onGenerateInvoice={handleGenerateInvoiceFromClass}
          />
        )}
      </Modal>

      <ConfirmationModal
        isOpen={pendingDeleteId !== null}
        variant='danger'
        message={t('classes.deleteConfirm')}
        onConfirm={async () => {
          await confirmDelete()
          setEditingClass(null)
        }}
        onCancel={cancelDelete}
      />
    </div>
  )
}
