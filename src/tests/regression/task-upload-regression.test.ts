import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TaskManager } from '../../main/services/task-manager';
import { TaskFile } from '../../main/types/task';

describe('Task Upload Regression Tests', () => {
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
    
    // Create task manager instance
    taskManager = new TaskManager(mockBrowserManager, mockDatabaseService);
  });
  
  describe('original format support', () => {
    it('should still support the original JSON task format', async () => {
      // Create a task file in the original format
      const originalFormatTask: TaskFile = {
        metadata: {
          id: 'original_format_task',
          name: 'Original Format Task',
          description: 'A task in the original format',
          version: '1.0.0',
          author: 'Test Author',
          tags: ['test', 'original']
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
        file: Buffer.from(JSON.stringify(originalFormatTask)),
        filename: 'original-format-task.json'
      });
      
      // Verify the task was saved
      expect(mockDatabaseService.saveTask).toHaveBeenCalled();
      expect(result.id).toBe('test_task_id');
    });
    
    it('should still support the original JavaScript task format with JSDoc', async () => {
      // Create a task file in the original JavaScript format with JSDoc
      const originalJSTaskFile = `
/**
 * @metadata
 * @name Original JS Task
 * @description A task in the original JavaScript format with JSDoc
 * @version 1.0.0
 * @author Test Author
 * @tags test,original,javascript
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
        file: Buffer.from(originalJSTaskFile),
        filename: 'original-js-task.js'
      });
      
      // Verify the task was saved
      expect(mockDatabaseService.saveTask).toHaveBeenCalled();
      expect(result.id).toBe('test_task_id');
    });
  });
  
  describe('existing task operations', () => {
    it('should still support getting tasks', async () => {
      // Mock getTasks to return some tasks
      mockDatabaseService.getTasks.mockResolvedValueOnce([
        {
          id: 'task1',
          metadata: {
            name: 'Task 1',
            description: 'First task',
            version: '1.0.0',
            author: 'Test Author',
            tags: ['test']
          },
          status: 'active',
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'task2',
          metadata: {
            name: 'Task 2',
            description: 'Second task',
            version: '1.0.0',
            author: 'Test Author',
            tags: ['test']
          },
          status: 'active',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ]);
      
      // Get tasks
      const tasks = await taskManager.getTasks();
      
      // Verify tasks were returned
      expect(tasks.length).toBe(2);
      expect(tasks[0].id).toBe('task1');
      expect(tasks[1].id).toBe('task2');
    });
    
    it('should still support getting a specific task', async () => {
      // Mock getTask to return a task
      mockDatabaseService.getTask.mockResolvedValueOnce({
        id: 'task1',
        metadata: {
          name: 'Task 1',
          description: 'First task',
          version: '1.0.0',
          author: 'Test Author',
          tags: ['test']
        },
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      // Get the task
      const task = await taskManager.getTask('task1');
      
      // Verify the task was returned
      expect(task).not.toBeNull();
      expect(task!.id).toBe('task1');
    });
    
    it('should still support deleting a task', async () => {
      // Delete a task
      await taskManager.deleteTask('task1');
      
      // Verify deleteTask was called
      expect(mockDatabaseService.deleteTask).toHaveBeenCalledWith('task1');
    });
  });
  
  describe('task execution', () => {
    it('should still support executing tasks', async () => {
      // Mock getTask to return a task
      const task = {
        id: 'task1',
        metadata: {
          name: 'Task 1',
          description: 'First task',
          version: '1.0.0',
          author: 'Test Author',
          tags: ['test']
        },
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      // Add the task to the localTasks map
      (taskManager as any).localTasks.set('task1', task);
      
      // Mock getTaskFile to return a task file
      mockDatabaseService.getTaskFile.mockResolvedValueOnce({
        metadata: task.metadata,
        parameters: [],
        code: 'async function execute(context) { return { success: true }; }',
        examples: []
      });
      
      // Mock browser and page
      mockBrowserManager.getBrowser.mockReturnValueOnce({
        id: 'browser1',
        status: 'running'
      });
      
      // Mock getPageFromBrowser
      (taskManager as any).getPageFromBrowser = vi.fn().mockResolvedValueOnce({});
      
      // Mock executeTaskCode
      (taskManager as any).executeTaskCode = vi.fn().mockResolvedValueOnce({ success: true });
      
      // Execute the task
      const execution = await taskManager.executeTask({
        taskId: 'task1',
        browserId: 'browser1'
      });
      
      // Verify execution was created
      expect(execution).not.toBeNull();
      expect(execution.taskId).toBe('task1');
      expect(execution.browserId).toBe('browser1');
      expect(execution.status).toBe('pending');
    });
  });
});