import { useAuth } from '../../context/AuthContext'
import { useTranslation } from '../../i18n'
import { adminService } from '../../services/admin.service'

/**
 * Fixed 25px orange strip on the left edge of the viewport, visible only
 * when the admin is in demo-impersonation mode.
 *
 * Contains a rotated "MODO DEMO" label and a logout button to exit.
 * AppLayout adds pl-[25px] to the page when this sidebar is rendered.
 */
export function DemoSidebar() {
  const { realEmail, reloadUser } = useAuth()
  const { t } = useTranslation()

  async function handleExit() {
    await adminService.demoExit()
    await reloadUser()
  }

  return (
    <div
      className='fixed top-0 left-0 h-screen w-[25px] bg-orange-500 z-[200] flex flex-col items-center justify-between py-3'
      title={t('demoSidebar.activeTooltip', { email: realEmail ?? '' })}
    >
      {/* Rotated label */}
      <span
        className='text-white text-[9px] font-black tracking-[0.2em] uppercase select-none'
        style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
      >
        {t('demoSidebar.label')}
      </span>

      {/* Exit button */}
      <button
        type='button'
        onClick={handleExit}
        title={t('demoSidebar.exitTooltip', { email: realEmail ?? '' })}
        className='text-white hover:bg-orange-600 rounded p-0.5 transition-colors'
      >
        <span className='material-symbols-outlined text-[14px]'>logout</span>
      </button>
    </div>
  )
}
