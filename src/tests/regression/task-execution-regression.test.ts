import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TaskManager } from '../../main/services/task-manager';
import { TaskExecutionRequest } from '../../main/types/task';

describe('Task Execution Regression Tests', () => {
  let taskManager: TaskManager;
  let mockBrowserManager: any;
  let mockDatabaseService: any;
  
  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    
    // Create mock dependencies
    mockBrowserManager = {
      getBrowser: vi.fn().mockReturnValue({
        id: 'browser1',
        status: 'running'
      }),
      getBrowsers: vi.fn().mockResolvedValue([
        { id: 'browser1', status: 'running' }
      ]),
      openBrowser: vi.fn()
    };
    
    mockDatabaseService = {
      saveTask: vi.fn(),
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
    
    // Mock internal methods
    (taskManager as any).getPageFromBrowser = vi.fn().mockResolvedValue({});
    (taskManager as any).executeTaskCode = vi.fn().mockResolvedValue({ success: true });
    (taskManager as any).createExecutionContext = vi.fn().mockReturnValue({});
    
    // Add a task to the localTasks map
    (taskManager as any).localTasks.set('task1', {
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
    
    // Mock getTaskFile
    mockDatabaseService.getTaskFile.mockResolvedValue({
      metadata: {
        name: 'Task 1',
        description: 'First task',
        version: '1.0.0',
        author: 'Test Author',
        tags: ['test']
      },
      parameters: [],
      code: 'async function execute(context) { return { success: true }; }',
      examples: []
    });
  });
  
  describe('task execution workflow', () => {
    it('should execute a task successfully', async () => {
      // Create execution request
      const request: TaskExecutionRequest = {
        taskId: 'task1',
        browserId: 'browser1'
      };
      
      // Execute the task
      const execution = await taskManager.executeTask(request);
      
      // Verify execution was created
      expect(execution).not.toBeNull();
      expect(execution.taskId).toBe('task1');
      expect(execution.browserId).toBe('browser1');
      expect(execution.status).toBe('pending');
      
      // Verify the browser was checked
      expect(mockBrowserManager.getBrowser).toHaveBeenCalledWith('browser1');
      
      // Verify a page was requested
      expect((taskManager as any).getPageFromBrowser).toHaveBeenCalledWith('browser1');
      
      // Verify the task file was loaded
      expect(mockDatabaseService.getTaskFile).toHaveBeenCalledWith('task1');
      
      // Verify an execution context was created
      expect((taskManager as any).createExecutionContext).toHaveBeenCalled();
      
      // Verify the task code was executed
      expect((taskManager as any).executeTaskCode).toHaveBeenCalled();
    });
    
    it('should stop a running task execution', async () => {
      // Create an execution and add it to the executions map
      const execution = {
        id: 'execution1',
        taskId: 'task1',
        browserId: 'browser1',
        status: 'running',
        startTime: new Date(),
        logs: []
      };
      
      (taskManager as any).executions.set('execution1', execution);
      
      // Stop the execution
      await taskManager.stopExecution('execution1');
      
      // Verify the execution was stopped
      expect(execution.status).toBe('cancelled');
      expect(execution.endTime).toBeDefined();
    });
    
    it('should get execution details', async () => {
      // Create an execution and add it to the executions map
      const execution = {
        id: 'execution1',
        taskId: 'task1',
        browserId: 'browser1',
        status: 'completed',
        startTime: new Date(),
        endTime: new Date(),
        logs: []
      };
      
      (taskManager as any).executions.set('execution1', execution);
      
      // Get the execution
      const result = await taskManager.getExecution('execution1');
      
      // Verify the execution was returned
      expect(result).not.toBeNull();
      expect(result!.id).toBe('execution1');
      expect(result!.status).toBe('completed');
    });
    
    it('should get task executions', async () => {
      // Mock getTaskExecutions to return some executions
      mockDatabaseService.getTaskExecutions.mockResolvedValueOnce([
        {
          id: 'execution1',
          taskId: 'task1',
          browserId: 'browser1',
          status: 'completed',
          startTime: new Date(),
          endTime: new Date(),
          logs: []
        },
        {
          id: 'execution2',
          taskId: 'task1',
          browserId: 'browser1',
          status: 'failed',
          startTime: new Date(),
          endTime: new Date(),
          logs: []
        }
      ]);
      
      // Get task executions
      const executions = await taskManager.getTaskExecutions('task1');
      
      // Verify executions were returned
      expect(executions.length).toBe(2);
      expect(executions[0].id).toBe('execution1');
      expect(executions[1].id).toBe('execution2');
    });
    
    it('should get task statistics', async () => {
      // Mock getTaskExecutions to return some executions
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      
      mockDatabaseService.getTaskExecutions.mockResolvedValueOnce([
        {
          id: 'execution1',
          taskId: 'task1',
          browserId: 'browser1',
          status: 'completed',
          startTime: oneHourAgo,
          endTime: now,
          logs: []
        },
        {
          id: 'execution2',
          taskId: 'task1',
          browserId: 'browser1',
          status: 'failed',
          startTime: oneHourAgo,
          endTime: now,
          logs: []
        }
      ]);
      
      // Get task stats
      const stats = await taskManager.getTaskStats('task1');
      
      // Verify stats were calculated correctly
      expect(stats.totalExecutions).toBe(2);
      expect(stats.successfulExecutions).toBe(1);
      expect(stats.failedExecutions).toBe(1);
      expect(stats.averageExecutionTime).toBeGreaterThan(0);
      expect(stats.lastExecutionTime).toBeDefined();
    });
  });
  
  describe('dependency management', () => {
    it('should check task dependencies', async () => {
      // Mock getTask to return a task with dependencies
      mockDatabaseService.getTask.mockResolvedValueOnce({
        id: 'task1',
        metadata: {
          name: 'Task 1',
          description: 'First task',
          version: '1.0.0',
          author: 'Test Author',
          tags: ['test'],
          dependencies: ['dep1@1.0.0', 'dep2@2.0.0']
        },
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      // Mock dependencyManager.checkDependencies
      (taskManager as any).dependencyManager = {
        checkDependencies: vi.fn().mockResolvedValue({
          satisfied: true,
          missingDependencies: []
        })
      };
      
      // Check dependencies
      const result = await taskManager.checkTaskDependencies('task1');
      
      // Verify dependencies were checked
      expect((taskManager as any).dependencyManager.checkDependencies).toHaveBeenCalled();
      expect(result).not.toBeNull();
      expect(result!.satisfied).toBe(true);
    });
    
    it('should install task dependencies', async () => {
      // Mock dependencyManager.installDependencies
      (taskManager as any).dependencyManager = {
        installDependencies: vi.fn().mockResolvedValue({
          success: true,
          installedDependencies: ['dep1@1.0.0', 'dep2@2.0.0'],
          failedDependencies: []
        }),
        checkDependencies: vi.fn().mockResolvedValue({
          satisfied: true,
          missingDependencies: []
        })
      };
      
      // Install dependencies
      const result = await taskManager.installTaskDependencies({
        taskId: 'task1',
        dependencies: ['dep1@1.0.0', 'dep2@2.0.0']
      });
      
      // Verify dependencies were installed
      expect((taskManager as any).dependencyManager.installDependencies).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.installedDependencies).toEqual(['dep1@1.0.0', 'dep2@2.0.0']);
    });
  });
});