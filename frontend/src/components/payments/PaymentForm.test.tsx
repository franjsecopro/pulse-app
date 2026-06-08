import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PaymentForm } from './PaymentForm'

vi.mock('../../i18n', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { returnObjects?: boolean }) =>
      options?.returnObjects ? [`mock.${key}.0`, `mock.${key}.1`] : key,
  }),
}))

const mockOnSave = vi.fn()
const mockOnCancel = vi.fn()

const mockClients = [
  { id: 1, name: 'Alice', isActive: true, contracts: [] },
  { id: 2, name: 'Bob', isActive: true, contracts: [] },
] as never

function renderForm(
  initial?: Record<string, unknown>,
  overrides: {
    onSave?: ReturnType<typeof vi.fn>
    onCancel?: ReturnType<typeof vi.fn>
  } = {},
) {
  return render(
    <PaymentForm
      clients={mockClients}
      {...(initial ? { initial: initial as never } : {})}
      onSave={(overrides.onSave ?? mockOnSave) as never}
      onCancel={(overrides.onCancel ?? mockOnCancel) as never}
    />,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('PaymentForm', () => {
  describe('native buttons present', () => {
    it('renders the create button with submit type', () => {
      renderForm()
      const createButton = screen.getByRole('button', {
        name: /payments\.create/,
      })
      expect(createButton).toBeTruthy()
      expect(createButton.getAttribute('type')).toBe('submit')
    })

    it('renders the cancel button with type button', () => {
      renderForm()
      const cancelButton = screen.getByRole('button', {
        name: /actions\.cancel/,
      })
      expect(cancelButton).toBeTruthy()
      expect(cancelButton.getAttribute('type')).toBe('button')
    })
  })

  describe('client select', () => {
    it('renders the clients as options in the select', () => {
      renderForm()
      const select = document.getElementById('payment-client') as HTMLSelectElement
      const optionTexts = Array.from(select.options).map((option) => option.textContent)
      expect(optionTexts).toContain('Alice')
      expect(optionTexts).toContain('Bob')
    })
  })

  describe('submit behavior', () => {
    it('fires onSave with formatted data (concept and notes null when empty)', async () => {
      const onSave = vi.fn().mockResolvedValue(undefined)
      renderForm(undefined, { onSave })

      const amountInput = document.getElementById('payment-amount') as HTMLInputElement
      fireEvent.change(amountInput, { target: { value: '150' } })

      const form = document.querySelector('form') as HTMLFormElement
      fireEvent.submit(form)

      expect(onSave).toHaveBeenCalledTimes(1)
      const arg = onSave.mock.calls[0][0] as Record<string, unknown>
      expect(arg.amount).toBe(150)
      expect(arg.concept).toBeNull()
      expect(arg.notes).toBeNull()
    })

    it('preserves non-empty concept and notes', async () => {
      const onSave = vi.fn().mockResolvedValue(undefined)
      renderForm(undefined, { onSave })

      const amountInput = document.getElementById('payment-amount') as HTMLInputElement
      const conceptInput = document.getElementById('payment-concept') as HTMLInputElement
      const notesInput = document.getElementById('payment-notes') as HTMLInputElement

      fireEvent.change(amountInput, { target: { value: '200' } })
      fireEvent.change(conceptInput, { target: { value: 'June classes' } })
      fireEvent.change(notesInput, { target: { value: 'cash' } })

      const form = document.querySelector('form') as HTMLFormElement
      fireEvent.submit(form)

      const arg = onSave.mock.calls[0][0] as Record<string, unknown>
      expect(arg.concept).toBe('June classes')
      expect(arg.notes).toBe('cash')
    })

    it('shows error message when onSave rejects', async () => {
      const onSave = vi.fn().mockRejectedValue(new Error('save failed'))
      renderForm(undefined, { onSave })

      const amountInput = document.getElementById('payment-amount') as HTMLInputElement
      fireEvent.change(amountInput, { target: { value: '100' } })

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

  describe('button visual state', () => {
    it('create button has primary styling (bg-primary)', () => {
      renderForm()
      const createButton = screen.getByRole('button', {
        name: /payments\.create/,
      })
      expect(createButton.className).toContain('bg-primary')
      expect(createButton.className).toContain('text-white')
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
