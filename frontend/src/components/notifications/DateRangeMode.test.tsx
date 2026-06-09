import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../../i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  default: { language: 'es-ES' },
}))

import { DateRangeMode } from './DateRangeMode'

const DEFAULT_DATE = '2026-06-09'

function renderDateRangeMode(props: Partial<React.ComponentProps<typeof DateRangeMode>> = {}) {
  const onModeChange = vi.fn()
  const onDateChange = vi.fn()
  const utils = render(
    <DateRangeMode
      mode='day'
      date={DEFAULT_DATE}
      onDateChange={onDateChange}
      onModeChange={onModeChange}
      {...props}
    />,
  )
  return { onModeChange, onDateChange, ...utils }
}

describe('DateRangeMode', () => {
  describe('mode control visibility', () => {
    it('hides the mode control when onModeChange is omitted and not locked', () => {
      renderDateRangeMode({ onModeChange: undefined, modeLocked: false })
      expect(screen.queryByRole('radiogroup')).toBeNull()
    })

    it('shows the mode control when onModeChange is provided', () => {
      renderDateRangeMode({ onModeChange: vi.fn() })
      expect(screen.getByRole('radiogroup')).toBeTruthy()
    })

    it('shows the mode control (disabled) when modeLocked is true', () => {
      renderDateRangeMode({ onModeChange: undefined, modeLocked: true })
      expect(screen.getByRole('radiogroup')).toBeTruthy()
      expect(screen.getByRole('radiogroup').getAttribute('aria-disabled')).toBe('true')
    })
  })

  describe('radio inputs (semantic, not faked)', () => {
    it('renders three real <input type="radio"> elements inside the radiogroup', () => {
      renderDateRangeMode({ onModeChange: vi.fn() })
      const radios = screen.getAllByRole('radio') as HTMLInputElement[]
      expect(radios).toHaveLength(3)
      expect(radios.every((r) => r.tagName === 'INPUT')).toBe(true)
      expect(radios.every((r) => r.type === 'radio')).toBe(true)
    })

    it('groups all radios under the same name so they behave as one group', () => {
      renderDateRangeMode({ onModeChange: vi.fn() })
      const radios = screen.getAllByRole('radio') as HTMLInputElement[]
      const names = new Set(radios.map((r) => r.name))
      expect(names.size).toBe(1)
    })

    it('marks only the active mode as checked', () => {
      renderDateRangeMode({ mode: 'week', onModeChange: vi.fn() })
      const radios = screen.getAllByRole('radio') as HTMLInputElement[]
      const checked = radios.filter((r) => r.checked)
      expect(checked).toHaveLength(1)
      expect(checked[0]?.value).toBe('week')
    })

    it('hides the radios visually with the sr-only class', () => {
      renderDateRangeMode({ onModeChange: vi.fn() })
      const radios = screen.getAllByRole('radio') as HTMLInputElement[]
      expect(radios.every((r) => r.className.includes('sr-only'))).toBe(true)
    })
  })

  describe('mode change behavior', () => {
    it.each([
      ['day', 'week'],
      ['week', 'month'],
      ['month', 'day'],
    ] as const)('calls onModeChange with "%s" when switching from "%s"', (currentMode, nextMode) => {
      const onModeChange = vi.fn()
      renderDateRangeMode({ mode: currentMode, onModeChange })
      const radio = screen.getByRole('radio', {
        name: `notifications.mode.${nextMode}`,
      }) as HTMLInputElement
      fireEvent.click(radio)
      expect(onModeChange).toHaveBeenCalledWith(nextMode)
    })

    it('does NOT call onModeChange when modeLocked is true', () => {
      const onModeChange = vi.fn()
      renderDateRangeMode({ mode: 'day', onModeChange, modeLocked: true })
      const radios = screen.getAllByRole('radio') as HTMLInputElement[]
      // Native disabled inputs block user interaction at the browser level,
      // so clicking a disabled radio should not fire onChange.
      fireEvent.click(radios[0] as HTMLInputElement)
      expect(onModeChange).not.toHaveBeenCalled()
      expect(radios.every((r) => r.disabled)).toBe(true)
    })
  })

  describe('modeLocked visual state', () => {
    it('disables every radio input when modeLocked is true', () => {
      renderDateRangeMode({ modeLocked: true })
      const radios = screen.getAllByRole('radio') as HTMLInputElement[]
      expect(radios.every((r) => r.disabled)).toBe(true)
    })

    it('applies opacity-60 to the radiogroup container when modeLocked is true', () => {
      renderDateRangeMode({ modeLocked: true })
      const group = screen.getByRole('radiogroup')
      expect(group.className).toMatch(/opacity-60/)
    })
  })

  describe('date input', () => {
    it('always renders the date input regardless of mode control visibility', () => {
      renderDateRangeMode({ onModeChange: undefined, modeLocked: false })
      const dateInput = screen.getByLabelText('notifications.dateLabel') as HTMLInputElement
      expect(dateInput).toBeTruthy()
      expect(dateInput.type).toBe('date')
      expect(dateInput.value).toBe(DEFAULT_DATE)
    })

    it('calls onDateChange when the user picks a new date', () => {
      const onDateChange = vi.fn()
      renderDateRangeMode({ onDateChange })
      const dateInput = screen.getByLabelText('notifications.dateLabel') as HTMLInputElement
      fireEvent.change(dateInput, { target: { value: '2026-07-15' } })
      expect(onDateChange).toHaveBeenCalledWith('2026-07-15')
    })
  })

  describe('context text', () => {
    it('uses the day-range i18n key when mode is "day"', () => {
      renderDateRangeMode({ mode: 'day' })
      expect(screen.getByText(/notifications\.range\.day/)).toBeTruthy()
    })

    it('uses the week-range i18n key when mode is "week"', () => {
      renderDateRangeMode({ mode: 'week' })
      expect(screen.getByText(/notifications\.range\.week/)).toBeTruthy()
    })

    it('uses the month-range i18n key when mode is "month"', () => {
      renderDateRangeMode({ mode: 'month' })
      expect(screen.getByText(/notifications\.range\.month/)).toBeTruthy()
    })
  })
})
