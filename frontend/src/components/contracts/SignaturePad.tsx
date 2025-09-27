import React, { useRef, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { RotateCcw, Check } from 'lucide-react'

interface SignaturePadProps {
  onSignatureChange: (dataUrl: string) => void
  disabled?: boolean
}

export const SignaturePad: React.FC<SignaturePadProps> = ({
  onSignatureChange,
  disabled = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasSignature, setHasSignature] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set canvas size
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * window.devicePixelRatio
    canvas.height = rect.height * window.devicePixelRatio
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio)

    // Set drawing styles
    ctx.strokeStyle = '#1f2937'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    // Clear canvas
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }, [])

  const getEventPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }

    const rect = canvas.getBoundingClientRect()
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY

    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    }
  }

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    if (disabled) return

    setIsDrawing(true)
    const pos = getEventPos(e)
    const ctx = canvasRef.current?.getContext('2d')
    if (ctx) {
      ctx.beginPath()
      ctx.moveTo(pos.x, pos.y)
    }
  }

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || disabled) return

    const pos = getEventPos(e)
    const ctx = canvasRef.current?.getContext('2d')
    if (ctx) {
      ctx.lineTo(pos.x, pos.y)
      ctx.stroke()
    }
  }

  const stopDrawing = () => {
    if (!isDrawing) return

    setIsDrawing(false)
    setHasSignature(true)

    // Get signature data
    const canvas = canvasRef.current
    if (canvas) {
      const dataUrl = canvas.toDataURL('image/png')
      onSignatureChange(dataUrl)
    }
  }

  const clearSignature = () => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (canvas && ctx) {
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      setHasSignature(false)
      onSignatureChange('')
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      <div className="relative">
        <canvas
          ref={canvasRef}
          className={`signature-pad w-full h-40 ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
        
        {!hasSignature && !disabled && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-gray-400 text-sm">Sign here</p>
          </div>
        )}

        {hasSignature && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute top-2 right-2 bg-green-100 text-green-600 p-1 rounded-full"
          >
            <Check className="w-4 h-4" />
          </motion.div>
        )}
      </div>

      <div className="flex justify-between items-center">
        <button
          type="button"
          onClick={clearSignature}
          disabled={disabled || !hasSignature}
          className="btn-secondary text-sm disabled:opacity-50"
        >
          <RotateCcw className="w-4 h-4 mr-2" />
          Clear
        </button>

        <p className="text-xs text-gray-500">
          {hasSignature ? 'Signature captured' : 'Draw your signature above'}
        </p>
      </div>
    </motion.div>
  )
}