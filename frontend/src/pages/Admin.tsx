import { useState } from 'react'
import { ClientsTab } from '../components/admin/ClientsTab'
import { DemoTab } from '../components/admin/DemoTab'
import { UsersTab } from '../components/admin/UsersTab'
import { Button } from '../components/ui/Button'
import { useTranslation } from '../i18n'

type Tab = 'users' | 'clients' | 'demo'

export function Admin() {
  const { t } = useTranslation()
  const [tab, setTab] = useState<Tab>('users')

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'users', label: t('admin.tab.users'), icon: 'manage_accounts' },
    { id: 'clients', label: t('admin.tab.clients'), icon: 'people' },
    { id: 'demo', label: t('admin.tab.demo'), icon: 'science' },
  ]

  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-2xl font-black text-slate-900'>{t('admin.title')}</h1>
        <p className='text-slate-500 text-sm mt-1'>{t('admin.subtitle')}</p>
      </div>

      <div className='flex gap-1 border-b border-slate-200'>
        {tabs.map((tabItem) => (
          <Button
            type='button'
            key={tabItem.id}
            onClick={() => setTab(tabItem.id)}
            className={`inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === tabItem.id
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <span className='material-symbols-outlined text-[16px]'>{tabItem.icon}</span>
            {tabItem.label}
          </Button>
        ))}
      </div>

      {tab === 'users' && <UsersTab />}
      {tab === 'clients' && <ClientsTab />}
      {tab === 'demo' && <DemoTab />}
    </div>
  )
}
