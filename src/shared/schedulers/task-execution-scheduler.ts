/**
 * Task Execution Scheduler
 * 
 * This module implements a scheduler for managing task execution queues,
 * concurrency control, and resource allocation.
 */

import { EventEmitter } from 'events';
import { 
  Task, 
  ExecutionRequest, 
  Execution, 
  ExecutionStatus,
  TaskError,
  ErrorCode
} from '../types/plugin-task-system';

// ============================================================================
// SCHEDULER INTERFACES
// ============================================================================

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

// ============================================================================
// TASK EXECUTION SCHEDULER IMPLEMENTATION
// ============================================================================

/**
 * Task Execution Scheduler - Manages task execution queues and concurrency
 */
export class TaskExecutionScheduler extends EventEmitter {
  private executor: TaskExecutor;
  private config: SchedulerConfig;
  private executionQueue: QueuedExecution[] = [];
  private activeExecutions: Map<string, QueuedExecution> = new Map();
  private nextQueueId = 1;
  private isProcessing = false;

  constructor(executor: TaskExecutor, config: Partial<SchedulerConfig> = {}) {
    super();
    this.executor = executor;
    this.config = {
      maxConcurrentExecutions: 3,
      maxQueueSize: 100,
      executionTimeout: 300000, // 5 minutes
      retryAttempts: 3,
      retryDelay: 5000, // 5 seconds
      ...config
    };
  }

  /**
   * Schedule a task for execution
   */
  async scheduleExecution(request: ExecutionRequest, task: Task, priority: number = 0): Promise<string> {
    // Check queue size limit
    if (this.executionQueue.length >= this.config.maxQueueSize) {
      this.emit('queue-full');
      throw new TaskError(
        ErrorCode.QUEUE_FULL,
        `Execution queue is full (max: ${this.config.maxQueueSize})`
      );
    }

    // Create queued execution
    const queuedExecution: QueuedExecution = {
      id: `queue_${this.nextQueueId++}`,
      request,
      task,
      priority,
      queuedAt: new Date()
    };

    // Add to queue (sorted by priority, higher priority first)
    this.executionQueue.push(queuedExecution);
    this.executionQueue.sort((a, b) => b.priority - a.priority);

    // Emit event
    this.emit('execution-queued', queuedExecution);

    // Start processing if not already running
    this.processQueue();

    return queuedExecution.id;
  }

  /**
   * Cancel a queued or active execution
   */
  async cancelExecution(queueId: string): Promise<void> {
    // Check if it's in the queue
    const queueIndex = this.executionQueue.findIndex(item => item.id === queueId);
    if (queueIndex !== -1) {
      const queuedExecution = this.executionQueue.splice(queueIndex, 1)[0];
      this.emit('execution-cancelled', queuedExecution);
      return;
    }

    // Check if it's actively executing
    const activeExecution = this.activeExecutions.get(queueId);
    if (activeExecution && activeExecution.execution) {
      try {
        await this.executor.stopExecution(activeExecution.execution.id);
        this.activeExecutions.delete(queueId);
        this.emit('execution-cancelled', activeExecution);
      } catch (error) {
        throw new TaskError(
          ErrorCode.EXECUTION_FAILED,
          `Failed to cancel execution: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    } else {
      throw new TaskError(
        ErrorCode.EXECUTION_NOT_FOUND,
        `No execution found with queue ID: ${queueId}`
      );
    }
  }

  /**
   * Get queue status
   */
  getQueueStatus(): {
    queuedCount: number;
    activeCount: number;
    maxConcurrent: number;
    queuedExecutions: QueuedExecution[];
    activeExecutions: QueuedExecution[];
  } {
    return {
      queuedCount: this.executionQueue.length,
      activeCount: this.activeExecutions.size,
      maxConcurrent: this.config.maxConcurrentExecutions,
      queuedExecutions: [...this.executionQueue],
      activeExecutions: Array.from(this.activeExecutions.values())
    };
  }

  /**
   * Get execution by queue ID
   */
  async getExecutionByQueueId(queueId: string): Promise<Execution | null> {
    const activeExecution = this.activeExecutions.get(queueId);
    if (activeExecution && activeExecution.execution) {
      return this.executor.getExecution(activeExecution.execution.id);
    }
    return null;
  }

  /**
   * Clear the execution queue
   */
  clearQueue(): void {
    const cancelledExecutions = [...this.executionQueue];
    this.executionQueue = [];
    
    cancelledExecutions.forEach(queuedExecution => {
      this.emit('execution-cancelled', queuedExecution);
    });
  }

  /**
   * Update scheduler configuration
   */
  updateConfig(newConfig: Partial<SchedulerConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Process the execution queue
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;

    try {
      while (this.executionQueue.length > 0 && this.activeExecutions.size < this.config.maxConcurrentExecutions) {
        const queuedExecution = this.executionQueue.shift()!;
        
        // Start the execution
        this.startExecution(queuedExecution);
      }

      if (this.executionQueue.length === 0 && this.activeExecutions.size === 0) {
        this.emit('queue-empty');
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Start an individual execution
   */
  private async startExecution(queuedExecution: QueuedExecution): Promise<void> {
    queuedExecution.startedAt = new Date();
    this.activeExecutions.set(queuedExecution.id, queuedExecution);
    this.emit('execution-started', queuedExecution);

    try {
      // Execute the task
      const execution = await this.executor.executeTask(queuedExecution.request, queuedExecution.task);
      queuedExecution.execution = execution;

      // Wait for completion or timeout
      await this.waitForCompletion(queuedExecution);

      // Remove from active executions
      this.activeExecutions.delete(queuedExecution.id);
      this.emit('execution-completed', queuedExecution);

    } catch (error) {
      // Handle execution error
      this.activeExecutions.delete(queuedExecution.id);
      this.emit('execution-failed', queuedExecution, error instanceof Error ? error : new Error(String(error)));
    }

    // Continue processing the queue
    this.processQueue();
  }

  /**
   * Wait for execution completion with timeout
   */
  private async waitForCompletion(queuedExecution: QueuedExecution): Promise<void> {
    if (!queuedExecution.execution) {
      throw new Error('No execution found');
    }

    const executionId = queuedExecution.execution.id;
    const timeout = queuedExecution.request.timeout || this.config.executionTimeout;
    const startTime = Date.now();

    return new Promise((resolve, reject) => {
      const checkCompletion = async () => {
        try {
          const execution = await this.executor.getExecution(executionId);
          
          if (!execution) {
            reject(new Error('Execution not found'));
            return;
          }

          // Check if completed
          if (execution.status === ExecutionStatus.COMPLETED || 
              execution.status === ExecutionStatus.FAILED || 
              execution.status === ExecutionStatus.STOPPED) {
            resolve();
            return;
          }

          // Check timeout
          if (Date.now() - startTime > timeout) {
            try {
              await this.executor.stopExecution(executionId);
            } catch (stopError) {
              console.error('Failed to stop timed out execution:', stopError);
            }
            reject(new TaskError(ErrorCode.EXECUTION_TIMEOUT, 'Execution timed out'));
            return;
          }

          // Continue checking
          setTimeout(checkCompletion, 1000);
        } catch (error) {
          reject(error);
        }
      };

      checkCompletion();
    });
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create a task execution scheduler
 */
export function createTaskExecutionScheduler(
  executor: TaskExecutor,
  config?: Partial<SchedulerConfig>
): TaskExecutionScheduler {
  return new TaskExecutionScheduler(executor, config);
}