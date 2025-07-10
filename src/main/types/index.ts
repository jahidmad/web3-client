export * from './browser';
export * from './task';
export * from './account';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: Date;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface LogEntry {
  timestamp: Date;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  context?: string;
  metadata?: Record<string, any>;
}

export interface SystemConfig {
  maxConcurrentBrowsers: number;
  defaultTimeout: number;
  retryAttempts: number;
  logLevel: 'info' | 'warn' | 'error' | 'debug';
  dataDirectory: string;
  autoCleanup: boolean;
  cleanupInterval: number;
}