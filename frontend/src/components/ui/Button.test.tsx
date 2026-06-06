import { render, screen } from '@testing-library/react'
import { createRef } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { Button } from './Button'

describe('Button', () => {
  describe('rendering', () => {
    it('renders children inside the button', () => {
      render(<Button>Save</Button>)
      expect(screen.getByRole('button', { name: 'Save' })).toBeTruthy()
    })

    it('renders as a <button> element', () => {
      render(<Button>Save</Button>)
      expect(screen.getByRole('button').tagName).toBe('BUTTON')
    })
  })

  describe('type attribute', () => {
    it('defaults to type="button" to prevent accidental form submission', () => {
      render(<Button>Save</Button>)
      expect(screen.getByRole('button').getAttribute('type')).toBe('button')
    })

    it('accepts type="submit"', () => {
      render(<Button type='submit'>Submit</Button>)
      expect(screen.getByRole('button').getAttribute('type')).toBe('submit')
    })

    it('accepts type="reset"', () => {
      render(<Button type='reset'>Reset</Button>)
      expect(screen.getByRole('button').getAttribute('type')).toBe('reset')
    })
  })

  describe('disabled state', () => {
    it('disables the button when disabled is true', () => {
      render(<Button disabled>Save</Button>)
      expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(true)
    })

    it('disables the button when loading is true', () => {
      render(<Button loading>Save</Button>)
      expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(true)
    })

    it('does NOT set aria-busy when only disabled (not loading)', () => {
      render(<Button disabled>Save</Button>)
      expect(screen.getByRole('button').getAttribute('aria-busy')).toBeNull()
    })
  })

  describe('loading state', () => {
    it('sets aria-busy="true" when loading', () => {
      render(<Button loading>Save</Button>)
      expect(screen.getByRole('button').getAttribute('aria-busy')).toBe('true')
    })

    it('does not set aria-busy when not loading', () => {
      render(<Button>Save</Button>)
      expect(screen.getByRole('button').getAttribute('aria-busy')).toBeNull()
    })
  })

  describe('onClick behavior', () => {
    it('fires onClick when clicked', () => {
      const handleClick = vi.fn()
      render(<Button onClick={handleClick}>Click</Button>)
      screen.getByRole('button').click()
      expect(handleClick).toHaveBeenCalledTimes(1)
    })

    it('does NOT fire onClick when disabled', () => {
      const handleClick = vi.fn()
      render(
        <Button disabled onClick={handleClick}>
          Click
        </Button>,
      )
      ;(screen.getByRole('button') as HTMLButtonElement).click()
      expect(handleClick).not.toHaveBeenCalled()
    })

    it('does NOT fire onClick when loading', () => {
      const handleClick = vi.fn()
      render(
        <Button loading onClick={handleClick}>
          Click
        </Button>,
      )
      ;(screen.getByRole('button') as HTMLButtonElement).click()
      expect(handleClick).not.toHaveBeenCalled()
    })
  })

  describe('props passthrough', () => {
    it('passes className to the rendered button (no default classes added)', () => {
      render(<Button className='my-custom-class'>Save</Button>)
      expect(screen.getByRole('button').className).toBe('my-custom-class')
    })

    it('spreads additional HTML attributes (title, data-testid, aria-label)', () => {
      render(
        <Button title='Click me' data-testid='my-button' aria-label='save button'>
          Save
        </Button>,
      )
      const button = screen.getByTestId('my-button')
      expect(button.getAttribute('title')).toBe('Click me')
      expect(button.getAttribute('aria-label')).toBe('save button')
    })

    it('forwards ref to the underlying button element', () => {
      const ref = createRef<HTMLButtonElement>()
      render(<Button ref={ref}>Save</Button>)
      expect(ref.current).toBeInstanceOf(HTMLButtonElement)
    })
  })
})
