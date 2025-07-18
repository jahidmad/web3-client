/**
 * Task Multiple Export Tests
 * 
 * This file contains tests for the multiple task export functionality.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TaskManager, InMemoryTaskStorage } from '../task-manager';

describe('Multiple Task Export Functionality', () => {
  let taskManager: TaskManager;
  let mockTaskFile1: Buffer;
  let mockTaskFile2: Buffer;
  
  beforeEach(() => {
    // Create a new task manager with in-memory storage for each test
    taskManager = new TaskManager(new InMemoryTaskStorage());
    
    // Create first mock task file
    mockTaskFile1 = Buffer.from(`
      /**
       * @name First Test Task
       * @description A test task for export operations
       * @version 1.0.0
       * @author Test Author
       * @category Test
       * @tags test,export,first
       * @icon 📦
       */
      
      const parameters = [
        {
          name: 'url',
          label: 'URL',
          type: 'url',
          required: true,
          description: 'The URL to process'
        }
      ];
      
      const dependencies = ['lodash@4.17.21'];
      
      const config = {
        timeout: 60000,
        retries: 3
      };
      
      async function execute(context) {
        const { log, progress } = context;
        log('First task started');
        progress(100, 'Task completed');
        return { success: true };
      }
      
      module.exports = { parameters, dependencies, config, execute };
    `);
    
    // Create second mock task file
    mockTaskFile2 = Buffer.from(`
      /**
       * @name Second Test Task
       * @description Another test task for export operations
       * @version 1.1.0
       * @author Another Author
       * @category Test
       * @tags test,export,second
       * @icon 🔧
       */
      
      const parameters = [
        {
          name: 'query',
          label: 'Search Query',
          type: 'string',
          required: true,
          description: 'The search query'
        }
      ];
      
      const dependencies = ['axios@1.3.4'];
      
      const config = {
        timeout: 30000,
        retries: 2
      };
      
      async function execute(context) {
        const { log, progress } = context;
        log('Second task started');
        progress(100, 'Task completed');
        return { success: true };
      }
      
      module.exports = { parameters, dependencies, config, execute };
    `);
  });
  
  it('should export multiple tasks', async () => {
    // Upload tasks
    const task1 = await taskManager.uploadTask(mockTaskFile1, 'first-task.js');
    const task2 = await taskManager.uploadTask(mockTaskFile2, 'second-task.js');
    
    // Export multiple tasks
    const exportedBuffer = await taskManager.exportMultipleTasks([task1.id, task2.id]);
    
    // Convert buffer to string and parse JSON
    const exportedContent = exportedBuffer.toString('utf-8');
    const exportData = JSON.parse(exportedContent);
    
    // Verify the exported content
    expect(exportData).toHaveProperty('tasks');
    expect(exportData).toHaveProperty('metadata');
    expect(exportData.metadata).toHaveProperty('taskCount', 2);
    
    // Check that both tasks are included
    const taskFilenames = Object.keys(exportData.tasks);
    expect(taskFilenames).toHaveLength(2);
    
    // Check first task content
    const firstTaskContent = Object.values(exportData.tasks)[0] as string;
    expect(firstTaskContent).toContain('@name First Test Task');
    expect(firstTaskContent).toContain('lodash@4.17.21');
    expect(firstTaskContent).toContain('First task started');
    
    // Check second task content
    const secondTaskContent = Object.values(exportData.tasks)[1] as string;
    expect(secondTaskContent).toContain('@name Second Test Task');
    expect(secondTaskContent).toContain('axios@1.3.4');
    expect(secondTaskContent).toContain('Second task started');
  });
  
  it('should handle exporting tasks with options', async () => {
    // Upload tasks
    const task1 = await taskManager.uploadTask(mockTaskFile1, 'first-task.js');
    const task2 = await taskManager.uploadTask(mockTaskFile2, 'second-task.js');
    
    // Export multiple tasks with options
    const exportedBuffer = await taskManager.exportMultipleTasks(
      [task1.id, task2.id], 
      { includeDependencies: false, prettify: true }
    );
    
    // Convert buffer to string and parse JSON
    const exportedContent = exportedBuffer.toString('utf-8');
    const exportData = JSON.parse(exportedContent);
    
    // Check that both tasks are included
    const taskFilenames = Object.keys(exportData.tasks);
    expect(taskFilenames).toHaveLength(2);
    
    // Check that dependencies are not included
    const firstTaskContent = Object.values(exportData.tasks)[0] as string;
    expect(firstTaskContent).not.toContain("'lodash@4.17.21'");
    
    const secondTaskContent = Object.values(exportData.tasks)[1] as string;
    expect(secondTaskContent).not.toContain("'axios@1.3.4'");
    
    // Check that the output is prettified
    expect(firstTaskContent).toContain('const parameters = [\n');
    expect(secondTaskContent).toContain('const parameters = [\n');
  });
  
  it('should handle non-existent task IDs', async () => {
    // Upload one task
    const task = await taskManager.uploadTask(mockTaskFile1, 'first-task.js');
    
    // Export with one valid ID and one invalid ID
    const exportedBuffer = await taskManager.exportMultipleTasks([task.id, 'non-existent-id']);
    
    // Convert buffer to string and parse JSON
    const exportedContent = exportedBuffer.toString('utf-8');
    const exportData = JSON.parse(exportedContent);
    
    // Check that only one task is included
    expect(exportData.metadata.taskCount).toBe(1);
    expect(Object.keys(exportData.tasks)).toHaveLength(1);
    
    // Check that the valid task is included
    const taskContent = Object.values(exportData.tasks)[0] as string;
    expect(taskContent).toContain('@name First Test Task');
  });
  
  it('should throw an error when no valid tasks are found', async () => {
    // Try to export non-existent tasks
    await expect(taskManager.exportMultipleTasks(['non-existent-id-1', 'non-existent-id-2']))
      .rejects.toThrow('No valid tasks found for export');
  });
  
  it('should throw an error when no task IDs are provided', async () => {
    // Try to export with empty array
    await expect(taskManager.exportMultipleTasks([]))
      .rejects.toThrow('No task IDs provided for export');
  });
});