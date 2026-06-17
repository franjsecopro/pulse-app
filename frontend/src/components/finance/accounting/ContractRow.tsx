import type { ContractBreakdown } from '../../../types'

interface ContractRowProps {
  contract: ContractBreakdown
  t: (key: string, options?: Record<string, unknown>) => string
}

export function ContractRow({ contract, t }: ContractRowProps) {
  return (
    <tr className='bg-slate-50/70 border-t border-slate-100'>
      <td className='pl-16 pr-4 py-3' colSpan={1}>
        <div className='flex items-center gap-2'>
          <span className='material-symbols-outlined text-sm text-slate-400'>description</span>
          <span className='text-sm font-medium text-slate-700'>{contract.contractDescription}</span>
          <span className='text-xs text-slate-400'>
            · €{contract.hourlyRate}/{t('common.units.hoursShort')}
          </span>
        </div>
        <div className='flex items-center gap-3 mt-1.5 pl-6 flex-wrap'>
          {contract.normalCount > 0 && (
            <span className='inline-flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full'>
              <span className='w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block' />
              {t('accounting.contract.normal', {
                count: contract.normalCount,
              })}
            </span>
          )}
          {contract.cancelledWithPaymentCount > 0 && (
            <span className='inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full'>
              <span className='w-1.5 h-1.5 rounded-full bg-amber-500 inline-block' />
              {t('accounting.contract.cancelledWithPayment', {
                count: contract.cancelledWithPaymentCount,
              })}
            </span>
          )}
          {contract.cancelledWithoutPaymentCount > 0 && (
            <span className='inline-flex items-center gap-1 text-xs text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full'>
              <span className='w-1.5 h-1.5 rounded-full bg-slate-400 inline-block' />
              {t('accounting.contract.cancelledWithoutPayment', {
                count: contract.cancelledWithoutPaymentCount,
              })}
            </span>
          )}
        </div>
      </td>
      <td className='px-4 py-3 text-right text-sm text-slate-600'>
        €{contract.expected.toFixed(2)}
      </td>
      <td className='px-4 py-3' colSpan={3} />
    </tr>
  )
}
