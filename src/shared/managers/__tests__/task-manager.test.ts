/**
 * Task Manager Tests
 * 
 * Comprehensive tests for the task manager CRUD operations
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TaskManager, InMemoryTaskStorage, createTaskManager, createInMemoryTaskManager } from '../task-manager';
import { TaskStatus, TaskError, ErrorCode } from '../../types/plugin-task-system';

describe('TaskManager', () => {
  let taskManager: TaskManager;

  beforeEach(() => {
    taskManager = createInMemoryTaskManager();
  });

  const createValidTaskFile = (): Buffer => {
    const taskContent = `
/**
 * @name Test Task
 * @description A simple test task for CRUD operations
 * @version 1.0.0
 * @author Test Author
 * @category Testing
 * @tags test,crud
 * @icon 🧪
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

const dependencies = ['lodash@4.17.21'];

const config = {
  timeout: 30000,
  retries: 2,
  permissions: ['network']
};

async function execute(context) {
  const { page, params, log, progress, browser, utils } = context;
  
  try {
    log('Starting test task');
    progress(50, 'Processing');
    
    await browser.goto(params.url);
    
    progress(100, 'Completed');
    return { success: true, data: 'Test completed' };
  } catch (error) {
    log('Error: ' + error.message);
    return { success: false, error: error.message };
  }
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

  describe('uploadTask', () => {
    it('should upload and parse a valid task file', async () => {
      const taskFile = createValidTaskFile();
      const task = await taskManager.uploadTask(taskFile, 'test-task.js');

      expect(task.id).toBeDefined();
      expect(task.name).toBe('Test Task');
      expect(task.description).toBe('A simple test task for CRUD operations');
      expect(task.version).toBe('1.0.0');
      expect(task.author).toBe('Test Author');
      expect(task.category).toBe('Testing');
      expect(task.tags).toEqual(['test', 'crud']);
      expect(task.icon).toBe('🧪');
      expect(task.status).toBe(TaskStatus.DRAFT);
      expect(task.parameters).toHaveLength(1);
      expect(task.dependencies).toEqual(['lodash@4.17.21']);
      expect(task.createdAt).toBeInstanceOf(Date);
      expect(task.updatedAt).toBeInstanceOf(Date);
    });

    it('should reject invalid task files', async () => {
      const invalidTaskContent = `
// Missing JSDoc metadata
const parameters = [];
module.exports = { parameters };
      `;
      const invalidFile = Buffer.from(invalidTaskContent, 'utf-8');

      await expect(taskManager.uploadTask(invalidFile, 'invalid-task.js'))
        .rejects.toThrow(TaskError);
    });

    it('should reject duplicate task names', async () => {
      const taskFile = createValidTaskFile();
      
      // Upload first task
      await taskManager.uploadTask(taskFile, 'test-task-1.js');
      
      // Try to upload task with same name
      await expect(taskManager.uploadTask(taskFile, 'test-task-2.js'))
        .rejects.toThrow('already exists');
    });
  });

  describe('getTasks', () => {
    it('should return empty array when no tasks exist', async () => {
      const tasks = await taskManager.getTasks();
      expect(tasks).toEqual([]);
    });

    it('should return all tasks', async () => {
      const taskFile = createValidTaskFile();
      const uploadedTask = await taskManager.uploadTask(taskFile, 'test-task.js');
      
      const tasks = await taskManager.getTasks();
      expect(tasks).toHaveLength(1);
      expect(tasks[0]).toEqual(uploadedTask);
    });

    it('should filter tasks by category', async () => {
      const taskFile = createValidTaskFile();
      await taskManager.uploadTask(taskFile, 'test-task.js');
      
      const testingTasks = await taskManager.getTasks({ category: 'Testing' });
      expect(testingTasks).toHaveLength(1);
      
      const otherTasks = await taskManager.getTasks({ category: 'Other' });
      expect(otherTasks).toHaveLength(0);
    });

    it('should filter tasks by status', async () => {
      const taskFile = createValidTaskFile();
      const task = await taskManager.uploadTask(taskFile, 'test-task.js');
      
      const draftTasks = await taskManager.getTasks({ status: TaskStatus.DRAFT });
      expect(draftTasks).toHaveLength(1);
      
      const activeTasks = await taskManager.getTasks({ status: TaskStatus.ACTIVE });
      expect(activeTasks).toHaveLength(0);
    });

    it('should filter tasks by author', async () => {
      const taskFile = createValidTaskFile();
      await taskManager.uploadTask(taskFile, 'test-task.js');
      
      const authorTasks = await taskManager.getTasks({ author: 'Test Author' });
      expect(authorTasks).toHaveLength(1);
      
      const otherAuthorTasks = await taskManager.getTasks({ author: 'Other Author' });
      expect(otherAuthorTasks).toHaveLength(0);
    });

    it('should limit and offset results', async () => {
      const taskFile = createValidTaskFile();
      
      // Create multiple tasks with different names
      for (let i = 1; i <= 5; i++) {
        const modifiedContent = taskFile.toString().replace('@name Test Task', `@name Test Task ${i}`);
        await taskManager.uploadTask(Buffer.from(modifiedContent), `test-task-${i}.js`);
      }
      
      const limitedTasks = await taskManager.getTasks({ limit: 2 });
      expect(limitedTasks).toHaveLength(2);
      
      const offsetTasks = await taskManager.getTasks({ limit: 2, offset: 2 });
      expect(offsetTasks).toHaveLength(2);
      expect(offsetTasks[0].name).not.toBe(limitedTasks[0].name);
    });
  });

  describe('getTask', () => {
    it('should return null for non-existent task', async () => {
      const task = await taskManager.getTask('non-existent-id');
      expect(task).toBeNull();
    });

    it('should return task by ID', async () => {
      const taskFile = createValidTaskFile();
      const uploadedTask = await taskManager.uploadTask(taskFile, 'test-task.js');
      
      const retrievedTask = await taskManager.getTask(uploadedTask.id);
      expect(retrievedTask).toEqual(uploadedTask);
    });
  });

  describe('updateTask', () => {
    it('should update task properties', async () => {
      const taskFile = createValidTaskFile();
      const originalTask = await taskManager.uploadTask(taskFile, 'test-task.js');
      
      // Add a small delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 1));
      
      const updates = {
        name: 'Updated Test Task',
        description: 'Updated description',
        status: TaskStatus.ACTIVE
      };
      
      const updatedTask = await taskManager.updateTask(originalTask.id, updates);
      
      expect(updatedTask.name).toBe('Updated Test Task');
      expect(updatedTask.description).toBe('Updated description');
      expect(updatedTask.status).toBe(TaskStatus.ACTIVE);
      expect(updatedTask.updatedAt.getTime()).toBeGreaterThanOrEqual(originalTask.updatedAt.getTime());
      expect(updatedTask.id).toBe(originalTask.id);
      expect(updatedTask.createdAt).toEqual(originalTask.createdAt);
    });

    it('should throw error for non-existent task', async () => {
      await expect(taskManager.updateTask('non-existent-id', { name: 'New Name' }))
        .rejects.toThrow('not found');
    });

    it('should prevent updating to duplicate name', async () => {
      const taskFile = createValidTaskFile();
      const task1 = await taskManager.uploadTask(taskFile, 'test-task-1.js');
      
      const modifiedContent = taskFile.toString().replace('@name Test Task', '@name Test Task 2');
      const task2 = await taskManager.uploadTask(Buffer.from(modifiedContent), 'test-task-2.js');
      
      await expect(taskManager.updateTask(task2.id, { name: 'Test Task' }))
        .rejects.toThrow('already exists');
    });

    it('should not allow updating protected fields', async () => {
      const taskFile = createValidTaskFile();
      const originalTask = await taskManager.uploadTask(taskFile, 'test-task.js');
      
      const updatedTask = await taskManager.updateTask(originalTask.id, {
        id: 'new-id',
        createdAt: new Date('2020-01-01'),
        name: 'Updated Name'
      } as any);
      
      expect(updatedTask.id).toBe(originalTask.id);
      expect(updatedTask.createdAt).toEqual(originalTask.createdAt);
      expect(updatedTask.name).toBe('Updated Name');
    });
  });

  describe('deleteTask', () => {
    it('should delete existing task', async () => {
      const taskFile = createValidTaskFile();
      const task = await taskManager.uploadTask(taskFile, 'test-task.js');
      
      await taskManager.deleteTask(task.id);
      
      const retrievedTask = await taskManager.getTask(task.id);
      expect(retrievedTask).toBeNull();
    });

    it('should throw error for non-existent task', async () => {
      await expect(taskManager.deleteTask('non-existent-id'))
        .rejects.toThrow('not found');
    });
  });

  describe('searchTasks', () => {
    beforeEach(async () => {
      // Create test tasks with different content
      const tasks = [
        { name: 'Web Scraper', description: 'Scrapes web pages', author: 'John Doe', category: 'Data Extraction' },
        { name: 'PDF Generator', description: 'Generates PDF documents', author: 'Jane Smith', category: 'Document Generation' },
        { name: 'Email Sender', description: 'Sends automated emails', author: 'John Doe', category: 'Communication' }
      ];

      for (let i = 0; i < tasks.length; i++) {
        const taskData = tasks[i];
        const content = createValidTaskFile().toString()
          .replace('@name Test Task', `@name ${taskData.name}`)
          .replace('@description A simple test task for CRUD operations', `@description ${taskData.description}`)
          .replace('@author Test Author', `@author ${taskData.author}`)
          .replace('@category Testing', `@category ${taskData.category}`);
        
        await taskManager.uploadTask(Buffer.from(content), `task-${i}.js`);
      }
    });

    it('should search tasks by name', async () => {
      const results = await taskManager.searchTasks('Web');
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Web Scraper');
    });

    it('should search tasks by description', async () => {
      const results = await taskManager.searchTasks('PDF');
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('PDF Generator');
    });

    it('should search tasks by author', async () => {
      const results = await taskManager.searchTasks('John');
      expect(results).toHaveLength(2);
    });

    it('should search with additional filters', async () => {
      const results = await taskManager.searchTasks('John', { category: 'Data Extraction' });
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Web Scraper');
    });

    it('should return empty array for no matches', async () => {
      const results = await taskManager.searchTasks('NonExistent');
      expect(results).toHaveLength(0);
    });
  });

  describe('getTaskCount', () => {
    it('should return 0 for empty storage', async () => {
      const count = await taskManager.getTaskCount();
      expect(count).toBe(0);
    });

    it('should return correct count', async () => {
      const taskFile = createValidTaskFile();
      await taskManager.uploadTask(taskFile, 'test-task.js');
      
      const count = await taskManager.getTaskCount();
      expect(count).toBe(1);
    });

    it('should return filtered count', async () => {
      const taskFile = createValidTaskFile();
      await taskManager.uploadTask(taskFile, 'test-task.js');
      
      const testingCount = await taskManager.getTaskCount({ category: 'Testing' });
      expect(testingCount).toBe(1);
      
      const otherCount = await taskManager.getTaskCount({ category: 'Other' });
      expect(otherCount).toBe(0);
    });
  });

  describe('bulk operations', () => {
    it('should upload multiple tasks', async () => {
      const files = [
        { buffer: createValidTaskFile(), filename: 'task1.js' },
        { 
          buffer: Buffer.from(createValidTaskFile().toString().replace('@name Test Task', '@name Test Task 2')), 
          filename: 'task2.js' 
        }
      ];
      
      const result = await taskManager.uploadMultipleTasks(files);
      
      expect(result.successful).toHaveLength(2);
      expect(result.failed).toHaveLength(0);
      expect(result.successful[0].name).toBe('Test Task');
      expect(result.successful[1].name).toBe('Test Task 2');
    });

    it('should handle mixed success/failure in bulk upload', async () => {
      const files = [
        { buffer: createValidTaskFile(), filename: 'valid-task.js' },
        { buffer: Buffer.from('invalid content'), filename: 'invalid-task.js' }
      ];
      
      const result = await taskManager.uploadMultipleTasks(files);
      
      expect(result.successful).toHaveLength(1);
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0].filename).toBe('invalid-task.js');
    });

    it('should delete multiple tasks', async () => {
      const taskFile = createValidTaskFile();
      const task1 = await taskManager.uploadTask(taskFile, 'task1.js');
      const task2Content = taskFile.toString().replace('@name Test Task', '@name Test Task 2');
      const task2 = await taskManager.uploadTask(Buffer.from(task2Content), 'task2.js');
      
      const result = await taskManager.deleteMultipleTasks([task1.id, task2.id]);
      
      expect(result.successful).toHaveLength(2);
      expect(result.failed).toHaveLength(0);
      
      const remainingTasks = await taskManager.getTasks();
      expect(remainingTasks).toHaveLength(0);
    });

    it('should update multiple task statuses', async () => {
      const taskFile = createValidTaskFile();
      const task1 = await taskManager.uploadTask(taskFile, 'task1.js');
      const task2Content = taskFile.toString().replace('@name Test Task', '@name Test Task 2');
      const task2 = await taskManager.uploadTask(Buffer.from(task2Content), 'task2.js');
      
      const result = await taskManager.updateMultipleTaskStatus([task1.id, task2.id], TaskStatus.ACTIVE);
      
      expect(result.successful).toHaveLength(2);
      expect(result.failed).toHaveLength(0);
      expect(result.successful[0].status).toBe(TaskStatus.ACTIVE);
      expect(result.successful[1].status).toBe(TaskStatus.ACTIVE);
    });
  });

  describe('category and status helpers', () => {
    beforeEach(async () => {
      const taskFile = createValidTaskFile();
      await taskManager.uploadTask(taskFile, 'test-task.js');
    });

    it('should get tasks by category', async () => {
      const tasks = await taskManager.getTasksByCategory('Testing');
      expect(tasks).toHaveLength(1);
    });

    it('should get tasks by status', async () => {
      const tasks = await taskManager.getTasksByStatus(TaskStatus.DRAFT);
      expect(tasks).toHaveLength(1);
    });

    it('should get tasks by author', async () => {
      const tasks = await taskManager.getTasksByAuthor('Test Author');
      expect(tasks).toHaveLength(1);
    });

    it('should get tasks by tags', async () => {
      const tasks = await taskManager.getTasksByTags(['test']);
      expect(tasks).toHaveLength(1);
    });
  });

  describe('factory functions', () => {
    it('should create task manager with default storage', () => {
      const manager = createTaskManager();
      expect(manager).toBeInstanceOf(TaskManager);
    });

    it('should create in-memory task manager', () => {
      const manager = createInMemoryTaskManager();
      expect(manager).toBeInstanceOf(TaskManager);
    });
  });

  describe('error handling', () => {
    it('should handle storage errors gracefully', async () => {
      // Create a mock storage that throws errors
      const errorStorage = {
        create: async () => { throw new Error('Storage error'); },
        findById: async () => { throw new Error('Storage error'); },
        findMany: async () => { throw new Error('Storage error'); },
        update: async () => { throw new Error('Storage error'); },
        delete: async () => { throw new Error('Storage error'); },
        createMany: async () => { throw new Error('Storage error'); },
        deleteMany: async () => { throw new Error('Storage error'); },
        search: async () => { throw new Error('Storage error'); },
        count: async () => { throw new Error('Storage error'); }
      };

      const errorManager = new TaskManager(errorStorage);
      
      await expect(errorManager.getTasks()).rejects.toThrow(TaskError);
      await expect(errorManager.getTask('test')).rejects.toThrow(TaskError);
      await expect(errorManager.getTaskCount()).rejects.toThrow(TaskError);
    });
  });
});