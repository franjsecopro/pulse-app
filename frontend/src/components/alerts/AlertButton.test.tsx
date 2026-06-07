import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Alert } from '../../types'
import { AlertButton } from './AlertButton'

function makeAlert(month: number, year: number, clientId = 1): Alert {
  return {
    client_id: clientId,
    client_name: `Client ${clientId}`,
    type: 'debt',
    severity: 'error',
    amount: 100,
    month,
    year,
  }
}

describe('AlertButton', () => {
  describe('rendering', () => {
    it('renders a button with the i18n label "Alertas"', () => {
      render(<AlertButton alerts={[]} onClick={() => {}} />)
      expect(screen.getByRole('button', { name: /alertas/i })).toBeTruthy()
    })

    it('renders the inactive notifications icon when there are no alerts', () => {
      render(<AlertButton alerts={[]} onClick={() => {}} />)
      const button = screen.getByRole('button')
      const icon = button.querySelector('.material-symbols-outlined')
      expect(icon?.textContent).toBe('notifications')
    })

    it('renders the active notifications icon when there are alerts', () => {
      render(<AlertButton alerts={[makeAlert(6, 2026)]} onClick={() => {}} />)
      const button = screen.getByRole('button')
      const icon = button.querySelector('.material-symbols-outlined')
      expect(icon?.textContent).toBe('notifications_active')
    })
  })

  describe('count badge', () => {
    it('does NOT render the count badge when there are no alerts', () => {
      render(<AlertButton alerts={[]} onClick={() => {}} />)
      const button = screen.getByRole('button')
      expect(button.querySelector('span[class*="rounded-full"]')).toBeNull()
    })

    it('renders the count badge with the number of alerts', () => {
      render(
        <AlertButton
          alerts={[makeAlert(6, 2026), makeAlert(8, 2026), makeAlert(9, 2026)]}
          onClick={() => {}}
        />,
      )
      const button = screen.getByRole('button')
      const badge = button.querySelector('span[class*="rounded-full"]')
      expect(badge?.textContent).toBe('3')
    })
  })

  describe('disabled state', () => {
    it('disables the button when there are no alerts', () => {
      render(<AlertButton alerts={[]} onClick={() => {}} />)
      expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(true)
    })

    it('enables the button when there is at least one alert', () => {
      render(<AlertButton alerts={[makeAlert(6, 2026)]} onClick={() => {}} />)
      expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(false)
    })

    it('applies opacity-40 and cursor-not-allowed when disabled', () => {
      render(<AlertButton alerts={[]} onClick={() => {}} />)
      const button = screen.getByRole('button')
      expect(button.className).toMatch(/disabled:opacity-40/)
      expect(button.className).toMatch(/disabled:cursor-not-allowed/)
    })
  })

  describe('onClick behavior', () => {
    it('fires onClick when clicked and enabled', () => {
      const handleClick = vi.fn()
      render(<AlertButton alerts={[makeAlert(6, 2026)]} onClick={handleClick} />)
      screen.getByRole('button').click()
      expect(handleClick).toHaveBeenCalledTimes(1)
    })

    it('does NOT fire onClick when disabled', () => {
      const handleClick = vi.fn()
      render(<AlertButton alerts={[]} onClick={handleClick} />)
      ;(screen.getByRole('button') as HTMLButtonElement).click()
      expect(handleClick).not.toHaveBeenCalled()
    })
  })

  describe('color (auto from alert state)', () => {
    it('uses emerald (success) classes when there are no alerts', () => {
      render(<AlertButton alerts={[]} onClick={() => {}} />)
      const button = screen.getByRole('button')
      expect(button.className).toMatch(/bg-emerald-600/)
      expect(button.className).not.toMatch(/bg-red-600/)
    })

    it('uses red (alert) classes when there are alerts', () => {
      render(<AlertButton alerts={[makeAlert(6, 2026)]} onClick={() => {}} />)
      const button = screen.getByRole('button')
      expect(button.className).toMatch(/bg-red-600/)
      expect(button.className).not.toMatch(/bg-emerald-600/)
    })
  })

  describe('tooltip', () => {
    it('links the button to the tooltip via aria-describedby', () => {
      render(<AlertButton alerts={[]} onClick={() => {}} />)
      const button = screen.getByRole('button')
      const describedBy = button.getAttribute('aria-describedby')
      expect(describedBy).toBeTruthy()
      expect(document.getElementById(describedBy ?? '')).not.toBeNull()
    })

    it('renders the tooltip above the button (position top)', () => {
      render(<AlertButton alerts={[]} onClick={() => {}} />)
      const tooltip = screen.getByRole('tooltip')
      expect(tooltip.className).toMatch(/bottom-full/)
    })

    it('renders the "ok" tooltip text when there are no alerts', () => {
      render(<AlertButton alerts={[]} onClick={() => {}} />)
      expect(screen.getByRole('tooltip').textContent).toMatch(/todo al día/i)
    })

    it('renders the month labels in the tooltip when there are alerts', () => {
      render(<AlertButton alerts={[makeAlert(6, 2026), makeAlert(8, 2026)]} onClick={() => {}} />)
      const tooltip = screen.getByRole('tooltip')
      expect(tooltip.textContent).toMatch(/junio 2026/)
      expect(tooltip.textContent).toMatch(/agosto 2026/)
    })

    it('deduplicates repeated month/year entries in the tooltip', () => {
      render(
        <AlertButton alerts={[makeAlert(6, 2026, 1), makeAlert(6, 2026, 2)]} onClick={() => {}} />,
      )
      const tooltip = screen.getByRole('tooltip')
      const occurrences = (tooltip.textContent?.match(/junio 2026/g) ?? []).length
      expect(occurrences).toBe(1)
    })
  })
})
