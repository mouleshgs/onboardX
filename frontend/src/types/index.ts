export interface User {
  uid: string
  email: string
  role: 'vendor' | 'distributor'
  idToken?: string
}

export interface Contract {
  id: string
  originalName?: string
  file: string
  storageUrl?: string
  vendorEmail?: string
  vendorId?: string
  assignedToEmail?: string
  status: 'pending' | 'signed'
  createdAt: string
  signedFile?: string
  signedAt?: string
  access?: {
    progress: number
    generatedAt: string
    tools: Tool[]
    unlocked?: boolean
    credentials?: {
      username: string
      password: string
      token: string
    }
  }
  events?: {
    slackVisited?: boolean
    notionCompleted?: boolean
  }
}

export interface Tool {
  name: string
  url: string
}

export interface Notification {
  id: string
  contractId: string
  from: string
  to: string
  message: string
  createdAt: string
  read: boolean
}

export interface DashboardStats {
  total: number
  signed: number
  onboarded: number
  byVendor: Record<string, {
    total: number
    signed: number
    onboarded: number
  }>
  recent: Contract[]
}

export interface ApiError {
  error: string
  detail?: string
}

export interface SignatureData {
  contractId: string
  name: string
  signatureDataUrl: string
}

export interface UploadData {
  file: File
  distributorEmail: string
  vendorEmail: string
  vendorId: string
}