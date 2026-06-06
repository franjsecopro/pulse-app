import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Login } from './Login'

vi.mock('../context/AuthContext', () => ({
  useAuth: vi.fn(),
}))

vi.mock('../i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

import { useAuth } from '../context/AuthContext'

const mockUseAuth = vi.mocked(useAuth)

const mockLogin = vi.fn()
const mockRegister = vi.fn()

function renderLogin() {
  return render(
    <MemoryRouter>
      <Login />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockUseAuth.mockReturnValue({
    user: null,
    isLoading: false,
    login: mockLogin,
    register: mockRegister,
  } as never)
})

describe('Login', () => {
  describe('native buttons present', () => {
    it('renders the submit button with login text by default', () => {
      renderLogin()
      const submitButton = screen.getByRole('button', { name: /auth\.login\.submit/ })
      expect(submitButton).toBeTruthy()
      expect(submitButton.getAttribute('type')).toBe('submit')
    })

    it('renders the toggle mode button', () => {
      renderLogin()
      const toggleButton = screen.getByRole('button', { name: /auth\.toggleToRegister/ })
      expect(toggleButton).toBeTruthy()
      expect(toggleButton.getAttribute('type')).toBe('button')
    })

    it('renders the show/hide password button', () => {
      renderLogin()
      const passwordToggle = document.querySelector('button[type="button"]') as HTMLButtonElement
      expect(passwordToggle).toBeTruthy()
    })
  })

  describe('mode toggle', () => {
    it('switches submit text from login to register when toggle is clicked', () => {
      renderLogin()
      const toggleButton = screen.getByRole('button', { name: /auth\.toggleToRegister/ })
      fireEvent.click(toggleButton)

      const submitButton = screen.getByRole('button', { name: /auth\.register\.submit/ })
      expect(submitButton).toBeTruthy()
    })

    it('switches toggle text to toggleToLogin when in register mode', () => {
      renderLogin()
      const toggleButton = screen.getByRole('button', { name: /auth\.toggleToRegister/ })
      fireEvent.click(toggleButton)

      const newToggle = screen.getByRole('button', { name: /auth\.toggleToLogin/ })
      expect(newToggle).toBeTruthy()
    })
  })

  describe('password visibility', () => {
    it('toggles password input type when eye button is clicked', () => {
      renderLogin()
      const passwordInput = document.querySelector('input[type="password"]') as HTMLInputElement
      expect(passwordInput).toBeTruthy()

      const eyeButton = document.querySelector('button[type="button"]') as HTMLButtonElement
      fireEvent.click(eyeButton)

      const textInput = document.querySelector('input[type="text"]') as HTMLInputElement
      expect(textInput).toBeTruthy()
    })
  })

  describe('submit behavior', () => {
    it('calls login when form is submitted in login mode', async () => {
      mockLogin.mockResolvedValue(undefined)
      renderLogin()

      const emailInput = screen.getByPlaceholderText('auth.fields.emailPlaceholder')
      const passwordInput = document.querySelector('input[type="password"]') as HTMLInputElement
      fireEvent.change(emailInput, { target: { value: 'user@test.com' } })
      fireEvent.change(passwordInput, { target: { value: 'secret123' } })

      const form = document.querySelector('form') as HTMLFormElement
      fireEvent.submit(form)

      expect(mockLogin).toHaveBeenCalledWith('user@test.com', 'secret123')
    })

    it('calls register when form is submitted in register mode', async () => {
      mockRegister.mockResolvedValue(undefined)
      renderLogin()

      const toggleButton = screen.getByRole('button', { name: /auth\.toggleToRegister/ })
      fireEvent.click(toggleButton)

      const emailInput = screen.getByPlaceholderText('auth.fields.emailPlaceholder')
      const passwordInput = document.querySelector('input[type="password"]') as HTMLInputElement
      fireEvent.change(emailInput, { target: { value: 'new@test.com' } })
      fireEvent.change(passwordInput, { target: { value: 'secret456' } })

      const form = document.querySelector('form') as HTMLFormElement
      fireEvent.submit(form)

      expect(mockRegister).toHaveBeenCalledWith('new@test.com', 'secret456')
    })
  })

  describe('submit button visual state', () => {
    it('submit button has the primary styling (bg-primary)', () => {
      renderLogin()
      const submitButton = screen.getByRole('button', { name: /auth\.login\.submit/ })
      expect(submitButton.className).toContain('bg-primary')
      expect(submitButton.className).toContain('text-white')
    })
  })
})
