import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ClientForm } from './ClientForm'

vi.mock('../../i18n', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { returnObjects?: boolean }) =>
      options?.returnObjects ? [`mock.${key}.0`, `mock.${key}.1`] : key,
  }),
}))

const mockOnSave = vi.fn()
const mockOnCancel = vi.fn()

function renderForm(
  initial?: Record<string, unknown>,
  overrides: { onSave?: ReturnType<typeof vi.fn>; onCancel?: ReturnType<typeof vi.fn> } = {},
) {
  return render(
    <ClientForm
      {...(initial ? { initial: initial as never } : {})}
      onSave={(overrides.onSave ?? mockOnSave) as never}
      onCancel={(overrides.onCancel ?? mockOnCancel) as never}
    />,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('ClientForm', () => {
  describe('native buttons present', () => {
    it('renders the save button with submit type', () => {
      renderForm()
      const saveButton = screen.getByRole('button', { name: /actions\.save/ })
      expect(saveButton).toBeTruthy()
      expect(saveButton.getAttribute('type')).toBe('submit')
    })

    it('renders the cancel button with type button', () => {
      renderForm()
      const cancelButton = screen.getByRole('button', { name: /actions\.cancel/ })
      expect(cancelButton).toBeTruthy()
      expect(cancelButton.getAttribute('type')).toBe('button')
    })

    it('does not render a delete button', () => {
      renderForm()
      expect(screen.queryByRole('button', { name: /actions\.delete|clients\.delete/ })).toBeNull()
    })
  })

  describe('submit behavior', () => {
    it('fires onSave with form data when submitted in create mode', async () => {
      const onSave = vi.fn().mockResolvedValue(undefined)
      renderForm(undefined, { onSave })

      const nameInput = screen.getByLabelText(/clients\.form\.name/)
      fireEvent.change(nameInput, { target: { value: 'Alice' } })

      const form = document.querySelector('form') as HTMLFormElement
      fireEvent.submit(form)

      expect(onSave).toHaveBeenCalledTimes(1)
      const callArg = onSave.mock.calls[0][0] as { name: string }
      expect(callArg.name).toBe('Alice')
    })

    it('shows "no changes" text on submit when editing and not dirty', () => {
      renderForm({ id: 1, name: 'Alice' })
      const submitButton = screen.getByRole('button', { name: /actions\.noChanges/ })
      expect(submitButton).toBeTruthy()
      expect((submitButton as HTMLButtonElement).disabled).toBe(true)
    })

    it('shows "save" text on submit when editing and dirty', () => {
      renderForm({ id: 1, name: 'Alice' })
      const nameInput = screen.getByLabelText(/clients\.form\.name/)
      fireEvent.change(nameInput, { target: { value: 'Alice Updated' } })

      const submitButton = screen.getByRole('button', { name: /actions\.save/ })
      expect(submitButton).toBeTruthy()
      expect((submitButton as HTMLButtonElement).disabled).toBe(false)
    })

    it('shows error message when onSave rejects', async () => {
      const onSave = vi.fn().mockRejectedValue(new Error('boom'))
      renderForm(undefined, { onSave })

      const nameInput = screen.getByLabelText(/clients\.form\.name/)
      fireEvent.change(nameInput, { target: { value: 'Alice' } })

      const form = document.querySelector('form') as HTMLFormElement
      fireEvent.submit(form)

      expect(await screen.findByText('boom')).toBeTruthy()
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
      const saveButton = screen.getByRole('button', { name: /actions\.save/ })
      expect(saveButton.className).toContain('bg-primary')
      expect(saveButton.className).toContain('text-white')
    })

    it('cancel button has secondary styling (text-slate-600)', () => {
      renderForm()
      const cancelButton = screen.getByRole('button', { name: /actions\.cancel/ })
      expect(cancelButton.className).toContain('text-slate-600')
    })
  })
})
