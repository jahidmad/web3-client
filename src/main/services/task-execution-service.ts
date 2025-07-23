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
import { Logger } from '../utils/logger';
import { 
  Task, 
  ExecutionRequest, 
  Execution,
  ExecutionResult,
  TaskError,
  ErrorCode
} from '../../shared/types/plugin-task-system';
import { BrowserStatus } from '../types/browser';

/**
 * Task Execution Service - Main service for executing plugin tasks
 */
export class TaskExecutionService {
  private executionEngine: TaskExecutionEngine;
  private browserManager: BrowserManager;
  private prisma: PrismaClient;
  private resultCache: ResultCacheManager;
  private logger: Logger;

  constructor(browserManager: BrowserManager, prisma: PrismaClient) {
    this.browserManager = browserManager;
    this.prisma = prisma;
    this.logger = new Logger('TaskExecutionService');
    
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
    
    this.logger.info('TaskExecutionService initialized successfully');
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
      
      // Check browser status and start if needed
      if (request.browserId) {
        await this.ensureBrowserRunning(request.browserId);
      }
      
      // Execute the task using the execution engine
      const execution = await this.executionEngine.executeTask(request, task);
      
      // Cache the result if the execution was successful
      if (execution.status === 'completed' && execution.result) {
        try {
          // Cache the execution result
          await this.resultCache.cacheExecution(execution);
        } catch (cacheError) {
          this.logger.error('Failed to cache execution result', cacheError);
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

  /**
   * Get browser by ID
   */
  private getBrowserById(browserId: string) {
    const browser = this.browserManager.getBrowser(browserId);
    if (!browser) {
      this.logger.error(`Browser not found: ${browserId}`, null, { browserId });
      
      throw new TaskError(
        ErrorCode.BROWSER_NOT_FOUND,
        `找不到指定的浏览器 (ID: ${browserId})。请检查浏览器配置或选择其他可用的浏览器。`,
        { browserId }
      );
    }
    return browser;
  }

  /**
   * Get browser status
   * Returns the current status of the specified browser
   */
  async getBrowserStatus(browserId: string): Promise<BrowserStatus> {
    try {
      // Validate that the browser exists
      const browser = this.getBrowserById(browserId);
      this.logger.debug(`Getting status for browser: ${browserId} (${browser.name})`);
      
      // Get the current status from browser manager
      const status = await this.browserManager.getBrowserStatus(browserId);
      this.logger.debug(`Browser ${browserId} status: ${status}`);
      
      return status;
    } catch (error) {
      if (error instanceof TaskError) {
        // Log the error for debugging but re-throw as-is
        this.logger.error(
          `Failed to get browser status for ${browserId}`,
          error,
          { browserId }
        );
        throw error;
      }
      
      // Handle unexpected errors
      this.logger.error(
        `Unexpected error getting browser status for ${browserId}`,
        error,
        { browserId }
      );
      
      throw new TaskError(
        ErrorCode.BROWSER_NOT_FOUND,
        `获取浏览器状态时发生错误。请确认浏览器配置正确。错误详情: ${error instanceof Error ? error.message : String(error)}`,
        {
          browserId,
          originalError: error instanceof Error ? error.message : String(error)
        }
      );
    }
  }

  /**
   * Ensure browser is running, start it if needed
   */
  private async ensureBrowserRunning(browserId: string): Promise<void> {
    try {
      // Get browser information
      const browser = this.getBrowserById(browserId);
      this.logger.debug(`Checking browser status for browser: ${browserId} (${browser.name})`);
      
      // Check current browser status
      const currentStatus = await this.browserManager.getBrowserStatus(browserId);
      this.logger.debug(`Browser ${browserId} current status: ${currentStatus}`);
      
      // If browser is not running, start it
      if (currentStatus !== 'running') {
        this.logger.info(`Browser ${browserId} (${browser.name}) is ${currentStatus}, attempting to start...`);
        
        const result = await this.browserManager.openBrowser(browserId);
        
        if (!result.success) {
          const errorMessage = result.error || 'Unknown error occurred during browser startup';
          
          // Log detailed error information
          this.logger.error(
            `Failed to start browser ${browserId} (${browser.name})`,
            new Error(errorMessage),
            {
              browserId,
              browserName: browser.name,
              browserPlatform: browser.platform,
              currentStatus,
              errorDetails: result.error
            }
          );
          
          // Create user-friendly error message with guidance
          let userFriendlyMessage = `无法启动浏览器 "${browser.name}"`;
          
          // Add specific guidance based on error type
          if (errorMessage.toLowerCase().includes('permission')) {
            userFriendlyMessage += '。请检查浏览器权限设置，确保应用有权限启动浏览器。';
          } else if (errorMessage.toLowerCase().includes('not found') || errorMessage.toLowerCase().includes('path')) {
            userFriendlyMessage += '。请确认浏览器已正确安装，并且路径配置正确。';
          } else if (errorMessage.toLowerCase().includes('port') || errorMessage.toLowerCase().includes('address')) {
            userFriendlyMessage += '。浏览器端口可能被占用，请尝试重启应用或检查端口冲突。';
          } else if (errorMessage.toLowerCase().includes('timeout')) {
            userFriendlyMessage += '。浏览器启动超时，请检查系统资源或尝试重启浏览器。';
          } else {
            userFriendlyMessage += `。错误详情: ${errorMessage}`;
          }
          
          userFriendlyMessage += ' 您可以尝试手动启动浏览器，或选择其他可用的浏览器执行任务。';
          
          throw new TaskError(
            ErrorCode.BROWSER_START_FAILED,
            userFriendlyMessage,
            {
              browserId,
              browserName: browser.name,
              originalError: errorMessage,
              currentStatus
            }
          );
        }
        
        this.logger.info(`Browser ${browserId} (${browser.name}) started successfully`);
      } else {
        this.logger.debug(`Browser ${browserId} (${browser.name}) is already running`);
      }
    } catch (error) {
      if (error instanceof TaskError) {
        // Re-throw TaskError as-is (already has proper logging and user-friendly message)
        throw error;
      }
      
      // Handle unexpected errors
      this.logger.error(
        `Unexpected error while ensuring browser ${browserId} is running`,
        error,
        { browserId }
      );
      
      throw new TaskError(
        ErrorCode.BROWSER_START_FAILED,
        `检查浏览器状态时发生意外错误。请重试或联系技术支持。错误详情: ${error instanceof Error ? error.message : String(error)}`,
        {
          browserId,
          originalError: error instanceof Error ? error.message : String(error)
        }
      );
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