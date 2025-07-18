/**
 * Browser Execution Environment
 *
 * This module implements the execution environment for running tasks
 * in a browser context with proper isolation and resource management.
 */
import { ExecutionEnvironment, TaskBrowser, TaskPage } from './task-execution-engine';
export { TaskBrowser, TaskPage };
import { Task, ExecutionRequest, ExecutionContext, ExecutionResult } from '../types/plugin-task-system';
/**
 * Browser-based execution environment for tasks
 */
export declare class BrowserExecutionEnvironment implements ExecutionEnvironment {
    private browserProvider;
    constructor(browserProvider: BrowserProvider);
    /**
     * Create an execution context for a task
     */
    createContext(request: ExecutionRequest, task: Task): Promise<ExecutionContext>;
    /**
     * Execute task code in the given context
     */
    executeCode(code: string, context: ExecutionContext): Promise<ExecutionResult>;
    /**
     * Clean up resources after execution
     */
    cleanup(context: ExecutionContext): Promise<void>;
    /**
     * Get a browser instance
     */
    private getBrowser;
}
/**
 * Browser provider interface
 */
export interface BrowserProvider {
    getBrowser(browserId: string): Promise<TaskBrowser | null>;
    getAvailableBrowser(): Promise<TaskBrowser | null>;
    getAllBrowsers(): Promise<TaskBrowser[]>;
}
/**
 * Create a browser execution environment
 */
export declare function createBrowserExecutionEnvironment(browserProvider: BrowserProvider): BrowserExecutionEnvironment;
//# sourceMappingURL=browser-execution-environment.d.ts.map