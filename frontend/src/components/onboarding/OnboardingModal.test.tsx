import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { OnboardingModal } from './OnboardingModal'

vi.mock('../../i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

function renderModal(props: Partial<Parameters<typeof OnboardingModal>[0]> = {}) {
  const onClose = vi.fn()
  render(
    <MemoryRouter>
      <OnboardingModal isOpen onClose={onClose} {...props} />
    </MemoryRouter>,
  )
  return { onClose }
}

describe('OnboardingModal', () => {
  it('renders nothing when closed', () => {
    render(
      <MemoryRouter>
        <OnboardingModal isOpen={false} onClose={vi.fn()} />
      </MemoryRouter>,
    )

    expect(screen.queryByText('onboarding.step1.title')).toBeNull()
  })

  it('shows the first step when open', () => {
    renderModal()

    expect(screen.getByText('onboarding.step1.title')).toBeTruthy()
  })

  it('advances through steps with the next button', () => {
    renderModal()

    fireEvent.click(screen.getByText('onboarding.next'))
    expect(screen.getByText('onboarding.step2.title')).toBeTruthy()

    fireEvent.click(screen.getByText('onboarding.next'))
    expect(screen.getByText('onboarding.step3.title')).toBeTruthy()
  })

  it('last step closes via the start button', () => {
    const { onClose } = renderModal()

    fireEvent.click(screen.getByText('onboarding.next'))
    fireEvent.click(screen.getByText('onboarding.next'))
    fireEvent.click(screen.getByText('onboarding.start'))

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('skip closes from any step', () => {
    const { onClose } = renderModal()

    fireEvent.click(screen.getByText('onboarding.skip'))

    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
