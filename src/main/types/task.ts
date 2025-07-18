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

// 任务依赖定义
export interface TaskDependency {
  name: string;
  version: string;
  type: 'npm' | 'browser-api' | 'system' | 'builtin';
  optional?: boolean;
  reason?: string; // 依赖用途说明
}

// 任务运行时环境要求
export interface TaskRuntime {
  nodeVersion?: string; // 最低Node.js版本要求
  platform?: string[]; // 支持的操作系统平台
  memory?: number; // 最低内存要求(MB)
  timeout?: number; // 任务超时时间(秒)
  sandbox?: boolean; // 是否需要沙箱环境
  permissions?: string[]; // 需要的权限列表
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
  dependencies?: TaskDependency[];
  runtime?: TaskRuntime;
  license?: string;
  repository?: string;
  homepage?: string;
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

// 依赖安装状态
export interface DependencyStatus {
  name: string;
  version: string;
  type: TaskDependency['type'];
  installed: boolean;
  installedVersion?: string;
  compatible: boolean;
  error?: string;
  installPath?: string;
}

// 任务依赖检查结果
export interface TaskDependencyCheck {
  taskId: string;
  satisfied: boolean;
  dependencies: DependencyStatus[];
  missingDependencies: TaskDependency[];
  incompatibleDependencies: TaskDependency[];
  installRequired: boolean;
}

// 依赖安装请求
export interface InstallDependencyRequest {
  taskId: string;
  dependencies: TaskDependency[];
  force?: boolean; // 强制重新安装
}

// 依赖安装结果
export interface InstallDependencyResult {
  success: boolean;
  installed: DependencyStatus[];
  failed: Array<{ dependency: TaskDependency; error: string }>;
  warnings: string[];
}

// 任务沙箱配置
export interface TaskSandboxConfig {
  enabled: boolean;
  isolateNetwork?: boolean;
  allowedDomains?: string[];
  maxMemory?: number; // MB
  maxExecutionTime?: number; // 秒
  allowFileSystem?: boolean;
  allowedPaths?: string[];
  environmentVariables?: Record<string, string>;
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
  dependencyStatus?: TaskDependencyCheck;
  sandboxConfig?: TaskSandboxConfig;
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
    // 基本等待和延迟
    wait: (ms: number) => Promise<void>;
    sleep: (ms: number) => Promise<void>;
    
    // 页面元素操作
    waitForSelector: (selector: string, timeout?: number) => Promise<any>;
    click: (selector: string) => Promise<void>;
    type: (selector: string, text: string) => Promise<void>;
    extractText: (selector: string) => Promise<string>;
    extractAttribute: (selector: string, attribute: string) => Promise<string>;
    
    // 截图和文件操作
    screenshot: (filename?: string) => Promise<string>;
    saveFile: (content: string | Buffer, filename: string) => Promise<string>;
    
    // 字符串和数据处理工具
    formatDate: (date: Date, format?: string) => string;
    isValidEmail: (email: string) => boolean;
    isValidUrl: (url: string) => boolean;
    randomString: (length?: number) => string;
    
    // 数组和对象工具
    unique: (array: any[]) => any[];
    groupBy: (array: any[], key: string) => Record<string, any[]>;
    
    // 数据解析
    parseCSV: (csvText: string) => any[];
    safeJsonParse: (jsonStr: string, defaultValue?: any) => any;
    
    // 哈希和加密工具
    createHash: (content: string) => string;
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