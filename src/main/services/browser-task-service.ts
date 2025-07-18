/**
 * Browser Task Service
 * 
 * This service integrates the browser manager with the task execution engine,
 * providing a high-level API for executing tasks in browser contexts.
 */

import { BrowserManager } from './browser-manager';
import { TaskExecutionEngine } from '../../shared/engines/task-execution-engine';
import { BrowserExecutionEnvironment } from '../../shared/engines/browser-execution-environment';
import { BrowserManagerAdapter } from '../adapters/browser-adapter';
import { DatabaseExecutionStorageAdapter } from '../adapters/execution-storage-adapter';
import { DatabaseExecutionLoggerAdapter } from '../adapters/execution-logger-adapter';
import { PrismaClient } from '@prisma/client';
import { 
  Task, 
  ExecutionRequest, 
  Execution,
  TaskError,
  ErrorCode
} from '../../shared/types/plugin-task-system';

/**
 * Browser Task Service - Service for executing tasks in browser contexts
 */
export class BrowserTaskService {
  private executionEngine: TaskExecutionEngine;
  private browserManager: BrowserManager;
  private prisma: PrismaClient;

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
    console.log('[BrowserTaskService] Initialized');
  }

  /**
   * Execute a task in a browser context
   */
  async executeTask(request: ExecutionRequest, task: Task): Promise<Execution> {
    try {
      // Validate the browser ID if specified
      if (request.browserId) {
        const browser = this.browserManager.getBrowser(request.browserId);
        if (!browser) {
          throw new TaskError(
            ErrorCode.BROWSER_NOT_FOUND,
            `Browser with ID ${request.browserId} not found`
          );
        }
        
        // Check if the browser is available
        const status = await this.browserManager.getBrowserStatus(request.browserId);
        if (status !== 'running') {
          throw new TaskError(
            ErrorCode.BROWSER_NOT_AVAILABLE,
            `Browser with ID ${request.browserId} is not available (status: ${status})`
          );
        }
      } else {
        // If no browser ID is specified, find an available browser
        const browsers = await this.browserManager.getBrowsers();
        const availableBrowser = browsers.find(b => b.status === 'running');
        
        if (!availableBrowser) {
          throw new TaskError(
            ErrorCode.BROWSER_NOT_AVAILABLE,
            'No available browsers found'
          );
        }
        
        // Set the browser ID in the request
        request.browserId = availableBrowser.id;
      }
      
      // Execute the task using the execution engine
      return await this.executionEngine.executeTask(request, task);
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
   * Get available browsers for task execution
   */
  async getAvailableBrowsers(): Promise<Array<{ id: string; name: string; status: string }>> {
    const browsers = await this.browserManager.getBrowsers();
    return browsers.map(browser => ({
      id: browser.id,
      name: browser.name,
      status: browser.status
    }));
  }
}

/**
 * Create a browser task service
 */
export function createBrowserTaskService(
  browserManager: BrowserManager, 
  prisma: PrismaClient
): BrowserTaskService {
  return new BrowserTaskService(browserManager, prisma);
}