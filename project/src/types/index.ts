export interface User {
  uid?: string;
  role: 'vendor' | 'distributor';
  email: string;
}

export interface Contract {
  id: string;
  file: string;
  status: 'pending' | 'signed';
  createdAt: string;
  vendorId: string;
  vendorEmail: string;
  assignedToEmail: string;
  originalName?: string;
  storageUrl?: string;
  signedFile?: string;
  signedAt?: string;
  access?: ContractAccess;
  events?: {
    slackVisited?: boolean;
    notionCompleted?: boolean;
  };
}

export interface ContractAccess {
  unlocked: boolean;
  generatedAt: string;
  expiresAt: string;
  progress: number;
  credentials?: {
    username: string;
    password: string;
    token: string;
  };
  tools?: Array<{
    name: string;
    url: string;
  }>;
}

export interface UploadResponse {
  ok: boolean;
  id: string;
  storageUrl?: string;
  file?: string;
}

export interface NudgeResponse {
  ok: boolean;
  nudge: {
    id: string;
    contractId: string;
    from: string;
    to: string;
    message: string;
    createdAt: string;
  };
}