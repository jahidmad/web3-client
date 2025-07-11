// 任务参数类型定义
export type TaskParameterType = 
  | 'string' 
  | 'number' 
  | 'boolean' 
  | 'select' 
  | 'multiselect'
  | 'url'
  | 'email'
  | 'password'
  | 'textarea'
  | 'file';

// 任务参数定义
export interface TaskParameter {
  name: string;
  label: string;
  type: TaskParameterType;
  required: boolean;
  defaultValue?: any;
  description?: string;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    options?: Array<{ label: string; value: any }>;
  };
}

// 任务元信息
export interface TaskMetadata {
  id: string;
  name: string;
  description: string;
  version: string;
  author: string;
  logoUrl?: string;
  category: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

// 任务文件结构
export interface TaskFile {
  metadata: TaskMetadata;
  parameters: TaskParameter[];
  code: string; // 任务执行代码
  examples?: Array<{
    name: string;
    description: string;
    parameters: Record<string, any>;
  }>;
}

// 本地任务记录
export interface LocalTask {
  id: string;
  filePath: string;
  metadata: TaskMetadata;
  parameters: TaskParameter[];
  addedAt: Date;
  lastUsed?: Date;
  usageCount: number;
  status: 'active' | 'disabled';
}

// 任务执行请求
export interface TaskExecutionRequest {
  taskId: string;
  browserId: string;
  parameters: Record<string, any>;
  debug?: boolean;
}

// 任务执行状态
export type TaskExecutionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

// 任务执行记录
export interface TaskExecution {
  id: string;
  taskId: string;
  browserId: string;
  status: TaskExecutionStatus;
  parameters: Record<string, any>;
  startTime: Date;
  endTime?: Date;
  result?: any;
  error?: string;
  logs: Array<{
    level: 'info' | 'warn' | 'error' | 'debug';
    message: string;
    timestamp: Date;
  }>;
  progress?: {
    current: number;
    total: number;
    message?: string;
  };
}

// 任务统计
export interface TaskStats {
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  averageExecutionTime: number;
  lastExecutionTime?: Date;
}

// 任务商店/远程任务
export interface RemoteTask {
  id: string;
  metadata: TaskMetadata;
  downloadUrl: string;
  size: number;
  downloads: number;
  rating: number;
  reviews: number;
  isInstalled: boolean;
}

// 任务执行上下文
export interface TaskExecutionContext {
  browser: any; // Puppeteer Browser instance
  page: any;    // Puppeteer Page instance
  parameters: Record<string, any>;
  log: (level: 'info' | 'warn' | 'error' | 'debug', message: string) => void;
  progress: (current: number, total: number, message?: string) => void;
  utils: {
    wait: (ms: number) => Promise<void>;
    waitForSelector: (selector: string, timeout?: number) => Promise<any>;
    click: (selector: string) => Promise<void>;
    type: (selector: string, text: string) => Promise<void>;
    screenshot: (filename?: string) => Promise<string>;
    extractText: (selector: string) => Promise<string>;
    extractAttribute: (selector: string, attribute: string) => Promise<string>;
  };
}

// API 请求类型
export interface UploadTaskRequest {
  file: File | Buffer;
  filename: string;
}

export interface ImportTaskRequest {
  url: string;
}

export interface GetTasksRequest {
  category?: string;
  tags?: string[];
  search?: string;
  status?: 'active' | 'disabled';
  limit?: number;
  offset?: number;
}

export interface ExecuteTaskRequest extends TaskExecutionRequest {}

// 兼容性：保留原有类型以避免破坏现有代码
export interface Task {
  id: string;
  name: string;
  description?: string;
  script: string;
  args?: Record<string, any>;
  timeout: number;
  retryCount: number;
  createdAt: Date;
  updatedAt: Date;
  status: TaskStatus;
  groupId?: string;
}

export type TaskStatus = 'draft' | 'active' | 'paused' | 'archived';
export type ExecutionStatus = TaskExecutionStatus;