import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TaskManager } from '../../main/services/task-manager';
import { TaskErrorHandler } from '../../main/services/task-error-handler';
import { TaskFixer } from '../../main/services/task-fixer';
import { TaskValidator } from '../../main/services/task-validator';
import { CleanupHelper } from '../../main/utils/cleanup-helper';
import { TaskFile, UploadTaskRequest } from '../../main/types/task';
import { ValidationResult } from '../../main/types/validation';

// Mock dependencies
vi.mock('../../main/services/task-error-handler');
vi.mock('../../main/services/task-fixer');
vi.mock('../../main/services/task-validator');
vi.mock('../../main/utils/cleanup-helper');

// Mock other dependencies
vi.mock('fs/promises');
vi.mock('path');
vi.mock('../../main/utils/logger', () => ({
  Logger: vi.fn().mockImplementation(() => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }))
}));

describe('TaskManager', () => {
  let taskManager: TaskManager;
  let mockBrowserManager: any;
  let mockDatabaseService: any;
  let mockTaskFile: TaskFile;
  
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
    
    // Create mock task file
    mockTaskFile = {
      metadata: {
        id: 'test_task_001',
        name: 'Test Task',
        description: 'A test task',
        version: '1.0.0',
        author: 'Test Author',
        tags: ['test']
      },
      parameters: [],
      code: 'async function execute(context) { return { success: true }; }',
      examples: []
    };
    
    // Mock TaskValidator.validateTaskFile to return a valid result
    (TaskValidator.prototype.validateTaskFile as any).mockReturnValue({
      valid: true,
      errors: [],
      warnings: [],
      infos: [],
      fixes: [],
      summary: {
        totalErrors: 0,
        totalWarnings: 0,
        totalInfos: 0,
        totalFixes: 0
      }
    } as ValidationResult);
    
    // Create task manager instance
    taskManager = new TaskManager(mockBrowserManager, mockDatabaseService);
  });
  
  describe('uploadTask', () => {
    it('should successfully upload a valid task file', async () => {
      // Create upload request
      const request: UploadTaskRequest = {
        file: Buffer.from(JSON.stringify(mockTaskFile)),
        filename: 'test-task.json'
      };
      
      // Mock parseTaskFile to return the mock task file
      (taskManager as any).parseTaskFile = vi.fn().mockResolvedValue(mockTaskFile);
      
      // Call uploadTask
      const result = await taskManager.uploadTask(request);
      
      // Verify the task was saved
      expect(mockDatabaseService.saveTask).toHaveBeenCalledWith(mockTaskFile);
      expect(result.id).toBe('test_task_id');
    });
    
    it('should handle parsing errors and attempt recovery', async () => {
      // Create upload request with invalid content
      const request: UploadTaskRequest = {
        file: Buffer.from('invalid content'),
        filename: 'invalid-task.js'
      };
      
      // Mock parseTaskFile to throw an error
      const parseError = new Error('Parsing error');
      (taskManager as any).parseTaskFile = vi.fn().mockRejectedValue(parseError);
      
      // Mock handleParsingError
      (TaskErrorHandler.prototype.handleParsingError as any).mockReturnValue(
        new Error('Enhanced error message')
      );
      
      // Call uploadTask and expect it to throw
      await expect(taskManager.uploadTask(request)).rejects.toThrow('Task upload failed');
      
      // Verify cleanup was called
      expect(CleanupHelper.prototype.cleanup).toHaveBeenCalled();
    });
    
    it('should attempt to fix validation errors', async () => {
      // Create upload request
      const request: UploadTaskRequest = {
        file: Buffer.from(JSON.stringify(mockTaskFile)),
        filename: 'test-task.json'
      };
      
      // Mock parseTaskFile to return the mock task file
      (taskManager as any).parseTaskFile = vi.fn().mockResolvedValue(mockTaskFile);
      
      // Mock validateTaskFile to throw an error first time, then succeed
      let validationAttempt = 0;
      (TaskValidator.prototype.validateTaskFile as any).mockImplementation(() => {
        validationAttempt++;
        if (validationAttempt === 1) {
          return {
            valid: false,
            errors: [{ message: 'Validation error' }],
            warnings: [],
            infos: [],
            fixes: [],
            summary: {
              totalErrors: 1,
              totalWarnings: 0,
              totalInfos: 0,
              totalFixes: 0
            }
          } as ValidationResult;
        } else {
          return {
            valid: true,
            errors: [],
            warnings: [],
            infos: [],
            fixes: [],
            summary: {
              totalErrors: 0,
              totalWarnings: 0,
              totalInfos: 0,
              totalFixes: 0
            }
          } as ValidationResult;
        }
      });
      
      // Mock TaskFixer.fixTaskFile to return a fixed task file
      const fixedTaskFile = { ...mockTaskFile };
      (TaskFixer.prototype.fixTaskFile as any).mockReturnValue({
        fixed: true,
        taskFile: fixedTaskFile,
        appliedFixes: ['Fixed something']
      });
      
      // Call uploadTask
      const result = await taskManager.uploadTask(request);
      
      // Verify the task fixer was called
      expect(TaskFixer.prototype.fixTaskFile).toHaveBeenCalled();
      // Verify the fixed task was saved
      expect(mockDatabaseService.saveTask).toHaveBeenCalledWith(fixedTaskFile);
      expect(result.id).toBe('test_task_id');
    });
    
    it('should handle validation errors that cannot be fixed', async () => {
      // Create upload request
      const request: UploadTaskRequest = {
        file: Buffer.from(JSON.stringify(mockTaskFile)),
        filename: 'test-task.json'
      };
      
      // Mock parseTaskFile to return the mock task file
      (taskManager as any).parseTaskFile = vi.fn().mockResolvedValue(mockTaskFile);
      
      // Mock validateTaskFile to throw an error
      (TaskValidator.prototype.validateTaskFile as any).mockReturnValue({
        valid: false,
        errors: [{ message: 'Validation error' }],
        warnings: [],
        infos: [],
        fixes: [],
        summary: {
          totalErrors: 1,
          totalWarnings: 0,
          totalInfos: 0,
          totalFixes: 0
        }
      } as ValidationResult);
      
      // Mock TaskValidator.generateValidationSummary
      (TaskValidator.prototype.generateValidationSummary as any).mockReturnValue(
        'Validation failed: Validation error'
      );
      
      // Mock TaskFixer.fixTaskFile to return unfixed task file
      (TaskFixer.prototype.fixTaskFile as any).mockReturnValue({
        fixed: false,
        taskFile: mockTaskFile,
        appliedFixes: []
      });
      
      // Call uploadTask and expect it to throw
      await expect(taskManager.uploadTask(request)).rejects.toThrow('Task upload failed');
      
      // Verify the task fixer was called
      expect(TaskFixer.prototype.fixTaskFile).toHaveBeenCalled();
      // Verify the task was not saved
      expect(mockDatabaseService.saveTask).not.toHaveBeenCalled();
    });
    
    it('should create a temporary file for error analysis', async () => {
      // Create upload request
      const request: UploadTaskRequest = {
        file: Buffer.from(JSON.stringify(mockTaskFile)),
        filename: 'test-task.json'
      };
      
      // Mock parseTaskFile to return the mock task file
      (taskManager as any).parseTaskFile = vi.fn().mockResolvedValue(mockTaskFile);
      
      // Mock createTempFile
      (CleanupHelper.prototype.createTempFile as any).mockResolvedValue('/temp/test-file.json');
      
      // Call uploadTask
      await taskManager.uploadTask(request);
      
      // Verify createTempFile was called
      expect(CleanupHelper.prototype.createTempFile).toHaveBeenCalled();
    });
  });
});