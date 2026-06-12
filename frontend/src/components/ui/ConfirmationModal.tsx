import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from '../../i18n'
import { Button } from './Button'

type ConfirmationVariant = 'simple' | 'danger' | 'typed'

interface ConfirmationModalProps {
  isOpen: boolean
  /**
   * - `simple`: neutral confirmation (primary button)
   * - `danger`: destructive action (red button + delete icon)
   * - `typed`: high-risk destructive action — two steps, the user must type
   *   `entityName` exactly to unlock the final confirm
   */
  variant?: ConfirmationVariant
  title?: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  isLoading?: boolean
  /** Required for variant `typed` — the exact string the user must type. */
  entityName?: string
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmationModal({
  isOpen,
  variant = 'simple',
  title,
  message,
  confirmLabel,
  cancelLabel,
  isLoading = false,
  entityName = '',
  onConfirm,
  onCancel,
}: ConfirmationModalProps) {
  const { t } = useTranslation()
  const [step, setStep] = useState<1 | 2>(1)
  const [typed, setTyped] = useState('')

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setStep(1)
        setTyped('')
        onCancel()
      }
    }
    if (isOpen) document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, onCancel])

  if (!isOpen) return null

  const isDestructive = variant === 'danger' || variant === 'typed'
  const isTypedStep = variant === 'typed' && step === 2

  const resolvedTitle =
    title ??
    (variant === 'typed'
      ? t(isTypedStep ? 'doubleConfirm.step2.title' : 'doubleConfirm.step1.title')
      : variant === 'danger'
        ? t('actions.confirmDelete')
        : t('actions.confirm'))

  const resolvedConfirmLabel = isTypedStep
    ? t('actions.deletePermanently')
    : (confirmLabel ??
      (variant === 'typed'
        ? t('actions.continue')
        : variant === 'danger'
          ? t('actions.delete')
          : t('actions.confirm')))

  const resolvedCancelLabel = cancelLabel ?? t('actions.cancel')

  const icon = isTypedStep ? 'delete_forever' : variant === 'typed' ? 'warning' : 'delete'

  const reset = () => {
    setStep(1)
    setTyped('')
  }

  const handleCancel = () => {
    reset()
    onCancel()
  }

  const handleConfirm = () => {
    if (variant === 'typed' && step === 1) {
      setStep(2)
      return
    }
    reset()
    onConfirm()
  }

  const confirmDisabled = isLoading || (isTypedStep && typed !== entityName)

  return createPortal(
    <div className='fixed inset-0 z-[9999] flex items-center justify-center p-4'>
      <Button
        type='button'
        className='absolute inset-0 bg-black/50 backdrop-blur-sm border-0 cursor-default w-full'
        onClick={handleCancel}
        aria-label='Close'
      />
      <div className='relative bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 flex flex-col gap-5'>
        <div className='flex items-start gap-4'>
          {isDestructive && (
            <div className='shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center'>
              <span className='material-symbols-outlined text-red-500 text-xl'>{icon}</span>
            </div>
          )}
          <div className='flex-1'>
            <p className='font-bold text-slate-900 text-sm'>{resolvedTitle}</p>
            <p className='text-slate-500 text-sm mt-1'>
              {isTypedStep ? t('doubleConfirm.step2.instruction') : message}
            </p>
            {isTypedStep && (
              <p className='font-mono font-semibold text-slate-800 text-sm mt-1 bg-slate-100 rounded px-2 py-1 inline-block'>
                {entityName}
              </p>
            )}
          </div>
        </div>
        {isTypedStep && (
          <input
            type='text'
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={entityName}
            className='w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300'
          />
        )}
        <div className='flex justify-end gap-3'>
          <Button
            type='button'
            onClick={handleCancel}
            loading={isLoading}
            className='px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-60'
          >
            {resolvedCancelLabel}
          </Button>
          <Button
            type='button'
            onClick={handleConfirm}
            disabled={confirmDisabled}
            className={`px-5 py-2 rounded-lg text-sm font-bold text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
              isDestructive
                ? 'bg-red-500 hover:bg-red-600 shadow-md shadow-red-200'
                : 'bg-primary hover:bg-primary-hover'
            }`}
          >
            {isLoading ? (
              <span className='material-symbols-outlined inline animate-spin'>sync</span>
            ) : (
              resolvedConfirmLabel
            )}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
