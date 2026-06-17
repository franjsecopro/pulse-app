import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { AppLayout } from './components/Layout/AppLayout'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ToastProvider } from './context/ToastContext'
import { QueryClientProvider } from './hooks/reactQuery'
import { queryClient } from './lib/queryClient'
import { Admin } from './pages/Admin'
import { Alerts } from './pages/Alerts'
import { Classes } from './pages/Classes'
import { Clients } from './pages/Clients'
import { Dashboard } from './pages/Dashboard'
import { Finanzas } from './pages/Finanzas'
import { Login } from './pages/Login'
import { Notifications } from './pages/Notifications'
import { Settings } from './pages/Settings'

function ProtectedRoute() {
  const { user, isLoading } = useAuth()
  if (isLoading) return null
  if (!user) return <Navigate to='/login' replace />
  return <Outlet />
}

function AdminRoute() {
  const { user, isDemoActive } = useAuth()
  return user?.role === 'admin' || isDemoActive ? <Outlet /> : <Navigate to='/' replace />
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ToastProvider>
          <AuthProvider>
            <Routes>
              <Route path='/login' element={<Login />} />
              <Route element={<ProtectedRoute />}>
                <Route element={<AppLayout />}>
                  <Route path='/' element={<Dashboard />} />
                  <Route path='/clients' element={<Clients />} />
                  <Route path='/classes' element={<Classes />} />
                  <Route path='/finanzas' element={<Finanzas />} />
                  <Route path='/payments' element={<Navigate to='/finanzas?tab=pagos' replace />} />
                  <Route
                    path='/accounting'
                    element={<Navigate to='/finanzas?tab=contabilidad' replace />}
                  />
                  <Route
                    path='/invoices'
                    element={<Navigate to='/finanzas?tab=facturas' replace />}
                  />
                  <Route path='/notifications' element={<Notifications />} />
                  <Route element={<AdminRoute />}>
                    <Route path='/admin' element={<Admin />} />
                  </Route>
                  <Route path='/alerts' element={<Alerts />} />
                  <Route path='/settings' element={<Settings />} />
                </Route>
              </Route>
              <Route path='*' element={<Navigate to='/' replace />} />
            </Routes>
          </AuthProvider>
        </ToastProvider>
      </BrowserRouter>
      {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  )
}
