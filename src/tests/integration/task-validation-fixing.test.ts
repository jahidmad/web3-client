import { describe, it, expect, beforeEach } from 'vitest';
import { TaskValidator } from '../../main/services/task-validator';
import { TaskFixer } from '../../main/services/task-fixer';
import { TaskFile } from '../../main/types/task';

describe('Task Validation and Fixing Integration', () => {
  let validator: TaskValidator;
  let fixer: TaskFixer;
  
  beforeEach(() => {
    validator = new TaskValidator();
    fixer = new TaskFixer();
  });
  
  describe('validation and fixing workflow', () => {
    it('should validate and fix a task file with multiple issues', () => {
      // Create a task file with multiple issues
      const taskFileWithIssues: any = {
        metadata: {
          // Missing id
          name: 'Task With Issues',
          // Missing description
          version: 123, // Wrong type
          author: 'Test Author',
          tags: 'test,issues' // Wrong type
        },
        parameters: [
          {
            name: 'param1',
            // Missing label
            type: 'select', // Missing options
            // Missing required
            // Missing description
          }
        ],
        code: `
function execute(context) { // Not async
  console.log('This should use log instead');
  return { success: true };
}
        `,
        // Missing examples
      };
      
      // First, validate the task file
      const validationResult = validator.validateTaskFile(taskFileWithIssues);
      
      // Expect validation to fail
      expect(validationResult.valid).toBe(false);
      expect(validationResult.errors.length).toBeGreaterThan(0);
      
      // Now try to fix the issues
      const fixResult = fixer.fixTaskFile(taskFileWithIssues);
      
      // Expect fixes to be applied
      expect(fixResult.fixed).toBe(true);
      expect(fixResult.appliedFixes.length).toBeGreaterThan(0);
      
      // Validate the fixed task file
      const revalidationResult = validator.validateTaskFile(fixResult.taskFile);
      
      // Expect validation to pass or have fewer errors
      if (revalidationResult.valid) {
        expect(revalidationResult.errors.length).toBe(0);
      } else {
        expect(revalidationResult.errors.length).toBeLessThan(validationResult.errors.length);
      }
      
      // Check that specific issues were fixed
      const fixedTask = fixResult.taskFile;
      
      // Check metadata fixes
      expect(fixedTask.metadata.id).toBeDefined();
      expect(typeof fixedTask.metadata.version).toBe('string');
      expect(Array.isArray(fixedTask.metadata.tags)).toBe(true);
      
      // Check parameter fixes
      expect(fixedTask.parameters[0].label).toBeDefined();
      expect(fixedTask.parameters[0].description).toBeDefined();
      expect(fixedTask.parameters[0].required).toBeDefined();
      
      // Check code fixes
      expect(fixedTask.code).toContain('async function execute');
    });
    
    it('should handle a completely valid task file', () => {
      // Create a completely valid task file
      const validTaskFile: TaskFile = {
        metadata: {
          id: 'valid_task',
          name: 'Valid Task',
          description: 'A completely valid task',
          version: '1.0.0',
          author: 'Test Author',
          tags: ['test', 'valid']
        },
        parameters: [
          {
            name: 'param1',
            label: 'Parameter 1',
            type: 'string',
            required: true,
            description: 'A test parameter'
          }
        ],
        code: `
async function execute(context) {
  const { log, progress } = context;
  
  log('Task started');
  progress(50, 'Processing');
  
  return { success: true };
}

module.exports = { parameters, execute };
        `,
        examples: [
          {
            name: 'Example 1',
            parameters: {
              param1: 'test value'
            }
          }
        ]
      };
      
      // Validate the task file
      const validationResult = validator.validateTaskFile(validTaskFile);
      
      // Expect validation to pass
      expect(validationResult.valid).toBe(true);
      expect(validationResult.errors.length).toBe(0);
      
      // Try to fix the task file (should not change anything)
      const fixResult = fixer.fixTaskFile(validTaskFile);
      
      // Expect no fixes to be applied
      expect(fixResult.fixed).toBe(false);
      expect(fixResult.appliedFixes.length).toBe(0);
      
      // The task file should remain unchanged
      expect(fixResult.taskFile).toEqual(validTaskFile);
    });
    
    it('should handle a task file with unfixable issues', () => {
      // Create a task file with unfixable issues
      const unfixableTaskFile: any = {
        // Completely missing metadata
        parameters: 'not an array', // Wrong type
        code: 123, // Wrong type
        examples: 'not an array' // Wrong type
      };
      
      // Validate the task file
      const validationResult = validator.validateTaskFile(unfixableTaskFile);
      
      // Expect validation to fail
      expect(validationResult.valid).toBe(false);
      expect(validationResult.errors.length).toBeGreaterThan(0);
      
      // Try to fix the task file
      const fixResult = fixer.fixTaskFile(unfixableTaskFile);
      
      // Expect fixes to be applied
      expect(fixResult.fixed).toBe(true);
      expect(fixResult.appliedFixes.length).toBeGreaterThan(0);
      
      // Validate the fixed task file
      const revalidationResult = validator.validateTaskFile(fixResult.taskFile);
      
      // Even after fixing, there might still be issues
      // But the task file should be more valid than before
      expect(revalidationResult.errors.length).toBeLessThan(validationResult.errors.length);
      
      // Check that specific issues were fixed
      const fixedTask = fixResult.taskFile;
      
      // Check that metadata was created
      expect(fixedTask.metadata).toBeDefined();
      
      // Check that parameters was converted to an array
      expect(Array.isArray(fixedTask.parameters)).toBe(true);
      
      // Check that code was converted to a string
      expect(typeof fixedTask.code).toBe('string');
      
      // Check that examples was converted to an array
      expect(Array.isArray(fixedTask.examples)).toBe(true);
    });
    
    it('should generate helpful validation summaries', () => {
      // Create a task file with issues
      const taskFileWithIssues: any = {
        metadata: {
          // Missing id
          name: 'Task With Issues',
          // Missing description
        },
        // Missing parameters
        code: 'function execute() {}' // Not async
      };
      
      // Validate the task file
      const validationResult = validator.validateTaskFile(taskFileWithIssues);
      
      // Generate a validation summary
      const summary = validator.generateValidationSummary(validationResult);
      
      // Check that the summary contains useful information
      expect(summary).toContain('❌ 任务文件验证失败');
      expect(summary).toContain('错误:');
      expect(summary).toMatch(/metadata\.id|id/); // Should mention missing id
      expect(summary).toMatch(/parameters|参数/); // Should mention missing parameters
      expect(summary).toMatch(/async|异步/); // Should mention non-async function
    });
  });
});