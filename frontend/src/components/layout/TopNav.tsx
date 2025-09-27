import React, { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Bell, LogOut, Menu, X } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { NotificationsModal } from '@/components/modals/NotificationsModal'

export const TopNav: React.FC = () => {
  const { user, logout } = useAuth()
  const location = useLocation()
  const [showNotifications, setShowNotifications] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const navigation = [
    { name: 'Contracts', href: '/', roles: ['distributor'] },
    { name: 'Upload', href: '/vendor', roles: ['vendor'] },
    { name: 'Dashboard', href: '/dashboard', roles: ['distributor', 'vendor'] },
  ]

  const filteredNavigation = navigation.filter(item =>
    item.roles.includes(user?.role || 'distributor')
  )

  const handleLogout = async () => {
    try {
      await logout()
    } catch (error) {
      console.error('Logout failed:', error)
    }
  }

  return (
    <>
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link to="/" className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-br from-primary-600 to-accent-500 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-lg">OX</span>
                </div>
                <span className="text-xl font-bold text-gray-900">OnboardX</span>
              </Link>

              {/* Desktop Navigation */}
              <div className="hidden md:ml-10 md:flex md:space-x-8">
                {filteredNavigation.map((item) => {
                  const isActive = location.pathname === item.href
                  return (
                    <Link
                      key={item.name}
                      to={item.href}
                      className={`inline-flex items-center px-1 pt-1 text-sm font-medium transition-colors duration-200 ${
                        isActive
                          ? 'text-primary-600 border-b-2 border-primary-600'
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      {item.name}
                    </Link>
                  )
                })}
              </div>
            </div>

            <div className="flex items-center space-x-4">
              {/* Notifications Bell */}
              {user?.role === 'distributor' && (
                <button
                  onClick={() => setShowNotifications(true)}
                  className="p-2 text-gray-400 hover:text-gray-600 transition-colors relative"
                  aria-label="Notifications"
                >
                  <Bell className="w-5 h-5" />
                </button>
              )}

              {/* User Info */}
              <div className="hidden md:flex md:items-center md:space-x-3">
                <span className="text-sm text-gray-700">{user?.email}</span>
                <span className="px-2 py-1 text-xs font-medium bg-primary-100 text-primary-800 rounded-full capitalize">
                  {user?.role}
                </span>
              </div>

              {/* Logout Button */}
              <button
                onClick={handleLogout}
                className="btn-secondary hidden md:inline-flex"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </button>

              {/* Mobile menu button */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 text-gray-400 hover:text-gray-600"
              >
                {mobileMenuOpen ? (
                  <X className="w-5 h-5" />
                ) : (
                  <Menu className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden border-t border-gray-200"
          >
            <div className="px-4 py-3 space-y-3">
              {filteredNavigation.map((item) => (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="block text-base font-medium text-gray-700 hover:text-primary-600"
                >
                  {item.name}
                </Link>
              ))}
              <div className="pt-3 border-t border-gray-200">
                <p className="text-sm text-gray-500">{user?.email}</p>
                <p className="text-xs text-gray-400 capitalize">{user?.role}</p>
                <button
                  onClick={handleLogout}
                  className="mt-2 btn-secondary w-full justify-center"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Logout
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </nav>

      {/* Notifications Modal */}
      {showNotifications && user && (
        <NotificationsModal
          userEmail={user.email}
          onClose={() => setShowNotifications(false)}
        />
      )}
    </>
  )
}