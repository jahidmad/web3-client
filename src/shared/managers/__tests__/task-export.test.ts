/**
 * Task Export Tests
 * 
 * This file contains tests for the task export functionality.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TaskManager, InMemoryTaskStorage } from '../task-manager';
import { TaskStatus } from '../../types/plugin-task-system';

describe('Task Export Functionality', () => {
  let taskManager: TaskManager;
  let mockTaskFile: Buffer;
  let mockTaskFile2: Buffer;
  
  beforeEach(() => {
    // Create a new task manager with in-memory storage for each test
    taskManager = new TaskManager(new InMemoryTaskStorage());
    
    // Create first mock task file
    mockTaskFile = Buffer.from(`
      /**
       * @name Test Task
       * @description A test task for export operations
       * @version 1.0.0
       * @author Test Author
       * @category Test
       * @tags test,export
       * @icon 📦
       */
      
      const parameters = [
        {
          name: 'url',
          label: 'URL',
          type: 'url',
          required: true,
          description: 'The URL to process'
        },
        {
          name: 'depth',
          label: 'Depth',
          type: 'number',
          default: 1,
          description: 'Processing depth'
        }
      ];
      
      const dependencies = ['lodash@4.17.21', 'axios@1.3.4'];
      
      const config = {
        timeout: 60000,
        retries: 3,
        permissions: ['network']
      };
      
      async function execute(context) {
        const { log, progress, params } = context;
        log('Task started');
        progress(50, 'Processing URL: ' + params.url);
        // Task implementation
        progress(100, 'Task completed');
        return { success: true, data: { url: params.url, processed: true } };
      }
      
      module.exports = { parameters, dependencies, config, execute };
    `);
  });
  
  it('should export a task as a JavaScript file', async () => {
    // Upload a task
    const uploadedTask = await taskManager.uploadTask(mockTaskFile, 'test-export-task.js');
    
    // Export the task
    const exportedBuffer = await taskManager.exportTask(uploadedTask.id);
    
    // Convert buffer to string
    const exportedContent = exportedBuffer.toString('utf-8');
    
    // Verify the exported content
    expect(exportedContent).toContain('@name Test Task');
    expect(exportedContent).toContain('@description A test task for export operations');
    expect(exportedContent).toContain('@version 1.0.0');
    expect(exportedContent).toContain('@author Test Author');
    expect(exportedContent).toContain('@category Test');
    expect(exportedContent).toContain('@tags test,export');
    expect(exportedContent).toContain('@icon 📦');
    
    // Check parameters
    expect(exportedContent).toContain('const parameters = [');
    expect(exportedContent).toContain("name: 'url'");
    expect(exportedContent).toContain("label: 'URL'");
    expect(exportedContent).toContain("type: 'url'");
    expect(exportedContent).toContain("required: true");
    expect(exportedContent).toContain("name: 'depth'");
    expect(exportedContent).toContain("default: 1");
    
    // Check dependencies
    expect(exportedContent).toContain('const dependencies = [');
    expect(exportedContent).toContain("'lodash@4.17.21'");
    expect(exportedContent).toContain("'axios@1.3.4'");
    
    // Check config
    expect(exportedContent).toContain('const config = {');
    expect(exportedContent).toContain('"timeout": 60000');
    expect(exportedContent).toContain('"retries": 3');
    expect(exportedContent).toContain('"permissions": ["network"]');
    
    // Check execute function
    expect(exportedContent).toContain('async function execute(context)');
    expect(exportedContent).toContain('const { log, progress, params } = context');
    expect(exportedContent).toContain("log('Task started')");
    expect(exportedContent).toContain('progress(50');
    expect(exportedContent).toContain('progress(100');
    expect(exportedContent).toContain('return { success: true');
    
    // Check module exports
    expect(exportedContent).toContain('module.exports = { parameters, dependencies, config, execute };');
  });
  
  it('should export a task with prettified output', async () => {
    // Upload a task
    const uploadedTask = await taskManager.uploadTask(mockTaskFile, 'test-export-task.js');
    
    // Export the task with prettify option
    const exportedBuffer = await taskManager.exportTask(uploadedTask.id, { prettify: true });
    const exportedContent = exportedBuffer.toString('utf-8');
    
    // Verify the exported content has proper formatting
    expect(exportedContent).toContain('const parameters = [\n');
    expect(exportedContent).toContain('  name:');
    expect(exportedContent).toContain('const config = {\n');
    expect(exportedContent).toContain('  "timeout":');
  });
  
  it('should export a task without dependencies when specified', async () => {
    // Upload a task
    const uploadedTask = await taskManager.uploadTask(mockTaskFile, 'test-export-task.js');
    
    // Export the task without dependencies
    const exportedBuffer = await taskManager.exportTask(uploadedTask.id, { includeDependencies: false });
    const exportedContent = exportedBuffer.toString('utf-8');
    
    // Verify dependencies are not included
    expect(exportedContent).not.toContain('const dependencies = [');
    expect(exportedContent).not.toContain("'lodash@4.17.21'");
    expect(exportedContent).not.toContain("'axios@1.3.4'");
  });
  
  it('should handle tasks with missing execute function', async () => {
    // Create a task with missing execute function
    const taskWithoutExecute = await taskManager.uploadTask(
      Buffer.from(`
        /**
         * @name Task Without Execute
         * @description A test task without execute function
         * @version 1.0.0
         * @author Test Author
         * @category Test
         */
        
        const parameters = [];
        const dependencies = [];
        const config = {};
        
        module.exports = { parameters, dependencies, config };
      `),
      'task-without-execute.js'
    );
    
    // Export the task
    const exportedBuffer = await taskManager.exportTask(taskWithoutExecute.id);
    const exportedContent = exportedBuffer.toString('utf-8');
    
    // Verify a placeholder execute function is included
    expect(exportedContent).toContain('async function execute(context)');
    expect(exportedContent).toContain("log('Task started')");
    expect(exportedContent).toContain('progress(100');
    expect(exportedContent).toContain('return { success: true };');
  });
});