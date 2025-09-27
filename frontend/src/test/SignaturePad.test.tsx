import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SignaturePad } from '@/components/contracts/SignaturePad'

// Mock canvas context
const mockGetContext = vi.fn(() => ({
  strokeStyle: '',
  lineWidth: 0,
  lineCap: '',
  lineJoin: '',
  fillStyle: '',
  scale: vi.fn(),
  fillRect: vi.fn(),
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  stroke: vi.fn(),
}))

Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
  value: mockGetContext,
})

Object.defineProperty(HTMLCanvasElement.prototype, 'getBoundingClientRect', {
  value: () => ({
    left: 0,
    top: 0,
    width: 400,
    height: 200,
  }),
})

Object.defineProperty(HTMLCanvasElement.prototype, 'toDataURL', {
  value: () => 'data:image/png;base64,mock-signature-data',
})

describe('SignaturePad', () => {
  it('renders signature pad', () => {
    const mockOnSignatureChange = vi.fn()
    render(<SignaturePad onSignatureChange={mockOnSignatureChange} />)
    
    expect(screen.getByText('Sign here')).toBeInTheDocument()
    expect(screen.getByText('Clear')).toBeInTheDocument()
  })

  it('calls onSignatureChange when signature is drawn', () => {
    const mockOnSignatureChange = vi.fn()
    render(<SignaturePad onSignatureChange={mockOnSignatureChange} />)
    
    const canvas = document.querySelector('canvas')!
    
    // Simulate drawing
    fireEvent.mouseDown(canvas, { clientX: 10, clientY: 10 })
    fireEvent.mouseMove(canvas, { clientX: 20, clientY: 20 })
    fireEvent.mouseUp(canvas)
    
    expect(mockOnSignatureChange).toHaveBeenCalledWith('data:image/png;base64,mock-signature-data')
  })

  it('clears signature when clear button is clicked', () => {
    const mockOnSignatureChange = vi.fn()
    render(<SignaturePad onSignatureChange={mockOnSignatureChange} />)
    
    const canvas = document.querySelector('canvas')!
    const clearButton = screen.getByText('Clear')
    
    // Draw signature first
    fireEvent.mouseDown(canvas, { clientX: 10, clientY: 10 })
    fireEvent.mouseUp(canvas)
    
    // Clear signature
    fireEvent.click(clearButton)
    
    expect(mockOnSignatureChange).toHaveBeenLastCalledWith('')
  })

  it('disables interaction when disabled prop is true', () => {
    const mockOnSignatureChange = vi.fn()
    render(<SignaturePad onSignatureChange={mockOnSignatureChange} disabled />)
    
    const canvas = document.querySelector('canvas')!
    
    // Try to draw
    fireEvent.mouseDown(canvas, { clientX: 10, clientY: 10 })
    fireEvent.mouseMove(canvas, { clientX: 20, clientY: 20 })
    fireEvent.mouseUp(canvas)
    
    // Should not call onSignatureChange when disabled
    expect(mockOnSignatureChange).not.toHaveBeenCalled()
  })
})