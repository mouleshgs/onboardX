import React from 'react'
import { motion } from 'framer-motion'
import { FileText, Clock, CheckCircle, User, Calendar } from 'lucide-react'
import { Contract } from '@/types'

interface ContractCardProps {
  contract: Contract
  onOpen?: (contract: Contract) => void
  onNudge?: (contract: Contract) => void
  showVendorInfo?: boolean
  showProgress?: boolean
}

export const ContractCard: React.FC<ContractCardProps> = ({
  contract,
  onOpen,
  onNudge,
  showVendorInfo = false,
  showProgress = false,
}) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'signed':
        return 'bg-green-100 text-green-800'
      case 'pending':
        return 'bg-yellow-100 text-yellow-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getProgressColor = (progress: number) => {
    if (progress >= 100) return 'text-green-600'
    if (progress >= 50) return 'text-yellow-600'
    return 'text-red-600'
  }

  return (
    <motion.div
      whileHover={{ y: -2 }}
      className="card p-6 cursor-pointer"
      onClick={() => onOpen?.(contract)}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-3 mb-3">
            <FileText className="w-5 h-5 text-primary-600 flex-shrink-0" />
            <h3 className="text-lg font-semibold text-gray-900 truncate">
              {contract.originalName || contract.id}
            </h3>
          </div>

          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(contract.status)}`}>
                {contract.status === 'signed' ? (
                  <CheckCircle className="w-3 h-3 inline mr-1" />
                ) : (
                  <Clock className="w-3 h-3 inline mr-1" />
                )}
                {contract.status}
              </span>
              <span className="text-sm text-gray-500">ID: {contract.id}</span>
            </div>

            {showVendorInfo && (contract.vendorEmail || contract.vendorId) && (
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <User className="w-4 h-4" />
                <span>Vendor: {contract.vendorEmail || contract.vendorId}</span>
              </div>
            )}

            {contract.assignedToEmail && (
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <User className="w-4 h-4" />
                <span>Assigned: {contract.assignedToEmail}</span>
              </div>
            )}

            <div className="flex items-center space-x-2 text-sm text-gray-500">
              <Calendar className="w-4 h-4" />
              <span>Created: {new Date(contract.createdAt).toLocaleDateString()}</span>
            </div>

            {showProgress && contract.access && (
              <div className="mt-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Onboarding Progress</span>
                  <span className={`font-medium ${getProgressColor(contract.access.progress)}`}>
                    {contract.access.progress}%
                  </span>
                </div>
                <div className="mt-1 w-full bg-gray-200 rounded-full h-2">
                  <motion.div
                    className="bg-gradient-to-r from-primary-500 to-accent-500 h-2 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${contract.access.progress}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col space-y-2 ml-4">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onOpen?.(contract)
            }}
            className="btn-primary text-sm"
          >
            {contract.status === 'signed' ? 'View' : 'Open'}
          </button>

          {onNudge && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onNudge(contract)
              }}
              className="btn-secondary text-sm"
            >
              Nudge
            </button>
          )}
        </div>
      </div>
    </motion.div>
  )
}