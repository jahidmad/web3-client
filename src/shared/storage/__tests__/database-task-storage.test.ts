/**
 * Database Task Storage Tests
 * 
 * Comprehensive tests for the database task storage implementation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { 
  DatabaseTaskStorage, 
  InMemoryTaskDatabase, 
  createInMemoryDatabaseTaskStorage 
} from '../database-task-storage';
import { TaskStatus } from '../../types/plugin-task-system';

describe('DatabaseTaskStorage', () => {
  let storage: DatabaseTaskStorage;

  beforeEach(() => {
    storage = createInMemoryDatabaseTaskStorage();
  });

  const createValidTaskData = () => ({
    name: 'Test Database Task',
    description: 'A test task for database storage',
    version: '1.0.0',
    author: 'Test Author',
    category: 'Testing',
    tags: ['test', 'database'],
    icon: '🗄️',
    parameters: [
      {
        name: 'url',
        label: 'Target URL',
        type: 'url' as const,
        required: true,
        description: 'The URL to process'
      }
    ],
    dependencies: ['lodash@4.17.21'],
    config: {
      timeout: 30000,
      retries: 2,
      permissions: ['network']
    },
    code: 'async function execute(context) { return { success: true }; }',
    status: TaskStatus.DRAFT
  });

  describe('create', () => {
    it('should create a task successfully', async () => {
      const taskData = createValidTaskData();
      const task = await storage.create(taskData);

      expect(task.id).toBeDefined();
      expect(task.name).toBe(taskData.name);
      expect(task.description).toBe(taskData.description);
      expect(task.version).toBe(taskData.version);
      expect(task.author).toBe(taskData.author);
      expect(task.category).toBe(taskData.category);
      expect(task.tags).toEqual(taskData.tags);
      expect(task.icon).toBe(taskData.icon);
      expect(task.parameters).toEqual(taskData.parameters);
      expect(task.dependencies).toEqual(taskData.dependencies);
      expect(task.config).toEqual(taskData.config);
      expect(task.code).toBe(taskData.code);
      expect(task.status).toBe(taskData.status);
      expect(task.createdAt).toBeInstanceOf(Date);
      expect(task.updatedAt).toBeInstanceOf(Date);
    });

    it('should handle JSON serialization correctly', async () => {
      const taskData = createValidTaskData();
      const task = await storage.create(taskData);

      // Verify that complex objects are properly serialized and deserialized
      expect(Array.isArray(task.tags)).toBe(true);
      expect(Array.isArray(task.parameters)).toBe(true);
      expect(Array.isArray(task.dependencies)).toBe(true);
      expect(typeof task.config).toBe('object');
    });
  });

  describe('findById', () => {
    it('should return null for non-existent task', async () => {
      const task = await storage.findById('non-existent-id');
      expect(task).toBeNull();
    });

    it('should return task by ID', async () => {
      const taskData = createValidTaskData();
      const createdTask = await storage.create(taskData);
      
      const foundTask = await storage.findById(createdTask.id);
      expect(foundTask).toEqual(createdTask);
    });
  });

  describe('findMany', () => {
    it('should return empty array when no tasks exist', async () => {
      const tasks = await storage.findMany();
      expect(tasks).toEqual([]);
    });

    it('should return all tasks', async () => {
      const taskData1 = createValidTaskData();
      const taskData2 = { ...createValidTaskData(), name: 'Second Task' };
      
      const task1 = await storage.create(taskData1);
      const task2 = await storage.create(taskData2);
      
      const tasks = await storage.findMany();
      expect(tasks).toHaveLength(2);
      expect(tasks.map(t => t.id)).toContain(task1.id);
      expect(tasks.map(t => t.id)).toContain(task2.id);
    });

    it('should filter tasks by category', async () => {
      const taskData1 = createValidTaskData();
      const taskData2 = { ...createValidTaskData(), name: 'Other Task', category: 'Other' };
      
      await storage.create(taskData1);
      await storage.create(taskData2);
      
      const testingTasks = await storage.findMany({ category: 'Testing' });
      expect(testingTasks).toHaveLength(1);
      expect(testingTasks[0].category).toBe('Testing');
      
      const otherTasks = await storage.findMany({ category: 'Other' });
      expect(otherTasks).toHaveLength(1);
      expect(otherTasks[0].category).toBe('Other');
    });

    it('should filter tasks by status', async () => {
      const taskData1 = createValidTaskData();
      const taskData2 = { ...createValidTaskData(), name: 'Active Task', status: TaskStatus.ACTIVE };
      
      await storage.create(taskData1);
      await storage.create(taskData2);
      
      const draftTasks = await storage.findMany({ status: TaskStatus.DRAFT });
      expect(draftTasks).toHaveLength(1);
      expect(draftTasks[0].status).toBe(TaskStatus.DRAFT);
      
      const activeTasks = await storage.findMany({ status: TaskStatus.ACTIVE });
      expect(activeTasks).toHaveLength(1);
      expect(activeTasks[0].status).toBe(TaskStatus.ACTIVE);
    });

    it('should filter tasks by author', async () => {
      const taskData1 = createValidTaskData();
      const taskData2 = { ...createValidTaskData(), name: 'Other Author Task', author: 'Other Author' };
      
      await storage.create(taskData1);
      await storage.create(taskData2);
      
      const testAuthorTasks = await storage.findMany({ author: 'Test Author' });
      expect(testAuthorTasks).toHaveLength(1);
      expect(testAuthorTasks[0].author).toBe('Test Author');
    });

    it('should filter tasks by tags', async () => {
      const taskData1 = createValidTaskData();
      const taskData2 = { ...createValidTaskData(), name: 'API Task', tags: ['api', 'integration'] };
      
      await storage.create(taskData1);
      await storage.create(taskData2);
      
      const testTasks = await storage.findMany({ tags: ['test'] });
      expect(testTasks).toHaveLength(1);
      expect(testTasks[0].tags).toContain('test');
      
      const apiTasks = await storage.findMany({ tags: ['api'] });
      expect(apiTasks).toHaveLength(1);
      expect(apiTasks[0].tags).toContain('api');
    });

    it('should apply limit and offset', async () => {
      // Create multiple tasks
      for (let i = 1; i <= 5; i++) {
        const taskData = { ...createValidTaskData(), name: `Task ${i}` };
        await storage.create(taskData);
      }
      
      const limitedTasks = await storage.findMany({ limit: 2 });
      expect(limitedTasks).toHaveLength(2);
      
      const offsetTasks = await storage.findMany({ limit: 2, offset: 2 });
      expect(offsetTasks).toHaveLength(2);
      expect(offsetTasks[0].name).not.toBe(limitedTasks[0].name);
    });
  });

  describe('update', () => {
    it('should update task properties', async () => {
      const taskData = createValidTaskData();
      const originalTask = await storage.create(taskData);
      
      // Add a small delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 1));
      
      const updates = {
        name: 'Updated Database Task',
        description: 'Updated description',
        status: TaskStatus.ACTIVE
      };
      
      const updatedTask = await storage.update(originalTask.id, updates);
      
      expect(updatedTask.name).toBe('Updated Database Task');
      expect(updatedTask.description).toBe('Updated description');
      expect(updatedTask.status).toBe(TaskStatus.ACTIVE);
      expect(updatedTask.updatedAt.getTime()).toBeGreaterThanOrEqual(originalTask.updatedAt.getTime());
      expect(updatedTask.id).toBe(originalTask.id);
      expect(updatedTask.createdAt).toEqual(originalTask.createdAt);
    });

    it('should throw error for non-existent task', async () => {
      await expect(storage.update('non-existent-id', { name: 'New Name' }))
        .rejects.toThrow('not found');
    });

    it('should handle complex object updates', async () => {
      const taskData = createValidTaskData();
      const originalTask = await storage.create(taskData);
      
      const newConfig = { timeout: 60000, retries: 5, permissions: ['network', 'filesystem'] };
      const newTags = ['updated', 'test'];
      
      const updatedTask = await storage.update(originalTask.id, {
        config: newConfig,
        tags: newTags
      });
      
      expect(updatedTask.config).toEqual(newConfig);
      expect(updatedTask.tags).toEqual(newTags);
    });
  });

  describe('delete', () => {
    it('should delete existing task', async () => {
      const taskData = createValidTaskData();
      const task = await storage.create(taskData);
      
      await storage.delete(task.id);
      
      const deletedTask = await storage.findById(task.id);
      expect(deletedTask).toBeNull();
    });

    it('should throw error for non-existent task', async () => {
      await expect(storage.delete('non-existent-id'))
        .rejects.toThrow('not found');
    });
  });

  describe('createMany', () => {
    it('should create multiple tasks', async () => {
      const tasksData = [
        createValidTaskData(),
        { ...createValidTaskData(), name: 'Second Task' },
        { ...createValidTaskData(), name: 'Third Task' }
      ];
      
      const createdTasks = await storage.createMany(tasksData);
      
      expect(createdTasks).toHaveLength(3);
      expect(createdTasks[0].name).toBe('Test Database Task');
      expect(createdTasks[1].name).toBe('Second Task');
      expect(createdTasks[2].name).toBe('Third Task');
      
      // Verify they're actually stored
      const allTasks = await storage.findMany();
      expect(allTasks).toHaveLength(3);
    });
  });

  describe('deleteMany', () => {
    it('should delete multiple tasks', async () => {
      const taskData1 = createValidTaskData();
      const taskData2 = { ...createValidTaskData(), name: 'Second Task' };
      
      const task1 = await storage.create(taskData1);
      const task2 = await storage.create(taskData2);
      
      await storage.deleteMany([task1.id, task2.id]);
      
      const remainingTasks = await storage.findMany();
      expect(remainingTasks).toHaveLength(0);
    });
  });

  describe('search', () => {
    beforeEach(async () => {
      // Create test tasks with different content
      const tasks = [
        { ...createValidTaskData(), name: 'Web Scraper', description: 'Scrapes web pages', author: 'John Doe', category: 'Data Extraction' },
        { ...createValidTaskData(), name: 'PDF Generator', description: 'Generates PDF documents', author: 'Jane Smith', category: 'Document Generation' },
        { ...createValidTaskData(), name: 'Email Sender', description: 'Sends automated emails', author: 'John Doe', category: 'Communication' }
      ];

      for (const taskData of tasks) {
        await storage.create(taskData);
      }
    });

    it('should search tasks by name', async () => {
      const results = await storage.search('Web');
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Web Scraper');
    });

    it('should search tasks by description', async () => {
      const results = await storage.search('PDF');
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('PDF Generator');
    });

    it('should search tasks by author', async () => {
      const results = await storage.search('John');
      expect(results).toHaveLength(2);
    });

    it('should search with additional filters', async () => {
      const results = await storage.search('John', { category: 'Data Extraction' });
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Web Scraper');
    });

    it('should return empty array for no matches', async () => {
      const results = await storage.search('NonExistent');
      expect(results).toHaveLength(0);
    });

    it('should be case insensitive', async () => {
      const results = await storage.search('web');
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Web Scraper');
    });
  });

  describe('count', () => {
    it('should return 0 for empty storage', async () => {
      const count = await storage.count();
      expect(count).toBe(0);
    });

    it('should return correct count', async () => {
      const taskData = createValidTaskData();
      await storage.create(taskData);
      
      const count = await storage.count();
      expect(count).toBe(1);
    });

    it('should return filtered count', async () => {
      const taskData1 = createValidTaskData();
      const taskData2 = { ...createValidTaskData(), name: 'Other Task', category: 'Other' };
      
      await storage.create(taskData1);
      await storage.create(taskData2);
      
      const testingCount = await storage.count({ category: 'Testing' });
      expect(testingCount).toBe(1);
      
      const otherCount = await storage.count({ category: 'Other' });
      expect(otherCount).toBe(1);
      
      const totalCount = await storage.count();
      expect(totalCount).toBe(2);
    });
  });

  describe('error handling', () => {
    it('should handle database errors gracefully', async () => {
      // Create a mock database that throws errors
      const errorDatabase = {
        createTask: async () => { throw new Error('Database error'); },
        findTaskById: async () => { throw new Error('Database error'); },
        findTasks: async () => { throw new Error('Database error'); },
        updateTask: async () => { throw new Error('Database error'); },
        deleteTask: async () => { throw new Error('Database error'); },
        searchTasks: async () => { throw new Error('Database error'); },
        countTasks: async () => { throw new Error('Database error'); },
        createExecution: async () => { throw new Error('Database error'); },
        findExecutionById: async () => { throw new Error('Database error'); },
        findExecutions: async () => { throw new Error('Database error'); },
        updateExecution: async () => { throw new Error('Database error'); },
        deleteExecution: async () => { throw new Error('Database error'); }
      };

      const errorStorage = new DatabaseTaskStorage(errorDatabase);
      const taskData = createValidTaskData();
      
      await expect(errorStorage.create(taskData)).rejects.toThrow('Failed to create task');
      await expect(errorStorage.findById('test')).rejects.toThrow('Failed to find task');
      await expect(errorStorage.findMany()).rejects.toThrow('Failed to find tasks');
      await expect(errorStorage.update('test', {})).rejects.toThrow('Failed to update task');
      await expect(errorStorage.delete('test')).rejects.toThrow('Failed to delete task');
      await expect(errorStorage.search('test')).rejects.toThrow('Failed to search tasks');
      await expect(errorStorage.count()).rejects.toThrow('Failed to count tasks');
    });
  });

  describe('InMemoryTaskDatabase', () => {
    let database: InMemoryTaskDatabase;

    beforeEach(() => {
      database = new InMemoryTaskDatabase();
    });

    it('should handle execution operations', async () => {
      // First create a task
      const taskData = {
        name: 'Test Task',
        description: 'Test Description',
        version: '1.0.0',
        author: 'Test Author',
        category: 'Testing',
        tags: '["test"]',
        parameters: '[]',
        dependencies: '[]',
        config: '{}',
        code: 'test code',
        status: 'draft'
      };

      const task = await database.createTask(taskData);

      // Create an execution
      const executionData = {
        taskId: task.id,
        browserId: 'browser-1',
        status: 'pending',
        parameters: '{}',
        startTime: new Date(),
        progress: 0,
        logs: '[]'
      };

      const execution = await database.createExecution(executionData);
      expect(execution.id).toBeDefined();
      expect(execution.taskId).toBe(task.id);

      // Find execution by ID
      const foundExecution = await database.findExecutionById(execution.id);
      expect(foundExecution).toEqual(execution);

      // Find executions by task ID
      const taskExecutions = await database.findExecutions(task.id);
      expect(taskExecutions).toHaveLength(1);
      expect(taskExecutions[0].id).toBe(execution.id);

      // Update execution
      const updatedExecution = await database.updateExecution(execution.id, {
        status: 'completed',
        progress: 100,
        endTime: new Date()
      });
      expect(updatedExecution.status).toBe('completed');
      expect(updatedExecution.progress).toBe(100);

      // Delete execution
      await database.deleteExecution(execution.id);
      const deletedExecution = await database.findExecutionById(execution.id);
      expect(deletedExecution).toBeNull();
    });
  });
});