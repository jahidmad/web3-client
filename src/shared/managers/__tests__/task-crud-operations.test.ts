/**
 * Task CRUD Operations Tests
 * 
 * This file contains tests for the task CRUD operations implemented in the task manager.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { TaskManager, InMemoryTaskStorage } from '../task-manager';
import { TaskStatus, TaskError, ErrorCode } from '../../types';

// Mock the task file parser and validator
vi.mock('../../parsers/task-file-parser', () => ({
  parseTaskFile: vi.fn(),
  validateTaskFile: vi.fn(),
  TaskFileParser: vi.fn().mockImplementation(() => ({
    parseTaskFile: vi.fn().mockResolvedValue({
      metadata: {
        name: 'Test Task',
        description: 'A test task for CRUD operations',
        version: '1.0.0',
        author: 'Test Author',
        category: 'Test',
        tags: ['test', 'crud']
      },
      parameters: [{
        name: 'url',
        label: 'URL',
        type: 'url',
        required: true
      }],
      dependencies: ['lodash@4.17.21'],
      config: {
        timeout: 30000,
        retries: 2
      },
      code: 'async function execute(context) { /* test code */ }',
      executeFunction: 'async function execute(context) { /* test code */ }'
    })
  }))
}));

vi.mock('../../validators/task-file-validator', () => ({
  validateTaskFile: vi.fn().mockResolvedValue({
    valid: true,
    errors: [],
    warnings: []
  })
}));

