import { describe, it, expect, beforeEach } from 'vitest';
import { TaskFixer } from '../../main/services/task-fixer';
import { TaskFile } from '../../main/types/task';

describe('TaskFixer', () => {
  let fixer: TaskFixer;
  let validTaskFile: TaskFile;
  let invalidTaskFile: TaskFile;

  beforeEach(() => {
    fixer = new TaskFixer();
    
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
    
    // 创建一个无效的任务文件用于测试修复功能
    invalidTaskFile = {
      metadata: {
        // Missing id
        name: 'Test Task',
        // Missing description
        version: 123, // Invalid type
        author: 'Test Author',
        tags: 'test,unit-test' // Invalid type
      },
      parameters: [
        {
          name: 'testParam',
          // Missing label
          type: 'select', // Missing options
          // Missing required
          // Missing description
        }
      ],
      code: `
function execute(context) { // Not async
  // Task logic here
  console.log('test');
  return { success: true };
}
      `,
      examples: 'not an array' // Invalid type
    } as unknown as TaskFile;
  });

  describe('fixTaskFile', () => {
    it('should not modify a valid task file', () => {
      const result = fixer.fixTaskFile(validTaskFile);
      expect(result.fixed).toBe(false);
      expect(result.appliedFixes.length).toBe(0);
      expect(result.taskFile).toEqual(validTaskFile);
    });

    it('should fix missing metadata fields', () => {
      const taskWithMissingFields = {
        ...validTaskFile,
        metadata: {
          name: 'Test Task'
          // Missing other fields
        }
      } as TaskFile;
      
      const result = fixer.fixTaskFile(taskWithMissingFields);
      expect(result.fixed).toBe(true);
      expect(result.appliedFixes.length).toBeGreaterThan(0);
      expect(result.taskFile.metadata.id).toBeDefined();
      expect(result.taskFile.metadata.description).toBeDefined();
      expect(result.taskFile.metadata.version).toBeDefined();
      expect(result.taskFile.metadata.author).toBeDefined();
      expect(result.taskFile.metadata.tags).toBeDefined();
    });

    it('should fix invalid metadata types', () => {
      const taskWithInvalidTypes = {
        ...validTaskFile,
        metadata: {
          ...validTaskFile.metadata,
          version: 123, // Invalid type
          tags: 'test,unit-test' // Invalid type
        }
      } as unknown as TaskFile;
      
      const result = fixer.fixTaskFile(taskWithInvalidTypes);
      expect(result.fixed).toBe(true);
      expect(result.appliedFixes.length).toBeGreaterThan(0);
      expect(typeof result.taskFile.metadata.version).toBe('string');
      expect(Array.isArray(result.taskFile.metadata.tags)).toBe(true);
    });

    it('should fix missing parameters fields', () => {
      const taskWithInvalidParams = {
        ...validTaskFile,
        parameters: [
          {
            name: 'testParam',
            // Missing other fields
          }
        ]
      } as TaskFile;
      
      const result = fixer.fixTaskFile(taskWithInvalidParams);
      expect(result.fixed).toBe(true);
      expect(result.appliedFixes.length).toBeGreaterThan(0);
      expect(result.taskFile.parameters[0].type).toBeDefined();
      expect(result.taskFile.parameters[0].label).toBeDefined();
      expect(result.taskFile.parameters[0].description).toBeDefined();
      expect(result.taskFile.parameters[0].required).toBeDefined();
    });

    it('should fix non-async execute function', () => {
      const taskWithNonAsyncFunction = {
        ...validTaskFile,
        code: `
function execute(context) { // Not async
  // Task logic here
  return { success: true };
}
        `
      };
      
      const result = fixer.fixTaskFile(taskWithNonAsyncFunction);
      expect(result.fixed).toBe(true);
      expect(result.appliedFixes.length).toBeGreaterThan(0);
      expect(result.taskFile.code).toContain('async function execute(');
    });

    it('should fix missing execute function', () => {
      const taskWithoutExecuteFunction = {
        ...validTaskFile,
        code: `
function someOtherFunction(context) {
  // Task logic here
  return { success: true };
}
        `
      };
      
      const result = fixer.fixTaskFile(taskWithoutExecuteFunction);
      expect(result.fixed).toBe(true);
      expect(result.appliedFixes.length).toBeGreaterThan(0);
      expect(result.taskFile.code).toContain('function execute(');
    });

    it('should fix multiple issues in a single task file', () => {
      const result = fixer.fixTaskFile(invalidTaskFile);
      expect(result.fixed).toBe(true);
      expect(result.appliedFixes.length).toBeGreaterThan(3); // Multiple fixes
      
      // Check that all issues were fixed
      expect(result.taskFile.metadata.id).toBeDefined();
      expect(result.taskFile.metadata.description).toBeDefined();
      expect(typeof result.taskFile.metadata.version).toBe('string');
      expect(Array.isArray(result.taskFile.metadata.tags)).toBe(true);
      
      expect(result.taskFile.parameters[0].label).toBeDefined();
      expect(result.taskFile.parameters[0].description).toBeDefined();
      expect(result.taskFile.parameters[0].required).toBeDefined();
      
      expect(result.taskFile.code).toContain('async function execute(');
      
      expect(Array.isArray(result.taskFile.examples)).toBe(true);
    });
  });
});