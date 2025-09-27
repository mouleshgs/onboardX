import { describe, it, expect, vi, beforeEach } from 'vitest'
import axios from 'axios'
import { apiClient } from '@/api/client'

vi.mock('axios')
const mockedAxios = vi.mocked(axios)

describe('ApiClient', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockedAxios.create.mockReturnValue(mockedAxios as any)
  })

  it('creates axios instance with correct config', () => {
    expect(mockedAxios.create).toHaveBeenCalledWith({
      baseURL: '',
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    })
  })

  it('sets authorization header when token is provided', () => {
    const mockRequest = { headers: {} }
    apiClient.setToken('test-token')
    
    // Simulate request interceptor
    const interceptor = mockedAxios.interceptors.request.use.mock.calls[0][0]
    const result = interceptor(mockRequest)
    
    expect(result.headers.Authorization).toBe('Bearer test-token')
  })

  it('handles API errors correctly', async () => {
    const errorResponse = {
      response: {
        data: {
          error: 'Test error',
          detail: 'Test detail',
        },
      },
    }

    mockedAxios.get.mockRejectedValue(errorResponse)

    try {
      await apiClient.getContracts()
    } catch (error: any) {
      expect(error.error).toBe('Test error')
      expect(error.detail).toBe('Test detail')
    }
  })

  it('makes correct API calls', async () => {
    mockedAxios.get.mockResolvedValue({ data: [] })
    mockedAxios.post.mockResolvedValue({ data: { ok: true } })

    await apiClient.getContracts()
    expect(mockedAxios.get).toHaveBeenCalledWith('/api/contracts')

    const formData = new FormData()
    await apiClient.uploadContract(formData)
    expect(mockedAxios.post).toHaveBeenCalledWith('/api/vendor/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
  })
})