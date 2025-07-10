export interface Account {
  id: string;
  name: string;
  type: AccountType;
  platform: string;
  credentials: Record<string, any>;
  status: AccountStatus;
  createdAt: Date;
  updatedAt: Date;
  lastUsedAt?: Date;
  groupId?: string;
}

export type AccountType = 'wallet' | 'social' | 'email' | 'proxy' | 'custom';

export type AccountStatus = 'active' | 'inactive' | 'blocked' | 'expired' | 'unverified';

export interface AccountGroup {
  id: string;
  name: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
  accounts: Account[];
}

export interface AccountFilter {
  type?: AccountType;
  platform?: string;
  status?: AccountStatus;
  groupId?: string;
  search?: string;
}

export interface CreateAccountRequest {
  name: string;
  type: AccountType;
  platform: string;
  credentials: Record<string, any>;
  groupId?: string;
}

export interface VerificationResult {
  success: boolean;
  status: AccountStatus;
  message?: string;
  lastChecked: Date;
}

export interface BatchVerificationResult {
  results: Array<{
    accountId: string;
    result: VerificationResult;
  }>;
}

export interface ImportData {
  accounts: CreateAccountRequest[];
  format: 'csv' | 'json';
}

export interface ImportResult {
  success: boolean;
  imported: number;
  failed: number;
  errors?: string[];
}

export interface ExportData {
  accounts: Account[];
  format: 'csv' | 'json';
  exportedAt: Date;
}