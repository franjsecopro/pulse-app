import { useTranslation } from '../../i18n'
import { Button } from '../ui/Button'

export type FinanceTab = 'pagos' | 'contabilidad' | 'facturas'

export const FINANCE_TABS: FinanceTab[] = ['pagos', 'contabilidad', 'facturas']

interface TabStripProps {
  activeTab: FinanceTab
  onTabChange: (tab: FinanceTab) => void
}

/** Segmented control to switch between the Finanzas modules. */
export function TabStrip({ activeTab, onTabChange }: TabStripProps) {
  const { t } = useTranslation()

  return (
    <div className='flex gap-1 bg-slate-100 rounded-xl p-1 w-fit'>
      {FINANCE_TABS.map((tab) => (
        <Button
          type='button'
          key={tab}
          onClick={() => onTabChange(tab)}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
            activeTab === tab
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          {t(`finanzas.tab.${tab}`)}
        </Button>
      ))}
    </div>
  )
}
