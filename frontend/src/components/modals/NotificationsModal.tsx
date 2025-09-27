import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Bell, Check } from 'lucide-react'
import { useNotifications, useMarkNotificationsRead } from '@/hooks/useNotifications'
import { Loading } from '@/components/ui/Loading'

interface NotificationsModalProps {
  userEmail: string
  onClose: () => void
}

export const NotificationsModal: React.FC<NotificationsModalProps> = ({
  userEmail,
  onClose,
}) => {
  const { data, isLoading, error } = useNotifications(userEmail)
  const markAsRead = useMarkNotificationsRead()

  const handleMarkAllRead = () => {
    if (!data?.notifications) return

    const unreadIds = data.notifications
      .filter(n => !n.read)
      .map(n => n.id)

    if (unreadIds.length > 0) {
      markAsRead.mutate(unreadIds)
    }
  }

  const notifications = data?.notifications || []
  const unreadCount = data?.unreadCount || 0

  return (
    <AnimatePresence>
      <div className="modal-overlay" onClick={onClose}>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="modal-content p-6 max-w-md"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <Bell className="w-5 h-5 text-primary-600" />
              <h2 className="text-xl font-bold text-gray-900">Notifications</h2>
              {unreadCount > 0 && (
                <span className="bg-red-500 text-white text-xs font-medium px-2 py-1 rounded-full">
                  {unreadCount}
                </span>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {isLoading && <Loading text="Loading notifications..." />}

          {error && (
            <div className="text-center py-8">
              <p className="text-red-600">Failed to load notifications</p>
            </div>
          )}

          {!isLoading && !error && (
            <>
              {notifications.length === 0 ? (
                <div className="text-center py-8">
                  <Bell className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No notifications yet</p>
                </div>
              ) : (
                <>
                  <div className="flex justify-between items-center mb-4">
                    <p className="text-sm text-gray-600">
                      {notifications.length} notification{notifications.length !== 1 ? 's' : ''}
                    </p>
                    {unreadCount > 0 && (
                      <button
                        onClick={handleMarkAllRead}
                        disabled={markAsRead.isPending}
                        className="btn-secondary text-sm"
                      >
                        <Check className="w-4 h-4 mr-2" />
                        Mark all read
                      </button>
                    )}
                  </div>

                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {notifications.map((notification, index) => (
                      <motion.div
                        key={notification.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className={`p-4 rounded-lg border ${
                          notification.read
                            ? 'bg-gray-50 border-gray-200'
                            : 'bg-blue-50 border-blue-200 border-l-4 border-l-blue-500'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900">
                              From: {notification.from}
                            </p>
                            <p className="text-sm text-gray-700 mt-1">
                              {notification.message}
                            </p>
                            <p className="text-xs text-gray-500 mt-2">
                              {new Date(notification.createdAt).toLocaleString()}
                            </p>
                          </div>
                          {!notification.read && (
                            <div className="w-2 h-2 bg-blue-500 rounded-full ml-3 mt-1 flex-shrink-0" />
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  )
}