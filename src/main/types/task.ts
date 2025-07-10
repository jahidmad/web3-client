export interface TaskConfig {
  id?: string;
  name: string;
  description?: string;
  script: string;
  args?: Record<string, any>;
  timeout?: number;
  retryCount?: number;
  browserIds?: string[];
  groupId?: string;
}

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

export interface TaskExecution {
  id: string;
  taskId: string;
  browserId: string;
  status: ExecutionStatus;
  startTime: Date;
  endTime?: Date;
  result?: any;
  error?: string;
  logs?: string[];
  retryCount: number;
}

export type ExecutionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface TaskStats {
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  averageExecutionTime: number;
  lastExecutionTime?: Date;
}

export interface ExecutionFilter {
  status?: ExecutionStatus;
  browserId?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export interface CreateTaskRequest {
  name: string;
  description?: string;
  script: string;
  args?: Record<string, any>;
  timeout?: number;
  retryCount?: number;
  groupId?: string;
}

export interface ExecuteTaskRequest {
  taskId: string;
  browserIds: string[];
  args?: Record<string, any>;
}