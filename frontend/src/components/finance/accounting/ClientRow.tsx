import { useState } from 'react'
import type { AccountingSummaryEntry } from '../../../types'
import { ContractRow } from './ContractRow'

interface ClientRowProps {
  entry: AccountingSummaryEntry
  t: (key: string, options?: Record<string, unknown>) => string
}

export function ClientRow({ entry, t }: ClientRowProps) {
  const [expanded, setExpanded] = useState(false)
  const isDebt = entry.balance < 0
  const isCredit = entry.balance > 0
  const hasContracts = entry.contracts.length > 0

  return (
    <>
      <tr
        className={`transition-colors ${hasContracts ? 'cursor-pointer hover:bg-slate-50' : ''} ${expanded ? 'bg-slate-50' : ''}`}
        onClick={() => hasContracts && setExpanded((e) => !e)}
      >
        <td className='px-5 py-4'>
          <div className='flex items-center gap-3'>
            {hasContracts ? (
              <span
                className={`material-symbols-outlined text-base text-slate-400 transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`}
              >
                chevron_right
              </span>
            ) : (
              <span className='w-5' />
            )}
            <div className='w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-xs shrink-0'>
              {entry.clientName.slice(0, 2).toUpperCase()}
            </div>
            <span className='font-medium text-slate-900'>{entry.clientName}</span>
          </div>
        </td>
        <td className='px-4 py-4 text-right text-slate-700'>€{entry.expected.toFixed(2)}</td>
        <td className='px-4 py-4 text-right text-slate-700'>€{entry.paid.toFixed(2)}</td>
        <td className='px-4 py-4 text-right'>
          {entry.previousCredit > 0 ? (
            <span className='text-blue-600 font-medium'>+€{entry.previousCredit.toFixed(2)}</span>
          ) : (
            <span className='text-slate-400'>—</span>
          )}
        </td>
        <td className='px-5 py-4 text-right'>
          <span
            className={`font-black text-base ${isDebt ? 'text-red-600' : isCredit ? 'text-blue-600' : 'text-emerald-600'}`}
          >
            {isDebt ? '-' : isCredit ? '+' : ''}€{Math.abs(entry.balance).toFixed(2)}
          </span>
        </td>
      </tr>

      {expanded &&
        entry.contracts.map((contract, i) => (
          <ContractRow key={contract.contractId ?? i} contract={contract} t={t} />
        ))}
    </>
  )
}
