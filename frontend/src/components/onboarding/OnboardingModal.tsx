import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { useTranslation } from '../../i18n'
import { Button } from '../ui/Button'

interface OnboardingModalProps {
  isOpen: boolean
  /** Called on skip or finish — the caller persists the "seen" flag. */
  onClose: () => void
}

const STEPS = [
  { key: 'step1', icon: 'person_add' },
  { key: 'step2', icon: 'contract' },
  { key: 'step3', icon: 'event_upcoming' },
] as const

/**
 * Three-step tour shown the first time a user lands on an empty Dashboard:
 * create a client → define their contract → schedule classes or import a
 * bank statement.
 */
export function OnboardingModal({ isOpen, onClose }: OnboardingModalProps) {
  const { t } = useTranslation()
  const [stepIndex, setStepIndex] = useState(0)

  if (!isOpen) return null

  const step = STEPS[stepIndex]
  const isLastStep = stepIndex === STEPS.length - 1

  const handleClose = () => {
    setStepIndex(0)
    onClose()
  }

  return createPortal(
    <div className='fixed inset-0 z-[9999] flex items-center justify-center p-4'>
      <div className='absolute inset-0 bg-black/50 backdrop-blur-sm' />
      <div className='relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 flex flex-col gap-6'>
        <div className='text-center space-y-1'>
          <p className='text-xs font-semibold text-primary uppercase tracking-wide'>
            {t('onboarding.title')}
          </p>
          <h2 className='text-xl font-black text-slate-900'>{t(`onboarding.${step.key}.title`)}</h2>
        </div>

        <div className='flex flex-col items-center gap-4'>
          <div className='w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center'>
            <span className='material-symbols-outlined text-primary text-3xl'>{step.icon}</span>
          </div>
          <p className='text-sm text-slate-600 text-center leading-relaxed'>
            {t(`onboarding.${step.key}.text`)}
          </p>
        </div>

        {/* Step dots */}
        <div className='flex justify-center gap-2'>
          {STEPS.map((s, i) => (
            <span
              key={s.key}
              className={`w-2 h-2 rounded-full transition-colors ${
                i === stepIndex ? 'bg-primary' : 'bg-slate-200'
              }`}
            />
          ))}
        </div>

        <div className='flex items-center justify-between'>
          <Button
            type='button'
            onClick={handleClose}
            className='text-sm font-medium text-slate-400 hover:text-slate-600 transition-colors'
          >
            {t('onboarding.skip')}
          </Button>
          {isLastStep ? (
            <Link
              to='/clients'
              onClick={handleClose}
              className='inline-flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-lg text-sm font-bold transition-colors'
            >
              <span className='material-symbols-outlined text-[16px]'>rocket_launch</span>
              {t('onboarding.start')}
            </Link>
          ) : (
            <Button
              type='button'
              onClick={() => setStepIndex((i) => i + 1)}
              className='inline-flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-lg text-sm font-bold transition-colors'
            >
              {t('onboarding.next')}
              <span className='material-symbols-outlined text-[16px]'>arrow_forward</span>
            </Button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
