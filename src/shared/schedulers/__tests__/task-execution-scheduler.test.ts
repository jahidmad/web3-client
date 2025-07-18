/**
 * Task Execution Scheduler Tests
 */

import { TaskExecutionScheduler, TaskExecutor, QueuedExecution } from '../task-execution-scheduler';
import { 
  Task, 
  ExecutionRequest, 
  Execution, 
  ExecutionStatus,
  TaskStatus,
  TaskError,
  ErrorCode
} from '../../types/plugin-task-system';

// Mock task executor
class MockTaskExecutor implements TaskExecutor {
  private executions: Map<string, Execution> = new Map();
  private nextExecutionId = 1;
  private executionDelay = 100; // ms

  async executeTask(request: ExecutionRequest, task: Task): Promise<Execution> {
    const execution: Execution = {
      id: `exec_${this.nextExecutionId++}`,
      taskId: task.id,
      browserId: request.browserId || '',
      status: ExecutionStatus.RUNNING,
      parameters: request.parameters || {},
      startTime: new Date(),
      progress: 0,
      logs: []
    };

    this.executions.set(execution.id, execution);

    // Simulate execution completion after delay
    setTimeout(() => {
      const updatedExecution: Execution = {
        ...execution,
        status: ExecutionStatus.COMPLETED,
        endTime: new Date(),
        duration: this.executionDelay,
        progress: 100
      };
      this.executions.set(execution.id, updatedExecution);
    }, this.executionDelay);

    return execution;
  }

  async stopExecution(executionId: string): Promise<void> {
    const execution = this.executions.get(executionId);
    if (execution) {
      const stoppedExecution: Execution = {
        ...execution,
        status: ExecutionStatus.STOPPED,
        endTime: new Date(),
        duration: Date.now() - execution.startTime.getTime()
      };
      this.executions.set(executionId, stoppedExecution);
    }
  }

  async getExecution(executionId: string): Promise<Execution | null> {
    return this.executions.get(executionId) || null;
  }

  async getExecutions(taskId?: string): Promise<Execution[]> {
    const executions = Array.from(this.executions.values());
    return taskId ? executions.filter(e => e.taskId === taskId) : executions;
  }

  setExecutionDelay(delay: number): void {
    this.executionDelay = delay;
  }
}

// Helper function to create a test task
function createTestTask(id: string = 'test-task'): Task {
  return {
    id,
    filename: `${id}.js`,
    code: 'async function execute(context) { return { success: true }; }',
    status: TaskStatus.ACTIVE,
    metadata: {
      name: `Test Task ${id}`,
      description: 'A test task',
      author: 'Test Author',
      version: '1.0.0'
    },
    parameters: {},
    dependencies: {},
    config: {
      timeout: 30000,
      retries: 0,
      permissions: []
    },
    createdAt: new Date(),
    updatedAt: new Date()
  };
}

// Helper function to create a test execution request
function createTestRequest(taskId: string = 'test-task'): ExecutionRequest {
  return {
    taskId,
    parameters: {},
    timeout: 30000
  };
}

