/**
 * Tests for browser state restoration functionality
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TaskManager } from '../../main/services/task-manager';
import { BrowserManager } from '../../main/services/browser-manager';
import { DatabaseService } from '../../main/services/database-service';

// Mock dependencies
vi.mock('../../main/utils/logger');
vi.mock('../../main/services/database-service');
vi.mock('../../main/services/browser-manager');

describe('Browser State Restoration', () => {
  let taskManager: TaskManager;
  let mockBrowserManager: BrowserManager;
  let mockDatabaseService: DatabaseService;
  let mockPage: any;
  let mockClient: any;

  beforeEach(() => {
    // Create mock CDP client
    mockClient = {
      send: vi.fn().mockResolvedValue({}),
    };

    // Create mock page
    mockPage = {
      target: vi.fn().mockReturnValue({
        createCDPSession: vi.fn().mockResolvedValue(mockClient)
      }),
      evaluate: vi.fn().mockResolvedValue({}),
      goto: vi.fn().mockResolvedValue({}),
      setViewport: vi.fn().mockResolvedValue({}),
      reload: vi.fn().mockResolvedValue({})
    };

    // Create mock browser manager
    mockBrowserManager = {
      getPlatform: vi.fn().mockReturnValue({
        getMainPage: vi.fn().mockResolvedValue(mockPage)
      })
    } as any;

    // Create mock database service
    mockDatabaseService = {
      saveTaskExecution: vi.fn().mockResolvedValue({}),
      updateTaskUsage: vi.fn().mockResolvedValue({})
    } as any;

    // Create task manager instance
    taskManager = new TaskManager(mockBrowserManager, mockDatabaseService);
  });

  describe('restoreBrowserInitialState', () => {
    it('should clear cookies when restoring browser state', async () => {
      // Access private method for testing
      const restoreMethod = (taskManager as any).restoreBrowserInitialState;
      
      await restoreMethod.call(taskManager, 'test-browser-id', mockPage);

      // Verify cookies were cleared
      expect(mockClient.send).toHaveBeenCalledWith('Network.clearBrowserCookies');
    });

    it('should clear browser cache when restoring browser state', async () => {
      const restoreMethod = (taskManager as any).restoreBrowserInitialState;
      
      await restoreMethod.call(taskManager, 'test-browser-id', mockPage);

      // Verify cache was cleared
      expect(mockClient.send).toHaveBeenCalledWith('Network.clearBrowserCache');
    });

    it('should clear local and session storage', async () => {
      const restoreMethod = (taskManager as any).restoreBrowserInitialState;
      
      await restoreMethod.call(taskManager, 'test-browser-id', mockPage);

      // Verify storage clearing script was executed
      expect(mockPage.evaluate).toHaveBeenCalledWith(expect.any(Function));
    });

    it('should navigate to blank page', async () => {
      const restoreMethod = (taskManager as any).restoreBrowserInitialState;
      
      await restoreMethod.call(taskManager, 'test-browser-id', mockPage);

      // Verify navigation to blank page
      expect(mockPage.goto).toHaveBeenCalledWith('about:blank', { waitUntil: 'load' });
    });

    it('should reset viewport to default size', async () => {
      const restoreMethod = (taskManager as any).restoreBrowserInitialState;
      
      await restoreMethod.call(taskManager, 'test-browser-id', mockPage);

      // Verify viewport reset
      expect(mockPage.setViewport).toHaveBeenCalledWith({ width: 1280, height: 720 });
    });

    it('should reload page to clear event listeners', async () => {
      const restoreMethod = (taskManager as any).restoreBrowserInitialState;
      
      await restoreMethod.call(taskManager, 'test-browser-id', mockPage);

      // Verify page reload
      expect(mockPage.reload).toHaveBeenCalledWith({ waitUntil: 'load' });
    });

    it('should handle errors gracefully', async () => {
      // Make CDP session creation fail
      mockPage.target.mockReturnValue({
        createCDPSession: vi.fn().mockRejectedValue(new Error('CDP failed'))
      });

      const restoreMethod = (taskManager as any).restoreBrowserInitialState;
      
      // Should throw error but not crash
      await expect(restoreMethod.call(taskManager, 'test-browser-id', mockPage))
        .rejects.toThrow('CDP failed');
    });
  });

  describe('Task execution with browser state restoration', () => {
    it('should restore browser state after successful task execution when enabled', async () => {
      const taskFile = {
        metadata: { name: 'Test Task', version: '1.0.0' },
        parameters: [],
        dependencies: [],
        config: { restoreBrowserState: true },
        code: 'async function execute() { return { success: true }; }',
        executeFunction: 'async function execute() { return { success: true }; }'
      };

      const request = {
        taskId: 'test-task',
        browserId: 'test-browser'
      };

      // Mock the private methods
      (taskManager as any).getTaskFile = vi.fn().mockResolvedValue(taskFile);
      (taskManager as any).getPageFromBrowser = vi.fn().mockResolvedValue(mockPage);
      (taskManager as any).createExecutionContext = vi.fn().mockReturnValue({});
      (taskManager as any).executeTaskCode = vi.fn().mockResolvedValue({ success: true });
      (taskManager as any).restoreBrowserInitialState = vi.fn().mockResolvedValue({});

      await (taskManager as any).performExecution(request, taskFile);

      // Verify browser state restoration was called
      expect((taskManager as any).restoreBrowserInitialState).toHaveBeenCalledWith('test-browser', mockPage);
    });

    it('should not restore browser state when disabled in config', async () => {
      const taskFile = {
        metadata: { name: 'Test Task', version: '1.0.0' },
        parameters: [],
        dependencies: [],
        config: { restoreBrowserState: false },
        code: 'async function execute() { return { success: true }; }',
        executeFunction: 'async function execute() { return { success: true }; }'
      };

      const request = {
        taskId: 'test-task',
        browserId: 'test-browser'
      };

      // Mock the private methods
      (taskManager as any).getTaskFile = vi.fn().mockResolvedValue(taskFile);
      (taskManager as any).getPageFromBrowser = vi.fn().mockResolvedValue(mockPage);
      (taskManager as any).createExecutionContext = vi.fn().mockReturnValue({});
      (taskManager as any).executeTaskCode = vi.fn().mockResolvedValue({ success: true });
      (taskManager as any).restoreBrowserInitialState = vi.fn().mockResolvedValue({});

      await (taskManager as any).performExecution(request, taskFile);

      // Verify browser state restoration was NOT called
      expect((taskManager as any).restoreBrowserInitialState).not.toHaveBeenCalled();
    });

    it('should attempt browser state restoration even after task failure', async () => {
      const taskFile = {
        metadata: { name: 'Test Task', version: '1.0.0' },
        parameters: [],
        dependencies: [],
        config: { restoreBrowserState: true },
        code: 'async function execute() { throw new Error("Task failed"); }',
        executeFunction: 'async function execute() { throw new Error("Task failed"); }'
      };

      const request = {
        taskId: 'test-task',
        browserId: 'test-browser'
      };

      // Mock the private methods
      (taskManager as any).getTaskFile = vi.fn().mockResolvedValue(taskFile);
      (taskManager as any).getPageFromBrowser = vi.fn().mockResolvedValue(mockPage);
      (taskManager as any).createExecutionContext = vi.fn().mockReturnValue({});
      (taskManager as any).executeTaskCode = vi.fn().mockRejectedValue(new Error('Task failed'));
      (taskManager as any).restoreBrowserInitialState = vi.fn().mockResolvedValue({});

      // Task execution should handle the error
      await (taskManager as any).performExecution(request, taskFile);

      // Verify browser state restoration was still attempted
      expect((taskManager as any).restoreBrowserInitialState).toHaveBeenCalledWith('test-browser', mockPage);
    });
  });
});