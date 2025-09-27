import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { BarChart3, Users, FileCheck, TrendingUp, Search, X } from 'lucide-react'
import { useDashboardStats } from '@/hooks/useDashboardStats'
import { StatCard } from '@/components/ui/StatCard'
import { Loading } from '@/components/ui/Loading'
import { ErrorBanner } from '@/components/ui/ErrorBanner'
import { Contract } from '@/types'

export const DashboardPage: React.FC = () => {
  const { data: stats, isLoading, error } = useDashboardStats()
  const [searchTerm, setSearchTerm] = useState('')

  if (isLoading) {
    return <Loading text="Loading dashboard..." />
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <ErrorBanner error="Failed to load dashboard data" />
      </div>
    )
  }

  if (!stats) {
    return null
  }

  const onboardingPercentage = stats.total > 0 ? Math.round((stats.onboarded / stats.total) * 100) : 0

  // Filter contracts for search
  const allContracts = Object.values(stats.byVendor).reduce((acc, vendor) => acc + vendor.total, 0)
  
  // Create a flat list of contracts for the table (mock data based on stats)
  const contractsForTable: Contract[] = []
  Object.entries(stats.byVendor).forEach(([vendorEmail, vendorStats]) => {
    for (let i = 0; i < vendorStats.total; i++) {
      contractsForTable.push({
        id: `contract-${vendorEmail}-${i}`,
        originalName: `Contract ${i + 1}`,
        file: '',
        vendorEmail,
        assignedToEmail: 'distributor@example.com',
        status: i < vendorStats.signed ? 'signed' : 'pending',
        createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
        access: i < vendorStats.onboarded ? { progress: 100, generatedAt: new Date().toISOString(), tools: [] } : undefined,
      })
    }
  })

  const filteredContracts = contractsForTable.filter(contract => {
    if (!searchTerm) return true
    const term = searchTerm.toLowerCase()
    return (
      contract.id.toLowerCase().includes(term) ||
      contract.vendorEmail?.toLowerCase().includes(term) ||
      contract.assignedToEmail?.toLowerCase().includes(term)
    )
  })

  return (
    <div className="max-w-7xl mx-auto p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Analytics Dashboard</h1>
        <p className="text-gray-600">Overview of contract distribution and onboarding progress</p>
      </motion.div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <StatCard
            title="Total Contracts"
            value={stats.total}
            icon={<FileCheck className="w-6 h-6 text-primary-600" />}
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <StatCard
            title="Signed Contracts"
            value={stats.signed}
            subtitle={`${stats.total > 0 ? Math.round((stats.signed / stats.total) * 100) : 0}% of total`}
            icon={<Users className="w-6 h-6 text-green-600" />}
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <StatCard
            title="Fully Onboarded"
            value={stats.onboarded}
            subtitle={`${onboardingPercentage}% completion rate`}
            icon={<TrendingUp className="w-6 h-6 text-accent-600" />}
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="relative"
        >
          <div className="card p-6">
            <div className="flex items-center justify-center">
              <div className="relative w-24 h-24">
                <svg className="w-24 h-24 progress-ring" viewBox="0 0 36 36">
                  <path
                    className="progress-ring-circle text-gray-200"
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
                    animate={{ strokeDasharray: `${onboardingPercentage} 100` }}
                    transition={{ duration: 1, ease: 'easeOut' }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-xl font-bold text-gray-900">{onboardingPercentage}%</span>
                  <span className="text-xs text-gray-500">Onboarded</span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Per-Vendor Performance */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.5 }}
          className="lg:col-span-2"
        >
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center">
              <BarChart3 className="w-5 h-5 mr-2 text-primary-600" />
              Per-Vendor Performance
            </h3>

            <div className="space-y-4">
              {Object.entries(stats.byVendor)
                .sort(([, a], [, b]) => b.onboarded - a.onboarded)
                .map(([vendor, data], index) => {
                  const percentage = data.total > 0 ? Math.round((data.onboarded / data.total) * 100) : 0
                  return (
                    <motion.div
                      key={vendor}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.6 + index * 0.1 }}
                      className="flex items-center space-x-4"
                    >
                      <div className="w-40 text-sm font-medium text-gray-700 truncate">
                        {vendor}
                      </div>
                      <div className="flex-1 bg-gray-200 rounded-full h-3 overflow-hidden">
                        <motion.div
                          className="h-full bg-gradient-to-r from-primary-500 to-accent-500 rounded-full"
                          initial={{ width: 0 }}
                          animate={{ width: `${percentage}%` }}
                          transition={{ duration: 0.8, delay: 0.8 + index * 0.1 }}
                        />
                      </div>
                      <div className="w-12 text-sm font-medium text-gray-900 text-right">
                        {percentage}%
                      </div>
                    </motion.div>
                  )
                })}
            </div>
          </div>
        </motion.div>

        {/* Recent Completions */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.6 }}
        >
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Recent Completions</h3>

            <div className="space-y-3">
              {stats.recent.length === 0 ? (
                <p className="text-gray-500 text-sm">No completions yet</p>
              ) : (
                stats.recent.map((contract, index) => (
                  <motion.div
                    key={contract.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.7 + index * 0.05 }}
                    className="p-3 bg-gray-50 rounded-lg"
                  >
                    <h4 className="font-medium text-gray-900 text-sm">
                      {contract.originalName || contract.id}
                    </h4>
                    <p className="text-xs text-gray-500 mt-1">
                      {contract.assignedToEmail}
                    </p>
                    <p className="text-xs text-gray-400">
                      {contract.access?.generatedAt && new Date(contract.access.generatedAt).toLocaleDateString()}
                    </p>
                  </motion.div>
                ))
              )}
            </div>
          </div>
        </motion.div>
      </div>

      {/* All Contracts Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
        className="mt-8"
      >
        <div className="card p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">All Contracts</h3>
            
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input pl-10 pr-10 w-64"
                placeholder="Search contracts..."
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Contract ID</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Vendor</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Assigned To</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Status</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Progress</th>
                </tr>
              </thead>
              <tbody>
                {filteredContracts.map((contract, index) => (
                  <motion.tr
                    key={contract.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.9 + index * 0.02 }}
                    className="border-b border-gray-100 hover:bg-gray-50"
                  >
                    <td className="py-3 px-4 text-sm font-mono text-gray-900">
                      {contract.id}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-700">
                      {contract.vendorEmail || '-'}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-700">
                      {contract.assignedToEmail || '-'}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full ${
                          contract.status === 'signed'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {contract.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-700">
                      {contract.access?.progress || 0}%
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>

            {filteredContracts.length === 0 && (
              <div className="text-center py-8">
                <p className="text-gray-500">
                  {searchTerm ? 'No contracts match your search' : 'No contracts found'}
                </p>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  )
}