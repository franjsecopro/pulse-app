import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ContractForm } from './ContractForm'

vi.mock('../../i18n', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { returnObjects?: boolean }) => {
      if (options?.returnObjects) {
        if (key === 'common.weekdays.short') {
          return ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
        }
        return [`mock.${key}.0`, `mock.${key}.1`]
      }
      return key
    },
  }),
}))

const mockOnSave = vi.fn()
const mockOnCancel = vi.fn()

function renderForm(
  initial?: Record<string, unknown>,
  overrides: {
    onSave?: ReturnType<typeof vi.fn>
    onCancel?: ReturnType<typeof vi.fn>
  } = {},
) {
  return render(
    <ContractForm
      {...(initial ? { initial: initial as never } : {})}
      onSave={(overrides.onSave ?? mockOnSave) as never}
      onCancel={(overrides.onCancel ?? mockOnCancel) as never}
    />,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('ContractForm', () => {
  describe('native buttons present', () => {
    it('renders the save button with submit type', () => {
      renderForm()
      const saveButton = screen.getByRole('button', {
        name: /contracts\.save/,
      })
      expect(saveButton).toBeTruthy()
      expect(saveButton.getAttribute('type')).toBe('submit')
    })

    it('renders the cancel button with type button', () => {
      renderForm()
      const cancelButton = screen.getByRole('button', {
        name: /actions\.cancel/,
      })
      expect(cancelButton).toBeTruthy()
      expect(cancelButton.getAttribute('type')).toBe('button')
    })

    it('renders 7 weekday toggle buttons (type=button)', () => {
      renderForm()
      const weekdayButtons = screen.getAllByRole('button', {
        name: /^(Lun|Mar|Mié|Jue|Vie|Sáb|Dom)$/,
      })
      expect(weekdayButtons.length).toBe(7)
      weekdayButtons.forEach((btn) => {
        expect(btn.getAttribute('type')).toBe('button')
      })
    })
  })

  describe('weekday toggle behavior', () => {
    it('starts inactive (bg-white) and becomes active (bg-primary) on click', () => {
      renderForm()
      const monday = screen.getByRole('button', { name: 'Lun' })
      expect(monday.className).toContain('bg-white')
      expect(monday.className).not.toContain('bg-primary')

      fireEvent.click(monday)
      expect(monday.className).toContain('bg-primary')
      expect(monday.className).not.toContain('bg-white')
    })

    it('toggles back to inactive when clicked again', () => {
      renderForm()
      const monday = screen.getByRole('button', { name: 'Lun' })
      fireEvent.click(monday)
      fireEvent.click(monday)
      expect(monday.className).toContain('bg-white')
      expect(monday.className).not.toContain('bg-primary')
    })

    it('does not show time inputs until a weekday is selected', () => {
      renderForm()
      expect(document.querySelector('input[type="time"]')).toBeNull()
    })

    it('shows two time inputs per active weekday', () => {
      renderForm()
      fireEvent.click(screen.getByRole('button', { name: 'Lun' }))
      const timeInputs = document.querySelectorAll('input[type="time"]')
      expect(timeInputs.length).toBe(2)
    })
  })

  describe('submit behavior', () => {
    it('fires onSave with formatted data (null for empty optional fields)', async () => {
      const onSave = vi.fn().mockResolvedValue(undefined)
      renderForm(undefined, { onSave })

      const descInput = screen.getByLabelText(/contracts\.form\.description/)
      fireEvent.change(descInput, { target: { value: 'Math tutoring' } })

      const form = document.querySelector('form') as HTMLFormElement
      fireEvent.submit(form)

      expect(onSave).toHaveBeenCalledTimes(1)
      const arg = onSave.mock.calls[0][0] as Record<string, unknown>
      expect(arg.description).toBe('Math tutoring')
      expect(arg.endDate).toBeNull()
      expect(arg.phone).toBeNull()
      expect(arg.scheduleDays).toBeNull()
      expect(arg.calendarDescription).toBeNull()
    })

    it('includes scheduleDays when a weekday is toggled', async () => {
      const onSave = vi.fn().mockResolvedValue(undefined)
      renderForm(undefined, { onSave })

      fireEvent.click(screen.getByRole('button', { name: 'Lun' }))

      const form = document.querySelector('form') as HTMLFormElement
      fireEvent.submit(form)

      const arg = onSave.mock.calls[0][0] as {
        scheduleDays: Record<string, unknown> | null
      }
      expect(arg.scheduleDays).toEqual({
        '0': { start: '09:00', end: '10:00' },
      })
    })

    it('shows error when endDate is before startDate', async () => {
      const onSave = vi.fn()
      renderForm({ startDate: '2025-06-15', endDate: '2025-06-10' }, { onSave })

      const form = document.querySelector('form') as HTMLFormElement
      fireEvent.submit(form)

      expect(onSave).not.toHaveBeenCalled()
      expect(await screen.findByText('contracts.errors.startAfterEnd')).toBeTruthy()
    })

    it('shows error when a day schedule has end before start', async () => {
      const onSave = vi.fn()
      renderForm(undefined, { onSave })

      fireEvent.click(screen.getByRole('button', { name: 'Lun' }))
      const timeInputs = document.querySelectorAll('input[type="time"]')
      fireEvent.change(timeInputs[0], { target: { value: '14:00' } })
      fireEvent.change(timeInputs[1], { target: { value: '13:00' } })

      const form = document.querySelector('form') as HTMLFormElement
      fireEvent.submit(form)

      expect(onSave).not.toHaveBeenCalled()
      expect(await screen.findByText('contracts.errors.endBeforeStart')).toBeTruthy()
    })

    it('shows error message when onSave rejects', async () => {
      const onSave = vi.fn().mockRejectedValue(new Error('save failed'))
      renderForm(undefined, { onSave })

      const descInput = screen.getByLabelText(/contracts\.form\.description/)
      fireEvent.change(descInput, { target: { value: 'Math tutoring' } })

      const form = document.querySelector('form') as HTMLFormElement
      fireEvent.submit(form)

      expect(await screen.findByText('save failed')).toBeTruthy()
    })
  })

  describe('button handlers', () => {
    it('fires onCancel when cancel button is clicked', () => {
      renderForm()
      fireEvent.click(screen.getByRole('button', { name: /actions\.cancel/ }))
      expect(mockOnCancel).toHaveBeenCalledTimes(1)
    })
  })

  describe('save button visual state', () => {
    it('save button has primary styling (bg-primary)', () => {
      renderForm()
      const saveButton = screen.getByRole('button', {
        name: /contracts\.save/,
      })
      expect(saveButton.className).toContain('bg-primary')
      expect(saveButton.className).toContain('text-white')
    })

    it('cancel button has secondary styling (text-slate-600)', () => {
      renderForm()
      const cancelButton = screen.getByRole('button', {
        name: /actions\.cancel/,
      })
      expect(cancelButton.className).toContain('text-slate-600')
    })
  })
})
