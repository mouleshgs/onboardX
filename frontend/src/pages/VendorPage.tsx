import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Upload, FileText, Send, RefreshCw } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useVendorContracts } from '@/hooks/useContracts'
import { useSendNudge } from '@/hooks/useNotifications'
import { ContractCard } from '@/components/contracts/ContractCard'
import { LoadingSpinner } from '@/components/ui/Loading'
import { ErrorBanner } from '@/components/ui/ErrorBanner'
import { apiClient } from '@/api/client'
import { Contract } from '@/types'
import toast from 'react-hot-toast'

export const VendorPage: React.FC = () => {
  const { user } = useAuth()
  const [distributorEmail, setDistributorEmail] = useState('')
  const [vendorEmail, setVendorEmail] = useState(user?.email || '')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')

  const { data: contracts, isLoading, error, refetch } = useVendorContracts(vendorEmail)
  const sendNudge = useSendNudge()

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && file.type === 'application/pdf') {
      setSelectedFile(file)
      setUploadError('')
    } else {
      toast.error('Please select a PDF file')
    }
  }

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedFile || !distributorEmail || !vendorEmail) return

    setIsUploading(true)
    setUploadError('')

    try {
      const formData = new FormData()
      formData.append('file', selectedFile)
      formData.append('distributorEmail', distributorEmail)
      formData.append('vendorEmail', vendorEmail)
      formData.append('vendorId', vendorEmail.replace(/[^a-z0-9]/gi, '').toLowerCase())

      const result = await apiClient.uploadContract(formData)
      
      toast.success('Contract uploaded successfully!')
      
      // Reset form
      setSelectedFile(null)
      setDistributorEmail('')
      
      // Reset file input
      const fileInput = document.getElementById('file-input') as HTMLInputElement
      if (fileInput) fileInput.value = ''
      
      // Refetch contracts
      refetch()
    } catch (error: any) {
      setUploadError(error.error || 'Upload failed')
    } finally {
      setIsUploading(false)
    }
  }

  const handleNudge = (contract: Contract) => {
    sendNudge.mutate({
      contractId: contract.id,
      from: vendorEmail,
    })
  }

  const handleViewContract = (contract: Contract) => {
    if (contract.storageUrl) {
      window.open(contract.storageUrl, '_blank')
    } else if (contract.signedFile) {
      window.open(`/signed/${contract.signedFile}`, '_blank')
    } else {
      window.open(`/contract/${contract.id}/pdf`, '_blank')
    }
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Vendor Dashboard</h1>
        <p className="text-gray-600">Upload contracts and manage your submissions</p>
      </motion.div>

      {/* Upload Form */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="card p-6 mb-8"
      >
        <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
          <Upload className="w-5 h-5 mr-2 text-primary-600" />
          Upload New Contract
        </h2>

        {uploadError && <ErrorBanner error={uploadError} onDismiss={() => setUploadError('')} />}

        <form onSubmit={handleUpload} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Distributor Email *
              </label>
              <input
                type="email"
                value={distributorEmail}
                onChange={(e) => setDistributorEmail(e.target.value)}
                className="input"
                placeholder="distributor@example.com"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Your Email *
              </label>
              <input
                type="email"
                value={vendorEmail}
                onChange={(e) => setVendorEmail(e.target.value)}
                className="input"
                placeholder="you@vendor.com"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Contract PDF *
            </label>
            <input
              id="file-input"
              type="file"
              accept="application/pdf"
              onChange={handleFileSelect}
              className="input"
              required
            />
            {selectedFile && (
              <p className="text-sm text-green-600 mt-1">
                Selected: {selectedFile.name}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={isUploading || !selectedFile || !distributorEmail || !vendorEmail}
            className="btn-primary"
          >
            {isUploading ? (
              <LoadingSpinner className="mr-2" />
            ) : (
              <Send className="w-4 h-4 mr-2" />
            )}
            {isUploading ? 'Uploading...' : 'Upload & Send'}
          </button>
        </form>
      </motion.div>

      {/* Contracts List */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center">
            <FileText className="w-5 h-5 mr-2 text-primary-600" />
            Your Contracts
          </h2>
          <button
            onClick={() => refetch()}
            disabled={isLoading}
            className="btn-secondary"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {isLoading && (
          <div className="text-center py-12">
            <LoadingSpinner />
            <p className="text-gray-600 mt-4">Loading contracts...</p>
          </div>
        )}

        {error && (
          <ErrorBanner error="Failed to load contracts" />
        )}

        {!isLoading && !error && (
          <>
            {!contracts || contracts.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No contracts yet</h3>
                <p className="text-gray-600">Upload your first contract to get started</p>
              </div>
            ) : (
              <div className="space-y-4">
                {contracts.map((contract, index) => (
                  <motion.div
                    key={contract.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <ContractCard
                      contract={contract}
                      onOpen={handleViewContract}
                      onNudge={handleNudge}
                      showVendorInfo={false}
                      showProgress={true}
                    />
                  </motion.div>
                ))}
              </div>
            )}
          </>
        )}
      </motion.div>
    </div>
  )
}