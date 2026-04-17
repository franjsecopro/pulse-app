import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

const navItems = [
  { path: '/', label: 'Dashboard', icon: 'home' },
  { path: '/clients', label: 'Clientes', icon: 'people' },
  { path: '/classes', label: 'Clases', icon: 'school' },
  { path: '/payments', label: 'Pagos', icon: 'payments' },
  { path: '/accounting', label: 'Contabilidad', icon: 'account_balance' },
  { path: '/alerts', label: 'Alertas', icon: 'notifications' },
  { path: '/notifications', label: 'Notificaciones', icon: 'send' },
  { path: '/settings', label: 'Ajustes', icon: 'settings' },
]

const adminNavItem = { path: '/admin', label: 'Admin', icon: 'admin_panel_settings' }

export function Header() {
  const { pathname } = useLocation()
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const visibleNavItems = user?.role === 'admin'
    ? [...navItems, adminNavItem]
    : navItems

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const initials = user?.email.slice(0, 2).toUpperCase() ?? 'US'

  const isActive = (path: string) =>
    pathname === path || (path !== '/' && pathname.startsWith(path))

  return (
    <>
      {/* ── Desktop / tablet header ── */}
      <header className="sticky top-0 z-50 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-8">
              <Link to="/" className="flex items-center gap-3 text-primary font-bold text-xl">
                <span className="material-symbols-outlined text-3xl">account_balance_wallet</span>
                <span className="text-slate-900">Pulse</span>
              </Link>
              <nav className="hidden md:flex items-center gap-1">
                {visibleNavItems.map(({ path, label }) => (
                  <Link
                    key={path}
                    to={path}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive(path)
                        ? 'bg-primary/10 text-primary font-semibold'
                        : 'text-slate-600 hover:text-primary hover:bg-slate-50'
                    }`}
                  >
                    {label}
                  </Link>
                ))}
              </nav>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleLogout}
                title="Cerrar sesión"
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 text-sm font-medium transition-colors"
              >
                <div className="w-7 h-7 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold">
                  {initials}
                </div>
                <span className="hidden lg:inline">{user?.email}</span>
                <span className="material-symbols-outlined text-base text-slate-400">logout</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ── Mobile bottom navigation ── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-200">
        <div className="flex items-center justify-around h-16">
          {visibleNavItems.map(({ path, label, icon }) => (
            <Link
              key={path}
              to={path}
              className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors ${
                isActive(path) ? 'text-primary' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <span className={`material-symbols-outlined text-2xl ${isActive(path) ? 'text-primary' : ''}`}>
                {icon}
              </span>
              <span className="text-[10px] font-semibold">{label}</span>
            </Link>
          ))}
        </div>
      </nav>
    </>
  )
}
