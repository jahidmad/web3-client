/**
 * Task System End-to-End Tests
 * 
 * This file contains comprehensive end-to-end tests for the plugin task system.
 * It tests the complete workflow from task creation to execution and result handling.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TaskManager, InMemoryTaskStorage } from '../task-manager';
import { TaskExecutionEngine } from '../../engines/task-execution-engine';
import { DependencyManager } from '../../managers/dependency-manager';
import { BrowserManager } from '../../managers/browser-manager';
import { LogManager } from '../../managers/log-manager';
import { EventBus } from '../../managers/event-bus';
import { TaskStatus, ExecutionStatus, TaskEventType } from '../../types/plugin-task-system';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('Task System End-to-End', () => {
  // Core system components
  let taskManager: TaskManager;
  let executionEngine: TaskExecutionEngine;
  let dependencyManager: DependencyManager;
  let browserManager: BrowserManager;
  let logManager: LogManager;
  let eventBus: EventBus;
  
  // Temporary directory for test files
  let tempDir: string;
  
  // Mock browser instance ID for testing
  const mockBrowserId = 'browser-123';
  
  // Setup before each test
  beforeEach(async () => {
    // Create temporary directory for test files
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'task-e2e-tests-'));
    
    // Create subdirectories
    fs.mkdirSync(path.join(tempDir, 'logs'), { recursive: true });
    fs.mkdirSync(path.join(tempDir, 'dependencies'), { recursive: true });
    fs.mkdirSync(path.join(tempDir, 'tasks'), { recursive: true });
    
    // Create a new event bus for communication between components
    eventBus = new EventBus();
    
    // Create storage with clean state for each test
    const taskStorage = new InMemoryTaskStorage();
    
    // Initialize the log manager
    logManager = new LogManager({
      logDirectory: path.join(tempDir, 'logs'),
      logLevel: 'debug',
      enableConsole: false
    });
    
    // Initialize the dependency manager
    dependencyManager = new DependencyManager({
      cacheDirectory: path.join(tempDir, 'dependencies'),
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
        goto: vi.fn().mockImplementation(async (url) => {
          return Promise.resolve();
        }),
        evaluate: vi.fn().mockImplementation(async (fn) => {
          if (typeof fn === 'function') {
            return 'Mock Page Title';
          }
          return undefined;
        }),
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
  
  // Clean up after each test
  afterEach(async () => {
    // Shut down the execution engine
    await executionEngine.shutdown();
    
    // Clean up temporary directory
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (error) {
      console.error('Failed to clean up temp directory:', error);
    }
  });
  
  /**
   * Helper function to create a task file
   */
  const createTaskFile = (customizations = {}): Buffer => {
    const {
      name = 'E2E Test Task',
      description = 'A task for end-to-end testing',
      version = '1.0.0',
      author = 'Test Author',
      category = 'Testing',
      tags = 'e2e,test',
      icon = '🧪',
      dependencies = ['lodash@4.17.21'],
      executeCode = `
  const { page, params, log, progress, browser, utils } = context;
  
  log('Starting E2E test task');
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
  },
  {
    name: 'selector',
    label: 'CSS Selector',
    type: 'string',
    required: false,
    default: 'body',
    description: 'Element selector to target'
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
  
  describe('Complete Task Lifecycle', () => {
    it('should handle the complete task lifecycle from creation to execution', async () => {
      // Track events for verification
      const events: any[] = [];
      eventBus.on(TaskEventType.TASK_CREATED, (event) => events.push({ type: 'task_created', event }));
      eventBus.on(TaskEventType.EXECUTION_STARTED, (event) => events.push({ type: 'execution_started', event }));
      eventBus.on(TaskEventType.EXECUTION_PROGRESS, (event) => events.push({ type: 'execution_progress', event }));
      eventBus.on(TaskEventType.EXECUTION_COMPLETED, (event) => events.push({ type: 'execution_completed', event }));
      
      // 1. Create a task file
      const taskFile = createTaskFile();
      
      // 2. Upload the task
      const task = await taskManager.uploadTask(taskFile, 'e2e-test-task.js');
      expect(task.id).toBeDefined();
      expect(task.name).toBe('E2E Test Task');
      expect(task.status).toBe(TaskStatus.DRAFT);
      
      // 3. Update task status to active
      const updatedTask = await taskManager.updateTask(task.id, { status: TaskStatus.ACTIVE });
      expect(updatedTask.status).toBe(TaskStatus.ACTIVE);
      
      // 4. Check dependencies
      const dependencyStatus = await dependencyManager.checkDependencies(task.id);
      expect(dependencyStatus.satisfied).toBe(true);
      
      // 5. Execute the task
      const execution = await executionEngine.executeTask({
        taskId: task.id,
        parameters: { 
          url: 'https://example.com',
          selector: 'h1'
        },
        browserId: mockBrowserId
      });
      
      expect(execution.id).toBeDefined();
      expect(execution.taskId).toBe(task.id);
      expect(execution.status).toBe(ExecutionStatus.PENDING);
      expect(execution.parameters).toEqual({
        url: 'https://example.com',
        selector: 'h1'
      });
      
      // 6. Wait for execution to complete
      const result = await executionEngine.waitForExecution(execution.id, 5000);
      
      expect(result.status).toBe(ExecutionStatus.COMPLETED);
      expect(result.progress).toBe(100);
      expect(result.result?.success).toBe(true);
      expect(result.result?.data?.title).toBe('Mock Page Title');
      
      // 7. Verify execution history
      const executions = await executionEngine.getExecutions(task.id);
      expect(executions.length).toBeGreaterThan(0);
      expect(executions[0].id).toBe(execution.id);
      
      // 8. Export the task
      const exportedBuffer = await taskManager.exportTask(task.id);
      expect(exportedBuffer).toBeInstanceOf(Buffer);
      expect(exportedBuffer.toString()).toContain('@name E2E Test Task');
      
      // 9. Delete the task
      await taskManager.deleteTask(task.id);
      const deletedTask = await taskManager.getTask(task.id);
      expect(deletedTask).toBeNull();
      
      // 10. Verify events were emitted
      expect(events.some(e => e.type === 'task_created')).toBe(true);
      expect(events.some(e => e.type === 'execution_started')).toBe(true);
      expect(events.some(e => e.type === 'execution_progress')).toBe(true);
      expect(events.some(e => e.type === 'execution_completed')).toBe(true);
      
      // Verify progress events
      const progressEvents = events.filter(e => e.type === 'execution_progress');
      expect(progressEvents.length).toBeGreaterThan(0);
      
      // Verify the final progress event has 100%
      const finalProgressEvent = progressEvents[progressEvents.length - 1];
      expect(finalProgressEvent.event.data.progress).toBe(100);
    });
  });
  
  describe('Complex Task Scenarios', () => {
    it('should handle tasks with complex dependencies', async () => {
      // Mock dependency manager to handle multiple dependencies
      dependencyManager.checkDependencies = vi.fn().mockResolvedValue({
        satisfied: true,
        dependencies: [
          { name: 'lodash', version: '4.17.21', installed: true },
          { name: 'moment', version: '2.29.4', installed: true },
          { name: 'axios', version: '1.3.4', installed: true }
        ],
        missingDependencies: [],
        lastChecked: new Date(),
        installRequired: false
      });
      
      // Create a task with multiple dependencies
      const taskFile = createTaskFile({
        name: 'Complex Dependencies Task',
        dependencies: ['lodash@4.17.21', 'moment@2.29.4', 'axios@1.3.4'],
        executeCode: `
  const { log, progress } = context;
  log('Task with multiple dependencies');
  progress(100, 'Completed');
  return { success: true, dependencies: ['lodash', 'moment', 'axios'] };`
      });
      
      // Upload and execute the task
      const task = await taskManager.uploadTask(taskFile, 'complex-deps-task.js');
      const execution = await executionEngine.executeTask({
        taskId: task.id,
        parameters: { url: 'https://example.com' },
        browserId: mockBrowserId
      });
      
      const result = await executionEngine.waitForExecution(execution.id, 5000);
      
      // Verify execution completed successfully
      expect(result.status).toBe(ExecutionStatus.COMPLETED);
      expect(result.result?.dependencies).toEqual(['lodash', 'moment', 'axios']);
      
      // Verify dependency manager was called with the task ID
      expect(dependencyManager.checkDependencies).toHaveBeenCalledWith(task.id);
    });
    
    it('should handle tasks with complex parameter validation', async () => {
      // Create a task with parameter validation
      const taskFile = createTaskFile({
        name: 'Parameter Validation Task',
        executeCode: `
  const { params, log, progress } = context;
  
  // Validate URL parameter
  if (!params.url.startsWith('https://')) {
    throw new Error('URL must start with https://');
  }
  
  // Validate numeric parameter
  if (params.count < 1 || params.count > 100) {
    throw new Error('Count must be between 1 and 100');
  }
  
  log('Parameters validated successfully');
  progress(100, 'Completed');
  return { success: true, params };`
      });
      
      // Modify the parameters section
      const taskContent = taskFile.toString().replace(
        /const parameters = \[\s*{[\s\S]*?}\s*\];/m,
        `const parameters = [
  {
    name: 'url',
    label: 'Target URL',
    type: 'url',
    required: true,
    description: 'The URL to process (must be HTTPS)'
  },
  {
    name: 'count',
    label: 'Item Count',
    type: 'number',
    required: true,
    default: 10,
    min: 1,
    max: 100,
    description: 'Number of items to process (1-100)'
  }
];`
      );
      
      // Upload the task
      const task = await taskManager.uploadTask(Buffer.from(taskContent), 'param-validation-task.js');
      
      // Test with valid parameters
      const validExecution = await executionEngine.executeTask({
        taskId: task.id,
        parameters: { 
          url: 'https://example.com',
          count: 50
        },
        browserId: mockBrowserId
      });
      
      const validResult = await executionEngine.waitForExecution(validExecution.id, 5000);
      expect(validResult.status).toBe(ExecutionStatus.COMPLETED);
      expect(validResult.result?.success).toBe(true);
      
      // Test with invalid parameters
      const invalidExecution = await executionEngine.executeTask({
        taskId: task.id,
        parameters: { 
          url: 'http://example.com', // Not HTTPS
          count: 150 // Exceeds max
        },
        browserId: mockBrowserId
      });
      
      const invalidResult = await executionEngine.waitForExecution(invalidExecution.id, 5000);
      expect(invalidResult.status).toBe(ExecutionStatus.FAILED);
      expect(invalidResult.error).toContain('URL must start with https://');
    });
    
    it('should handle tasks with error handling and retries', async () => {
      // Mock browser manager to fail on first attempt
      let attemptCount = 0;
      browserManager.getBrowser = vi.fn().mockImplementation(async () => {
        return {
          id: mockBrowserId,
          getPage: vi.fn().mockImplementation(async () => {
            attemptCount++;
            if (attemptCount === 1) {
              throw new Error('Simulated browser error');
            }
            return {
              goto: vi.fn().mockResolvedValue(undefined),
              evaluate: vi.fn().mockResolvedValue('Mock Page Title'),
              screenshot: vi.fn().mockResolvedValue(Buffer.from('mock-screenshot')),
              close: vi.fn().mockResolvedValue(undefined)
            };
          }),
          close: vi.fn().mockResolvedValue(undefined)
        };
      });
      
      // Create a task with retry logic
      const taskFile = createTaskFile({
        name: 'Error Handling Task',
        executeCode: `
  const { log, progress, utils } = context;
  
  // Track retry attempts
  let attempts = 0;
  const maxAttempts = 3;
  
  async function attemptOperation() {
    attempts++;
    log(\`Attempt \${attempts} of \${maxAttempts}\`);
    
    try {
      // This will fail on first attempt due to our mock
      const page = await context.page;
      await page.goto(context.params.url);
      return 'Success';
    } catch (error) {
      log(\`Error: \${error.message}\`);
      if (attempts >= maxAttempts) {
        throw new Error(\`Failed after \${attempts} attempts: \${error.message}\`);
      }
      
      // Wait before retry
      log('Waiting before retry...');
      await utils.sleep(100);
      return attemptOperation();
    }
  }
  
  const result = await attemptOperation();
  progress(100, 'Task completed after retries');
  return { success: true, result, attempts };`
      });
      
      // Upload and execute the task
      const task = await taskManager.uploadTask(taskFile, 'retry-task.js');
      const execution = await executionEngine.executeTask({
        taskId: task.id,
        parameters: { url: 'https://example.com' },
        browserId: mockBrowserId
      });
      
      const result = await executionEngine.waitForExecution(execution.id, 5000);
      
      // Verify execution completed successfully after retries
      expect(result.status).toBe(ExecutionStatus.COMPLETED);
      expect(result.result?.success).toBe(true);
      expect(result.result?.attempts).toBeGreaterThan(1);
      
      // Verify logs contain retry information
      const retryLogs = result.logs.filter(log => log.message.includes('Attempt'));
      expect(retryLogs.length).toBeGreaterThan(1);
    });
  });
  
  describe('Task Import/Export', () => {
    it('should export and re-import tasks preserving all metadata', async () => {
      // 1. Create and upload a task
      const taskFile = createTaskFile({
        name: 'Export Import Test Task',
        description: 'A task for testing export/import functionality',
        tags: 'export,import,test'
      });
      
      const originalTask = await taskManager.uploadTask(taskFile, 'export-import-task.js');
      
      // 2. Export the task
      const exportedBuffer = await taskManager.exportTask(originalTask.id);
      
      // 3. Delete the original task
      await taskManager.deleteTask(originalTask.id);
      
      // 4. Re-import the task
      const importResult = await taskManager.importTask(exportedBuffer);
      
      expect(importResult.success).toBe(true);
      expect(importResult.imported.length).toBe(1);
      
      // 5. Get the imported task
      const tasks = await taskManager.getTasks();
      expect(tasks.length).toBe(1);
      
      const importedTask = tasks[0];
      
      // 6. Verify metadata is preserved
      expect(importedTask.name).toBe('Export Import Test Task');
      expect(importedTask.description).toBe('A task for testing export/import functionality');
      expect(importedTask.author).toBe('Test Author');
      expect(importedTask.version).toBe('1.0.0');
      expect(importedTask.category).toBe('Testing');
      expect(importedTask.tags).toContain('export');
      expect(importedTask.tags).toContain('import');
      expect(importedTask.tags).toContain('test');
      
      // 7. Verify parameters are preserved
      expect(importedTask.parameters).toHaveLength(2);
      expect(importedTask.parameters[0].name).toBe('url');
      expect(importedTask.parameters[1].name).toBe('selector');
      
      // 8. Verify dependencies are preserved
      expect(importedTask.dependencies).toEqual(['lodash@4.17.21']);
      
      // 9. Execute the imported task to verify functionality
      const execution = await executionEngine.executeTask({
        taskId: importedTask.id,
        parameters: { url: 'https://example.com' },
        browserId: mockBrowserId
      });
      
      const result = await executionEngine.waitForExecution(execution.id, 5000);
      
      expect(result.status).toBe(ExecutionStatus.COMPLETED);
      expect(result.result?.success).toBe(true);
    });
    
    it('should handle bulk export and import of multiple tasks', async () => {
      // 1. Create and upload multiple tasks
      const taskFiles = [
        createTaskFile({ name: 'Bulk Task 1', description: 'First bulk task' }),
        createTaskFile({ name: 'Bulk Task 2', description: 'Second bulk task' }),
        createTaskFile({ name: 'Bulk Task 3', description: 'Third bulk task' })
      ];
      
      const tasks = [];
      for (let i = 0; i < taskFiles.length; i++) {
        const task = await taskManager.uploadTask(taskFiles[i], `bulk-task-${i+1}.js`);
        tasks.push(task);
      }
      
      // 2. Export all tasks
      const taskIds = tasks.map(task => task.id);
      const exportedBuffer = await taskManager.exportMultipleTasks(taskIds);
      
      // 3. Delete all tasks
      for (const taskId of taskIds) {
        await taskManager.deleteTask(taskId);
      }
      
      // 4. Re-import all tasks
      const importResult = await taskManager.importTask(exportedBuffer);
      
      expect(importResult.success).toBe(true);
      expect(importResult.imported.length).toBe(3);
      
      // 5. Verify all tasks were imported
      const importedTasks = await taskManager.getTasks();
      expect(importedTasks.length).toBe(3);
      
      // 6. Verify task names
      const taskNames = importedTasks.map(task => task.name).sort();
      expect(taskNames).toEqual(['Bulk Task 1', 'Bulk Task 2', 'Bulk Task 3'].sort());
    });
  });
});