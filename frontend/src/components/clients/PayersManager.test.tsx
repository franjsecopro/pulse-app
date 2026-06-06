import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PayersManager } from './PayersManager'

vi.mock('../../i18n', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { returnObjects?: boolean }) =>
      options?.returnObjects ? [`mock.${key}.0`, `mock.${key}.1`] : key,
  }),
}))

const mockCreatePayer = vi.fn()
const mockDeletePayer = vi.fn()

vi.mock('../../services/client.service', () => ({
  clientService: {
    createPayer: (...args: unknown[]) => mockCreatePayer(...args),
    deletePayer: (...args: unknown[]) => mockDeletePayer(...args),
  },
}))

const mockOnPayersChanged = vi.fn()

const mockClient = {
  id: 1,
  name: 'Test Client',
  payment_name: null,
  email: null,
  phone: null,
  whatsapp_phone: null,
  address: null,
  tax_id: null,
  payment_timing: 'same_month',
  is_active: true,
  created_at: '2026-01-01',
  contracts: [],
  payers: [],
}

function renderPayers(
  overrides: { client?: Record<string, unknown>; onPayersChanged?: ReturnType<typeof vi.fn> } = {},
) {
  const client = (overrides.client ?? mockClient) as never
  return render(
    <PayersManager
      client={client}
      onPayersChanged={(overrides.onPayersChanged ?? mockOnPayersChanged) as never}
    />,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('PayersManager', () => {
  describe('native buttons present', () => {
    it('renders the add button with submit type', () => {
      renderPayers()
      const addButton = screen.getByRole('button', { name: /actions\.add/ })
      expect(addButton).toBeTruthy()
      expect(addButton.getAttribute('type')).toBe('submit')
    })

    it('renders a delete button (type=button) per existing payer', () => {
      renderPayers({
        client: {
          ...mockClient,
          payers: [
            { id: 10, client_id: 1, name: 'Bank A', info: null, created_at: '2026-01-01' },
            { id: 11, client_id: 1, name: 'Bank B', info: 'iban', created_at: '2026-01-02' },
          ],
        },
      })
      const allButtons = document.querySelectorAll('button')
      const deleteButtons = Array.from(allButtons).filter(
        (button) => button.getAttribute('type') === 'button',
      )
      expect(deleteButtons.length).toBe(2)
      deleteButtons.forEach((btn) => {
        expect(btn.querySelector('.material-symbols-outlined')).toBeTruthy()
      })
    })
  })

  describe('add flow', () => {
    it('add button is disabled when newName input is empty', () => {
      renderPayers()
      const addButton = screen.getByRole('button', { name: /actions\.add/ }) as HTMLButtonElement
      expect(addButton.disabled).toBe(true)
    })

    it('add button becomes enabled when newName is filled', () => {
      const { container } = renderPayers()
      const nameInput = container.querySelector('input') as HTMLInputElement
      fireEvent.change(nameInput, { target: { value: 'Bank X' } })

      const addButton = screen.getByRole('button', { name: /actions\.add/ }) as HTMLButtonElement
      expect(addButton.disabled).toBe(false)
    })

    it('calls clientService.createPayer on submit', async () => {
      const created = {
        id: 99,
        client_id: 1,
        name: 'Bank X',
        info: null,
        created_at: '2026-01-01',
      }
      mockCreatePayer.mockResolvedValue(created)

      const { container } = renderPayers()
      const inputs = container.querySelectorAll('input')
      fireEvent.change(inputs[0], { target: { value: 'Bank X' } })
      fireEvent.change(inputs[1], { target: { value: 'IBAN 1234' } })

      const form = container.querySelector('form') as HTMLFormElement
      fireEvent.submit(form)

      await waitFor(() => {
        expect(mockCreatePayer).toHaveBeenCalledWith(1, {
          name: 'Bank X',
          info: 'IBAN 1234',
        })
      })
    })

    it('fires onPayersChanged after successful add', async () => {
      const created = {
        id: 99,
        client_id: 1,
        name: 'Bank X',
        info: null,
        created_at: '2026-01-01',
      }
      mockCreatePayer.mockResolvedValue(created)

      const { container } = renderPayers()
      const nameInput = container.querySelector('input') as HTMLInputElement
      fireEvent.change(nameInput, { target: { value: 'Bank X' } })

      const form = container.querySelector('form') as HTMLFormElement
      fireEvent.submit(form)

      await waitFor(() => {
        expect(mockOnPayersChanged).toHaveBeenCalledWith(1, [created])
      })
    })

    it('clears input fields after successful add', async () => {
      const created = {
        id: 99,
        client_id: 1,
        name: 'Bank X',
        info: null,
        created_at: '2026-01-01',
      }
      mockCreatePayer.mockResolvedValue(created)

      const { container } = renderPayers()
      const inputs = container.querySelectorAll('input')
      fireEvent.change(inputs[0], { target: { value: 'Bank X' } })

      const form = container.querySelector('form') as HTMLFormElement
      fireEvent.submit(form)

      await waitFor(() => {
        expect((inputs[0] as HTMLInputElement).value).toBe('')
      })
    })
  })

  describe('delete flow', () => {
    it('calls clientService.deletePayer on delete click', async () => {
      mockDeletePayer.mockResolvedValue(undefined)

      renderPayers({
        client: {
          ...mockClient,
          payers: [{ id: 10, client_id: 1, name: 'Bank A', info: null, created_at: '2026-01-01' }],
        },
      })

      const deleteButton = document.querySelector('button[type="button"]') as HTMLButtonElement
      fireEvent.click(deleteButton)

      await waitFor(() => {
        expect(mockDeletePayer).toHaveBeenCalledWith(1, 10)
      })
    })

    it('fires onPayersChanged after delete', async () => {
      mockDeletePayer.mockResolvedValue(undefined)

      renderPayers({
        client: {
          ...mockClient,
          payers: [
            { id: 10, client_id: 1, name: 'Bank A', info: null, created_at: '2026-01-01' },
            { id: 11, client_id: 1, name: 'Bank B', info: null, created_at: '2026-01-02' },
          ],
        },
      })

      const deleteButtons = document.querySelectorAll('button[type="button"]')
      fireEvent.click(deleteButtons[0])

      await waitFor(() => {
        expect(mockOnPayersChanged).toHaveBeenCalledWith(1, [
          { id: 11, client_id: 1, name: 'Bank B', info: null, created_at: '2026-01-02' },
        ])
      })
    })
  })

  describe('add button visual state', () => {
    it('add button has primary styling (bg-primary)', () => {
      renderPayers()
      const addButton = screen.getByRole('button', { name: /actions\.add/ })
      expect(addButton.className).toContain('bg-primary')
      expect(addButton.className).toContain('text-white')
    })
  })
})