describe('Task CRUD Operations', () => {
  let taskManager: TaskManager;
  let mockTaskFile: Buffer;
  
  beforeEach(() => {
    // Create a new task manager with in-memory storage for each test
    taskManager = new TaskManager(new InMemoryTaskStorage());
    
    // Create a mock task file
    mockTaskFile = Buffer.from(`
      /**
       * @name Test Task
       * @description A test task for CRUD operations
       * @version 1.0.0
       * @author Test Author
       * @category Test
       * @tags test,crud
       */
      
      const parameters = [
        {
          name: 'url',
          label: 'URL',
          type: 'url',
          required: true
        }
      ];
      
      const dependencies = ['lodash@4.17.21'];
      
      const config = {
        timeout: 30000,
        retries: 2
      };
      
      async function execute(context) {
        const { log, progress } = context;
        log('Task started');
        progress(50, 'Halfway done');
        return { success: true };
      }
      
      module.exports = { parameters, dependencies, config, execute };
    `);
  });
  
  afterEach(() => {
    vi.restoreAllMocks();
  });
  
  describe('uploadTask', () => {
    it('should upload and parse a task file', async () => {
      const task = await taskManager.uploadTask(mockTaskFile, 'test-task.js');
      
      expect(task).toBeDefined();
      expect(task.id).toBeDefined();
      expect(task.name).toBe('Test Task');
      expect(task.description).toBe('A test task for CRUD operations');
      expect(task.version).toBe('1.0.0');
      expect(task.author).toBe('Test Author');
      expect(task.category).toBe('Test');
      expect(task.tags).toEqual(['test', 'crud']);
      expect(task.status).toBe(TaskStatus.DRAFT);
      expect(task.parameters).toHaveLength(1);
      expect(task.dependencies).toEqual(['lodash@4.17.21']);
    });
    
    it('should reject duplicate task names', async () => {
      // Upload the first task
      await taskManager.uploadTask(mockTaskFile, 'test-task.js');
      
      // Try to upload another task with the same name
      await expect(taskManager.uploadTask(mockTaskFile, 'test-task-2.js')).rejects.toThrow(
        expect.objectContaining({
          code: ErrorCode.INVALID_FORMAT,
          message: expect.stringContaining('already exists')
        })
      );
    });
  });
  
  describe('getTasks', () => {
    it('should retrieve all tasks', async () => {
      // Upload a task
      await taskManager.uploadTask(mockTaskFile, 'test-task.js');
      
      // Get all tasks
      const tasks = await taskManager.getTasks();
      
      expect(tasks).toHaveLength(1);
      expect(tasks[0].name).toBe('Test Task');
    });
    
    it('should filter tasks by category', async () => {
      // Upload a task
      await taskManager.uploadTask(mockTaskFile, 'test-task.js');
      
      // Get tasks with filter
      const tasks = await taskManager.getTasks({ category: 'Test' });
      
      expect(tasks).toHaveLength(1);
      expect(tasks[0].category).toBe('Test');
      
      // Get tasks with non-matching filter
      const emptyTasks = await taskManager.getTasks({ category: 'NonExistent' });
      
      expect(emptyTasks).toHaveLength(0);
    });
  });
  
  describe('getTask', () => {
    it('should retrieve a task by ID', async () => {
      // Upload a task
      const uploadedTask = await taskManager.uploadTask(mockTaskFile, 'test-task.js');
      
      // Get the task by ID
      const task = await taskManager.getTask(uploadedTask.id);
      
      expect(task).toBeDefined();
      expect(task?.id).toBe(uploadedTask.id);
      expect(task?.name).toBe('Test Task');
    });
    
    it('should return null for non-existent task ID', async () => {
      const task = await taskManager.getTask('non-existent-id');
      
      expect(task).toBeNull();
    });
  });
  
  describe('updateTask', () => {
    it('should update a task', async () => {
      // Upload a task
      const uploadedTask = await taskManager.uploadTask(mockTaskFile, 'test-task.js');
      
      // Update the task
      const updatedTask = await taskManager.updateTask(uploadedTask.id, {
        description: 'Updated description',
        status: TaskStatus.ACTIVE
      });
      
      expect(updatedTask).toBeDefined();
      expect(updatedTask.id).toBe(uploadedTask.id);
      expect(updatedTask.description).toBe('Updated description');
      expect(updatedTask.status).toBe(TaskStatus.ACTIVE);
      
      // Verify the update persisted
      const retrievedTask = await taskManager.getTask(uploadedTask.id);
      expect(retrievedTask?.description).toBe('Updated description');
      expect(retrievedTask?.status).toBe(TaskStatus.ACTIVE);
    });
    
    it('should reject updates to non-existent tasks', async () => {
      await expect(taskManager.updateTask('non-existent-id', {
        description: 'Updated description'
      })).rejects.toThrow(
        expect.objectContaining({
          code: ErrorCode.DATABASE_ERROR,
          message: expect.stringContaining('not found')
        })
      );
    });
    
    it('should prevent duplicate names on update', async () => {
      // Upload two tasks
      const task1 = await taskManager.uploadTask(mockTaskFile, 'test-task.js');
      
      // Create a second task with a different name
      const mockTaskFile2 = Buffer.from(mockTaskFile.toString().replace('@name Test Task', '@name Another Task'));
      const task2 = await taskManager.uploadTask(mockTaskFile2, 'another-task.js');
      
      // Try to update task2 to have the same name as task1
      await expect(taskManager.updateTask(task2.id, {
        name: 'Test Task'
      })).rejects.toThrow(
        expect.objectContaining({
          code: ErrorCode.INVALID_FORMAT,
          message: expect.stringContaining('already exists')
        })
      );
    });
  });
  
  describe('deleteTask', () => {
    it('should delete a task', async () => {
      // Upload a task
      const uploadedTask = await taskManager.uploadTask(mockTaskFile, 'test-task.js');
      
      // Delete the task
      await taskManager.deleteTask(uploadedTask.id);
      
      // Verify the task was deleted
      const task = await taskManager.getTask(uploadedTask.id);
      expect(task).toBeNull();
    });
    
    it('should handle deleting non-existent tasks', async () => {
      await expect(taskManager.deleteTask('non-existent-id')).rejects.toThrow(
        expect.objectContaining({
          code: ErrorCode.DATABASE_ERROR,
          message: expect.stringContaining('not found')
        })
      );
    });
  });
  
  describe('searchTasks', () => {
    it('should search tasks by query string', async () => {
      // Upload a task
      await taskManager.uploadTask(mockTaskFile, 'test-task.js');
      
      // Search for tasks
      const tasks = await taskManager.searchTasks('test');
      
      expect(tasks).toHaveLength(1);
      expect(tasks[0].name).toBe('Test Task');
      
      // Search with non-matching query
      const emptyTasks = await taskManager.searchTasks('nonexistent');
      
      expect(emptyTasks).toHaveLength(0);
    });
    
    it('should combine search with filters', async () => {
      // Upload a task
      await taskManager.uploadTask(mockTaskFile, 'test-task.js');
      
      // Search with matching filter
      const tasks = await taskManager.searchTasks('test', { category: 'Test' });
      
      expect(tasks).toHaveLength(1);
      
      // Search with non-matching filter
      const emptyTasks = await taskManager.searchTasks('test', { category: 'NonExistent' });
      
      expect(emptyTasks).toHaveLength(0);
    });
  });
  
  describe('getTaskCount', () => {
    it('should count all tasks', async () => {
      // Upload a task
      await taskManager.uploadTask(mockTaskFile, 'test-task.js');
      
      // Count all tasks
      const count = await taskManager.getTaskCount();
      
      expect(count).toBe(1);
    });
    
    it('should count filtered tasks', async () => {
      // Upload a task
      await taskManager.uploadTask(mockTaskFile, 'test-task.js');
      
      // Count with matching filter
      const count = await taskManager.getTaskCount({ category: 'Test' });
      
      expect(count).toBe(1);
      
      // Count with non-matching filter
      const emptyCount = await taskManager.getTaskCount({ category: 'NonExistent' });
      
      expect(emptyCount).toBe(0);
    });
  });
  
  describe('bulk operations', () => {
    it('should upload multiple tasks', async () => {
      // Create a second mock task file
      const mockTaskFile2 = Buffer.from(mockTaskFile.toString().replace('@name Test Task', '@name Another Task'));
      
      // Upload multiple tasks
      const result = await taskManager.uploadMultipleTasks([
        { buffer: mockTaskFile, filename: 'test-task.js' },
        { buffer: mockTaskFile2, filename: 'another-task.js' }
      ]);
      
      expect(result.successful).toHaveLength(2);
      expect(result.failed).toHaveLength(0);
      
      // Verify tasks were uploaded
      const tasks = await taskManager.getTasks();
      expect(tasks).toHaveLength(2);
    });
    
    it('should delete multiple tasks', async () => {
      // Upload two tasks
      const task1 = await taskManager.uploadTask(mockTaskFile, 'test-task.js');
      
      const mockTaskFile2 = Buffer.from(mockTaskFile.toString().replace('@name Test Task', '@name Another Task'));
      const task2 = await taskManager.uploadTask(mockTaskFile2, 'another-task.js');
      
      // Delete multiple tasks
      const result = await taskManager.deleteMultipleTasks([task1.id, task2.id]);
      
      expect(result.successful).toHaveLength(2);
      expect(result.failed).toHaveLength(0);
      
      // Verify tasks were deleted
      const tasks = await taskManager.getTasks();
      expect(tasks).toHaveLength(0);
    });
    
    it('should update status for multiple tasks', async () => {
      // Upload two tasks
      const task1 = await taskManager.uploadTask(mockTaskFile, 'test-task.js');
      
      const mockTaskFile2 = Buffer.from(mockTaskFile.toString().replace('@name Test Task', '@name Another Task'));
      const task2 = await taskManager.uploadTask(mockTaskFile2, 'another-task.js');
      
      // Update status for multiple tasks
      const result = await taskManager.updateMultipleTaskStatus([task1.id, task2.id], TaskStatus.ACTIVE);
      
      expect(result.successful).toHaveLength(2);
      expect(result.failed).toHaveLength(0);
      
      // Verify status was updated
      const tasks = await taskManager.getTasks();
      expect(tasks[0].status).toBe(TaskStatus.ACTIVE);
      expect(tasks[1].status).toBe(TaskStatus.ACTIVE);
    });
  });
});