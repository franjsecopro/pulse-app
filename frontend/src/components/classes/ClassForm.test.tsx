import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ClassForm } from './ClassForm'

vi.mock('../../i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

const mockClients = [
  { id: 1, name: 'Alice', isActive: true, contracts: [] },
  { id: 2, name: 'Bob', isActive: true, contracts: [] },
] as never

function renderForm(
  overrides: {
    onSave?: ReturnType<typeof vi.fn>
    onCancel?: ReturnType<typeof vi.fn>
    onDelete?: ReturnType<typeof vi.fn>
    initial?: Record<string, unknown>
    isSubmitting?: boolean
  } = {},
) {
  const onSave = overrides.onSave ?? vi.fn()
  const onCancel = overrides.onCancel ?? vi.fn()
  const onDelete = overrides.onDelete
  return render(
    <ClassForm
      initial={overrides.initial as never}
      clients={mockClients as never}
      onSave={onSave as never}
      onCancel={onCancel as never}
      onDelete={onDelete as never}
    />,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('ClassForm', () => {
  describe('native buttons present', () => {
    it('renders the save button with submit type', () => {
      renderForm()
      const saveButton = screen.getByRole('button', { name: /classes\.save/ })
      expect(saveButton).toBeTruthy()
      expect(saveButton.getAttribute('type')).toBe('submit')
    })

    it('renders the cancel button', () => {
      renderForm()
      const cancelButton = screen.getByRole('button', {
        name: /actions\.cancel/,
      })
      expect(cancelButton).toBeTruthy()
      expect(cancelButton.getAttribute('type')).toBe('button')
    })

    it('renders the delete button when onDelete prop is provided', () => {
      renderForm({ onDelete: vi.fn() })
      const deleteButton = screen.getByRole('button', {
        name: /classes\.delete/,
      })
      expect(deleteButton).toBeTruthy()
      expect(deleteButton.getAttribute('type')).toBe('button')
    })

    it('does not render delete button when onDelete prop is not provided', () => {
      renderForm({ onDelete: undefined })
      expect(screen.queryByRole('button', { name: /classes\.delete/ })).toBeNull()
    })
  })

  describe('button handlers', () => {
    it('fires onCancel when cancel button is clicked', () => {
      const onCancel = vi.fn()
      renderForm({ onCancel })
      fireEvent.click(screen.getByRole('button', { name: /actions\.cancel/ }))
      expect(onCancel).toHaveBeenCalledTimes(1)
    })

    it('fires onDelete when delete button is clicked', () => {
      const onDelete = vi.fn()
      renderForm({ onDelete })
      fireEvent.click(screen.getByRole('button', { name: /classes\.delete/ }))
      expect(onDelete).toHaveBeenCalledTimes(1)
    })
  })

  describe('save button visual state', () => {
    it('save button has primary styling (bg-primary)', () => {
      renderForm()
      const saveButton = screen.getByRole('button', { name: /classes\.save/ })
      expect(saveButton.className).toContain('bg-primary')
      expect(saveButton.className).toContain('text-white')
    })

    it('delete button has danger styling (text-red)', () => {
      renderForm({ onDelete: vi.fn() })
      const deleteButton = screen.getByRole('button', {
        name: /classes\.delete/,
      })
      expect(deleteButton.className).toContain('text-red-500')
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
