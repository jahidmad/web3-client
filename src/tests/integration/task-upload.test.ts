import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TaskManager } from '../../main/services/task-manager';
import { TaskFile } from '../../main/types/task';
import * as fs from 'fs/promises';
import * as path from 'path';

// Create real instances for integration testing
// But mock external dependencies
vi.mock('fs/promises', () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
  unlink: vi.fn().mockResolvedValue(undefined),
  rm: vi.fn().mockResolvedValue(undefined),
  readFile: vi.fn().mockImplementation((path) => {
    if (path.includes('external-code.js')) {
      return Promise.resolve('async function execute() { return { success: true }; }');
    }
    return Promise.resolve('');
  })
}));

describe('Task Upload Integration', () => {
  let taskManager: TaskManager;
  let mockBrowserManager: any;
  let mockDatabaseService: any;
  
  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    
    // Create mock dependencies
    mockBrowserManager = {
      getBrowser: vi.fn(),
      getBrowsers: vi.fn().mockResolvedValue([]),
      openBrowser: vi.fn()
    };
    
    mockDatabaseService = {
      saveTask: vi.fn().mockImplementation(taskFile => ({
        id: 'test_task_id',
        metadata: taskFile.metadata,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date()
      })),
      getTasks: vi.fn().mockResolvedValue([]),
      getTask: vi.fn(),
      getTaskFile: vi.fn(),
      deleteTask: vi.fn(),
      getTaskExecutions: vi.fn().mockResolvedValue([]),
      getAllTaskExecutions: vi.fn().mockResolvedValue([]),
      saveTaskExecution: vi.fn(),
      updateTaskUsage: vi.fn()
    };
    
    // Create task manager instance with real implementations
    taskManager = new TaskManager(mockBrowserManager, mockDatabaseService);
  });
  
  describe('uploadTask with different file formats', () => {
    it('should successfully upload a valid JSON task file', async () => {
      // Create a valid JSON task file
      const taskFile: TaskFile = {
        metadata: {
          id: 'json_task',
          name: 'JSON Task',
          description: 'A task in JSON format',
          version: '1.0.0',
          author: 'Test Author',
          tags: ['test', 'json']
        },
        parameters: [
          {
            name: 'param1',
            label: 'Parameter 1',
            type: 'string',
            required: true,
            description: 'A test parameter'
          }
        ],
        code: 'async function execute(context) { return { success: true }; }',
        examples: []
      };
      
      // Upload the task
      const result = await taskManager.uploadTask({
        file: Buffer.from(JSON.stringify(taskFile)),
        filename: 'test-task.json'
      });
      
      // Verify the task was saved
      expect(mockDatabaseService.saveTask).toHaveBeenCalled();
      expect(result.id).toBe('test_task_id');
    });
    
    it('should successfully upload a valid JavaScript task file with JSDoc', async () => {
      // Create a valid JavaScript task file with JSDoc
      const jsTaskFile = `
/**
 * @metadata
 * @name JavaScript Task
 * @description A task in JavaScript format with JSDoc
 * @version 1.0.0
 * @author Test Author
 * @tags test,javascript
 * 
 * @parameters
 */

// Parameters definition
const parameters = [
  {
    name: 'param1',
    label: 'Parameter 1',
    type: 'string',
    required: true,
    description: 'A test parameter'
  }
];

// Execute function
async function execute(context) {
  const { log, progress } = context;
  
  log('Task started');
  progress(50, 'Processing');
  
  return { success: true };
}

// Export components
module.exports = { parameters, execute };
`;
      
      // Upload the task
      const result = await taskManager.uploadTask({
        file: Buffer.from(jsTaskFile),
        filename: 'test-task.js'
      });
      
      // Verify the task was saved
      expect(mockDatabaseService.saveTask).toHaveBeenCalled();
      expect(result.id).toBe('test_task_id');
    });
    
    it('should fix and upload a JavaScript task file with minor issues', async () => {
      // Create a JavaScript task file with minor issues
      const jsTaskFileWithIssues = `
/**
 * @metadata
 * @name JS Task With Issues
 * @description A task with some fixable issues
 * @version 1.0.0
 * @author Test Author
 * @tags test,issues
 * 
 * @parameters
 */

// Parameters definition
const parameters = [
  {
    name: 'param1',
    // Missing label
    type: 'string',
    required: true,
    // Missing description
  }
];

// Non-async execute function
function execute(context) {
  const { log, progress } = context;
  
  console.log('This should use log instead'); // Using console.log
  progress(50, 'Processing');
  
  return { success: true };
}

// Missing module.exports
`;
      
      // Upload the task
      const result = await taskManager.uploadTask({
        file: Buffer.from(jsTaskFileWithIssues),
        filename: 'task-with-issues.js'
      });
      
      // Verify the task was saved after fixing
      expect(mockDatabaseService.saveTask).toHaveBeenCalled();
      expect(result.id).toBe('test_task_id');
    });
    
    it('should handle and reject a completely invalid file', async () => {
      // Create an invalid file
      const invalidFile = 'This is not a valid task file at all';
      
      // Attempt to upload the task and expect it to fail
      await expect(taskManager.uploadTask({
        file: Buffer.from(invalidFile),
        filename: 'invalid-file.txt'
      })).rejects.toThrow('Task upload failed');
      
      // Verify the task was not saved
      expect(mockDatabaseService.saveTask).not.toHaveBeenCalled();
    });
  });
  
  describe('uploadTask error handling and recovery', () => {
    it('should handle database errors gracefully', async () => {
      // Create a valid task file
      const taskFile: TaskFile = {
        metadata: {
          id: 'test_task',
          name: 'Test Task',
          description: 'A test task',
          version: '1.0.0',
          author: 'Test Author',
          tags: ['test']
        },
        parameters: [],
        code: 'async function execute(context) { return { success: true }; }',
        examples: []
      };
      
      // Mock database error
      mockDatabaseService.saveTask.mockRejectedValueOnce(new Error('Database error'));
      
      // Attempt to upload the task and expect it to fail
      await expect(taskManager.uploadTask({
        file: Buffer.from(JSON.stringify(taskFile)),
        filename: 'test-task.json'
      })).rejects.toThrow('Task upload failed: Failed to save task to database');
    });
    
    it('should clean up resources after errors', async () => {
      // Create an invalid file
      const invalidFile = 'This is not a valid task file';
      
      // Attempt to upload the task and expect it to fail
      await expect(taskManager.uploadTask({
        file: Buffer.from(invalidFile),
        filename: 'invalid-file.txt'
      })).rejects.toThrow();
      
      // Verify cleanup was attempted
      expect(fs.unlink).toHaveBeenCalled();
    });
  });
  
  describe('end-to-end task upload workflow', () => {
    it('should handle the complete task upload workflow', async () => {
      // Create a valid task file
      const taskFile: TaskFile = {
        metadata: {
          id: 'workflow_task',
          name: 'Workflow Task',
          description: 'A task for testing the complete workflow',
          version: '1.0.0',
          author: 'Test Author',
          tags: ['test', 'workflow'],
          dependencies: ['test-dep@1.0.0']
        },
        parameters: [
          {
            name: 'param1',
            label: 'Parameter 1',
            type: 'string',
            required: true,
            description: 'A test parameter'
          }
        ],
        code: 'async function execute(context) { return { success: true }; }',
        examples: [
          {
            name: 'Example 1',
            parameters: {
              param1: 'test value'
            }
          }
        ]
      };
      
      // Mock dependency check
      (taskManager as any).dependencyManager = {
        checkDependencies: vi.fn().mockResolvedValue({
          satisfied: true,
          missingDependencies: []
        })
      };
      
      // Upload the task
      const result = await taskManager.uploadTask({
        file: Buffer.from(JSON.stringify(taskFile)),
        filename: 'workflow-task.json'
      });
      
      // Verify the complete workflow
      expect(mockDatabaseService.saveTask).toHaveBeenCalled();
      expect(result.id).toBe('test_task_id');
      expect(result.metadata.name).toBe('Workflow Task');
      
      // Verify dependency check was called
      expect((taskManager as any).dependencyManager.checkDependencies).toHaveBeenCalled();
      
      // Verify metadata was cached
      expect((taskManager as any).metadataCache.cacheTaskMetadata).toHaveBeenCalled();
    });
  });
});