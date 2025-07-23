/**
 * Integration test for error handling and logging in TaskExecutionService
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TaskExecutionService } from '../../main/services/task-execution-service';
import { BrowserManager } from '../../main/services/browser-manager';
import { PrismaClient } from '@prisma/client';
import { Logger } from '../../main/utils/logger';
import { TaskError, ErrorCode } from '../../shared/types/plugin-task-system';

// Mock the logger to capture log calls
vi.mock('../../main/utils/logger');

describe('TaskExecutionService - Error Logging Integration', () => {
  let mockLogger: any;
  let loggerSpy: any;

  beforeEach(() => {
    // Create mock logger with spy methods
    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      verbose: vi.fn()
    };

    // Mock the Logger constructor to return our mock
    loggerSpy = vi.mocked(Logger).mockImplementation(() => mockLogger);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should log detailed error information when browser startup fails', async () => {
    // Create mock browser manager
    const mockBrowserManager = {
      getBrowser: vi.fn().mockReturnValue({
        id: 'test-browser',
        name: 'Chrome Browser',
        platform: 'local',
        status: 'stopped'
      }),
      getBrowserStatus: vi.fn().mockResolvedValue('stopped'),
      openBrowser: vi.fn().mockResolvedValue({
        success: false,
        error: 'Permission denied to start browser'
      })
    } as any;

    const mockPrisma = {} as any;
    const service = new TaskExecutionService(mockBrowserManager, mockPrisma);

    // Verify Logger was instantiated with correct context
    expect(Logger).toHaveBeenCalledWith('TaskExecutionService');

    try {
      // Access private method for testing
      const ensureBrowserRunning = (service as any).ensureBrowserRunning;
      await ensureBrowserRunning.call(service, 'test-browser');
      
      expect(true).toBe(false); // Should not reach here
    } catch (error) {
      // Verify error logging was called with detailed information
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to start browser test-browser (Chrome Browser)',
        expect.any(Error),
        expect.objectContaining({
          browserId: 'test-browser',
          browserName: 'Chrome Browser',
          browserPlatform: 'local',
          currentStatus: 'stopped',
          errorDetails: 'Permission denied to start browser'
        })
      );

      // Verify the error is user-friendly
      expect(error).toBeInstanceOf(TaskError);
      expect((error as TaskError).message).toContain('权限设置');
    }
  });

  it('should log debug information during normal browser status checks', async () => {
    const mockBrowserManager = {
      getBrowser: vi.fn().mockReturnValue({
        id: 'test-browser',
        name: 'Chrome Browser',
        platform: 'local',
        status: 'running'
      }),
      getBrowserStatus: vi.fn().mockResolvedValue('running')
    } as any;

    const mockPrisma = {} as any;
    const service = new TaskExecutionService(mockBrowserManager, mockPrisma);

    // Test getBrowserStatus method
    const status = await service.getBrowserStatus('test-browser');

    // Verify debug logging was called
    expect(mockLogger.debug).toHaveBeenCalledWith(
      'Getting status for browser: test-browser (Chrome Browser)'
    );
    expect(mockLogger.debug).toHaveBeenCalledWith(
      'Browser test-browser status: running'
    );

    expect(status).toBe('running');
  });

  it('should log initialization message', async () => {
    const mockBrowserManager = {} as any;
    const mockPrisma = {} as any;
    const service = new TaskExecutionService(mockBrowserManager, mockPrisma);

    // Mock the result cache manager initialization
    const mockResultCache = {
      initialize: vi.fn().mockResolvedValue(undefined)
    };
    (service as any).resultCache = mockResultCache;

    await service.initialize();

    // Verify initialization logging
    expect(mockLogger.info).toHaveBeenCalledWith('TaskExecutionService initialized successfully');
  });

  it('should log cache errors without throwing', async () => {
    const mockBrowserManager = {
      getBrowser: vi.fn().mockReturnValue({
        id: 'test-browser',
        name: 'Chrome Browser',
        platform: 'local',
        status: 'running'
      }),
      getBrowserStatus: vi.fn().mockResolvedValue('running')
    } as any;

    const mockPrisma = {} as any;
    const service = new TaskExecutionService(mockBrowserManager, mockPrisma);

    // Mock execution engine to return successful execution
    const mockExecution = {
      id: 'exec-1',
      status: 'completed',
      result: { success: true }
    };

    const mockExecutionEngine = {
      executeTask: vi.fn().mockResolvedValue(mockExecution)
    };
    (service as any).executionEngine = mockExecutionEngine;

    // Mock result cache to throw error
    const mockResultCache = {
      cacheExecution: vi.fn().mockRejectedValue(new Error('Cache storage full'))
    };
    (service as any).resultCache = mockResultCache;

    const mockTask = {
      id: 'task-1',
      name: 'Test Task',
      code: 'async function execute() { return { success: true }; }'
    };

    const mockRequest = {
      browserId: 'test-browser',
      parameters: {}
    };

    // Execute task - should not throw despite cache error
    const result = await service.executeTask(mockRequest, mockTask);

    // Verify cache error was logged
    expect(mockLogger.error).toHaveBeenCalledWith(
      'Failed to cache execution result',
      expect.any(Error)
    );

    // Verify execution still succeeded
    expect(result).toEqual(mockExecution);
  });
});