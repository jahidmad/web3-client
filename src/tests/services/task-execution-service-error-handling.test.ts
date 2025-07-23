/**
 * Test for enhanced error handling and logging in TaskExecutionService
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TaskExecutionService } from '../../main/services/task-execution-service';
import { BrowserManager } from '../../main/services/browser-manager';
import { PrismaClient } from '@prisma/client';
import { TaskError, ErrorCode } from '../../shared/types/plugin-task-system';
import { Browser, BrowserStatus } from '../../main/types/browser';

// Mock dependencies
vi.mock('../../main/utils/logger');
vi.mock('../../main/services/result-cache-manager');

describe('TaskExecutionService - Error Handling', () => {
  let taskExecutionService: TaskExecutionService;
  let mockBrowserManager: BrowserManager;
  let mockPrisma: PrismaClient;

  const mockBrowser: Browser = {
    id: 'test-browser-id',
    name: 'Test Browser',
    platform: 'local',
    status: 'stopped',
    config: { name: 'Test Browser' },
    createdAt: new Date(),
    updatedAt: new Date(),
    groupId: undefined
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

  describe('Browser startup error handling', () => {
    it('should provide user-friendly error message for permission errors', async () => {
      // Setup mocks
      vi.mocked(mockBrowserManager.getBrowser).mockReturnValue(mockBrowser);
      vi.mocked(mockBrowserManager.getBrowserStatus).mockResolvedValue('stopped');
      vi.mocked(mockBrowserManager.openBrowser).mockResolvedValue({
        success: false,
        error: 'Permission denied to start browser'
      });

      // Test the private method through getBrowserStatus (which calls ensureBrowserRunning indirectly)
      try {
        // We need to access the private method for testing
        const ensureBrowserRunning = (taskExecutionService as any).ensureBrowserRunning;
        await ensureBrowserRunning.call(taskExecutionService, 'test-browser-id');
        
        // Should not reach here
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(TaskError);
        expect((error as TaskError).code).toBe(ErrorCode.BROWSER_START_FAILED);
        expect((error as TaskError).message).toContain('权限设置');
        expect((error as TaskError).message).toContain('确保应用有权限启动浏览器');
      }
    });

    it('should provide user-friendly error message for browser not found errors', async () => {
      // Setup mocks
      vi.mocked(mockBrowserManager.getBrowser).mockReturnValue(mockBrowser);
      vi.mocked(mockBrowserManager.getBrowserStatus).mockResolvedValue('stopped');
      vi.mocked(mockBrowserManager.openBrowser).mockResolvedValue({
        success: false,
        error: 'Browser executable not found at path'
      });

      try {
        const ensureBrowserRunning = (taskExecutionService as any).ensureBrowserRunning;
        await ensureBrowserRunning.call(taskExecutionService, 'test-browser-id');
        
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(TaskError);
        expect((error as TaskError).code).toBe(ErrorCode.BROWSER_START_FAILED);
        expect((error as TaskError).message).toContain('确认浏览器已正确安装');
        expect((error as TaskError).message).toContain('路径配置正确');
      }
    });

    it('should provide user-friendly error message for port conflicts', async () => {
      // Setup mocks
      vi.mocked(mockBrowserManager.getBrowser).mockReturnValue(mockBrowser);
      vi.mocked(mockBrowserManager.getBrowserStatus).mockResolvedValue('stopped');
      vi.mocked(mockBrowserManager.openBrowser).mockResolvedValue({
        success: false,
        error: 'Port 9222 is already in use'
      });

      try {
        const ensureBrowserRunning = (taskExecutionService as any).ensureBrowserRunning;
        await ensureBrowserRunning.call(taskExecutionService, 'test-browser-id');
        
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(TaskError);
        expect((error as TaskError).code).toBe(ErrorCode.BROWSER_START_FAILED);
        expect((error as TaskError).message).toContain('端口可能被占用');
        expect((error as TaskError).message).toContain('重启应用或检查端口冲突');
      }
    });

    it('should provide user-friendly error message for timeout errors', async () => {
      // Setup mocks
      vi.mocked(mockBrowserManager.getBrowser).mockReturnValue(mockBrowser);
      vi.mocked(mockBrowserManager.getBrowserStatus).mockResolvedValue('stopped');
      vi.mocked(mockBrowserManager.openBrowser).mockResolvedValue({
        success: false,
        error: 'Browser startup timeout after 30 seconds'
      });

      try {
        const ensureBrowserRunning = (taskExecutionService as any).ensureBrowserRunning;
        await ensureBrowserRunning.call(taskExecutionService, 'test-browser-id');
        
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(TaskError);
        expect((error as TaskError).code).toBe(ErrorCode.BROWSER_START_FAILED);
        expect((error as TaskError).message).toContain('启动超时');
        expect((error as TaskError).message).toContain('检查系统资源');
      }
    });

    it('should handle browser not found scenario', async () => {
      // Setup mocks - browser doesn't exist
      vi.mocked(mockBrowserManager.getBrowser).mockReturnValue(null);

      try {
        const ensureBrowserRunning = (taskExecutionService as any).ensureBrowserRunning;
        await ensureBrowserRunning.call(taskExecutionService, 'non-existent-browser');
        
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(TaskError);
        expect((error as TaskError).code).toBe(ErrorCode.BROWSER_NOT_FOUND);
        expect((error as TaskError).message).toContain('找不到指定的浏览器');
        expect((error as TaskError).message).toContain('选择其他可用的浏览器');
      }
    });

    it('should skip startup for already running browser', async () => {
      // Setup mocks - browser is already running
      vi.mocked(mockBrowserManager.getBrowser).mockReturnValue(mockBrowser);
      vi.mocked(mockBrowserManager.getBrowserStatus).mockResolvedValue('running');

      // Should not throw any error
      const ensureBrowserRunning = (taskExecutionService as any).ensureBrowserRunning;
      await expect(ensureBrowserRunning.call(taskExecutionService, 'test-browser-id')).resolves.toBeUndefined();

      // openBrowser should not be called
      expect(mockBrowserManager.openBrowser).not.toHaveBeenCalled();
    });
  });

  describe('getBrowserStatus error handling', () => {
    it('should provide user-friendly error message when browser status check fails', async () => {
      // Setup mocks
      vi.mocked(mockBrowserManager.getBrowser).mockReturnValue(mockBrowser);
      vi.mocked(mockBrowserManager.getBrowserStatus).mockRejectedValue(new Error('Connection failed'));

      try {
        await taskExecutionService.getBrowserStatus('test-browser-id');
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(TaskError);
        expect((error as TaskError).code).toBe(ErrorCode.BROWSER_NOT_FOUND);
        expect((error as TaskError).message).toContain('获取浏览器状态时发生错误');
        expect((error as TaskError).message).toContain('确认浏览器配置正确');
      }
    });
  });
});