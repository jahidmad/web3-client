import { describe, it, expect, beforeEach } from 'vitest';
import { TaskErrorHandler } from '../../main/services/task-error-handler';
import { TaskFixer } from '../../main/services/task-fixer';
import { CleanupHelper } from '../../main/utils/cleanup-helper';
import * as fs from 'fs/promises';
import * as path from 'path';

// Mock fs/promises
vi.mock('fs/promises', () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
  unlink: vi.fn().mockResolvedValue(undefined),
  rm: vi.fn().mockResolvedValue(undefined)
}));

describe('Error Handling and Recovery Integration', () => {
  let errorHandler: TaskErrorHandler;
  let fixer: TaskFixer;
  let cleanupHelper: CleanupHelper;
  
  beforeEach(() => {
    errorHandler = new TaskErrorHandler();
    fixer = new TaskFixer();
    cleanupHelper = new CleanupHelper();
    vi.clearAllMocks();
  });
  
  describe('error handling and recovery workflow', () => {
    it('should handle and enhance JSON parsing errors', () => {
      // Create an invalid JSON string
      const invalidJson = '{"name": "Test Task", "description": "Test description",}'; // Trailing comma
      
      // Create an error
      const error = new SyntaxError('Unexpected token } in JSON at position 54');
      
      // Handle the error
      const enhancedError = errorHandler.handleParsingError(error, invalidJson, 'test-task.json');
      
      // Check that the error message is enhanced
      expect(enhancedError.message).toContain('JSON');
      expect(enhancedError.message).toContain('position 54');
      expect(enhancedError.message).toContain('错误位置附近的内容');
      expect(enhancedError.message).toContain('文件名: test-task.json');
      
      // Try to recover from the error
      const parsingError = {
        type: 'json_format_error',
        message: 'Invalid JSON',
        suggestion: 'Fix JSON format'
      };
      
      const fixedContent = errorHandler.tryRecoverFromError(parsingError, invalidJson);
      
      // Check that the content was fixed
      expect(fixedContent).not.toBeNull();
      if (fixedContent) {
        // Should be valid JSON now
        expect(() => JSON.parse(fixedContent)).not.toThrow();
      }
    });
    
    it('should handle and enhance JSDoc parsing errors', () => {
      // Create a file with JSDoc errors
      const invalidJSDoc = `
/**
 * This is a task file with missing metadata tag
 * @parameters
 */
function execute(context) {
  // Task logic
}
      `;
      
      // Create an error
      const error = new Error('Missing required @metadata tag in JSDoc');
      
      // Handle the error
      const enhancedError = errorHandler.handleParsingError(error, invalidJSDoc, 'test-task.js');
      
      // Check that the error message is enhanced
      expect(enhancedError.message).toContain('JSDoc');
      expect(enhancedError.message).toContain('@metadata');
      expect(enhancedError.message).toContain('正确的JSDoc格式示例');
      expect(enhancedError.message).toContain('文件名: test-task.js');
      
      // Try to recover from the error
      const parsingError = {
        type: 'jsdoc_format_error',
        message: 'Missing @metadata tag',
        suggestion: 'Add @metadata tag'
      };
      
      const fixedContent = errorHandler.tryRecoverFromError(parsingError, invalidJSDoc);
      
      // Check that the content was fixed
      expect(fixedContent).not.toBeNull();
      if (fixedContent) {
        // Should contain @metadata now
        expect(fixedContent).toContain('@metadata');
      }
    });
    
    it('should handle and enhance missing execute function errors', () => {
      // Create a file with missing execute function
      const missingExecute = `
/**
 * @metadata
 * @name Test Task
 * @description Test description
 * @version 1.0.0
 * @author Test Author
 * 
 * @parameters
 */

function someOtherFunction(context) {
  // Task logic
}
      `;
      
      // Create an error
      const error = new Error('Task code must contain execute function');
      
      // Handle the error
      const enhancedError = errorHandler.handleParsingError(error, missingExecute, 'test-task.js');
      
      // Check that the error message is enhanced
      expect(enhancedError.message).toContain('execute函数');
      expect(enhancedError.message).toContain('someOtherFunction');
      expect(enhancedError.message).toContain('文件名: test-task.js');
      
      // Try to recover from the error
      const parsingError = {
        type: 'missing_execute_function',
        message: 'Missing execute function',
        suggestion: 'Add execute function'
      };
      
      const fixedContent = errorHandler.tryRecoverFromError(parsingError, missingExecute);
      
      // Check that the content was fixed
      expect(fixedContent).not.toBeNull();
      if (fixedContent) {
        // Should contain execute function now
        expect(fixedContent).toContain('function execute(');
      }
    });
    
    it('should clean up temporary resources after errors', async () => {
      // Register some temporary resources
      const tempFilePath = path.join(process.cwd(), 'temp', 'test-file.tmp');
      const tempDirPath = path.join(process.cwd(), 'temp', 'test-dir');
      
      cleanupHelper.registerTempFile(tempFilePath);
      cleanupHelper.registerTempDir(tempDirPath);
      
      // Clean up resources
      await cleanupHelper.cleanup();
      
      // Check that cleanup was called
      expect(fs.unlink).toHaveBeenCalledWith(tempFilePath);
      expect(fs.rm).toHaveBeenCalledWith(tempDirPath, { recursive: true, force: true });
    });
    
    it('should create and manage temporary files for error analysis', async () => {
      // Create a temporary file
      const content = 'Test content';
      const extension = '.js';
      
      const tempFilePath = await cleanupHelper.createTempFile(content, extension);
      
      // Check that the file was created
      expect(fs.mkdir).toHaveBeenCalled();
      expect(fs.writeFile).toHaveBeenCalledWith(tempFilePath, content);
      
      // Check that the file was registered for cleanup
      await cleanupHelper.cleanup();
      expect(fs.unlink).toHaveBeenCalledWith(tempFilePath);
    });
  });
});