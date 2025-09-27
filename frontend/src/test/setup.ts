import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Mock Firebase
vi.mock('@/config/firebase', () => ({
  auth: {},
  db: {},
}))

// Mock API client
vi.mock('@/api/client', () => ({
  apiClient: {
    setToken: vi.fn(),
    getContracts: vi.fn(),
    uploadContract: vi.fn(),
    signContract: vi.fn(),
  },
}))

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: 'div',
    button: 'button',
    form: 'form',
    input: 'input',
    canvas: 'canvas',
    path: 'path',
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
}))