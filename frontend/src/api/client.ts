import axios, { AxiosInstance, AxiosError } from 'axios'
import { ApiError } from '@/types'

class ApiClient {
  private client: AxiosInstance
  private idToken: string | null = null

  constructor() {
    this.client = axios.create({
      baseURL: '',
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    })

    // Request interceptor to add auth token
    this.client.interceptors.request.use((config) => {
      if (this.idToken) {
        config.headers.Authorization = `Bearer ${this.idToken}`
      }
      return config
    })

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        const apiError: ApiError = {
          error: 'Network error',
          detail: error.message,
        }

        if (error.response?.data) {
          const data = error.response.data as any
          apiError.error = data.error || 'Server error'
          apiError.detail = data.detail || data.message
        }

        return Promise.reject(apiError)
      }
    )
  }

  setToken(token: string | null) {
    this.idToken = token
  }

  // Auth endpoints
  async identifyUser(idToken: string, role: string) {
    return this.client.post('/api/user/identify', { idToken, role })
  }

  // Contract endpoints
  async getContracts() {
    const response = await this.client.get('/api/contracts')
    return response.data
  }

  async getVendorContracts(vendorEmail: string) {
    const response = await this.client.get('/api/vendor/contracts', {
      params: { vendorEmail },
    })
    return response.data
  }

  async getContract(id: string) {
    const response = await this.client.get(`/api/contract/${id}`)
    return response.data
  }

  async getContractAccess(id: string) {
    const response = await this.client.get(`/api/contract/${id}/access`)
    return response.data
  }

  async uploadContract(data: FormData) {
    const response = await this.client.post('/api/vendor/upload', data, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
    return response.data
  }

  async signContract(data: {
    contractId: string
    name: string
    signatureDataUrl: string
  }) {
    const response = await this.client.post('/api/sign', data)
    return response.data
  }

  async recordEvent(contractId: string, event: string) {
    const response = await this.client.post(`/api/contract/${contractId}/event`, {
      event,
    })
    return response.data
  }

  // Nudge/Notification endpoints
  async sendNudge(contractId: string, data: { from: string; message?: string }) {
    const response = await this.client.post(
      `/api/contract/${contractId}/nudge`,
      data
    )
    return response.data
  }

  async getNotifications(email: string) {
    const response = await this.client.get('/api/notifications', {
      params: { email },
    })
    return response.data
  }

  async markNotificationsRead(ids: string[]) {
    const response = await this.client.post('/api/notifications/mark-read', {
      ids,
    })
    return response.data
  }

  // Chat endpoints
  async sendChatMessage(message: string) {
    const response = await this.client.post('/api/chat', { message })
    return response.data
  }

  async getChatWelcome() {
    const response = await this.client.get('/api/chat/welcome')
    return response.data
  }
}

export const apiClient = new ApiClient()
export default apiClient