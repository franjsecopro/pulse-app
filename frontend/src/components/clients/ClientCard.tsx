import { useTranslation } from '../../i18n'
import type { Client } from '../../types'
import { Button } from '../ui/Button'

interface ClientCardProps {
  client: Client
  onEdit: () => void
  onDelete: () => void
  onActivate: () => void
  onManageContracts: () => void
  onHardDelete?: () => void
}

export function ClientCard({
  client,
  onEdit,
  onDelete,
  onActivate,
  onManageContracts,
  onHardDelete,
}: ClientCardProps) {
  const { t } = useTranslation()
  const activeContracts = client.contracts?.filter((contract) => contract.isActive) ?? []
  const isArchived = !!client.archivedAt

  return (
    <div
      className={`bg-white border rounded-xl p-5 flex flex-col lg:flex-row lg:items-center gap-5 shadow-sm hover:border-primary/50 transition-colors ${
        isArchived
          ? 'opacity-50 border-slate-100'
          : !client.isActive
            ? 'opacity-60 border-slate-200'
            : 'border-slate-200'
      }`}
    >
      <div className='flex items-center gap-4 flex-1'>
        <div
          className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
            client.isActive && !isArchived
              ? 'bg-primary/10 text-primary'
              : 'bg-slate-100 text-slate-400'
          }`}
        >
          <span className='material-symbols-outlined text-2xl'>person</span>
        </div>
        <div className='min-w-0'>
          <div className='flex items-center gap-2 flex-wrap'>
            <h3 className='font-bold text-slate-900 truncate'>{client.name}</h3>
            {isArchived ? (
              <span className='px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-400 border border-slate-200'>
                {t('clients.status.archived')}
              </span>
            ) : client.isActive ? (
              <span className='px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200'>
                {t('clients.status.active')}
              </span>
            ) : (
              <span className='px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200'>
                {t('clients.status.inactive')}
              </span>
            )}
          </div>
          {client.email && <p className='text-sm text-slate-500 truncate'>{client.email}</p>}
          {client.phone && <p className='text-sm text-slate-400'>{client.phone}</p>}
        </div>
      </div>

      <div className='flex-1 lg:border-x border-slate-100 px-0 lg:px-6'>
        <p className='text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2'>
          {t('clients.contractsLabel')}
        </p>
        {activeContracts.length > 0 ? (
          <div className='flex flex-wrap gap-2'>
            {activeContracts.map((contract) => (
              <span
                key={contract.id}
                className='bg-slate-50 text-slate-600 px-2 py-1 rounded text-xs border border-slate-200'
              >
                {contract.description} — €{contract.hourlyRate}/h
              </span>
            ))}
          </div>
        ) : (
          <span className='text-slate-400 text-xs italic'>{t('clients.noActiveContracts')}</span>
        )}
      </div>

      <div className='flex items-center gap-2 shrink-0'>
        {!isArchived && (
          <Button
            type='button'
            onClick={onManageContracts}
            className='p-2 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors'
            title={t('clients.manageContracts')}
          >
            <span className='material-symbols-outlined'>description</span>
          </Button>
        )}
        <Button
          type='button'
          onClick={onEdit}
          className='p-2 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors'
          title={isArchived ? t('clients.viewData') : t('clients.edit')}
        >
          <span className='material-symbols-outlined'>edit</span>
        </Button>
        {isArchived ? (
          <>
            <Button
              type='button'
              onClick={onActivate}
              className='p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors'
              title={t('clients.activateTooltip')}
            >
              <span className='material-symbols-outlined'>restore</span>
            </Button>
            {onHardDelete && (
              <Button
                type='button'
                onClick={onHardDelete}
                className='p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors'
                title={t('clients.hardDeleteTooltip')}
              >
                <span className='material-symbols-outlined'>delete_forever</span>
              </Button>
            )}
          </>
        ) : (
          <Button
            type='button'
            onClick={onDelete}
            className='p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors'
            title={t('clients.archiveTooltip')}
          >
            <span className='material-symbols-outlined'>archive</span>
          </Button>
        )}
      </div>
    </div>
  )
}
