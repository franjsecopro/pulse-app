import { useState } from 'react'
import { HistoryTab } from '../components/notifications/HistoryTab'
import { PendingTab } from '../components/notifications/PendingTab'
import { SettingsTab } from '../components/notifications/SettingsTab'
import { Button } from '../components/ui/Button'
import { useTranslation } from '../i18n'

type Tab = 'pending' | 'history' | 'settings'

export function Notifications() {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<Tab>('pending')

  const tabs: { id: Tab; label: string; icon: string }[] = [
    {
      id: 'pending',
      label: t('notifications.tab.pending'),
      icon: 'notifications',
    },
    { id: 'history', label: t('notifications.tab.history'), icon: 'history' },
    {
      id: 'settings',
      label: t('notifications.tab.settings'),
      icon: 'settings',
    },
  ]

  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-2xl font-black text-slate-900'>{t('notifications.title')}</h1>
        <p className='text-slate-500 text-sm mt-1'>{t('notifications.subtitle')}</p>
      </div>

      <div className='flex gap-1 bg-slate-100 p-1 rounded-lg w-fit'>
        {tabs.map((tab) => (
          <Button
            type='button'
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-white text-indigo-600 shadow-sm'
                : 'text-slate-600 hover:text-slate-800'
            }`}
          >
            <span className='material-symbols-outlined text-[16px]'>{tab.icon}</span>
            {tab.label}
          </Button>
        ))}
      </div>

      {activeTab === 'pending' && <PendingTab />}
      {activeTab === 'history' && <HistoryTab />}
      {activeTab === 'settings' && <SettingsTab />}
    </div>
  )
}
