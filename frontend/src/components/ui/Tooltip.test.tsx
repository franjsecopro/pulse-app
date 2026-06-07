import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Tooltip } from './Tooltip'

describe('Tooltip', () => {
  describe('trigger', () => {
    it('renders the children as the tooltip trigger', () => {
      render(
        <Tooltip content='Hello'>
          <button type='button'>Trigger</button>
        </Tooltip>,
      )
      expect(screen.getByRole('button', { name: 'Trigger' })).toBeTruthy()
    })

    it('links the trigger to the tooltip via aria-describedby', () => {
      render(
        <Tooltip content='Hello'>
          <button type='button'>Trigger</button>
        </Tooltip>,
      )
      const trigger = screen.getByRole('button', { name: 'Trigger' })
      const describedBy = trigger.getAttribute('aria-describedby')
      expect(describedBy).toBeTruthy()
      expect(document.getElementById(describedBy ?? '')).not.toBeNull()
    })
  })

  describe('content', () => {
    it('renders the content with role="tooltip"', () => {
      render(
        <Tooltip content='Hello world'>
          <button type='button'>Trigger</button>
        </Tooltip>,
      )
      expect(screen.getByRole('tooltip').textContent).toBe('Hello world')
    })

    it('uses the same id on the tooltip element that aria-describedby points to', () => {
      render(
        <Tooltip content='Hello'>
          <button type='button'>Trigger</button>
        </Tooltip>,
      )
      const trigger = screen.getByRole('button', { name: 'Trigger' })
      const tooltip = screen.getByRole('tooltip')
      expect(trigger.getAttribute('aria-describedby')).toBe(tooltip.id)
    })

    it('hides the content by default (visibility controlled by group hover/focus)', () => {
      render(
        <Tooltip content='Hidden until hover'>
          <button type='button'>Trigger</button>
        </Tooltip>,
      )
      const tooltip = screen.getByRole('tooltip')
      expect(tooltip.className).toMatch(/invisible/)
      expect(tooltip.className).toMatch(/group-hover:visible/)
      expect(tooltip.className).toMatch(/group-focus:visible/)
    })
  })

  describe('position prop', () => {
    it('defaults to top position (tooltip above the trigger)', () => {
      render(
        <Tooltip content='Hello'>
          <button type='button'>Trigger</button>
        </Tooltip>,
      )
      const tooltip = screen.getByRole('tooltip')
      expect(tooltip.className).toMatch(/bottom-full/)
      expect(tooltip.className).toMatch(/mb-/)
    })

    it('renders below the trigger when position="bottom"', () => {
      render(
        <Tooltip content='Hello' position='bottom'>
          <button type='button'>Trigger</button>
        </Tooltip>,
      )
      const tooltip = screen.getByRole('tooltip')
      expect(tooltip.className).toMatch(/top-full/)
      expect(tooltip.className).toMatch(/mt-/)
    })

    it('renders to the right of the trigger when position="right"', () => {
      render(
        <Tooltip content='Hello' position='right'>
          <button type='button'>Trigger</button>
        </Tooltip>,
      )
      const tooltip = screen.getByRole('tooltip')
      expect(tooltip.className).toMatch(/left-full/)
      expect(tooltip.className).toMatch(/ml-/)
    })

    it('renders to the left of the trigger when position="left"', () => {
      render(
        <Tooltip content='Hello' position='left'>
          <button type='button'>Trigger</button>
        </Tooltip>,
      )
      const tooltip = screen.getByRole('tooltip')
      expect(tooltip.className).toMatch(/right-full/)
      expect(tooltip.className).toMatch(/mr-/)
    })
  })

  describe('wrapper', () => {
    it('wraps the trigger in a relative inline-block group container', () => {
      const { container } = render(
        <Tooltip content='Hello'>
          <button type='button'>Trigger</button>
        </Tooltip>,
      )
      const wrapper = container.firstElementChild
      expect(wrapper?.className).toMatch(/relative/)
      expect(wrapper?.className).toMatch(/inline-block/)
      expect(wrapper?.className).toMatch(/\bgroup\b/)
    })

    it('accepts a custom className on the wrapper for positioning context', () => {
      const { container } = render(
        <Tooltip content='Hello' className='block w-full'>
          <button type='button'>Trigger</button>
        </Tooltip>,
      )
      const wrapper = container.firstElementChild
      expect(wrapper?.className).toMatch(/block/)
      expect(wrapper?.className).toMatch(/w-full/)
    })
  })
})
