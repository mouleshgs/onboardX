import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FileText, Search, X, RefreshCw } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useContracts, useSignContract, useContractAccess } from '@/hooks/useContracts'
import { ContractCard } from '@/components/contracts/ContractCard'
import { PDFViewer } from '@/components/contracts/PDFViewer'
import { SignaturePad } from '@/components/contracts/SignaturePad'
import { AccessModal } from '@/components/modals/AccessModal'
import { LoadingSpinner } from '@/components/ui/Loading'
import { ErrorBanner } from '@/components/ui/ErrorBanner'
import { Contract } from '@/types'
import toast from 'react-hot-toast'

export const DistributorPage: React.FC = () => {
  const { user } = useAuth()
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [signerName, setSignerName] = useState('')
  const [signatureDataUrl, setSignatureDataUrl] = useState('')
  const [showAccessModal, setShowAccessModal] = useState(false)

  const { data: contracts, isLoading, error, refetch } = useContracts()
  const signContract = useSignContract()
  const { data: accessData } = useContractAccess(selectedContract?.id || '')

  // Filter contracts for current user
  const userContracts = contracts?.filter(contract =>
    contract.assignedToEmail?.toLowerCase() === user?.email?.toLowerCase()
  ) || []

  // Apply search filter
  const filteredContracts = userContracts.filter(contract => {
    if (!searchTerm) return true
    const term = searchTerm.toLowerCase()
    return (
      contract.id.toLowerCase().includes(term) ||
      contract.originalName?.toLowerCase().includes(term) ||
      contract.vendorEmail?.toLowerCase().includes(term)
    )
  })

  const handleContractSelect = (contract: Contract) => {
    setSelectedContract(contract)
    setSignerName('')
    setSignatureDataUrl('')
  }

  const handleSignContract = async () => {
    if (!selectedContract || !signerName || !signatureDataUrl) {
      toast.error('Please provide your name and signature')
      return
    }

    try {
      await signContract.mutateAsync({
        contractId: selectedContract.id,
        name: signerName,
        signatureDataUrl,
      })

      // Reset form
      setSignerName('')
      setSignatureDataUrl('')
      
      // Refresh contracts to get updated status
      refetch()
    } catch (error) {
      // Error is handled by the mutation
    }
  }

  const handleShowAccessTools = () => {
    setShowAccessModal(true)
  }

  const signedCount = userContracts.filter(c => c.status === 'signed').length

  return (
    <div className="max-w-7xl mx-auto p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Your Contracts</h1>
            <p className="text-gray-600">
              Review and sign your assigned contracts
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-sm text-gray-600">
              Signed: <span className="font-semibold text-green-600">{signedCount}</span>
            </div>
            <button
              onClick={() => refetch()}
              disabled={isLoading}
              className="btn-secondary"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Contracts List */}
        <div className="lg:col-span-1">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="card p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                <FileText className="w-5 h-5 mr-2 text-primary-600" />
                Contracts ({filteredContracts.length})
              </h2>
            </div>

            {/* Search */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input pl-10 pr-10"
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

            {/* Contracts List */}
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {isLoading && (
                <div className="text-center py-8">
                  <LoadingSpinner />
                </div>
              )}

              {error && (
                <ErrorBanner error="Failed to load contracts" />
              )}

              {!isLoading && !error && filteredContracts.length === 0 && (
                <div className="text-center py-8">
                  <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">
                    {searchTerm ? 'No contracts match your search' : 'No contracts assigned to you'}
                  </p>
                </div>
              )}

              {filteredContracts.map((contract, index) => (
                <motion.div
                  key={contract.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={`p-4 rounded-lg border cursor-pointer transition-all ${
                    selectedContract?.id === contract.id
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => handleContractSelect(contract)}
                >
                  <h3 className="font-medium text-gray-900 truncate">
                    {contract.originalName || contract.id}
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Status: {contract.status}
                  </p>
                  {contract.vendorEmail && (
                    <p className="text-sm text-gray-500">
                      From: {contract.vendorEmail}
                    </p>
                  )}
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Contract Viewer */}
        <div className="lg:col-span-2">
          <AnimatePresence mode="wait">
            {selectedContract ? (
              <motion.div
                key={selectedContract.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                {/* PDF Viewer */}
                <div className="card p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    {selectedContract.originalName || selectedContract.id}
                  </h3>
                  <PDFViewer
                    contractId={selectedContract.id}
                    className="h-96"
                  />
                </div>

                {/* Signature Section */}
                {selectedContract.status === 'pending' && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="card p-6"
                  >
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      Sign Contract
                    </h3>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Full Name *
                        </label>
                        <input
                          type="text"
                          value={signerName}
                          onChange={(e) => setSignerName(e.target.value)}
                          className="input"
                          placeholder="Enter your full name"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Signature *
                        </label>
                        <SignaturePad
                          onSignatureChange={setSignatureDataUrl}
                          disabled={signContract.isPending}
                        />
                      </div>

                      <button
                        onClick={handleSignContract}
                        disabled={signContract.isPending || !signerName || !signatureDataUrl}
                        className="btn-primary w-full"
                      >
                        {signContract.isPending ? (
                          <LoadingSpinner className="mr-2" />
                        ) : null}
                        {signContract.isPending ? 'Signing...' : 'Submit Signature'}
                      </button>
                    </div>
                  </motion.div>
                )}

                {/* Access Tools Button */}
                {selectedContract.status === 'signed' && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="card p-6 text-center"
                  >
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      Contract Signed Successfully! ✅
                    </h3>
                    <p className="text-gray-600 mb-4">
                      Your contract has been signed and processed. Access your onboarding tools below.
                    </p>
                    <button
                      onClick={handleShowAccessTools}
                      className="btn-primary"
                    >
                      Access Tools & Resources
                    </button>
                  </motion.div>
                )}
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="card p-12 text-center"
              >
                <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Select a Contract
                </h3>
                <p className="text-gray-600">
                  Choose a contract from the list to view and sign it
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Access Modal */}
      {showAccessModal && selectedContract && (
        <AccessModal
          contract={selectedContract}
          onClose={() => setShowAccessModal(false)}
        />
      )}
    </div>
  )
}