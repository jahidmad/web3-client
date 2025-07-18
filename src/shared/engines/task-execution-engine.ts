/**
 * Task Execution Engine
 * 
 * This module implements the core functionality for executing plugin tasks
 * in a controlled environment with proper isolation and resource management.
 */

import { 
  Task, 
  ExecutionRequest, 
  Execution, 
  ExecutionStatus, 
  ExecutionContext,
  ExecutionResult,
  TaskError,
  ErrorCode
} from '../types/plugin-task-system';

// ============================================================================
// EXECUTION ENGINE INTERFACES
// ============================================================================

/**
 * Browser interface for task execution
 */
export interface TaskBrowser {
  id: string;
  name: string;
  isAvailable(): Promise<boolean>;
  createPage(): Promise<TaskPage>;
}

/**
 * Page interface for task execution
 */
export interface TaskPage {
  // 页面导航API
  goto(url: string, options?: { timeout?: number; waitUntil?: string }): Promise<void>;
  url(): Promise<string>;
  title(): Promise<string>;
  content(): Promise<string>;
  reload(options?: { timeout?: number; waitUntil?: string }): Promise<void>;
  goBack(options?: { timeout?: number; waitUntil?: string }): Promise<void>;
  goForward(options?: { timeout?: number; waitUntil?: string }): Promise<void>;
  waitForNavigation(options?: { timeout?: number; waitUntil?: string }): Promise<void>;
  waitForLoadState(state: string, options?: { timeout?: number }): Promise<void>;
  
  // 数据提取API
  getText(selector: string): Promise<string>;
  getAttribute(selector: string, attribute: string): Promise<string>;
  getTable(selector: string): Promise<string[][]>;
  getCount(selector: string): Promise<number>;
  getInnerHTML(selector: string): Promise<string>;
  getOuterHTML(selector: string): Promise<string>;
  getLinks(selector?: string): Promise<Array<{href: string, text: string}>>;
  getImages(selector?: string): Promise<Array<{src: string, alt: string}>>;
  
  // 等待操作
  waitFor(selector: string, options?: { timeout?: number; visible?: boolean; hidden?: boolean }): Promise<void>;
  waitForText(text: string, options?: { timeout?: number }): Promise<void>;
  
  // 高级操作
  screenshot(options?: { type?: string; quality?: number; fullPage?: boolean }): Promise<Buffer>;
  pdf(options?: { format?: string; landscape?: boolean; printBackground?: boolean }): Promise<Buffer>;
  evaluate<T>(fn: string | Function, ...args: any[]): Promise<T>;
  close(): Promise<void>;
}

/**
 * Execution environment for tasks
 */
export interface ExecutionEnvironment {
  createContext(request: ExecutionRequest, task: Task): Promise<ExecutionContext>;
  executeCode(code: string, context: ExecutionContext): Promise<ExecutionResult>;
  cleanup(context: ExecutionContext): Promise<void>;
}

/**
 * Execution storage interface
 */
export interface ExecutionStorage {
  createExecution(execution: Omit<Execution, 'id'>): Promise<Execution>;
  updateExecution(id: string, updates: Partial<Execution>): Promise<Execution>;
  getExecution(id: string): Promise<Execution | null>;
  getExecutions(taskId?: string): Promise<Execution[]>;
}

/**
 * Execution logger interface
 */
export interface ExecutionLogger {
  log(executionId: string, message: string, level?: 'debug' | 'info' | 'warn' | 'error'): Promise<void>;
  getLogs(executionId: string): Promise<Array<{ timestamp: Date; message: string; level: 'debug' | 'info' | 'warn' | 'error' }>>;
}

// ============================================================================
// TASK EXECUTION ENGINE IMPLEMENTATION
// ============================================================================

/**
 * Task Execution Engine - Core implementation
 */
export class TaskExecutionEngine {
  private environment: ExecutionEnvironment;
  private storage: ExecutionStorage;
  private logger: ExecutionLogger;
  private activeExecutions: Map<string, { context: ExecutionContext; abortController: AbortController }> = new Map();

  constructor(environment: ExecutionEnvironment, storage: ExecutionStorage, logger: ExecutionLogger) {
    this.environment = environment;
    this.storage = storage;
    this.logger = logger;
  }

