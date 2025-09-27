import React from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import { TopNav } from '@/components/layout/TopNav'
import { LoginPage } from '@/pages/LoginPage'
import { VendorPage } from '@/pages/VendorPage'
import { DistributorPage } from '@/pages/DistributorPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { Loading } from '@/components/ui/Loading'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
})

const ProtectedRoute: React.FC<{ 
  children: React.ReactNode
  allowedRoles?: ('vendor' | 'distributor')[]
}> = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth()

  if (loading) {
    return <Loading />
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to={user.role === 'vendor' ? '/vendor' : '/'} replace />
  }

  return <>{children}</>
}

const AppContent: React.FC = () => {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loading text="Loading application..." />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <TopNav />
              <main className="pt-4">
                <Routes>
                  <Route
                    path="/"
                    element={
                      user?.role === 'vendor' ? (
                        <Navigate to="/vendor" replace />
                      ) : (
                        <DistributorPage />
                      )
                    }
                  />
                  <Route
                    path="/vendor"
                    element={
                      <ProtectedRoute allowedRoles={['vendor']}>
                        <VendorPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/distributor"
                    element={
                      <ProtectedRoute allowedRoles={['distributor']}>
                        <DistributorPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/dashboard"
                    element={
                      <ProtectedRoute>
                        <DashboardPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </main>
            </ProtectedRoute>
          }
        />
      </Routes>
    </div>
  )
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router>
          <AppContent />
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#363636',
                color: '#fff',
              },
              success: {
                duration: 3000,
                iconTheme: {
                  primary: '#10b981',
                  secondary: '#fff',
                },
              },
              error: {
                duration: 5000,
                iconTheme: {
                  primary: '#ef4444',
                  secondary: '#fff',
                },
              },
            }}
          />
        </Router>
      </AuthProvider>
    </QueryClientProvider>
  )
}

export default App