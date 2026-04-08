import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { AuthProvider } from './context/AuthContext'
import { AppLayout } from './components/Layout/AppLayout'
import { Login } from './pages/Login'
import { Dashboard } from './pages/Dashboard'
import { Clients } from './pages/Clients'
import { Classes } from './pages/Classes'
import { Payments } from './pages/Payments'
import { Alerts } from './pages/Alerts'
import { Accounting } from './pages/Accounting'
import { Notifications } from './pages/Notifications'
import { Admin } from './pages/Admin'
import { Settings } from './pages/Settings'

function AdminRoute() {
  const { user } = useAuth()
  return user?.role === 'admin' ? <Outlet /> : <Navigate to="/" replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<AppLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/clients" element={<Clients />} />
            <Route path="/classes" element={<Classes />} />
            <Route path="/payments" element={<Payments />} />
            <Route path="/accounting" element={<Accounting />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route element={<AdminRoute />}>
              <Route path="/admin" element={<Admin />} />
            </Route>
            <Route path="/alerts" element={<Alerts />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
