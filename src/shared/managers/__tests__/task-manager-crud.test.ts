/**
 * Task Manager CRUD Operations Tests
 * 
 * This file contains tests for the task CRUD operations implemented in the task manager.
 * It uses direct manipulation of the storage layer to avoid issues with task file parsing.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { TaskManager, InMemoryTaskStorage } from '../task-manager';
import { TaskStatus, TaskError, ErrorCode } from '../../types';

describe('Task Manager CRUD Operations', () => {
  let taskManager: TaskManager;
  let storage: InMemoryTaskStorage;
  
  beforeEach(() => {
    // Create a new storage and task manager for each test
    storage = new InMemoryTaskStorage();
    taskManager = new TaskManager(storage);
  });
  
  afterEach(() => {
    vi.restoreAllMocks();
  });
  
  describe('getTasks', () => {
    it('should retrieve all tasks', async () => {
      // Create test tasks directly in storage
      const task1 = await storage.create({
        name: 'Test Task 1',
        description: 'Description 1',
        version: '1.0.0',
        author: 'Test Author',
        category: 'Test',
        tags: ['test'],
        parameters: [],
        dependencies: [],
        config: {},
        code: 'test code',
        status: TaskStatus.DRAFT
      });
      
      const task2 = await storage.create({
        name: 'Test Task 2',
        description: 'Description 2',
        version: '1.0.0',
        author: 'Test Author',
        category: 'Test',
        tags: ['test'],
        parameters: [],
        dependencies: [],
        config: {},
        code: 'test code',
        status: TaskStatus.DRAFT
      });
      
      // Get all tasks
      const tasks = await taskManager.getTasks();
      
      expect(tasks).toHaveLength(2);
      expect(tasks[0].id).toBe(task1.id);
      expect(tasks[1].id).toBe(task2.id);
    });
    
    it('should filter tasks by category', async () => {
      // Create test tasks directly in storage
      await storage.create({
        name: 'Test Task 1',
        description: 'Description 1',
        version: '1.0.0',
        author: 'Test Author',
        category: 'Category1',
        tags: ['test'],
        parameters: [],
        dependencies: [],
        config: {},
        code: 'test code',
        status: TaskStatus.DRAFT
      });
      
      await storage.create({
        name: 'Test Task 2',
        description: 'Description 2',
        version: '1.0.0',
        author: 'Test Author',
        category: 'Category2',
        tags: ['test'],
        parameters: [],
        dependencies: [],
        config: {},
        code: 'test code',
        status: TaskStatus.DRAFT
      });
      
      // Get tasks with filter
      const tasks = await taskManager.getTasks({ category: 'Category1' });
      
      expect(tasks).toHaveLength(1);
      expect(tasks[0].name).toBe('Test Task 1');
      expect(tasks[0].category).toBe('Category1');
    });
  });
  
  describe('getTask', () => {
    it('should retrieve a task by ID', async () => {
      // Create a test task directly in storage
      const createdTask = await storage.create({
        name: 'Test Task',
        description: 'Description',
        version: '1.0.0',
        author: 'Test Author',
        category: 'Test',
        tags: ['test'],
        parameters: [],
        dependencies: [],
        config: {},
        code: 'test code',
        status: TaskStatus.DRAFT
      });
      
      // Get the task by ID
      const task = await taskManager.getTask(createdTask.id);
      
      expect(task).toBeDefined();
      expect(task?.id).toBe(createdTask.id);
      expect(task?.name).toBe('Test Task');
    });
    
    it('should return null for non-existent task ID', async () => {
      const task = await taskManager.getTask('non-existent-id');
      
      expect(task).toBeNull();
    });
  });
  
  describe('updateTask', () => {
    it('should update a task', async () => {
      // Create a test task directly in storage
      const createdTask = await storage.create({
        name: 'Test Task',
        description: 'Description',
        version: '1.0.0',
        author: 'Test Author',
        category: 'Test',
        tags: ['test'],
        parameters: [],
        dependencies: [],
        config: {},
        code: 'test code',
        status: TaskStatus.DRAFT
      });
      
      // Update the task
      const updatedTask = await taskManager.updateTask(createdTask.id, {
        description: 'Updated description',
        status: TaskStatus.ACTIVE
      });
      
      expect(updatedTask).toBeDefined();
      expect(updatedTask.id).toBe(createdTask.id);
      expect(updatedTask.description).toBe('Updated description');
      expect(updatedTask.status).toBe(TaskStatus.ACTIVE);
      
      // Verify the update persisted
      const retrievedTask = await taskManager.getTask(createdTask.id);
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
      // Create two tasks directly in storage
      const task1 = await storage.create({
        name: 'Task 1',
        description: 'Description 1',
        version: '1.0.0',
        author: 'Test Author',
        category: 'Test',
        tags: ['test'],
        parameters: [],
        dependencies: [],
        config: {},
        code: 'test code',
        status: TaskStatus.DRAFT
      });
      
      const task2 = await storage.create({
        name: 'Task 2',
        description: 'Description 2',
        version: '1.0.0',
        author: 'Test Author',
        category: 'Test',
        tags: ['test'],
        parameters: [],
        dependencies: [],
        config: {},
        code: 'test code',
        status: TaskStatus.DRAFT
      });
      
      // Try to update task2 to have the same name as task1
      await expect(taskManager.updateTask(task2.id, {
        name: 'Task 1'
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
      // Create a test task directly in storage
      const createdTask = await storage.create({
        name: 'Test Task',
        description: 'Description',
        version: '1.0.0',
        author: 'Test Author',
        category: 'Test',
        tags: ['test'],
        parameters: [],
        dependencies: [],
        config: {},
        code: 'test code',
        status: TaskStatus.DRAFT
      });
      
      // Delete the task
      await taskManager.deleteTask(createdTask.id);
      
      // Verify the task was deleted
      const task = await taskManager.getTask(createdTask.id);
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
      // Create test tasks directly in storage
      await storage.create({
        name: 'Search Task',
        description: 'Description with search term',
        version: '1.0.0',
        author: 'Test Author',
        category: 'Test',
        tags: ['test'],
        parameters: [],
        dependencies: [],
        config: {},
        code: 'test code',
        status: TaskStatus.DRAFT
      });
      
      await storage.create({
        name: 'Another Task',
        description: 'Another description',
        version: '1.0.0',
        author: 'Test Author',
        category: 'Test',
        tags: ['test'],
        parameters: [],
        dependencies: [],
        config: {},
        code: 'test code',
        status: TaskStatus.DRAFT
      });
      
      // Search for tasks
      const tasks = await taskManager.searchTasks('search');
      
      expect(tasks).toHaveLength(1);
      expect(tasks[0].name).toBe('Search Task');
      
      // Search with non-matching query
      const emptyTasks = await taskManager.searchTasks('nonexistent');
      
      expect(emptyTasks).toHaveLength(0);
    });
    
    it('should combine search with filters', async () => {
      // Create test tasks directly in storage
      await storage.create({
        name: 'Search Task',
        description: 'Description with search term',
        version: '1.0.0',
        author: 'Test Author',
        category: 'Category1',
        tags: ['test'],
        parameters: [],
        dependencies: [],
        config: {},
        code: 'test code',
        status: TaskStatus.DRAFT
      });
      
      await storage.create({
        name: 'Another Search Task',
        description: 'Another description with search term',
        version: '1.0.0',
        author: 'Test Author',
        category: 'Category2',
        tags: ['test'],
        parameters: [],
        dependencies: [],
        config: {},
        code: 'test code',
        status: TaskStatus.DRAFT
      });
      
      // Search with matching filter
      const tasks = await taskManager.searchTasks('search', { category: 'Category1' });
      
      expect(tasks).toHaveLength(1);
      expect(tasks[0].name).toBe('Search Task');
      expect(tasks[0].category).toBe('Category1');
      
      // Search with non-matching filter
      const emptyTasks = await taskManager.searchTasks('search', { category: 'NonExistent' });
      
      expect(emptyTasks).toHaveLength(0);
    });
  });
  
  describe('getTaskCount', () => {
    it('should count all tasks', async () => {
      // Create test tasks directly in storage
      await storage.create({
        name: 'Test Task 1',
        description: 'Description 1',
        version: '1.0.0',
        author: 'Test Author',
        category: 'Test',
        tags: ['test'],
        parameters: [],
        dependencies: [],
        config: {},
        code: 'test code',
        status: TaskStatus.DRAFT
      });
      
      await storage.create({
        name: 'Test Task 2',
        description: 'Description 2',
        version: '1.0.0',
        author: 'Test Author',
        category: 'Test',
        tags: ['test'],
        parameters: [],
        dependencies: [],
        config: {},
        code: 'test code',
        status: TaskStatus.DRAFT
      });
      
      // Count all tasks
      const count = await taskManager.getTaskCount();
      
      expect(count).toBe(2);
    });
    
    it('should count filtered tasks', async () => {
      // Create test tasks directly in storage
      await storage.create({
        name: 'Test Task 1',
        description: 'Description 1',
        version: '1.0.0',
        author: 'Test Author',
        category: 'Category1',
        tags: ['test'],
        parameters: [],
        dependencies: [],
        config: {},
        code: 'test code',
        status: TaskStatus.DRAFT
      });
      
      await storage.create({
        name: 'Test Task 2',
        description: 'Description 2',
        version: '1.0.0',
        author: 'Test Author',
        category: 'Category2',
        tags: ['test'],
        parameters: [],
        dependencies: [],
        config: {},
        code: 'test code',
        status: TaskStatus.DRAFT
      });
      
      // Count with matching filter
      const count = await taskManager.getTaskCount({ category: 'Category1' });
      
      expect(count).toBe(1);
      
      // Count with non-matching filter
      const emptyCount = await taskManager.getTaskCount({ category: 'NonExistent' });
      
      expect(emptyCount).toBe(0);
    });
  });
  
  describe('bulk operations', () => {
    it('should update status for multiple tasks', async () => {
      // Create test tasks directly in storage
      const task1 = await storage.create({
        name: 'Test Task 1',
        description: 'Description 1',
        version: '1.0.0',
        author: 'Test Author',
        category: 'Test',
        tags: ['test'],
        parameters: [],
        dependencies: [],
        config: {},
        code: 'test code',
        status: TaskStatus.DRAFT
      });
      
      const task2 = await storage.create({
        name: 'Test Task 2',
        description: 'Description 2',
        version: '1.0.0',
        author: 'Test Author',
        category: 'Test',
        tags: ['test'],
        parameters: [],
        dependencies: [],
        config: {},
        code: 'test code',
        status: TaskStatus.DRAFT
      });
      
      // Update status for multiple tasks
      const result = await taskManager.updateMultipleTaskStatus([task1.id, task2.id], TaskStatus.ACTIVE);
      
      expect(result.successful).toHaveLength(2);
      expect(result.failed).toHaveLength(0);
      
      // Verify status was updated
      const tasks = await taskManager.getTasks();
      expect(tasks[0].status).toBe(TaskStatus.ACTIVE);
      expect(tasks[1].status).toBe(TaskStatus.ACTIVE);
    });
    
    it('should handle errors when updating multiple tasks', async () => {
      // Create one test task directly in storage
      const task = await storage.create({
        name: 'Test Task',
        description: 'Description',
        version: '1.0.0',
        author: 'Test Author',
        category: 'Test',
        tags: ['test'],
        parameters: [],
        dependencies: [],
        config: {},
        code: 'test code',
        status: TaskStatus.DRAFT
      });
      
      // Update status for multiple tasks including a non-existent one
      const result = await taskManager.updateMultipleTaskStatus([task.id, 'non-existent-id'], TaskStatus.ACTIVE);
      
      expect(result.successful).toHaveLength(1);
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0].taskId).toBe('non-existent-id');
      
      // Verify status was updated for the existing task
      const updatedTask = await taskManager.getTask(task.id);
      expect(updatedTask?.status).toBe(TaskStatus.ACTIVE);
    });
  });
});