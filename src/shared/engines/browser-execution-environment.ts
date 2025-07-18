/**
 * Browser Execution Environment
 * 
 * This module implements the execution environment for running tasks
 * in a browser context with proper isolation and resource management.
 */

import { 
  ExecutionEnvironment, 
  TaskBrowser, 
  TaskPage 
} from './task-execution-engine';

import { createBrowserAPI } from '../api/browser-api';

// Re-export interfaces for external use
export { TaskBrowser, TaskPage };

import {
  Task,
  ExecutionRequest,
  ExecutionContext,
  ExecutionResult,
  TaskError,
  ErrorCode
} from '../types/plugin-task-system';

// ============================================================================
// BROWSER EXECUTION ENVIRONMENT
// ============================================================================

/**
 * Browser-based execution environment for tasks
 */
export class BrowserExecutionEnvironment implements ExecutionEnvironment {
  private browserProvider: BrowserProvider;

  constructor(browserProvider: BrowserProvider) {
    this.browserProvider = browserProvider;
  }

  /**
   * Create an execution context for a task
   */
  async createContext(request: ExecutionRequest, task: Task): Promise<ExecutionContext> {
    // Get the browser
    const browser = await this.getBrowser(request.browserId);
    
    // Create a new page
    const page = await browser.createPage();
    
    // Create progress and log tracking
    const logs: Array<{ timestamp: Date; message: string; level: 'debug' | 'info' | 'warn' | 'error' }> = [];
    let progressValue = 0;
    let progressMessage = '';
    
    // Create the logger function
    const logger = (message: string, level?: string) => {
      const logLevel = (level as 'debug' | 'info' | 'warn' | 'error') || 'info';
      logs.push({
        timestamp: new Date(),
        message,
        level: logLevel
      });
      return message;
    };
    
    // Create the comprehensive browser API
    const browserAPI = createBrowserAPI(page, browser, logger);
    
    // Create the execution context
    const context: ExecutionContext = {
      // Browser and page
      browser: browserAPI,
      page,
      
      // Parameters from the request
      params: request.parameters || {},
      
      // Utility functions
      log: logger,
      
      progress: (value: number, message?: string) => {
        progressValue = Math.max(0, Math.min(100, value));
        if (message) {
          progressMessage = message;
        }
        return { value: progressValue, message: progressMessage };
      },
      
      // Utility helpers
      utils: {
        sleep: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),
        formatDate: (date: Date, format: string = 'YYYY-MM-DD') => {
          // Simple date formatter
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          return format
            .replace('YYYY', year.toString())
            .replace('MM', month)
            .replace('DD', day);
        },
        parseJson: (json: string) => {
          try {
            return JSON.parse(json);
          } catch (e) {
            return null;
          }
        },
        generateId: () => Math.random().toString(36).substring(2, 15)
      },
      
      // Tracking data
      _internal: {
        logs,
        progress: { value: progressValue, message: progressMessage },
        startTime: new Date(),
        memoryUsage: 0,
        cpuUsage: 0
      }
    };
    
    return context;
  }

  /**
   * Execute task code in the given context
   */
  async executeCode(code: string, context: ExecutionContext): Promise<ExecutionResult> {
    try {
      // Start measuring resource usage
      const startMemory = process.memoryUsage().heapUsed;
      const startCpu = process.cpuUsage();
      
      // Create a safe function from the code
      // This is a simplified approach - in a real implementation,
      // you would use a proper sandbox or VM for better isolation
      const executeFunction = new Function('context', `
        return (async () => {
          ${code}
          return await execute(context);
        })();
      `);
      
      // Execute the function with the context
      const result = await executeFunction(context);
      
      // Measure resource usage
      const endMemory = process.memoryUsage().heapUsed;
      const endCpu = process.cpuUsage(startCpu);
      
      const memoryUsage = Math.round((endMemory - startMemory) / 1024); // KB
      const cpuUsage = Math.round((endCpu.user + endCpu.system) / 1000); // ms
      
      // Update context with resource usage
      context._internal.memoryUsage = memoryUsage;
      context._internal.cpuUsage = cpuUsage;
      
      // Return the result with resource usage
      return {
        success: result?.success || false,
        data: result,
        logs: context._internal.logs,
        progress: context._internal.progress,
        memoryUsage,
        cpuUsage
      };
    } catch (error) {
      throw new TaskError(
        ErrorCode.EXECUTION_FAILED,
        `Failed to execute task code: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Clean up resources after execution
   */
  async cleanup(context: ExecutionContext): Promise<void> {
    try {
      // Close the page
      if (context.page) {
        await context.page.close();
      }
    } catch (error) {
      console.error('Error during execution cleanup:', error);
    }
  }

  /**
   * Get a browser instance
   */
  private async getBrowser(browserId?: string): Promise<TaskBrowser> {
    try {
      // If a specific browser ID is requested, get that browser
      if (browserId) {
        const browser = await this.browserProvider.getBrowser(browserId);
        if (!browser) {
          throw new TaskError(
            ErrorCode.BROWSER_NOT_FOUND,
            `Browser with ID ${browserId} not found`
          );
        }
        
        // Check if the browser is available
        const isAvailable = await browser.isAvailable();
        if (!isAvailable) {
          throw new TaskError(
            ErrorCode.BROWSER_NOT_AVAILABLE,
            `Browser with ID ${browserId} is not available`
          );
        }
        
        return browser;
      }
      
      // Otherwise, get any available browser
      const browser = await this.browserProvider.getAvailableBrowser();
      if (!browser) {
        throw new TaskError(
          ErrorCode.BROWSER_NOT_AVAILABLE,
          'No available browsers found'
        );
      }
      
      return browser;
    } catch (error) {
      if (error instanceof TaskError) {
        throw error;
      }
      
      throw new TaskError(
        ErrorCode.BROWSER_ERROR,
        `Failed to get browser: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}

// ============================================================================
// BROWSER PROVIDER INTERFACE
// ============================================================================

/**
 * Browser provider interface
 */
export interface BrowserProvider {
  getBrowser(browserId: string): Promise<TaskBrowser | null>;
  getAvailableBrowser(): Promise<TaskBrowser | null>;
  getAllBrowsers(): Promise<TaskBrowser[]>;
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create a browser execution environment
 */
export function createBrowserExecutionEnvironment(browserProvider: BrowserProvider): BrowserExecutionEnvironment {
  return new BrowserExecutionEnvironment(browserProvider);
}