  /**
   * Execute a task with the given parameters
   */
  async executeTask(request: ExecutionRequest, task: Task): Promise<Execution> {
    // Create initial execution record
    const execution: Omit<Execution, 'id'> = {
      taskId: task.id,
      browserId: request.browserId || '',
      status: ExecutionStatus.PENDING,
      parameters: request.parameters || {},
      startTime: new Date(),
      progress: 0,
      logs: []
    };

    let executionRecord: Execution | undefined;
    try {
      // Store the execution record
      executionRecord = await this.storage.createExecution(execution);
      
      // Log the start of execution
      await this.logger.log(executionRecord.id, `Starting execution of task: ${task.name}`);
      
      // Update status to running
      executionRecord = await this.storage.updateExecution(executionRecord.id, {
        status: ExecutionStatus.RUNNING
      });

      // Create abort controller for cancellation
      const abortController = new AbortController();
      
      // Create execution context
      const context = await this.environment.createContext(request, task);
      
      // Store active execution
      this.activeExecutions.set(executionRecord.id, { context, abortController });
      
      // Execute the task code
      const result = await this.executeTaskWithTimeout(task, context, executionRecord.id, request.timeout);
      
      // Update execution record with results
      const endTime = new Date();
      const duration = endTime.getTime() - executionRecord.startTime.getTime();
      
      executionRecord = await this.storage.updateExecution(executionRecord.id, {
        status: ExecutionStatus.COMPLETED,
        endTime,
        duration,
        progress: 100,
        result: result.data,
        memoryUsage: result.memoryUsage,
        cpuUsage: result.cpuUsage
      });
      
      // Log completion
      await this.logger.log(executionRecord.id, `Execution completed successfully`);
      
      // Cleanup
      await this.environment.cleanup(context);
      this.activeExecutions.delete(executionRecord.id);
      
      return executionRecord;
    } catch (error) {
      // Handle execution errors
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // If we have an execution record, update it with the error
      if (executionRecord) {
        const endTime = new Date();
        const duration = endTime.getTime() - executionRecord.startTime.getTime();
        
        executionRecord = await this.storage.updateExecution(executionRecord.id, {
          status: ExecutionStatus.FAILED,
          endTime,
          duration,
          error: errorMessage
        });
        
        // Log the error
        await this.logger.log(executionRecord.id, `Execution failed: ${errorMessage}`, 'error');
        
        // Cleanup if context exists
        const activeExecution = this.activeExecutions.get(executionRecord.id);
        if (activeExecution) {
          await this.environment.cleanup(activeExecution.context);
          this.activeExecutions.delete(executionRecord.id);
        }
        
        return executionRecord;
      }
      
      // If we don't have an execution record yet, throw the error
      throw new TaskError(
        ErrorCode.EXECUTION_FAILED,
        `Failed to execute task: ${errorMessage}`
      );
    }
  }

