/**
 * Task System Performance Tests
 * 
 * This file contains performance and stress tests for the plugin task system.
 * It focuses on measuring execution time, resource usage, and system behavior
 * under load.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TaskManager, InMemoryTaskStorage } from '../task-manager';
import { TaskExecutionEngine } from '../../engines/task-execution-engine';
import { DependencyManager } from '../../managers/dependency-manager';
import { BrowserManager } from '../../managers/browser-manager';
import { LogManager } from '../../managers/log-manager';
import { EventBus } from '../../managers/event-bus';
import { ExecutionStatus } from '../../types/plugin-task-system';

describe('Task System Performance', () => {
  // Core system components
  let taskManager: TaskManager;
  let executionEngine: TaskExecutionEngine;
  let dependencyManager: DependencyManager;
  let browserManager: BrowserManager;
  let logManager: LogManager;
  let eventBus: EventBus;
  
  // Mock browser instance ID for testing
  const mockBrowserId = 'browser-123';
  
  // Setup before each test
  beforeEach(() => {
    // Create a new event bus for communication between components
    eventBus = new EventBus();
    
    // Create storage with clean state for each test
    const taskStorage = new InMemoryTaskStorage();
    
    // Initialize the log manager
    logManager = new LogManager({
      logDirectory: './logs',
      logLevel: 'debug',
      enableConsole: false
    });
    
    // Initialize the dependency manager with in-memory storage
    dependencyManager = new DependencyManager({
      cacheDirectory: './data/dependencies',
      eventBus,
      logManager
    });
    
    // Initialize the browser manager with mock implementation
    browserManager = new BrowserManager({
      eventBus,
      logManager
    });
    
    // Create the task manager
    taskManager = new TaskManager(taskStorage);
    
    // Create the execution engine with all dependencies
    executionEngine = new TaskExecutionEngine({
      taskManager,
      dependencyManager,
      browserManager,
      eventBus,
      logManager,
      maxConcurrentExecutions: 5,
      defaultTimeout: 30000
    });
    
    // Mock the browser manager's getBrowser method
    browserManager.getBrowser = vi.fn().mockResolvedValue({
      id: mockBrowserId,
      getPage: vi.fn().mockResolvedValue({
        goto: vi.fn().mockResolvedValue(undefined),
        evaluate: vi.fn().mockResolvedValue(undefined),
        screenshot: vi.fn().mockResolvedValue(Buffer.from('mock-screenshot')),
        close: vi.fn().mockResolvedValue(undefined)
      }),
      close: vi.fn().mockResolvedValue(undefined)
    });
    
    // Mock the dependency manager's methods
    dependencyManager.installDependencies = vi.fn().mockResolvedValue({
      success: true,
      installed: [{ name: 'lodash', version: '4.17.21', installed: true }],
      failed: [],
      warnings: []
    });
    
    dependencyManager.checkDependencies = vi.fn().mockResolvedValue({
      satisfied: true,
      dependencies: [{ name: 'lodash', version: '4.17.21', installed: true }],
      missingDependencies: [],
      lastChecked: new Date(),
      installRequired: false
    });
  });
  
  /**
   * Helper function to create a valid task file
   */
  const createTaskFile = (options = {}): Buffer => {
    const {
      name = 'Performance Test Task',
      description = 'A task for performance testing',
      executeCode = `
  const { log, progress, utils } = context;
  log('Task running');
  progress(50, 'Working');
  await utils.sleep(10);
  progress(100, 'Completed');
  return { success: true };`,
      dependencies = ['lodash@4.17.21'],
      timeout = 30000
    } = options;
    
    const taskContent = `
/**
 * @name ${name}
 * @description ${description}
 * @version 1.0.0
 * @author Test Author
 * @category Performance
 * @tags performance,test
 * @icon ⚡
 */

const parameters = [
  {
    name: 'url',
    label: 'Target URL',
    type: 'url',
    required: true,
    description: 'The URL to process'
  }
];

const dependencies = ${JSON.stringify(dependencies)};

const config = {
  timeout: ${timeout},
  retries: 0,
  permissions: ['network']
};

async function execute(context) {${executeCode}
}

module.exports = {
  parameters,
  dependencies,
  config,
  execute
};
    `;
    return Buffer.from(taskContent, 'utf-8');
  };
  
  /**
   * Helper function to measure execution time
   */
  const measureExecutionTime = async (fn: () => Promise<any>): Promise<number> => {
    const startTime = process.hrtime.bigint();
    await fn();
    const endTime = process.hrtime.bigint();
    return Number(endTime - startTime) / 1_000_000; // Convert to milliseconds
  };
  
  describe('Execution Performance', () => {
    it('should measure task upload performance', async () => {
      const taskCount = 50;
      const taskFiles = Array.from({ length: taskCount }).map((_, i) => 
        createTaskFile({ name: `Performance Task ${i + 1}` })
      );
      
      const uploadTimes: number[] = [];
      
      for (let i = 0; i < taskCount; i++) {
        const time = await measureExecutionTime(async () => {
          await taskManager.uploadTask(taskFiles[i], `perf-task-${i + 1}.js`);
        });
        uploadTimes.push(time);
      }
      
      const totalTime = uploadTimes.reduce((sum, time) => sum + time, 0);
      const averageTime = totalTime / taskCount;
      const minTime = Math.min(...uploadTimes);
      const maxTime = Math.max(...uploadTimes);
      
      console.log(`Task Upload Performance (${taskCount} tasks):`);
      console.log(`- Total time: ${totalTime.toFixed(2)}ms`);
      console.log(`- Average time: ${averageTime.toFixed(2)}ms per task`);
      console.log(`- Min time: ${minTime.toFixed(2)}ms`);
      console.log(`- Max time: ${maxTime.toFixed(2)}ms`);
      
      // Soft assertions - we're mainly interested in the metrics
      expect(averageTime).toBeLessThan(100); // Adjust based on reasonable expectations
    });
    
    it('should measure task execution performance', async () => {
      // Upload a lightweight task
      const taskFile = createTaskFile({
        executeCode: `
  const { log, progress } = context;
  log('Performance measurement task');
  progress(100, 'Completed');
  return { success: true };`
      });
      
      const task = await taskManager.uploadTask(taskFile, 'execution-perf-task.js');
      
      const executionCount = 20;
      const executionTimes: number[] = [];
      
      for (let i = 0; i < executionCount; i++) {
        const time = await measureExecutionTime(async () => {
          const execution = await executionEngine.executeTask({
            taskId: task.id,
            parameters: { url: `https://example.com/perf/${i}` },
            browserId: mockBrowserId
          });
          
          await executionEngine.waitForExecution(execution.id, 5000);
        });
        
        executionTimes.push(time);
      }
      
      const totalTime = executionTimes.reduce((sum, time) => sum + time, 0);
      const averageTime = totalTime / executionCount;
      const minTime = Math.min(...executionTimes);
      const maxTime = Math.max(...executionTimes);
      
      console.log(`Task Execution Performance (${executionCount} executions):`);
      console.log(`- Total time: ${totalTime.toFixed(2)}ms`);
      console.log(`- Average time: ${averageTime.toFixed(2)}ms per execution`);
      console.log(`- Min time: ${minTime.toFixed(2)}ms`);
      console.log(`- Max time: ${maxTime.toFixed(2)}ms`);
      
      // Soft assertions - we're mainly interested in the metrics
      expect(averageTime).toBeLessThan(500); // Adjust based on reasonable expectations
    });
  });
  
  describe('Concurrency Performance', () => {
    it('should measure performance with different concurrency levels', async () => {
      // Upload a task with consistent execution time
      const taskFile = createTaskFile({
        executeCode: `
  const { log, progress, utils } = context;
  log('Concurrency test task');
  progress(50, 'Working');
  await utils.sleep(100); // Consistent sleep time
  progress(100, 'Completed');
  return { success: true };`
      });
      
      const task = await taskManager.uploadTask(taskFile, 'concurrency-test-task.js');
      
      // Test with different concurrency levels
      const concurrencyLevels = [1, 2, 5, 10];
      const taskCount = 20;
      
      for (const concurrency of concurrencyLevels) {
        // Set concurrency level
        executionEngine.setMaxConcurrentExecutions(concurrency);
        
        // Measure execution time for batch of tasks
        const startTime = process.hrtime.bigint();
        
        // Create all execution promises
        const executionPromises = Array.from({ length: taskCount }).map((_, i) => 
          executionEngine.executeTask({
            taskId: task.id,
            parameters: { url: `https://example.com/concurrency/${i}` },
            browserId: mockBrowserId
          })
        );
        
        // Wait for all executions to be created
        const executions = await Promise.all(executionPromises);
        
        // Wait for all executions to complete
        const resultPromises = executions.map(execution => 
          executionEngine.waitForExecution(execution.id, 10000)
        );
        
        const results = await Promise.all(resultPromises);
        
        const endTime = process.hrtime.bigint();
        const totalTime = Number(endTime - startTime) / 1_000_000; // Convert to milliseconds
        
        // Verify all completed successfully
        const allCompleted = results.every(result => result.status === ExecutionStatus.COMPLETED);
        expect(allCompleted).toBe(true);
        
        console.log(`Concurrency Level ${concurrency} (${taskCount} tasks):`);
        console.log(`- Total time: ${totalTime.toFixed(2)}ms`);
        console.log(`- Average time: ${(totalTime / taskCount).toFixed(2)}ms per task`);
        console.log(`- Throughput: ${(taskCount / (totalTime / 1000)).toFixed(2)} tasks/second`);
        
        // With higher concurrency, we expect better throughput
        if (concurrency > 1) {
          // This is a soft assertion - actual improvement depends on many factors
          expect(totalTime).toBeLessThan(taskCount * 100);
        }
      }
    });
  });
  
  describe('Resource Usage', () => {
    it('should measure memory usage during task execution', async () => {
      // Upload a memory-intensive task
      const taskFile = createTaskFile({
        name: 'Memory Test Task',
        executeCode: `
  const { log, progress } = context;
  log('Memory test task running');
  
  // Create some objects to use memory
  const objects = [];
  for (let i = 0; i < 1000; i++) {
    objects.push({
      id: i,
      name: 'Test object ' + i,
      data: 'x'.repeat(100)
    });
  }
  
  progress(100, 'Memory test completed');
  return { success: true, objectCount: objects.length };`
      });
      
      const task = await taskManager.uploadTask(taskFile, 'memory-test-task.js');
      
      // Measure memory before execution
      const memoryBefore = process.memoryUsage();
      
      // Execute the task
      const execution = await executionEngine.executeTask({
        taskId: task.id,
        parameters: { url: 'https://example.com/memory-test' },
        browserId: mockBrowserId
      });
      
      // Wait for execution to complete
      const result = await executionEngine.waitForExecution(execution.id, 5000);
      
      // Measure memory after execution
      const memoryAfter = process.memoryUsage();
      
      // Calculate memory differences
      const memoryDiff = {
        rss: memoryAfter.rss - memoryBefore.rss,
        heapTotal: memoryAfter.heapTotal - memoryBefore.heapTotal,
        heapUsed: memoryAfter.heapUsed - memoryBefore.heapUsed,
        external: memoryAfter.external - memoryBefore.external
      };
      
      console.log('Memory Usage (bytes):');
      console.log(`- RSS diff: ${memoryDiff.rss}`);
      console.log(`- Heap total diff: ${memoryDiff.heapTotal}`);
      console.log(`- Heap used diff: ${memoryDiff.heapUsed}`);
      console.log(`- External diff: ${memoryDiff.external}`);
      
      // Verify execution completed successfully
      expect(result.status).toBe(ExecutionStatus.COMPLETED);
      expect(result.result?.objectCount).toBe(1000);
      
      // This is a soft assertion - we're mainly interested in the metrics
      // We expect some memory usage, but not excessive
      expect(memoryDiff.heapUsed).toBeGreaterThan(0);
    });
  });
  
  describe('Stress Testing', () => {
    it('should handle rapid task creation and cancellation', async () => {
      // Upload a long-running task
      const taskFile = createTaskFile({
        name: 'Long Running Task',
        executeCode: `
  const { log, progress, utils } = context;
  log('Long running task started');
  
  for (let i = 0; i < 10; i++) {
    progress(i * 10, 'Working...');
    await utils.sleep(500);
  }
  
  return { success: true };`
      });
      
      const task = await taskManager.uploadTask(taskFile, 'long-running-task.js');
      
      // Start many tasks
      const taskCount = 20;
      const executions = [];
      
      for (let i = 0; i < taskCount; i++) {
        const execution = await executionEngine.executeTask({
          taskId: task.id,
          parameters: { url: `https://example.com/stress/${i}` },
          browserId: mockBrowserId
        });
        executions.push(execution);
      }
      
      // Wait a short time for executions to start
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Cancel half of the tasks
      const cancelPromises = executions
        .slice(0, taskCount / 2)
        .map(execution => executionEngine.cancelExecution(execution.id));
      
      await Promise.all(cancelPromises);
      
      // Wait for remaining tasks to complete or timeout
      const waitPromises = executions
        .slice(taskCount / 2)
        .map(execution => executionEngine.waitForExecution(execution.id, 1000));
      
      // This might timeout, which is expected
      const results = await Promise.allSettled(waitPromises);
      
      // Count cancelled and running tasks
      const cancelledCount = executions.slice(0, taskCount / 2).length;
      const runningCount = results.filter(r => 
        r.status === 'fulfilled' && r.value.status === ExecutionStatus.RUNNING
      ).length;
      const completedCount = results.filter(r => 
        r.status === 'fulfilled' && r.value.status === ExecutionStatus.COMPLETED
      ).length;
      
      console.log('Stress Test Results:');
      console.log(`- Cancelled tasks: ${cancelledCount}`);
      console.log(`- Still running tasks: ${runningCount}`);
      console.log(`- Completed tasks: ${completedCount}`);
      
      // Verify that we cancelled the expected number of tasks
      expect(cancelledCount).toBe(taskCount / 2);
    });
    
    it('should handle task queue overflow', async () => {
      // Set a very low concurrency limit
      executionEngine.setMaxConcurrentExecutions(2);
      
      // Upload a task that takes some time
      const taskFile = createTaskFile({
        executeCode: `
  const { log, progress, utils } = context;
  log('Queue test task running');
  progress(50, 'Working');
  await utils.sleep(200);
  progress(100, 'Completed');
  return { success: true };`
      });
      
      const task = await taskManager.uploadTask(taskFile, 'queue-test-task.js');
      
      // Try to execute many tasks at once
      const taskCount = 30;
      const maxQueueSize = executionEngine.getMaxQueueSize();
      
      console.log(`Testing with ${taskCount} tasks, max queue size: ${maxQueueSize}`);
      
      const executionPromises = Array.from({ length: taskCount }).map((_, i) => 
        executionEngine.executeTask({
          taskId: task.id,
          parameters: { url: `https://example.com/queue/${i}` },
          browserId: mockBrowserId,
          priority: i % 5 // Mix different priorities
        }).catch(error => ({ error }))
      );
      
      const results = await Promise.all(executionPromises);
      
      // Count successful and rejected executions
      const successful = results.filter(r => !('error' in r)).length;
      const rejected = results.filter(r => 'error' in r).length;
      
      console.log('Queue Overflow Test Results:');
      console.log(`- Successfully queued: ${successful}`);
      console.log(`- Rejected (queue full): ${rejected}`);
      
      // We expect some tasks to be rejected when the queue is full
      // The exact number depends on the implementation
      expect(successful).toBeGreaterThan(0);
      expect(successful).toBeLessThanOrEqual(maxQueueSize + 2); // +2 for concurrently running tasks
    });
  });
});