describe('TaskExecutionScheduler', () => {
  let scheduler: TaskExecutionScheduler;
  let mockExecutor: MockTaskExecutor;

  beforeEach(() => {
    mockExecutor = new MockTaskExecutor();
    scheduler = new TaskExecutionScheduler(mockExecutor, {
      maxConcurrentExecutions: 2,
      maxQueueSize: 10,
      executionTimeout: 5000,
      retryAttempts: 1,
      retryDelay: 1000
    });
  });

  afterEach(() => {
    scheduler.removeAllListeners();
  });

  describe('scheduleExecution', () => {
    it('should schedule a task for execution', async () => {
      const task = createTestTask();
      const request = createTestRequest();

      const queueId = await scheduler.scheduleExecution(request, task);

      expect(queueId).toBeDefined();
      expect(typeof queueId).toBe('string');

      const status = scheduler.getQueueStatus();
      expect(status.queuedCount + status.activeCount).toBe(1);
    });

    it('should emit execution-queued event', async () => {
      const task = createTestTask();
      const request = createTestRequest();
      
      let queuedExecution: QueuedExecution | null = null;
      scheduler.on('execution-queued', (execution) => {
        queuedExecution = execution;
      });

      await scheduler.scheduleExecution(request, task);

      expect(queuedExecution).not.toBeNull();
      expect(queuedExecution!.task.id).toBe(task.id);
    });

    it('should respect priority ordering', async () => {
      const task1 = createTestTask('task1');
      const task2 = createTestTask('task2');
      const task3 = createTestTask('task3');
      
      const request1 = createTestRequest('task1');
      const request2 = createTestRequest('task2');
      const request3 = createTestRequest('task3');

      // Set execution delay to prevent immediate execution
      mockExecutor.setExecutionDelay(1000);

      // Schedule with different priorities
      await scheduler.scheduleExecution(request1, task1, 1);
      await scheduler.scheduleExecution(request2, task2, 3); // Highest priority
      await scheduler.scheduleExecution(request3, task3, 2);

      const status = scheduler.getQueueStatus();
      
      // Should be ordered by priority: task2 (3), task3 (2), task1 (1)
      // But first 2 should be active due to maxConcurrentExecutions = 2
      expect(status.activeCount).toBe(2);
      expect(status.queuedCount).toBe(1);
    });

    it('should throw error when queue is full', async () => {
      const smallScheduler = new TaskExecutionScheduler(mockExecutor, {
        maxQueueSize: 1,
        maxConcurrentExecutions: 1
      });

      const task1 = createTestTask('task1');
      const task2 = createTestTask('task2');
      const request1 = createTestRequest('task1');
      const request2 = createTestRequest('task2');

      // Set long execution delay to fill queue
      mockExecutor.setExecutionDelay(5000);

      await smallScheduler.scheduleExecution(request1, task1);
      
      await expect(smallScheduler.scheduleExecution(request2, task2))
        .rejects.toThrow('Execution queue is full');
    });
  });

  describe('cancelExecution', () => {
    it('should cancel queued execution', async () => {
      const task = createTestTask();
      const request = createTestRequest();
      
      // Set long execution delay to keep in queue
      mockExecutor.setExecutionDelay(5000);

      const queueId = await scheduler.scheduleExecution(request, task);
      
      let cancelledExecution: QueuedExecution | null = null;
      scheduler.on('execution-cancelled', (execution) => {
        cancelledExecution = execution;
      });

      await scheduler.cancelExecution(queueId);

      expect(cancelledExecution).not.toBeNull();
      expect(cancelledExecution!.id).toBe(queueId);

      const status = scheduler.getQueueStatus();
      expect(status.queuedCount + status.activeCount).toBe(0);
    });

    it('should throw error for non-existent execution', async () => {
      await expect(scheduler.cancelExecution('non-existent'))
        .rejects.toThrow('No execution found with queue ID');
    });
  });

  describe('getQueueStatus', () => {
    it('should return correct queue status', async () => {
      const task1 = createTestTask('task1');
      const task2 = createTestTask('task2');
      const task3 = createTestTask('task3');
      
      const request1 = createTestRequest('task1');
      const request2 = createTestRequest('task2');
      const request3 = createTestRequest('task3');

      // Set execution delay to control queue state
      mockExecutor.setExecutionDelay(1000);

      await scheduler.scheduleExecution(request1, task1);
      await scheduler.scheduleExecution(request2, task2);
      await scheduler.scheduleExecution(request3, task3);

      const status = scheduler.getQueueStatus();

      expect(status.maxConcurrent).toBe(2);
      expect(status.activeCount).toBe(2);
      expect(status.queuedCount).toBe(1);
      expect(status.activeExecutions).toHaveLength(2);
      expect(status.queuedExecutions).toHaveLength(1);
    });
  });

  describe('clearQueue', () => {
    it('should clear all queued executions', async () => {
      const task1 = createTestTask('task1');
      const task2 = createTestTask('task2');
      const task3 = createTestTask('task3');
      
      const request1 = createTestRequest('task1');
      const request2 = createTestRequest('task2');
      const request3 = createTestRequest('task3');

      // Set long execution delay to keep in queue
      mockExecutor.setExecutionDelay(5000);

      await scheduler.scheduleExecution(request1, task1);
      await scheduler.scheduleExecution(request2, task2);
      await scheduler.scheduleExecution(request3, task3);

      let cancelledCount = 0;
      scheduler.on('execution-cancelled', () => {
        cancelledCount++;
      });

      scheduler.clearQueue();

      const status = scheduler.getQueueStatus();
      expect(status.queuedCount).toBe(0);
      // Active executions should still be running
      expect(status.activeCount).toBeGreaterThan(0);
    });
  });

  describe('events', () => {
    it('should emit execution-started event', (done) => {
      const task = createTestTask();
      const request = createTestRequest();

      scheduler.on('execution-started', (queuedExecution) => {
        expect(queuedExecution.task.id).toBe(task.id);
        expect(queuedExecution.startedAt).toBeDefined();
        done();
      });

      scheduler.scheduleExecution(request, task);
    });

    it('should emit execution-completed event', (done) => {
      const task = createTestTask();
      const request = createTestRequest();

      scheduler.on('execution-completed', (queuedExecution) => {
        expect(queuedExecution.task.id).toBe(task.id);
        expect(queuedExecution.execution).toBeDefined();
        done();
      });

      scheduler.scheduleExecution(request, task);
    });

    it('should emit queue-empty event', (done) => {
      const task = createTestTask();
      const request = createTestRequest();

      scheduler.on('queue-empty', () => {
        done();
      });

      scheduler.scheduleExecution(request, task);
    });
  });

  describe('updateConfig', () => {
    it('should update scheduler configuration', () => {
      const newConfig = {
        maxConcurrentExecutions: 5,
        maxQueueSize: 50
      };

      scheduler.updateConfig(newConfig);

      const status = scheduler.getQueueStatus();
      expect(status.maxConcurrent).toBe(5);
    });
  });
});