  /**
   * Stop an active execution
   */
  async stopExecution(executionId: string): Promise<void> {
    const activeExecution = this.activeExecutions.get(executionId);
    if (!activeExecution) {
      throw new TaskError(
        ErrorCode.EXECUTION_NOT_FOUND,
        `No active execution found with ID: ${executionId}`
      );
    }

    try {
      // Abort the execution
      activeExecution.abortController.abort();
      
      // Update the execution record
      const endTime = new Date();
      const execution = await this.storage.getExecution(executionId);
      
      if (execution) {
        const duration = endTime.getTime() - execution.startTime.getTime();
        
        await this.storage.updateExecution(executionId, {
          status: ExecutionStatus.STOPPED,
          endTime,
          duration
        });
        
        // Log the stop
        await this.logger.log(executionId, 'Execution stopped by user');
      }
      
      // Cleanup
      await this.environment.cleanup(activeExecution.context);
      this.activeExecutions.delete(executionId);
    } catch (error) {
      throw new TaskError(
        ErrorCode.EXECUTION_FAILED,
        `Failed to stop execution: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Get execution details
   */
  async getExecution(executionId: string): Promise<Execution | null> {
    try {
      const execution = await this.storage.getExecution(executionId);
      
      if (execution) {
        // Get logs
        const logs = await this.logger.getLogs(executionId);
        return {
          ...execution,
          logs
        };
      }
      
      return null;
    } catch (error) {
      throw new TaskError(
        ErrorCode.DATABASE_ERROR,
        `Failed to get execution: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Get executions for a task
   */
  async getExecutions(taskId?: string): Promise<Execution[]> {
    try {
      return await this.storage.getExecutions(taskId);
    } catch (error) {
      throw new TaskError(
        ErrorCode.DATABASE_ERROR,
        `Failed to get executions: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
  
  /**
   * Create an execution with a pre-existing result (e.g., from cache)
   */
  async createExecutionWithResult(
    request: ExecutionRequest,
    task: Task,
    result: ExecutionResult,
    fromCache: boolean = false
  ): Promise<Execution> {
    // Create initial execution record
    const execution: Omit<Execution, 'id'> = {
      taskId: task.id,
      browserId: request.browserId || '',
      status: ExecutionStatus.COMPLETED,
      parameters: request.parameters || {},
      startTime: new Date(),
      endTime: new Date(),
      duration: 0, // Instant execution since we're using cached result
      progress: 100,
      logs: [],
      result: result,
      memoryUsage: result.memoryUsage,
      cpuUsage: result.cpuUsage
    };

    try {
      // Store the execution record
      const executionRecord = await this.storage.createExecution(execution);
      
      // Log the use of cached result
      if (fromCache) {
        await this.logger.log(executionRecord.id, `Using cached result for task: ${task.name}`);
      } else {
        await this.logger.log(executionRecord.id, `Created execution with pre-existing result for task: ${task.name}`);
      }
      
      return executionRecord;
    } catch (error) {
      throw new TaskError(
        ErrorCode.DATABASE_ERROR,
        `Failed to create execution with result: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Execute task code with timeout
   */
  private async executeTaskWithTimeout(
    task: Task, 
    context: ExecutionContext, 
    executionId: string, 
    timeout?: number
  ): Promise<ExecutionResult> {
    // Use task config timeout if not specified in request
    const executionTimeout = timeout || task.config.timeout || 30000;
    
    try {
      // Create a promise that resolves when the task completes or rejects on timeout
      const executionPromise = this.environment.executeCode(task.code, context);
      
      const timeoutPromise = new Promise<ExecutionResult>((_, reject) => {
        setTimeout(() => {
          reject(new TaskError(ErrorCode.EXECUTION_TIMEOUT, `Task execution timed out after ${executionTimeout}ms`));
        }, executionTimeout);
      });
      
      // Race the execution against the timeout
      return await Promise.race([executionPromise, timeoutPromise]);
    } catch (error) {
      if (error instanceof TaskError) {
        throw error;
      }
      
      throw new TaskError(
        ErrorCode.EXECUTION_FAILED,
        `Task execution failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}

// ============================================================================
// IN-MEMORY IMPLEMENTATIONS FOR TESTING
// ============================================================================

/**
 * In-memory execution storage implementation
 */
export class InMemoryExecutionStorage implements ExecutionStorage {
  private executions: Map<string, Execution> = new Map();
  private nextId = 1;

  async createExecution(executionData: Omit<Execution, 'id'>): Promise<Execution> {
    const id = `exec_${this.nextId++}`;
    const execution: Execution = {
      ...executionData,
      id
    };
    
    this.executions.set(id, execution);
    return { ...execution };
  }

  async updateExecution(id: string, updates: Partial<Execution>): Promise<Execution> {
    const execution = this.executions.get(id);
    if (!execution) {
      throw new Error(`Execution with id ${id} not found`);
    }

    const updatedExecution: Execution = {
      ...execution,
      ...updates
    };

    this.executions.set(id, updatedExecution);
    return { ...updatedExecution };
  }

  async getExecution(id: string): Promise<Execution | null> {
    const execution = this.executions.get(id);
    return execution ? { ...execution } : null;
  }

  async getExecutions(taskId?: string): Promise<Execution[]> {
    const executions = Array.from(this.executions.values());
    
    if (taskId) {
      return executions
        .filter(execution => execution.taskId === taskId)
        .map(execution => ({ ...execution }));
    }
    
    return executions.map(execution => ({ ...execution }));
  }
}

/**
 * In-memory execution logger implementation
 */
export class InMemoryExecutionLogger implements ExecutionLogger {
  private logs: Map<string, Array<{ timestamp: Date; message: string; level: 'debug' | 'info' | 'warn' | 'error' }>> = new Map();

  async log(executionId: string, message: string, level: 'debug' | 'info' | 'warn' | 'error' = 'info'): Promise<void> {
    const executionLogs = this.logs.get(executionId) || [];
    
    executionLogs.push({
      timestamp: new Date(),
      message,
      level
    });
    
    this.logs.set(executionId, executionLogs);
  }

  async getLogs(executionId: string): Promise<Array<{ timestamp: Date; message: string; level: 'debug' | 'info' | 'warn' | 'error' }>> {
    return this.logs.get(executionId) || [];
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create a task execution engine with the given components
 */
export function createTaskExecutionEngine(
  environment: ExecutionEnvironment,
  storage: ExecutionStorage,
  logger: ExecutionLogger
): TaskExecutionEngine {
  return new TaskExecutionEngine(environment, storage, logger);
}

/**
 * Create an in-memory task execution engine for testing
 */
export function createInMemoryTaskExecutionEngine(environment: ExecutionEnvironment): TaskExecutionEngine {
  const storage = new InMemoryExecutionStorage();
  const logger = new InMemoryExecutionLogger();
  return createTaskExecutionEngine(environment, storage, logger);
}