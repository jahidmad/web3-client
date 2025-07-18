/**
 * Task Execution Scheduler
 *
 * This module implements a scheduler for managing task execution queues,
 * concurrency control, and resource allocation.
 */
import { EventEmitter } from 'events';
import { Task, ExecutionRequest, Execution } from '../types/plugin-task-system';
/**
 * Task executor interface
 */
export interface TaskExecutor {
    executeTask(request: ExecutionRequest, task: Task): Promise<Execution>;
    stopExecution(executionId: string): Promise<void>;
    getExecution(executionId: string): Promise<Execution | null>;
    getExecutions(taskId?: string): Promise<Execution[]>;
}
/**
 * Execution queue item
 */
export interface QueuedExecution {
    id: string;
    request: ExecutionRequest;
    task: Task;
    priority: number;
    queuedAt: Date;
    startedAt?: Date;
    execution?: Execution;
}
/**
 * Scheduler configuration
 */
export interface SchedulerConfig {
    maxConcurrentExecutions: number;
    maxQueueSize: number;
    executionTimeout: number;
    retryAttempts: number;
    retryDelay: number;
}
/**
 * Scheduler events
 */
export interface SchedulerEvents {
    'execution-queued': (queuedExecution: QueuedExecution) => void;
    'execution-started': (queuedExecution: QueuedExecution) => void;
    'execution-completed': (queuedExecution: QueuedExecution) => void;
    'execution-failed': (queuedExecution: QueuedExecution, error: Error) => void;
    'execution-cancelled': (queuedExecution: QueuedExecution) => void;
    'queue-full': () => void;
    'queue-empty': () => void;
}
/**
 * Task Execution Scheduler - Manages task execution queues and concurrency
 */
export declare class TaskExecutionScheduler extends EventEmitter {
    private executor;
    private config;
    private executionQueue;
    private activeExecutions;
    private nextQueueId;
    private isProcessing;
    constructor(executor: TaskExecutor, config?: Partial<SchedulerConfig>);
    /**
     * Schedule a task for execution
     */
    scheduleExecution(request: ExecutionRequest, task: Task, priority?: number): Promise<string>;
    /**
     * Cancel a queued or active execution
     */
    cancelExecution(queueId: string): Promise<void>;
    /**
     * Get queue status
     */
    getQueueStatus(): {
        queuedCount: number;
        activeCount: number;
        maxConcurrent: number;
        queuedExecutions: QueuedExecution[];
        activeExecutions: QueuedExecution[];
    };
    /**
     * Get execution by queue ID
     */
    getExecutionByQueueId(queueId: string): Promise<Execution | null>;
    /**
     * Clear the execution queue
     */
    clearQueue(): void;
    /**
     * Update scheduler configuration
     */
    updateConfig(newConfig: Partial<SchedulerConfig>): void;
    /**
     * Process the execution queue
     */
    private processQueue;
    /**
     * Start an individual execution
     */
    private startExecution;
    /**
     * Wait for execution completion with timeout
     */
    private waitForCompletion;
}
/**
 * Create a task execution scheduler
 */
export declare function createTaskExecutionScheduler(executor: TaskExecutor, config?: Partial<SchedulerConfig>): TaskExecutionScheduler;
//# sourceMappingURL=task-execution-scheduler.d.ts.map