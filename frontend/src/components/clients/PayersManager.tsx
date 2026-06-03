import { type FormEvent, useEffect, useState } from 'react'
import { useTranslation } from '../../i18n'
import { clientService } from '../../services/client.service'
import type { Client, PaymentIdentifier } from '../../types'

interface PayersManagerProps {
  client: Client
  onPayersChanged: (clientId: number, payers: PaymentIdentifier[]) => void
}

export function PayersManager({ client, onPayersChanged }: PayersManagerProps) {
  const { t } = useTranslation()
  const [payers, setPayers] = useState<PaymentIdentifier[]>(client.payers ?? [])
  const [newName, setNewName] = useState('')
  const [newInfo, setNewInfo] = useState('')
  const [isAdding, setIsAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setPayers(client.payers ?? [])
  }, [client.payers])

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault()
    if (!newName.trim()) return
    setError(null)
    setIsAdding(true)
    try {
      const created = await clientService.createPayer(client.id, {
        name: newName.trim(),
        info: newInfo.trim() || null,
      })
      const updated = [...payers, created]
      setPayers(updated)
      onPayersChanged(client.id, updated)
      setNewName('')
      setNewInfo('')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('common.errors.add'))
    } finally {
      setIsAdding(false)
    }
  }

  const handleDelete = async (payerId: number) => {
    try {
      await clientService.deletePayer(client.id, payerId)
      const updated = payers.filter((p) => p.id !== payerId)
      setPayers(updated)
      onPayersChanged(client.id, updated)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('common.errors.delete'))
    }
  }

  return (
    <div className='space-y-3 pt-4 border-t border-slate-100'>
      <div>
        <p className='text-sm font-semibold text-slate-700'>{t('payers.title')}</p>
        <p className='text-xs text-slate-400 mt-0.5'>{t('payers.description')}</p>
      </div>

      {error && <p className='text-xs text-red-600'>{error}</p>}

      <div className='flex flex-wrap gap-2 min-h-[28px]'>
        {payers.map((p) => (
          <span
            key={p.id}
            className='flex items-center gap-1.5 bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-1 rounded-full text-xs font-medium'
          >
            {p.name}
            {p.info && <span className='text-blue-400'>· {p.info}</span>}
            <button
              onClick={() => handleDelete(p.id)}
              type='button'
              className='text-blue-400 hover:text-red-500 transition-colors ml-0.5'
            >
              <span className='material-symbols-outlined text-sm'>close</span>
            </button>
          </span>
        ))}
        {payers.length === 0 && (
          <span className='text-slate-400 text-xs italic self-center'>{t('payers.empty')}</span>
        )}
      </div>

      <form onSubmit={handleAdd} className='flex gap-2'>
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder={t('payers.namePlaceholder')}
          className='flex-1 px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none'
        />
        <input
          value={newInfo}
          onChange={(e) => setNewInfo(e.target.value)}
          placeholder={t('payers.infoPlaceholder')}
          className='w-28 px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none'
        />
        <button
          type='submit'
          disabled={isAdding || !newName.trim()}
          className='px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-bold hover:bg-primary-hover transition-colors disabled:opacity-60'
        >
          {t('actions.add')}
        </button>
      </form>
    </div>
  )
}
