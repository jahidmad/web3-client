/**
 * Unit tests for browser status checking and auto-start functionality in TaskExecutionService
 * 
 * Tests cover:
 * - Browser status checking logic
 * - Automatic browser startup functionality  
 * - Various error scenarios handling
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TaskExecutionService } from '../../main/services/task-execution-service';
import { BrowserManager } from '../../main/services/browser-manager';
import { PrismaClient } from '@prisma/client';
import { TaskError, ErrorCode, ExecutionRequest, Task } from '../../shared/types/plugin-task-system';
import { Browser, BrowserStatus } from '../../main/types/browser';

// Mock dependencies
vi.mock('../../main/utils/logger');
vi.mock('../../main/services/result-cache-manager');
vi.mock('../../shared/engines/task-execution-engine');
vi.mock('../../main/adapters/browser-adapter');
vi.mock('../../main/adapters/execution-storage-adapter');
vi.mock('../../main/adapters/execution-logger-adapter');

describe('TaskExecutionService - Browser Status and Auto-Start', () => {
  let taskExecutionService: TaskExecutionService;
  let mockBrowserManager: BrowserManager;
  let mockPrisma: PrismaClient;

  const mockBrowser: Browser = {
    id: 'test-browser-id',
    name: 'Test Chrome Browser',
    platform: 'local',
    status: 'stopped',
    config: { name: 'Test Chrome Browser' },
    createdAt: new Date(),
    updatedAt: new Date(),
    groupId: undefined
  };

  const mockTask: Task = {
    id: 'test-task-id',
    name: 'Test Task',
    description: 'Test task description',
    version: '1.0.0',
    author: 'Test Author',
    category: 'test',
    tags: ['test'],
    parameters: [],
    dependencies: [],
    config: { timeout: 30000 },
    code: 'async function execute() { return "test"; }',
    createdAt: new Date(),
    updatedAt: new Date(),
    status: 'active'
  };

  beforeEach(() => {
    // Create mock browser manager
    mockBrowserManager = {
      getBrowser: vi.fn(),
      getBrowserStatus: vi.fn(),
      openBrowser: vi.fn()
    } as any;

    // Create mock prisma client
    mockPrisma = {} as any;

    // Create service instance
    taskExecutionService = new TaskExecutionService(mockBrowserManager, mockPrisma);
  });

  describe('Browser Status Checking Logic', () => {
    it('should successfully get browser status for existing browser', async () => {
      // Setup mocks
      vi.mocked(mockBrowserManager.getBrowser).mockReturnValue(mockBrowser);
      vi.mocked(mockBrowserManager.getBrowserStatus).mockResolvedValue('running');

      // Test
      const status = await taskExecutionService.getBrowserStatus('test-browser-id');

      // Verify
      expect(status).toBe('running');
      expect(mockBrowserManager.getBrowser).toHaveBeenCalledWith('test-browser-id');
      expect(mockBrowserManager.getBrowserStatus).toHaveBeenCalledWith('test-browser-id');
    });

    it('should return stopped status for stopped browser', async () => {
      // Setup mocks
      vi.mocked(mockBrowserManager.getBrowser).mockReturnValue(mockBrowser);
      vi.mocked(mockBrowserManager.getBrowserStatus).mockResolvedValue('stopped');

      // Test
      const status = await taskExecutionService.getBrowserStatus('test-browser-id');

      // Verify
      expect(status).toBe('stopped');
    });

    it('should return starting status for starting browser', async () => {
      // Setup mocks
      vi.mocked(mockBrowserManager.getBrowser).mockReturnValue(mockBrowser);
      vi.mocked(mockBrowserManager.getBrowserStatus).mockResolvedValue('starting');

      // Test
      const status = await taskExecutionService.getBrowserStatus('test-browser-id');

      // Verify
      expect(status).toBe('starting');
    });

    it('should throw TaskError when browser does not exist', async () => {
      // Setup mocks - browser doesn't exist
      vi.mocked(mockBrowserManager.getBrowser).mockReturnValue(null);

      // Test and verify
      await expect(taskExecutionService.getBrowserStatus('non-existent-browser'))
        .rejects.toThrow(TaskError);
      
      try {
        await taskExecutionService.getBrowserStatus('non-existent-browser');
      } catch (error) {
        expect(error).toBeInstanceOf(TaskError);
        expect((error as TaskError).code).toBe(ErrorCode.BROWSER_NOT_FOUND);
        expect((error as TaskError).message).toContain('找不到指定的浏览器');
        expect((error as TaskError).details?.browserId).toBe('non-existent-browser');
      }
    });

    it('should handle browser manager errors gracefully', async () => {
      // Setup mocks
      vi.mocked(mockBrowserManager.getBrowser).mockReturnValue(mockBrowser);
      vi.mocked(mockBrowserManager.getBrowserStatus).mockRejectedValue(new Error('Connection failed'));

      // Test and verify
      await expect(taskExecutionService.getBrowserStatus('test-browser-id'))
        .rejects.toThrow(TaskError);
      
      try {
        await taskExecutionService.getBrowserStatus('test-browser-id');
      } catch (error) {
        expect(error).toBeInstanceOf(TaskError);
        expect((error as TaskError).code).toBe(ErrorCode.BROWSER_NOT_FOUND);
        expect((error as TaskError).message).toContain('获取浏览器状态时发生错误');
        expect((error as TaskError).details?.originalError).toBe('Connection failed');
      }
    });
  });

  describe('Automatic Browser Startup Functionality', () => {
    it('should start browser when status is stopped', async () => {
      // Setup mocks
      vi.mocked(mockBrowserManager.getBrowser).mockReturnValue(mockBrowser);
      vi.mocked(mockBrowserManager.getBrowserStatus).mockResolvedValue('stopped');
      vi.mocked(mockBrowserManager.openBrowser).mockResolvedValue({
        success: true,
        error: null
      });

      // Access private method for testing
      const ensureBrowserRunning = (taskExecutionService as any).ensureBrowserRunning;
      
      // Test - should not throw
      await expect(ensureBrowserRunning.call(taskExecutionService, 'test-browser-id'))
        .resolves.toBeUndefined();

      // Verify browser startup was called
      expect(mockBrowserManager.openBrowser).toHaveBeenCalledWith('test-browser-id');
    });

    it('should start browser when status is error', async () => {
      // Setup mocks
      vi.mocked(mockBrowserManager.getBrowser).mockReturnValue(mockBrowser);
      vi.mocked(mockBrowserManager.getBrowserStatus).mockResolvedValue('error');
      vi.mocked(mockBrowserManager.openBrowser).mockResolvedValue({
        success: true,
        error: null
      });

      // Access private method for testing
      const ensureBrowserRunning = (taskExecutionService as any).ensureBrowserRunning;
      
      // Test - should not throw
      await expect(ensureBrowserRunning.call(taskExecutionService, 'test-browser-id'))
        .resolves.toBeUndefined();

      // Verify browser startup was called
      expect(mockBrowserManager.openBrowser).toHaveBeenCalledWith('test-browser-id');
    });

    it('should skip startup when browser is already running', async () => {
      // Setup mocks
      vi.mocked(mockBrowserManager.getBrowser).mockReturnValue(mockBrowser);
      vi.mocked(mockBrowserManager.getBrowserStatus).mockResolvedValue('running');

      // Access private method for testing
      const ensureBrowserRunning = (taskExecutionService as any).ensureBrowserRunning;
      
      // Test - should not throw
      await expect(ensureBrowserRunning.call(taskExecutionService, 'test-browser-id'))
        .resolves.toBeUndefined();

      // Verify browser startup was NOT called
      expect(mockBrowserManager.openBrowser).not.toHaveBeenCalled();
    });

    it('should start browser when status is starting (not running)', async () => {
      // Setup mocks - "starting" status should still trigger startup attempt
      vi.mocked(mockBrowserManager.getBrowser).mockReturnValue(mockBrowser);
      vi.mocked(mockBrowserManager.getBrowserStatus).mockResolvedValue('starting');
      vi.mocked(mockBrowserManager.openBrowser).mockResolvedValue({
        success: true,
        error: null
      });

      // Access private method for testing
      const ensureBrowserRunning = (taskExecutionService as any).ensureBrowserRunning;
      
      // Test - should not throw
      await expect(ensureBrowserRunning.call(taskExecutionService, 'test-browser-id'))
        .resolves.toBeUndefined();

      // Verify browser startup was called since "starting" != "running"
      expect(mockBrowserManager.openBrowser).toHaveBeenCalledWith('test-browser-id');
    });
  });

  describe('Error Scenarios Handling', () => {
    it('should handle browser startup failure with generic error', async () => {
      // Setup mocks
      vi.mocked(mockBrowserManager.getBrowser).mockReturnValue(mockBrowser);
      vi.mocked(mockBrowserManager.getBrowserStatus).mockResolvedValue('stopped');
      vi.mocked(mockBrowserManager.openBrowser).mockResolvedValue({
        success: false,
        error: 'Generic startup failure'
      });

      // Access private method for testing
      const ensureBrowserRunning = (taskExecutionService as any).ensureBrowserRunning;
      
      // Test and verify
      await expect(ensureBrowserRunning.call(taskExecutionService, 'test-browser-id'))
        .rejects.toThrow(TaskError);
      
      try {
        await ensureBrowserRunning.call(taskExecutionService, 'test-browser-id');
      } catch (error) {
        expect(error).toBeInstanceOf(TaskError);
        expect((error as TaskError).code).toBe(ErrorCode.BROWSER_START_FAILED);
        expect((error as TaskError).message).toContain('无法启动浏览器');
        expect((error as TaskError).message).toContain('Generic startup failure');
        expect((error as TaskError).details?.originalError).toBe('Generic startup failure');
      }
    });

    it('should provide specific guidance for permission errors', async () => {
      // Setup mocks
      vi.mocked(mockBrowserManager.getBrowser).mockReturnValue(mockBrowser);
      vi.mocked(mockBrowserManager.getBrowserStatus).mockResolvedValue('stopped');
      vi.mocked(mockBrowserManager.openBrowser).mockResolvedValue({
        success: false,
        error: 'Permission denied to access browser'
      });

      // Access private method for testing
      const ensureBrowserRunning = (taskExecutionService as any).ensureBrowserRunning;
      
      try {
        await ensureBrowserRunning.call(taskExecutionService, 'test-browser-id');
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(TaskError);
        expect((error as TaskError).message).toContain('权限设置');
        expect((error as TaskError).message).toContain('确保应用有权限启动浏览器');
      }
    });

    it('should provide specific guidance for path/installation errors', async () => {
      // Setup mocks
      vi.mocked(mockBrowserManager.getBrowser).mockReturnValue(mockBrowser);
      vi.mocked(mockBrowserManager.getBrowserStatus).mockResolvedValue('stopped');
      vi.mocked(mockBrowserManager.openBrowser).mockResolvedValue({
        success: false,
        error: 'Browser executable not found at specified path'
      });

      // Access private method for testing
      const ensureBrowserRunning = (taskExecutionService as any).ensureBrowserRunning;
      
      try {
        await ensureBrowserRunning.call(taskExecutionService, 'test-browser-id');
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(TaskError);
        expect((error as TaskError).message).toContain('确认浏览器已正确安装');
        expect((error as TaskError).message).toContain('路径配置正确');
      }
    });

    it('should provide specific guidance for port conflict errors', async () => {
      // Setup mocks
      vi.mocked(mockBrowserManager.getBrowser).mockReturnValue(mockBrowser);
      vi.mocked(mockBrowserManager.getBrowserStatus).mockResolvedValue('stopped');
      vi.mocked(mockBrowserManager.openBrowser).mockResolvedValue({
        success: false,
        error: 'Port 9222 is already in use by another process'
      });

      // Access private method for testing
      const ensureBrowserRunning = (taskExecutionService as any).ensureBrowserRunning;
      
      try {
        await ensureBrowserRunning.call(taskExecutionService, 'test-browser-id');
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(TaskError);
        expect((error as TaskError).message).toContain('端口可能被占用');
        expect((error as TaskError).message).toContain('重启应用或检查端口冲突');
      }
    });

    it('should provide specific guidance for timeout errors', async () => {
      // Setup mocks
      vi.mocked(mockBrowserManager.getBrowser).mockReturnValue(mockBrowser);
      vi.mocked(mockBrowserManager.getBrowserStatus).mockResolvedValue('stopped');
      vi.mocked(mockBrowserManager.openBrowser).mockResolvedValue({
        success: false,
        error: 'Browser startup timeout after 30 seconds'
      });

      // Access private method for testing
      const ensureBrowserRunning = (taskExecutionService as any).ensureBrowserRunning;
      
      try {
        await ensureBrowserRunning.call(taskExecutionService, 'test-browser-id');
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(TaskError);
        expect((error as TaskError).message).toContain('启动超时');
        expect((error as TaskError).message).toContain('检查系统资源');
      }
    });

    it('should handle browser not found during startup', async () => {
      // Setup mocks - browser doesn't exist
      vi.mocked(mockBrowserManager.getBrowser).mockReturnValue(null);

      // Access private method for testing
      const ensureBrowserRunning = (taskExecutionService as any).ensureBrowserRunning;
      
      try {
        await ensureBrowserRunning.call(taskExecutionService, 'non-existent-browser');
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(TaskError);
        expect((error as TaskError).code).toBe(ErrorCode.BROWSER_NOT_FOUND);
        expect((error as TaskError).message).toContain('找不到指定的浏览器');
      }
    });

    it('should handle unexpected errors during browser startup', async () => {
      // Setup mocks
      vi.mocked(mockBrowserManager.getBrowser).mockReturnValue(mockBrowser);
      vi.mocked(mockBrowserManager.getBrowserStatus).mockRejectedValue(new Error('Unexpected error'));

      // Access private method for testing
      const ensureBrowserRunning = (taskExecutionService as any).ensureBrowserRunning;
      
      try {
        await ensureBrowserRunning.call(taskExecutionService, 'test-browser-id');
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(TaskError);
        expect((error as TaskError).code).toBe(ErrorCode.BROWSER_START_FAILED);
        expect((error as TaskError).message).toContain('检查浏览器状态时发生意外错误');
        expect((error as TaskError).details?.originalError).toBe('Unexpected error');
      }
    });
  });

  describe('Integration with Task Execution', () => {
    it('should check and start browser before task execution when browserId is provided', async () => {
      // Setup mocks
      vi.mocked(mockBrowserManager.getBrowser).mockReturnValue(mockBrowser);
      vi.mocked(mockBrowserManager.getBrowserStatus).mockResolvedValue('stopped');
      vi.mocked(mockBrowserManager.openBrowser).mockResolvedValue({
        success: true,
        error: null
      });

      // Mock the execution engine to avoid actual task execution
      const mockExecutionEngine = {
        executeTask: vi.fn().mockResolvedValue({
          id: 'test-execution-id',
          status: 'completed',
          result: { success: true }
        })
      };
      (taskExecutionService as any).executionEngine = mockExecutionEngine;

      const executionRequest: ExecutionRequest = {
        taskId: 'test-task-id',
        browserId: 'test-browser-id',
        parameters: {}
      };

      // Test
      const result = await taskExecutionService.executeTask(executionRequest, mockTask);

      // Verify browser was started
      expect(mockBrowserManager.getBrowserStatus).toHaveBeenCalledWith('test-browser-id');
      expect(mockBrowserManager.openBrowser).toHaveBeenCalledWith('test-browser-id');
      
      // Verify task execution proceeded
      expect(mockExecutionEngine.executeTask).toHaveBeenCalledWith(executionRequest, mockTask);
      expect(result.status).toBe('completed');
    });

    it('should skip browser check when no browserId is provided', async () => {
      // Mock the execution engine
      const mockExecutionEngine = {
        executeTask: vi.fn().mockResolvedValue({
          id: 'test-execution-id',
          status: 'completed',
          result: { success: true }
        })
      };
      (taskExecutionService as any).executionEngine = mockExecutionEngine;

      const executionRequest: ExecutionRequest = {
        taskId: 'test-task-id',
        // No browserId provided
        parameters: {}
      };

      // Test
      const result = await taskExecutionService.executeTask(executionRequest, mockTask);

      // Verify browser methods were not called
      expect(mockBrowserManager.getBrowser).not.toHaveBeenCalled();
      expect(mockBrowserManager.getBrowserStatus).not.toHaveBeenCalled();
      expect(mockBrowserManager.openBrowser).not.toHaveBeenCalled();
      
      // Verify task execution proceeded
      expect(mockExecutionEngine.executeTask).toHaveBeenCalledWith(executionRequest, mockTask);
      expect(result.status).toBe('completed');
    });

    it('should fail task execution when browser startup fails', async () => {
      // Setup mocks
      vi.mocked(mockBrowserManager.getBrowser).mockReturnValue(mockBrowser);
      vi.mocked(mockBrowserManager.getBrowserStatus).mockResolvedValue('stopped');
      vi.mocked(mockBrowserManager.openBrowser).mockResolvedValue({
        success: false,
        error: 'Failed to start browser'
      });

      const executionRequest: ExecutionRequest = {
        taskId: 'test-task-id',
        browserId: 'test-browser-id',
        parameters: {}
      };

      // Test and verify
      await expect(taskExecutionService.executeTask(executionRequest, mockTask))
        .rejects.toThrow(TaskError);
      
      try {
        await taskExecutionService.executeTask(executionRequest, mockTask);
      } catch (error) {
        expect(error).toBeInstanceOf(TaskError);
        expect((error as TaskError).code).toBe(ErrorCode.BROWSER_START_FAILED);
        expect((error as TaskError).message).toContain('无法启动浏览器');
      }
    });
  });
});