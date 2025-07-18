import { describe, it, expect, beforeEach } from 'vitest';
import { TaskValidator } from '../../main/services/task-validator';
import { TaskFile } from '../../main/types/task';
import { ValidationSeverity } from '../../main/types/validation';

describe('TaskValidator', () => {
  let validator: TaskValidator;
  let validTaskFile: TaskFile;

  beforeEach(() => {
    validator = new TaskValidator();
    
    // 创建一个有效的任务文件用于测试
    validTaskFile = {
      metadata: {
        id: 'test_task_001',
        name: 'Test Task',
        description: 'A test task for unit testing',
        version: '1.0.0',
        author: 'Test Author',
        tags: ['test', 'unit-test']
      },
      parameters: [
        {
          name: 'testParam',
          label: 'Test Parameter',
          type: 'string',
          required: true,
          description: 'A test parameter'
        }
      ],
      code: `
async function execute(context) {
  const { page, params, log, progress, browser, utils } = context;
  
  log('Task started');
  progress(50, 'Processing');
  
  // Task logic here
  
  progress(100, 'Completed');
  return { success: true, data: {} };
}
      `,
      examples: [
        {
          name: 'Example 1',
          parameters: {
            testParam: 'test value'
          }
        }
      ]
    };
  });

  describe('validateTaskFile', () => {
    it('should validate a valid task file without errors', () => {
      const result = validator.validateTaskFile(validTaskFile);
      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it('should detect missing metadata', () => {
      const invalidTask = { ...validTaskFile, metadata: undefined };
      const result = validator.validateTaskFile(invalidTask as TaskFile);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].path).toBe('metadata');
    });

    it('should detect missing required metadata fields', () => {
      const invalidTask = {
        ...validTaskFile,
        metadata: { ...validTaskFile.metadata, id: undefined }
      };
      const result = validator.validateTaskFile(invalidTask as TaskFile);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.path === 'metadata.id')).toBe(true);
    });

    it('should detect invalid metadata field types', () => {
      const invalidTask = {
        ...validTaskFile,
        metadata: { ...validTaskFile.metadata, name: 123 }
      };
      const result = validator.validateTaskFile(invalidTask as TaskFile);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.path === 'metadata.name')).toBe(true);
    });

    it('should detect missing code', () => {
      const invalidTask = { ...validTaskFile, code: undefined };
      const result = validator.validateTaskFile(invalidTask as TaskFile);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.path === 'code')).toBe(true);
    });

    it('should detect missing execute function', () => {
      const invalidTask = { ...validTaskFile, code: 'function someOtherFunction() {}' };
      const result = validator.validateTaskFile(invalidTask as TaskFile);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.path === 'code')).toBe(true);
    });

    it('should detect invalid parameters array', () => {
      const invalidTask = { ...validTaskFile, parameters: 'not an array' };
      const result = validator.validateTaskFile(invalidTask as TaskFile);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.path === 'parameters')).toBe(true);
    });

    it('should detect invalid parameter fields', () => {
      const invalidTask = {
        ...validTaskFile,
        parameters: [
          { ...validTaskFile.parameters[0], type: undefined }
        ]
      };
      const result = validator.validateTaskFile(invalidTask as TaskFile);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.path?.includes('parameters[0].type'))).toBe(true);
    });

    it('should generate warnings for non-critical issues', () => {
      const taskWithWarnings = {
        ...validTaskFile,
        metadata: {
          ...validTaskFile.metadata,
          name: 'Ab' // Too short name
        },
        code: validTaskFile.code + '\nconsole.log("test");' // Contains console.log
      };
      const result = validator.validateTaskFile(taskWithWarnings);
      expect(result.valid).toBe(true); // Warnings don't make it invalid
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.severity === ValidationSeverity.WARNING)).toBe(true);
    });
  });

  describe('generateValidationSummary', () => {
    it('should generate a summary for a valid task file', () => {
      const result = validator.validateTaskFile(validTaskFile);
      const summary = validator.generateValidationSummary(result);
      expect(summary).toContain('✅ 任务文件验证通过');
    });

    it('should generate a summary for an invalid task file', () => {
      const invalidTask = { ...validTaskFile, metadata: undefined };
      const result = validator.validateTaskFile(invalidTask as TaskFile);
      const summary = validator.generateValidationSummary(result);
      expect(summary).toContain('❌ 任务文件验证失败');
      expect(summary).toContain('错误:');
    });
  });
});