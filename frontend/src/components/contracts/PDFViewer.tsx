import React from 'react'
import { motion } from 'framer-motion'
import { ExternalLink } from 'lucide-react'

interface PDFViewerProps {
  contractId: string
  className?: string
}

export const PDFViewer: React.FC<PDFViewerProps> = ({ contractId, className = '' }) => {
  const pdfUrl = `/contract/${contractId}/pdf`

  const handleOpenInNewTab = () => {
    window.open(pdfUrl, '_blank')
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={`relative bg-white rounded-lg border border-gray-200 overflow-hidden ${className}`}
    >
      <div className="absolute top-2 right-2 z-10">
        <button
          onClick={handleOpenInNewTab}
          className="p-2 bg-white/90 hover:bg-white rounded-lg shadow-sm transition-colors"
          title="Open in new tab"
        >
          <ExternalLink className="w-4 h-4 text-gray-600" />
        </button>
      </div>
      
      <iframe
        src={pdfUrl}
        className="w-full h-full border-0"
        title="Contract PDF"
        loading="lazy"
      />
    </motion.div>
  )
}