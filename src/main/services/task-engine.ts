import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { Logger } from '../utils/logger';
import { 
  Task, 
  TaskExecution, 
  TaskExecutionStatus,
  TaskStats
} from '../types/task';
import { BrowserManager } from './browser-manager';

/**
 * 任务自动化引擎核心服务
 * 负责管理和执行自动化任务
 */
export class TaskEngine extends EventEmitter {
  private logger: Logger;
  private browserManager: BrowserManager;
  private tasks: Map<string, Task> = new Map();
  private executions: Map<string, TaskExecution> = new Map();
  private isRunning: boolean = false;

  constructor(browserManager: BrowserManager) {
    super();
    this.logger = new Logger('TaskEngine');
    this.browserManager = browserManager;
  }

  /**
   * 启动任务引擎
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('Task engine is already running');
      return;
    }

    this.isRunning = true;
    this.logger.info('Task engine started');
    this.emit('engine:started');
  }

  /**
   * 停止任务引擎
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      this.logger.warn('Task engine is not running');
      return;
    }

    // 停止所有正在执行的任务
    const runningExecutions = Array.from(this.executions.values())
      .filter(execution => execution.status === 'running');

    for (const execution of runningExecutions) {
      await this.stopExecution(execution.id);
    }

    this.isRunning = false;
    this.logger.info('Task engine stopped');
    this.emit('engine:stopped');
  }

  /**
   * 创建任务
   */
  async createTask(task: Task): Promise<Task> {
    const taskId = task.id || uuidv4();
    const now = new Date();
    
    const newTask: Task = {
      ...task,
      id: taskId,
      createdAt: now,
      updatedAt: now,
      status: task.status || 'active'
    };

    this.tasks.set(taskId, newTask);
    this.logger.info(`Task created: ${taskId}`);
    this.emit('task:created', newTask);
    
    return newTask;
  }

  /**
   * 获取所有任务
   */
  async getTasks(): Promise<Task[]> {
    return Array.from(this.tasks.values());
  }

  /**
   * 获取特定任务
   */
  async getTask(taskId: string): Promise<Task | null> {
    return this.tasks.get(taskId) || null;
  }

  /**
   * 更新任务
   */
  async updateTask(taskId: string, updates: Partial<Task>): Promise<Task> {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    const updatedTask = {
      ...task,
      ...updates,
      id: taskId,
      updatedAt: new Date()
    };

    this.tasks.set(taskId, updatedTask);
    this.logger.info(`Task updated: ${taskId}`);
    this.emit('task:updated', updatedTask);
    
    return updatedTask;
  }

  /**
   * 删除任务
   */
  async deleteTask(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    this.tasks.delete(taskId);
    this.logger.info(`Task deleted: ${taskId}`);
    this.emit('task:deleted', taskId);
  }

  /**
   * 执行任务
   */
  async executeTask(request: { taskId: string; browserId: string; variables?: Record<string, any>; debug?: boolean }): Promise<TaskExecution> {
    const task = this.tasks.get(request.taskId);
    if (!task) {
      throw new Error(`Task not found: ${request.taskId}`);
    }

    if (!this.isRunning) {
      throw new Error('Task engine is not running');
    }

    const executionId = uuidv4();
    const now = new Date();

    const execution: TaskExecution = {
      id: executionId,
      taskId: request.taskId,
      browserId: request.browserId,
      status: 'pending',
      parameters: request.variables || {},
      startTime: now,
      logs: [],
      progress: {
        current: 0,
        total: 1,
        message: 'Task execution started'
      }
    };

    this.executions.set(executionId, execution);
    this.logger.info(`Created execution: ${executionId} for task: ${request.taskId}`);
    this.emit('execution:created', execution);

    // 异步执行任务
    this.performExecution(execution, task, request.variables || {}, request.debug || false)
      .catch(error => {
        this.logger.error(`Execution failed: ${executionId}`, error);
      });

    return execution;
  }

  /**
   * 停止任务执行
   */
  async stopExecution(executionId: string): Promise<void> {
    const execution = this.executions.get(executionId);
    if (!execution) {
      throw new Error(`Execution not found: ${executionId}`);
    }

    if (execution.status !== 'running') {
      this.logger.warn(`Execution ${executionId} is not running (status: ${execution.status})`);
      return;
    }

    execution.status = 'cancelled';
    execution.endTime = new Date();

    this.logger.info(`Stopped execution: ${executionId}`);
    this.emit('execution:stopped', execution);
  }

  /**
   * 获取执行记录
   */
  async getExecution(executionId: string): Promise<TaskExecution | null> {
    return this.executions.get(executionId) || null;
  }

  /**
   * 获取任务的执行历史
   */
  async getTaskExecutions(taskId: string): Promise<TaskExecution[]> {
    return Array.from(this.executions.values())
      .filter(execution => execution.taskId === taskId)
      .sort((a, b) => b.startTime.getTime() - a.startTime.getTime());
  }

  /**
   * 获取任务统计
   */
  async getTaskStats(taskId: string): Promise<TaskStats> {
    const executions = await this.getTaskExecutions(taskId);
    const totalExecutions = executions.length;
    const successfulExecutions = executions.filter(e => e.status === 'completed').length;
    const failedExecutions = executions.filter(e => e.status === 'failed').length;
    
    const completedExecutions = executions.filter(e => e.endTime);
    const averageExecutionTime = completedExecutions.length > 0
      ? completedExecutions.reduce((sum, e) => {
          const duration = e.endTime!.getTime() - e.startTime.getTime();
          return sum + duration;
        }, 0) / completedExecutions.length
      : 0;

    const lastExecution = executions.length > 0 ? executions[0].startTime : undefined;

    return {
      totalExecutions,
      successfulExecutions,
      failedExecutions,
      averageExecutionTime,
      lastExecutionTime: lastExecution
    };
  }

  /**
   * 执行任务的核心逻辑
   */
  private async performExecution(
    execution: TaskExecution,
    task: Task,
    variables: Record<string, any>,
    debug: boolean
  ): Promise<void> {
    try {
      execution.status = 'running';
      this.emit('execution:started', execution);

      // 简单的任务执行逻辑（这里可以根据需要扩展）
      execution.logs.push({
        level: 'info',
        message: `Starting execution of task: ${task.name}`,
        timestamp: new Date()
      });

      // 模拟任务执行
      await new Promise(resolve => setTimeout(resolve, 1000));

      execution.status = 'completed';
      execution.endTime = new Date();
      execution.result = { success: true, message: 'Task completed successfully' };
      
      if (execution.progress) {
        execution.progress.current = execution.progress.total;
        execution.progress.message = 'Task completed';
      }

      this.logger.info(`Execution completed: ${execution.id}`);
      this.emit('execution:completed', execution);

    } catch (error) {
      execution.status = 'failed';
      execution.endTime = new Date();
      execution.error = error instanceof Error ? error.message : String(error);
      
      execution.logs.push({
        level: 'error',
        message: `Task execution failed: ${execution.error}`,
        timestamp: new Date()
      });

      this.logger.error(`Execution failed: ${execution.id}`, error);
      this.emit('execution:failed', execution);
    }
  }
}