import { useState } from 'react'
import { useTranslation } from '../../i18n'

interface Props {
  isOpen: boolean
  entityName: string
  warningMessage: string
  onConfirm: () => void
  onCancel: () => void
}

/**
 * Two-step confirmation modal for destructive actions.
 * Step 1: standard warning with Confirm / Cancel.
 * Step 2: user must type the entity name exactly to unlock the final delete.
 */
export function DoubleConfirmModal({
  isOpen,
  entityName,
  warningMessage,
  onConfirm,
  onCancel,
}: Props) {
  const [step, setStep] = useState<1 | 2>(1)
  const [typed, setTyped] = useState('')
  const { t } = useTranslation()

  if (!isOpen) return null

  const handleCancel = () => {
    setStep(1)
    setTyped('')
    onCancel()
  }

  const handleFirstConfirm = () => setStep(2)

  const handleFinalConfirm = () => {
    setStep(1)
    setTyped('')
    onConfirm()
  }

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4'>
      <div className='bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4'>
        {step === 1 ? (
          <>
            <div className='flex items-start gap-3'>
              <span className='material-symbols-outlined text-red-500 text-2xl mt-0.5'>
                warning
              </span>
              <div>
                <h2 className='font-bold text-slate-900 text-base'>
                  {t('doubleConfirm.step1.title')}
                </h2>
                <p className='text-slate-600 text-sm mt-1'>{warningMessage}</p>
              </div>
            </div>
            <div className='flex justify-end gap-2 pt-2'>
              <button
                type='button'
                onClick={handleCancel}
                className='px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors'
              >
                {t('actions.cancel')}
              </button>
              <button
                type='button'
                onClick={handleFirstConfirm}
                className='px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white text-sm font-medium transition-colors'
              >
                {t('actions.continue')}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className='flex items-start gap-3'>
              <span className='material-symbols-outlined text-red-500 text-2xl mt-0.5'>
                delete_forever
              </span>
              <div className='flex-1'>
                <h2 className='font-bold text-slate-900 text-base'>
                  {t('doubleConfirm.step2.title')}
                </h2>
                <p className='text-slate-600 text-sm mt-1'>
                  {t('doubleConfirm.step2.instruction')}
                </p>
                <p className='font-mono font-semibold text-slate-800 text-sm mt-1 bg-slate-100 rounded px-2 py-1 inline-block'>
                  {entityName}
                </p>
              </div>
            </div>
            <input
              type='text'
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={entityName}
              className='w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300'
            />
            <div className='flex justify-end gap-2'>
              <button
                type='button'
                onClick={handleCancel}
                className='px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors'
              >
                {t('actions.cancel')}
              </button>
              <button
                type='button'
                onClick={handleFinalConfirm}
                disabled={typed !== entityName}
                className='px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors'
              >
                {t('actions.deletePermanently')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
