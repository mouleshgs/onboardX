import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Copy, Check, ExternalLink, Trophy } from 'lucide-react'
import { Contract } from '@/types'
import { useRecordEvent } from '@/hooks/useContracts'
import toast from 'react-hot-toast'

interface AccessModalProps {
  contract: Contract
  onClose: () => void
}

export const AccessModal: React.FC<AccessModalProps> = ({ contract, onClose }) => {
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const recordEvent = useRecordEvent()

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedField(field)
      toast.success('Copied to clipboard!')
      setTimeout(() => setCopiedField(null), 2000)
    } catch (error) {
      toast.error('Failed to copy to clipboard')
    }
  }

  const handleToolClick = async (tool: any) => {
    // Record events for specific tools
    if (tool.name.toLowerCase().includes('slack')) {
      recordEvent.mutate({ contractId: contract.id, event: 'slack_visited' })
    }

    // Open tool in new tab
    window.open(tool.url, '_blank')
  }

  const handleMarkCourseCompleted = () => {
    recordEvent.mutate({ contractId: contract.id, event: 'notion_completed' })
    toast.success('Course marked as completed! 🎉')
  }

  const progress = contract.access?.progress || 0
  const credentials = contract.access?.credentials
  const tools = contract.access?.tools || []

  return (
    <AnimatePresence>
      <div className="modal-overlay" onClick={onClose}>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="modal-content p-6"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">Access Tools</h2>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Progress Ring */}
          <div className="flex items-center justify-center mb-8">
            <div className="relative w-24 h-24">
              <svg className="w-24 h-24 progress-ring" viewBox="0 0 36 36">
                <path
                  className="progress-ring-circle bg-gray-200"
                  stroke="currentColor"
                  strokeWidth="3"
                  fill="transparent"
                  d="M18 2.0845a15.9155 15.9155 0 1 1 0 31.831"
                />
                <motion.path
                  className="progress-ring-circle text-accent-500"
                  stroke="currentColor"
                  strokeWidth="3"
                  fill="transparent"
                  strokeLinecap="round"
                  d="M18 2.0845a15.9155 15.9155 0 1 1 0 31.831"
                  initial={{ strokeDasharray: '0 100' }}
                  animate={{ strokeDasharray: `${progress} 100` }}
                  transition={{ duration: 1, ease: 'easeOut' }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold text-gray-900">{progress}%</span>
                <span className="text-xs text-gray-500">Complete</span>
              </div>
            </div>
          </div>

          {progress === 100 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6 text-center"
            >
              <Trophy className="w-8 h-8 text-green-600 mx-auto mb-2" />
              <p className="text-green-800 font-medium">Onboarding Complete!</p>
              <p className="text-green-600 text-sm">You can now access all tools and resources.</p>
            </motion.div>
          )}

          {/* Credentials */}
          {credentials && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Credentials</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <span className="text-sm font-medium text-gray-700">Username</span>
                    <p className="text-sm text-gray-900 font-mono">{credentials.username}</p>
                  </div>
                  <button
                    onClick={() => copyToClipboard(credentials.username, 'username')}
                    className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {copiedField === 'username' ? (
                      <Check className="w-4 h-4 text-green-600" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>

                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <span className="text-sm font-medium text-gray-700">Password</span>
                    <p className="text-sm text-gray-900 font-mono">{credentials.password}</p>
                  </div>
                  <button
                    onClick={() => copyToClipboard(credentials.password, 'password')}
                    className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {copiedField === 'password' ? (
                      <Check className="w-4 h-4 text-green-600" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Tools */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Available Tools</h3>
            <div className="space-y-3">
              {tools.map((tool, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div>
                    <h4 className="font-medium text-gray-900">{tool.name}</h4>
                    {tool.name.toLowerCase().includes('dashboard') && progress < 100 && (
                      <p className="text-sm text-amber-600">Complete onboarding to access</p>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    {tool.name.toLowerCase().includes('onboarding course') && (
                      <button
                        onClick={handleMarkCourseCompleted}
                        className="btn-primary text-sm"
                      >
                        Mark Complete
                      </button>
                    )}
                    <button
                      onClick={() => handleToolClick(tool)}
                      disabled={tool.name.toLowerCase().includes('dashboard') && progress < 100}
                      className="btn-secondary text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Open
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}