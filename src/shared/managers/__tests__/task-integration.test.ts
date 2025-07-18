/**
 * Task System Integration Tests
 * 
 * This file contains end-to-end integration tests for the plugin task system.
 * It tests the interaction between multiple components and verifies the system
 * works correctly as a whole.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TaskManager, InMemoryTaskStorage } from '../task-manager';
import { TaskStatus, ExecutionStatus, ErrorCode } from '../../types/plugin-task-system';
import { TaskExecutionEngine } from '../../engines/task-execution-engine';
import { DependencyManager } from '../../managers/dependency-manager';
import { BrowserManager } from '../../managers/browser-manager';
import { LogManager } from '../../managers/log-manager';
import { EventBus } from '../../managers/event-bus';

describe('Task System Integration', () => {
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
      maxConcurrentExecutions: 2,
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
    
    // Mock the dependency manager's installDependencies method
    dependencyManager.installDependencies = vi.fn().mockResolvedValue({
      success: true,
      installed: [{ name: 'lodash', version: '4.17.21', installed: true }],
      failed: [],
      warnings: []
    });
    
    // Mock the dependency manager's checkDependencies method
    dependencyManager.checkDependencies = vi.fn().mockResolvedValue({
      satisfied: true,
      dependencies: [{ name: 'lodash', version: '4.17.21', installed: true }],
      missingDependencies: [],
      lastChecked: new Date(),
      installRequired: false
    });
  });
  
  // Clean up after each test
  afterEach(async () => {
    // Clean up any resources
    await executionEngine.shutdown();
  });
  
  /**
   * Helper function to create a valid task file
   */
  const createValidTaskFile = (customizations = {}): Buffer => {
    const {
      name = 'Test Task',
      description = 'A simple test task',
      version = '1.0.0',
      author = 'Test Author',
      category = 'Testing',
      tags = 'test,integration',
      icon = '🧪',
      dependencies = ['lodash@4.17.21'],
      executeCode = `
  const { page, params, log, progress, browser, utils } = context;
  
  log('Starting test task');
  progress(25, 'Navigating to URL');
  
  await browser.goto(params.url);
  
  progress(50, 'Waiting for page to load');
  await utils.sleep(100);
  
  progress(75, 'Extracting data');
  const title = await browser.evaluate(() => document.title);
  
  progress(100, 'Task completed');
  return { success: true, data: { title } };`
    } = customizations;
    
    const taskContent = `
/**
 * @name ${name}
 * @description ${description}
 * @version ${version}
 * @author ${author}
 * @category ${category}
 * @tags ${tags}
 * @icon ${icon}
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
  timeout: 30000,
  retries: 2,
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

  describe('End-to-End Task Execution', () => {
    it('should execute a task successfully with all components working together', async () => {
      // 1. Upload a task
      const taskFile = createValidTaskFile();
      const task = await taskManager.uploadTask(taskFile, 'integration-test-task.js');
      
      // 2. Execute the task
      const execution = await executionEngine.executeTask({
        taskId: task.id,
        parameters: { url: 'https://example.com' },
        browserId: mockBrowserId
      });
      
      // 3. Wait for execution to complete
      const result = await executionEngine.waitForExecution(execution.id, 5000);
      
      // 4. Verify the execution completed successfully
      expect(result.status).toBe(ExecutionStatus.COMPLETED);
      expect(result.progress).toBe(100);
      expect(result.result?.success).toBe(true);
      expect(result.logs.length).toBeGreaterThan(0);
      
      // 5. Verify dependency manager was called
      expect(dependencyManager.checkDependencies).toHaveBeenCalledWith(task.id);
      
      // 6. Verify browser manager was used
      expect(browserManager.getBrowser).toHaveBeenCalled();
    });
    
    it('should handle task execution failure gracefully', async () => {
      // 1. Upload a task that will fail
      const taskFile = createValidTaskFile({
        executeCode: `
  const { log, progress } = context;
  log('Starting failing task');
  progress(50, 'About to fail');
  throw new Error('Intentional test failure');`
      });
      
      const task = await taskManager.uploadTask(taskFile, 'failing-task.js');
      
      // 2. Execute the task
      const execution = await executionEngine.executeTask({
        taskId: task.id,
        parameters: { url: 'https://example.com' },
        browserId: mockBrowserId
      });
      
      // 3. Wait for execution to complete
      const result = await executionEngine.waitForExecution(execution.id, 5000);
      
      // 4. Verify the execution failed as expected
      expect(result.status).toBe(ExecutionStatus.FAILED);
      expect(result.error).toContain('Intentional test failure');
      expect(result.logs.some(log => log.level === 'error')).toBe(true);
    });
    
    it('should handle task cancellation', async () => {
      // 1. Upload a long-running task
      const taskFile = createValidTaskFile({
        executeCode: `
  const { log, progress } = context;
  log('Starting long task');
  progress(25, 'Running for a while');
  
  // This would normally be a long operation
  await new Promise(resolve => setTimeout(resolve, 10000));
  
  return { success: true };`
      });
      
      const task = await taskManager.uploadTask(taskFile, 'long-task.js');
      
      // 2. Execute the task
      const execution = await executionEngine.executeTask({
        taskId: task.id,
        parameters: { url: 'https://example.com' },
        browserId: mockBrowserId
      });
      
      // 3. Wait a short time for execution to start
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // 4. Cancel the execution
      await executionEngine.cancelExecution(execution.id);
      
      // 5. Wait for execution to be marked as cancelled
      const result = await executionEngine.waitForExecution(execution.id, 1000);
      
      // 6. Verify the execution was cancelled
      expect(result.status).toBe(ExecutionStatus.CANCELLED);
    });
  });
  
  describe('Multi-Component Integration', () => {
    it('should handle dependency installation failure', async () => {
      // 1. Mock dependency installation failure
      dependencyManager.installDependencies = vi.fn().mockResolvedValue({
        success: false,
        installed: [],
        failed: [{ dependency: 'non-existent-package@1.0.0', error: 'Package not found' }],
        warnings: []
      });
      
      dependencyManager.checkDependencies = vi.fn().mockResolvedValue({
        satisfied: false,
        dependencies: [],
        missingDependencies: [{ name: 'non-existent-package', version: '1.0.0', installed: false }],
        lastChecked: new Date(),
        installRequired: true
      });
      
      // 2. Upload a task with the problematic dependency
      const taskFile = createValidTaskFile({
        dependencies: ['non-existent-package@1.0.0']
      });
      
      const task = await taskManager.uploadTask(taskFile, 'bad-dependency-task.js');
      
      // 3. Try to execute the task
      try {
        await executionEngine.executeTask({
          taskId: task.id,
          parameters: { url: 'https://example.com' },
          browserId: mockBrowserId
        });
        
        // Should not reach here
        expect(true).toBe(false);
      } catch (error) {
        // 4. Verify proper error is thrown
        expect(error.code).toBe(ErrorCode.DEPENDENCY_INSTALL_FAILED);
      }
    });
    
    it('should handle browser unavailability', async () => {
      // 1. Mock browser manager to simulate browser unavailability
      browserManager.getBrowser = vi.fn().mockRejectedValue(
        new Error('Browser not available')
      );
      
      // 2. Upload a task
      const taskFile = createValidTaskFile();
      const task = await taskManager.uploadTask(taskFile, 'browser-test-task.js');
      
      // 3. Try to execute the task
      try {
        await executionEngine.executeTask({
          taskId: task.id,
          parameters: { url: 'https://example.com' },
          browserId: 'non-existent-browser'
        });
        
        // Should not reach here
        expect(true).toBe(false);
      } catch (error) {
        // 4. Verify proper error is thrown
        expect(error.code).toBe(ErrorCode.BROWSER_NOT_AVAILABLE);
      }
    });
    
    it('should execute multiple tasks concurrently', async () => {
      // 1. Upload two tasks
      const taskFile1 = createValidTaskFile({
        name: 'Concurrent Task 1',
        executeCode: `
  const { log, progress, utils } = context;
  log('Task 1 running');
  progress(50, 'Task 1 in progress');
  await utils.sleep(100);
  progress(100, 'Task 1 completed');
  return { success: true, taskNumber: 1 };`
      });
      
      const taskFile2 = createValidTaskFile({
        name: 'Concurrent Task 2',
        executeCode: `
  const { log, progress, utils } = context;
  log('Task 2 running');
  progress(50, 'Task 2 in progress');
  await utils.sleep(100);
  progress(100, 'Task 2 completed');
  return { success: true, taskNumber: 2 };`
      });
      
      const task1 = await taskManager.uploadTask(taskFile1, 'concurrent-task-1.js');
      const task2 = await taskManager.uploadTask(taskFile2, 'concurrent-task-2.js');
      
      // 2. Execute both tasks
      const execution1Promise = executionEngine.executeTask({
        taskId: task1.id,
        parameters: { url: 'https://example.com/1' },
        browserId: mockBrowserId
      });
      
      const execution2Promise = executionEngine.executeTask({
        taskId: task2.id,
        parameters: { url: 'https://example.com/2' },
        browserId: mockBrowserId
      });
      
      // 3. Wait for both executions to start
      const [execution1, execution2] = await Promise.all([execution1Promise, execution2Promise]);
      
      // 4. Wait for both executions to complete
      const result1 = await executionEngine.waitForExecution(execution1.id, 5000);
      const result2 = await executionEngine.waitForExecution(execution2.id, 5000);
      
      // 5. Verify both executions completed successfully
      expect(result1.status).toBe(ExecutionStatus.COMPLETED);
      expect(result2.status).toBe(ExecutionStatus.COMPLETED);
      expect(result1.result?.taskNumber).toBe(1);
      expect(result2.result?.taskNumber).toBe(2);
    });
  });
  
  describe('Performance Testing', () => {
    it('should handle rapid sequential task executions', async () => {
      // 1. Upload a quick task
      const taskFile = createValidTaskFile({
        executeCode: `
  const { log, progress } = context;
  log('Quick task running');
  progress(100, 'Completed');
  return { success: true };`
      });
      
      const task = await taskManager.uploadTask(taskFile, 'quick-task.js');
      
      // 2. Execute the task multiple times in sequence
      const executionCount = 5;
      const startTime = Date.now();
      
      for (let i = 0; i < executionCount; i++) {
        const execution = await executionEngine.executeTask({
          taskId: task.id,
          parameters: { url: `https://example.com/${i}` },
          browserId: mockBrowserId
        });
        
        const result = await executionEngine.waitForExecution(execution.id, 5000);
        expect(result.status).toBe(ExecutionStatus.COMPLETED);
      }
      
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      
      // 3. Verify performance metrics
      console.log(`Executed ${executionCount} tasks in ${totalTime}ms (${totalTime/executionCount}ms per task)`);
      
      // This is a soft assertion - we're mainly interested in the logged metrics
      expect(totalTime).toBeLessThan(executionCount * 1000);
    });
    
    it('should handle stress testing with many concurrent tasks', async () => {
      // 1. Upload a quick task
      const taskFile = createValidTaskFile({
        executeCode: `
  const { log, progress, utils } = context;
  log('Stress test task running');
  progress(50, 'Working');
  await utils.sleep(50);
  progress(100, 'Completed');
  return { success: true };`
      });
      
      const task = await taskManager.uploadTask(taskFile, 'stress-test-task.js');
      
      // 2. Configure execution engine for higher concurrency
      executionEngine.setMaxConcurrentExecutions(5);
      
      // 3. Execute many tasks concurrently
      const executionCount = 10;
      const startTime = Date.now();
      
      const executionPromises = [];
      for (let i = 0; i < executionCount; i++) {
        const executionPromise = executionEngine.executeTask({
          taskId: task.id,
          parameters: { url: `https://example.com/stress/${i}` },
          browserId: mockBrowserId
        });
        executionPromises.push(executionPromise);
      }
      
      // 4. Wait for all executions to be created
      const executions = await Promise.all(executionPromises);
      
      // 5. Wait for all executions to complete
      const resultPromises = executions.map(execution => 
        executionEngine.waitForExecution(execution.id, 10000)
      );
      
      const results = await Promise.all(resultPromises);
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      
      // 6. Verify all completed successfully
      const allCompleted = results.every(result => result.status === ExecutionStatus.COMPLETED);
      expect(allCompleted).toBe(true);
      
      // 7. Log performance metrics
      console.log(`Stress test: ${executionCount} concurrent tasks in ${totalTime}ms (${totalTime/executionCount}ms per task)`);
      
      // This is a soft assertion - we're mainly interested in the logged metrics
      // The time should be significantly less than sequential execution would take
      expect(totalTime).toBeLessThan(executionCount * 200);
    });
  });
});