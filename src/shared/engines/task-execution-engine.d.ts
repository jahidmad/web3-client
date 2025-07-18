/**
 * Task Execution Engine
 *
 * This module implements the core functionality for executing plugin tasks
 * in a controlled environment with proper isolation and resource management.
 */
import { Task, ExecutionRequest, Execution, ExecutionContext, ExecutionResult } from '../types/plugin-task-system';
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
    goto(url: string, options?: {
        timeout?: number;
        waitUntil?: string;
    }): Promise<void>;
    url(): Promise<string>;
    title(): Promise<string>;
    content(): Promise<string>;
    reload(options?: {
        timeout?: number;
        waitUntil?: string;
    }): Promise<void>;
    goBack(options?: {
        timeout?: number;
        waitUntil?: string;
    }): Promise<void>;
    goForward(options?: {
        timeout?: number;
        waitUntil?: string;
    }): Promise<void>;
    waitForNavigation(options?: {
        timeout?: number;
        waitUntil?: string;
    }): Promise<void>;
    waitForLoadState(state: string, options?: {
        timeout?: number;
    }): Promise<void>;
    getText(selector: string): Promise<string>;
    getAttribute(selector: string, attribute: string): Promise<string>;
    getTable(selector: string): Promise<string[][]>;
    getCount(selector: string): Promise<number>;
    getInnerHTML(selector: string): Promise<string>;
    getOuterHTML(selector: string): Promise<string>;
    getLinks(selector?: string): Promise<Array<{
        href: string;
        text: string;
    }>>;
    getImages(selector?: string): Promise<Array<{
        src: string;
        alt: string;
    }>>;
    waitFor(selector: string, options?: {
        timeout?: number;
        visible?: boolean;
        hidden?: boolean;
    }): Promise<void>;
    waitForText(text: string, options?: {
        timeout?: number;
    }): Promise<void>;
    screenshot(options?: {
        type?: string;
        quality?: number;
        fullPage?: boolean;
    }): Promise<Buffer>;
    pdf(options?: {
        format?: string;
        landscape?: boolean;
        printBackground?: boolean;
    }): Promise<Buffer>;
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
    getLogs(executionId: string): Promise<Array<{
        timestamp: Date;
        message: string;
        level: 'debug' | 'info' | 'warn' | 'error';
    }>>;
}
/**
 * Task Execution Engine - Core implementation
 */
export declare class TaskExecutionEngine {
    private environment;
    private storage;
    private logger;
    private activeExecutions;
    constructor(environment: ExecutionEnvironment, storage: ExecutionStorage, logger: ExecutionLogger);
    /**
     * Execute a task with the given parameters
     */
    executeTask(request: ExecutionRequest, task: Task): Promise<Execution>;
    /**
     * Stop an active execution
     */
    stopExecution(executionId: string): Promise<void>;
    /**
     * Get execution details
     */
    getExecution(executionId: string): Promise<Execution | null>;
    /**
     * Get executions for a task
     */
    getExecutions(taskId?: string): Promise<Execution[]>;
    /**
     * Create an execution with a pre-existing result (e.g., from cache)
     */
    createExecutionWithResult(request: ExecutionRequest, task: Task, result: ExecutionResult, fromCache?: boolean): Promise<Execution>;
    /**
     * Execute task code with timeout
     */
    private executeTaskWithTimeout;
}
/**
 * In-memory execution storage implementation
 */
export declare class InMemoryExecutionStorage implements ExecutionStorage {
    private executions;
    private nextId;
    createExecution(executionData: Omit<Execution, 'id'>): Promise<Execution>;
    updateExecution(id: string, updates: Partial<Execution>): Promise<Execution>;
    getExecution(id: string): Promise<Execution | null>;
    getExecutions(taskId?: string): Promise<Execution[]>;
}
/**
 * In-memory execution logger implementation
 */
export declare class InMemoryExecutionLogger implements ExecutionLogger {
    private logs;
    log(executionId: string, message: string, level?: 'debug' | 'info' | 'warn' | 'error'): Promise<void>;
    getLogs(executionId: string): Promise<Array<{
        timestamp: Date;
        message: string;
        level: 'debug' | 'info' | 'warn' | 'error';
    }>>;
}
/**
 * Create a task execution engine with the given components
 */
export declare function createTaskExecutionEngine(environment: ExecutionEnvironment, storage: ExecutionStorage, logger: ExecutionLogger): TaskExecutionEngine;
/**
 * Create an in-memory task execution engine for testing
 */
export declare function createInMemoryTaskExecutionEngine(environment: ExecutionEnvironment): TaskExecutionEngine;
//# sourceMappingURL=task-execution-engine.d.ts.map