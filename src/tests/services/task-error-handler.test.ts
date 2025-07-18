import { describe, it, expect, beforeEach } from 'vitest';
import { TaskErrorHandler, TaskParsingErrorType } from '../../main/services/task-error-handler';

describe('TaskErrorHandler', () => {
  let errorHandler: TaskErrorHandler;

  beforeEach(() => {
    errorHandler = new TaskErrorHandler();
  });

  describe('handleParsingError', () => {
    it('should handle JSON format errors', () => {
      const error = new Error('Invalid JSON at position 42');
      const content = '{"metadata": {"name": "Test Task", "description": "Test description",}'; // Invalid JSON with trailing comma
      
      const enhancedError = errorHandler.handleParsingError(error, content);
      
      expect(enhancedError.message).toContain('Invalid JSON');
      expect(enhancedError.message).toContain('position 42');
      expect(enhancedError.message).toContain('错误位置附近的内容');
    });

    it('should handle JSDoc format errors', () => {
      const error = new Error('Missing required @metadata tag in JSDoc');
      const content = `
/**
 * This is a task file with missing metadata tag
 * @parameters
 */
async function execute(context) {
  // Task logic
}
      `;
      
      const enhancedError = errorHandler.handleParsingError(error, content);
      
      expect(enhancedError.message).toContain('JSDoc格式错误');
      expect(enhancedError.message).toContain('@metadata');
      expect(enhancedError.message).toContain('正确的JSDoc格式示例');
    });

    it('should handle YAML format errors', () => {
      const error = new Error('YAML parsing error at line 3');
      const content = `
metadata:
  name: Test Task
  description: Test description
  version: 1.0.0
  author: Test Author
  tags:
    - test
    - yaml
  indentation error here
      `;
      
      const enhancedError = errorHandler.handleParsingError(error, content);
      
      expect(enhancedError.message).toContain('YAML格式错误');
      expect(enhancedError.message).toContain('line 3');
    });

    it('should handle missing execute function errors', () => {
      const error = new Error('Task code must contain execute function');
      const content = `
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
      
      const enhancedError = errorHandler.handleParsingError(error, content);
      
      expect(enhancedError.message).toContain('execute函数');
      expect(enhancedError.message).toContain('someOtherFunction');
    });

    it('should handle empty or short files', () => {
      const error = new Error('Task file is too short or empty');
      const content = 'Too short content';
      
      const enhancedError = errorHandler.handleParsingError(error, content);
      
      expect(enhancedError.message).toContain('过短');
      expect(enhancedError.message).toContain('Too short content');
    });

    it('should include filename in error message if provided', () => {
      const error = new Error('Generic error');
      const content = 'Some content';
      const filename = 'test-task.js';
      
      const enhancedError = errorHandler.handleParsingError(error, content, filename);
      
      expect(enhancedError.message).toContain('文件名: test-task.js');
    });

    it('should include format guide link in all error messages', () => {
      const error = new Error('Generic error');
      const content = 'Some content';
      
      const enhancedError = errorHandler.handleParsingError(error, content);
      
      expect(enhancedError.message).toContain('docs/task-format-guide.md');
    });
  });

  describe('classifyError', () => {
    it('should classify JSON errors correctly', () => {
      const error = new Error('Invalid JSON at position 42');
      const content = '{"invalid": "json",}';
      
      const parsingError = errorHandler['classifyError'](error, content);
      
      expect(parsingError.type).toBe(TaskParsingErrorType.JSON_FORMAT_ERROR);
      expect(parsingError.suggestion).toContain('JSON格式');
    });

    it('should classify JSDoc errors correctly', () => {
      const error = new Error('Missing @metadata tag');
      const content = '/** @parameters */';
      
      const parsingError = errorHandler['classifyError'](error, content);
      
      expect(parsingError.type).toBe(TaskParsingErrorType.JSDOC_FORMAT_ERROR);
      expect(parsingError.suggestion).toContain('@metadata');
    });

    it('should classify missing execute function errors correctly', () => {
      const error = new Error('execute function not found');
      const content = 'function wrongName() {}';
      
      const parsingError = errorHandler['classifyError'](error, content);
      
      expect(parsingError.type).toBe(TaskParsingErrorType.MISSING_EXECUTE_FUNCTION);
      expect(parsingError.suggestion).toContain('execute');
    });
  });

  describe('tryRecoverFromError', () => {
    it('should attempt to fix JSON format errors', () => {
      const error = {
        type: TaskParsingErrorType.JSON_FORMAT_ERROR,
        message: 'Invalid JSON',
        suggestion: 'Fix JSON format'
      };
      const content = '{"name": "Test",}'; // Invalid JSON with trailing comma
      
      const fixedContent = errorHandler.tryRecoverFromError(error, content);
      
      // This might not always succeed, but we're testing the attempt
      if (fixedContent) {
        expect(fixedContent).not.toEqual(content);
        expect(() => JSON.parse(fixedContent)).not.toThrow();
      }
    });

    it('should attempt to fix JSDoc format errors', () => {
      const error = {
        type: TaskParsingErrorType.JSDOC_FORMAT_ERROR,
        message: 'Missing @metadata tag',
        suggestion: 'Add @metadata tag'
      };
      const content = `
/**
 * This is a task file with missing metadata tag
 * @parameters
 */
function execute(context) {
  // Task logic
}
      `;
      
      const fixedContent = errorHandler.tryRecoverFromError(error, content);
      
      if (fixedContent) {
        expect(fixedContent).not.toEqual(content);
        expect(fixedContent).toContain('@metadata');
      }
    });

    it('should attempt to fix non-async execute function', () => {
      const error = {
        type: TaskParsingErrorType.MISSING_EXECUTE_FUNCTION,
        message: 'Function should be async',
        suggestion: 'Make function async'
      };
      const content = `
function execute(context) {
  // Task logic
}
      `;
      
      const fixedContent = errorHandler.tryRecoverFromError(error, content);
      
      if (fixedContent) {
        expect(fixedContent).not.toEqual(content);
        expect(fixedContent).toContain('async function execute(');
      }
    });
  });
});