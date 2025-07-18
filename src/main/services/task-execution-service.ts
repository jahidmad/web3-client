/**
 * Task Execution Service
 * 
 * This service integrates all the task execution components and provides
 * a high-level API for executing plugin tasks.
 */

import { PrismaClient } from '@prisma/client';
import { BrowserManager } from './browser-manager';
import { TaskExecutionEngine } from '../../shared/engines/task-execution-engine';
import { BrowserExecutionEnvironment } from '../../shared/engines/browser-execution-environment';
import { BrowserManagerAdapter } from '../adapters/browser-adapter';
import { DatabaseExecutionStorageAdapter } from '../adapters/execution-storage-adapter';
import { DatabaseExecutionLoggerAdapter } from '../adapters/execution-logger-adapter';
import { ResultCacheManager } from './result-cache-manager';
import { 
  Task, 
  ExecutionRequest, 
  Execution,
  ExecutionResult,
  TaskError,
  ErrorCode
} from '../../shared/types/plugin-task-system';

/**
 * Task Execution Service - Main service for executing plugin tasks
 */
export class TaskExecutionService {
  private executionEngine: TaskExecutionEngine;
  private browserManager: BrowserManager;
  private prisma: PrismaClient;
  private resultCache: ResultCacheManager;

  constructor(browserManager: BrowserManager, prisma: PrismaClient) {
    this.browserManager = browserManager;
    this.prisma = prisma;
    
    // Create the browser adapter
    const browserAdapter = new BrowserManagerAdapter(browserManager);
    
    // Create the execution environment
    const executionEnvironment = new BrowserExecutionEnvironment(browserAdapter);
    
    // Create the storage and logger adapters
    const executionStorage = new DatabaseExecutionStorageAdapter(prisma);
    const executionLogger = new DatabaseExecutionLoggerAdapter(prisma);
    
    // Create the result cache manager
    this.resultCache = new ResultCacheManager();
    
    // Create the execution engine
    this.executionEngine = new TaskExecutionEngine(
      executionEnvironment,
      executionStorage,
      executionLogger
    );
  }

  /**
   * Initialize the service
   */
  async initialize(): Promise<void> {
    // Initialize the result cache manager
    await this.resultCache.initialize();
    
    console.log('[TaskExecutionService] Initialized');
  }

  /**
   * Execute a task
   */
  async executeTask(request: ExecutionRequest, task: Task): Promise<Execution> {
    try {
      // Validate the task before execution
      this.validateTask(task);
      
      // Validate the execution request
      this.validateExecutionRequest(request, task);
      
      // Execute the task using the execution engine
      const execution = await this.executionEngine.executeTask(request, task);
      
      // Cache the result if the execution was successful
      if (execution.status === 'completed' && execution.result) {
        try {
          // Cache the execution result
          await this.resultCache.cacheExecution(execution);
        } catch (cacheError) {
          console.error('[TaskExecutionService] Failed to cache execution result:', cacheError);
          // Continue execution even if caching fails
        }
      }
      
      return execution;
    } catch (error) {
      if (error instanceof TaskError) {
        throw error;
      }
      
      throw new TaskError(
        ErrorCode.EXECUTION_FAILED,
        `Failed to execute task: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Stop an active execution
   */
  async stopExecution(executionId: string): Promise<void> {
    return this.executionEngine.stopExecution(executionId);
  }

  /**
   * Get execution details
   */
  async getExecution(executionId: string): Promise<Execution | null> {
    return this.executionEngine.getExecution(executionId);
  }

  /**
   * Get executions for a task
   */
  async getExecutions(taskId?: string): Promise<Execution[]> {
    return this.executionEngine.getExecutions(taskId);
  }
  
  /**
   * Get result cache statistics
   */
  getResultCacheStats() {
    return this.resultCache.getCacheStats();
  }
  
  /**
   * Clear result cache for a task
   */
  async clearTaskResultCache(taskId: string): Promise<void> {
    await this.resultCache.clearTaskCache(taskId);
  }
  
  /**
   * Clean up the result cache
   */
  async cleanupResultCache(): Promise<void> {
    await this.resultCache.cleanupCache();
  }

  /**
   * Validate a task before execution
   */
  private validateTask(task: Task): void {
    if (!task.id) {
      throw new TaskError(ErrorCode.INVALID_PARAMETERS, 'Task ID is required');
    }
    
    if (!task.code) {
      throw new TaskError(ErrorCode.INVALID_PARAMETERS, 'Task code is required');
    }
    
    if (!task.name) {
      throw new TaskError(ErrorCode.INVALID_PARAMETERS, 'Task name is required');
    }
    
    // Validate that the task has an execute function
    if (!task.code.includes('async function execute(')) {
      throw new TaskError(ErrorCode.INVALID_PARAMETERS, 'Task must contain an execute function');
    }
  }

  /**
   * Validate an execution request
   */
  private validateExecutionRequest(request: ExecutionRequest, task: Task): void {
    // Validate required parameters
    if (task.parameters && task.parameters.length > 0) {
      for (const paramDef of task.parameters) {
        if (paramDef.required && !request.parameters?.[paramDef.name]) {
          throw new TaskError(
            ErrorCode.INVALID_PARAMETERS,
            `Required parameter '${paramDef.name}' is missing`
          );
        }
      }
    }
    
    // Validate parameter types
    if (request.parameters && task.parameters) {
      for (const [paramName, paramValue] of Object.entries(request.parameters)) {
        const paramDef = task.parameters.find(p => p.name === paramName);
        if (paramDef && !this.validateParameterType(paramValue, paramDef.type)) {
          throw new TaskError(
            ErrorCode.INVALID_PARAMETERS,
            `Parameter '${paramName}' has invalid type. Expected ${paramDef.type}, got ${typeof paramValue}`
          );
        }
      }
    }
    
    // Validate browser ID if specified
    if (request.browserId) {
      // This will be validated by the browser adapter when the execution starts
    }
  }

  /**
   * Validate parameter type
   */
  private validateParameterType(value: any, expectedType: string): boolean {
    switch (expectedType) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number';
      case 'boolean':
        return typeof value === 'boolean';
      case 'object':
        return typeof value === 'object' && value !== null;
      case 'array':
        return Array.isArray(value);
      default:
        return true; // Unknown types are allowed
    }
  }
}

/**
 * Create a task execution service
 */
export function createTaskExecutionService(
  browserManager: BrowserManager, 
  prisma: PrismaClient
): TaskExecutionService {
  return new TaskExecutionService(browserManager, prisma);
}