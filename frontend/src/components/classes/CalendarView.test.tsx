import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ClassSession } from '../../types'
import { CalendarView } from './CalendarView'

vi.mock('../../i18n', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { returnObjects?: boolean }) => {
      if (key === 'common.weekdays.short' && opts?.returnObjects) {
        return ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
      }
      return key
    },
  }),
}))

function makeClass(overrides: Partial<ClassSession> = {}): ClassSession {
  return {
    id: 1,
    userId: 1,
    clientId: 1,
    contractId: null,
    classDate: '2026-06-15',
    classTime: '16:00',
    durationHours: 1.5,
    hourlyRate: 30,
    status: 'normal',
    notes: null,
    googleCalendarId: null,
    gcalSyncStatus: null,
    createdAt: '2026-06-01',
    clientName: 'Juan García',
    contractDescription: null,
    effectiveRevenue: 45,
    ...overrides,
  }
}

const noop = () => {}

function renderCalendar(classes: ClassSession[]) {
  return render(
    <CalendarView
      classes={classes}
      year={2026}
      month={6}
      onEdit={noop}
      onNewClass={noop}
      onDayDetail={noop}
    />,
  )
}

describe('CalendarView planned-hours badge', () => {
  it('shows planned hours for the day, excluding cancellations', () => {
    renderCalendar([
      makeClass({ id: 1, classDate: '2026-06-15', durationHours: 2, status: 'normal' }),
      makeClass({
        id: 2,
        classDate: '2026-06-15',
        durationHours: 1,
        status: 'cancelledWithPayment',
      }),
    ])

    // Only the normal class counts toward planned hours.
    expect(screen.getByText('2h')).toBeTruthy()
  })

  it('does not show an hours badge for a day with only cancelled classes', () => {
    renderCalendar([
      makeClass({
        id: 3,
        classDate: '2026-06-15',
        durationHours: 1,
        status: 'cancelledWithoutPayment',
      }),
    ])

    expect(screen.queryByText('1h')).toBeNull()
  })
})

describe('CalendarView day-hours breakdown tooltip', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-18T12:00:00'))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('reveals worked + excluded cancelled hours on hover', () => {
    renderCalendar([
      makeClass({
        id: 1,
        classDate: '2026-06-15',
        classTime: '10:00:00',
        durationHours: 2,
        status: 'normal',
      }),
      makeClass({
        id: 2,
        classDate: '2026-06-15',
        classTime: '10:00:00',
        durationHours: 1,
        status: 'cancelledWithPayment',
      }),
    ])

    fireEvent.mouseEnter(screen.getByTestId('day-hours-2026-06-15'))

    expect(screen.getByText('calendar.workedHoursLabel')).toBeTruthy()
    expect(screen.getByText('calendar.cancelledHoursExcluded')).toBeTruthy()
  })

  it('omits the cancelled line when there are no cancellations', () => {
    renderCalendar([
      makeClass({
        id: 1,
        classDate: '2026-06-15',
        classTime: '10:00:00',
        durationHours: 2,
        status: 'normal',
      }),
    ])

    fireEvent.mouseEnter(screen.getByTestId('day-hours-2026-06-15'))

    expect(screen.queryByText('calendar.cancelledHoursExcluded')).toBeNull()
  })

  it('shows a planned line for a future day (scheduled but not yet worked)', () => {
    renderCalendar([
      makeClass({
        id: 1,
        classDate: '2026-06-20',
        classTime: '10:00:00',
        durationHours: 1,
        status: 'normal',
      }),
    ])

    // Badge shows the scheduled (planned) load even for a future day.
    expect(screen.getByText('1h')).toBeTruthy()

    fireEvent.mouseEnter(screen.getByTestId('day-hours-2026-06-20'))
    expect(screen.getByText('calendar.plannedHoursLabel')).toBeTruthy()
  })

  it('omits the planned line for a fully past day (worked equals planned)', () => {
    renderCalendar([
      makeClass({
        id: 1,
        classDate: '2026-06-15',
        classTime: '10:00:00',
        durationHours: 2,
        status: 'normal',
      }),
    ])

    fireEvent.mouseEnter(screen.getByTestId('day-hours-2026-06-15'))
    expect(screen.getByText('calendar.workedHoursLabel')).toBeTruthy()
    expect(screen.queryByText('calendar.plannedHoursLabel')).toBeNull()
  })
})

describe('CalendarView weekly totals', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-18T12:00:00'))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('sums worked / planned hours per week (June 15 is a Monday → week 15-21)', () => {
    renderCalendar([
      makeClass({
        id: 1,
        classDate: '2026-06-15',
        classTime: '10:00:00',
        durationHours: 2,
        status: 'normal',
      }),
      makeClass({
        id: 2,
        classDate: '2026-06-16',
        classTime: '10:00:00',
        durationHours: 1,
        status: 'normal',
      }),
      makeClass({
        id: 3,
        classDate: '2026-06-20',
        classTime: '10:00:00',
        durationHours: 3,
        status: 'normal',
      }),
    ])

    // worked = 2 + 1 (the 20th is still in the future), planned = 2 + 1 + 3
    expect(screen.getByText('3 / 6h')).toBeTruthy()
  })
})
