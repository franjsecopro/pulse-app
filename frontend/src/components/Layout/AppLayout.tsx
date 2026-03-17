import { Outlet, Navigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { Header } from './Header'

export function AppLayout() {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background-light">
        <span className="material-symbols-outlined text-primary text-4xl animate-spin">sync</span>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  return (
    <div className="min-h-screen bg-background-light flex flex-col">
      <Header />
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>
      <footer className="border-t border-slate-200 bg-white py-4">
        <p className="text-center text-slate-400 text-xs">
          © {new Date().getFullYear()} Pulse — Gestor de Contabilidad
        </p>
      </footer>
    </div>
  )
}
