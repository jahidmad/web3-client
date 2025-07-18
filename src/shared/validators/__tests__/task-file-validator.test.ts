/**
 * Task File Validator Tests
 * 
 * This file contains unit tests for the task file validator component.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TaskFileValidator, validateTaskFile, quickValidateTaskFile } from '../task-file-validator';

import { TaskFile } from '../../types/task-file-format';
import { TaskConfig } from '../../types/plugin-task-system';

describe('TaskFileValidator', () => {
  let validator: TaskFileValidator;

  beforeEach(() => {
    validator = new TaskFileValidator();
  });

  // Helper function to create a valid task file for testing
  function createValidTaskFile(): TaskFile {
    return {
      metadata: {
        name: 'Test Task',
        description: 'This is a test task for validation',
        version: '1.0.0',
        author: 'Test Author',
        category: 'Testing',
        tags: ['test', 'validation'],
        icon: '🧪'
      },
      parameters: [
        {
          name: 'url',
          label: 'URL',
          type: 'url',
          required: true,
          description: 'The URL to process'
        }
      ],
      dependencies: ['axios@1.0.0'],
      config: {
        timeout: 30000,
        retries: 2,
        permissions: ['network']
      },
      code: 'const test = true;',
      executeFunction: `async function execute(context) {
        const { page, params, log, progress, browser } = context;
        try {
          log('Starting task');
          progress(10, 'Initializing');
          await browser.goto(params.url);
          progress(100, 'Complete');
          return { success: true, data: 'Task completed' };
        } catch (error) {
          log('Error: ' + error.message);
          return { success: false, error: error.message };
        }
      }`
    };
  }

  describe('validateTaskFile', () => {
    it('should validate a correct task file', async () => {
      const taskFile = createValidTaskFile();
      const result = await validator.validateTaskFile(taskFile);

      if (!result.valid) {
        console.error('Validation errors:', result.errors);
      }

      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it('should reject task with invalid metadata', async () => {
      const taskFile = createValidTaskFile();
      taskFile.metadata.name = ''; // Invalid empty name

      const result = await validator.validateTaskFile(taskFile);

      expect(result.valid).toBe(false);
      expect(result.errors.some(error => error.includes('name'))).toBe(true);
    });

    it('should reject task with invalid version format', async () => {
      const taskFile = createValidTaskFile();
      taskFile.metadata.version = 'invalid-version';

      const result = await validator.validateTaskFile(taskFile);

      expect(result.valid).toBe(false);
      expect(result.errors.some(error => error.includes('version'))).toBe(true);
    });

    it('should reject task with duplicate parameter names', async () => {
      const taskFile = createValidTaskFile();
      taskFile.parameters = [
        {
          name: 'url',
          label: 'URL',
          type: 'url',
          required: true
        },
        {
          name: 'url', // Duplicate name
          label: 'Another URL',
          type: 'url',
          required: false
        }
      ];

      const result = await validator.validateTaskFile(taskFile);

      expect(result.valid).toBe(false);
      expect(result.errors.some(error => error.includes('duplicate'))).toBe(true);
    });

    it('should reject task with invalid parameter type', async () => {
      const taskFile = createValidTaskFile();
      taskFile.parameters = [
        {
          name: 'test',
          label: 'Test',
          type: 'invalid-type' as any,
          required: true
        }
      ];

      const result = await validator.validateTaskFile(taskFile);

      expect(result.valid).toBe(false);
      expect(result.errors.some(error => error.includes('type'))).toBe(true);
    });

    it('should reject task with invalid select parameter without options', async () => {
      const taskFile = createValidTaskFile();
      taskFile.parameters = [
        {
          name: 'choice',
          label: 'Choice',
          type: 'select',
          required: true
          // Missing options array
        }
      ];

      const result = await validator.validateTaskFile(taskFile);

      expect(result.valid).toBe(false);
      expect(result.errors.some(error => error.includes('options'))).toBe(true);
    });

    it('should reject task with invalid number parameter constraints', async () => {
      const taskFile = createValidTaskFile();
      taskFile.parameters = [
        {
          name: 'count',
          label: 'Count',
          type: 'number',
          min: 100,
          max: 10 // Invalid: min > max
        }
      ];

      const result = await validator.validateTaskFile(taskFile);

      expect(result.valid).toBe(false);
      expect(result.errors.some(error => error.includes('min') && error.includes('max'))).toBe(true);
    });

    it('should reject task with invalid dependency format', async () => {
      const taskFile = createValidTaskFile();
      taskFile.dependencies = [
        'invalid@dependency@format'
      ];

      const result = await validator.validateTaskFile(taskFile);

      expect(result.valid).toBe(false);
      expect(result.errors.some(error => error.includes('dependency'))).toBe(true);
    });

    it('should reject task with non-async execute function', async () => {
      const taskFile = createValidTaskFile();
      taskFile.executeFunction = 'function execute(context) { return true; }'; // Not async

      const result = await validator.validateTaskFile(taskFile);

      expect(result.valid).toBe(false);
      expect(result.errors.some(error => error.includes('async'))).toBe(true);
    });

    it('should warn about unused parameters', async () => {
      const taskFile = createValidTaskFile();
      taskFile.parameters = [
        {
          name: 'unusedParam',
          label: 'Unused Parameter',
          type: 'string',
          required: false
        }
      ];
      // Execute function doesn't use the parameter

      const result = await validator.validateTaskFile(taskFile);

      expect(result.warnings.some(warning => warning.includes('defined but not used'))).toBe(true);
    });

    it('should reject task with invalid config timeout', async () => {
      const taskFile = createValidTaskFile();
      taskFile.config = {
        timeout: -1000, // Invalid negative timeout
        retries: 2,
        permissions: ['network']
      };

      const result = await validator.validateTaskFile(taskFile);

      expect(result.valid).toBe(false);
      expect(result.errors.some(error => error.includes('timeout'))).toBe(true);
    });

    it('should reject task with invalid config retries', async () => {
      const taskFile = createValidTaskFile();
      taskFile.config = {
        timeout: 30000,
        retries: 10, // Invalid: too many retries
        permissions: ['network']
      };

      const result = await validator.validateTaskFile(taskFile);

      expect(result.valid).toBe(false);
      expect(result.errors.some(error => error.includes('retries'))).toBe(true);
    });

    it('should reject task with invalid permissions', async () => {
      const taskFile = createValidTaskFile();
      taskFile.config = {
        timeout: 30000,
        retries: 2,
        permissions: ['invalid-permission'] // Invalid permission
      };

      const result = await validator.validateTaskFile(taskFile);

      expect(result.valid).toBe(false);
      expect(result.errors.some(error => error.includes('permission'))).toBe(true);
    });

    it('should warn about unversioned dependencies', async () => {
      const taskFile = createValidTaskFile();
      taskFile.dependencies = ['lodash']; // No version specified

      const result = await validator.validateTaskFile(taskFile);

      expect(result.warnings.some(warning => warning.includes('consider specifying a version'))).toBe(true);
    });

    it('should reject task with invalid execute function signature', async () => {
      const taskFile = createValidTaskFile();
      taskFile.executeFunction = `async function executeTask(wrongParam) {
        return { success: true };
      }`;

      const result = await validator.validateTaskFile(taskFile);

      expect(result.valid).toBe(false);
      expect(result.errors.some(error => error.includes('execute'))).toBe(true);
    });

    it('should warn about filesystem usage without permission', async () => {
      const taskFile = createValidTaskFile();
      taskFile.executeFunction = `async function execute(context) {
        const { utils } = context;
        await utils.saveFile('test.txt', 'content');
        return { success: true };
      }`;
      taskFile.config = {
        permissions: ['network'] // Missing filesystem permission
      };

      const result = await validator.validateTaskFile(taskFile);

      expect(result.warnings.some(warning => warning.includes('filesystem permission'))).toBe(true);
    });

    it('should reject task with missing context parameter', async () => {
      const taskFile = createValidTaskFile();
      taskFile.executeFunction = 'async function execute() { return { success: true }; }';

      const result = await validator.validateTaskFile(taskFile);

      expect(result.valid).toBe(false);
      expect(result.errors.some(error => error.includes('context'))).toBe(true);
    });

    it('should warn about missing error handling', async () => {
      const taskFile = createValidTaskFile();
      taskFile.executeFunction = 'async function execute(context) { return { success: true }; }';

      const result = await validator.validateTaskFile(taskFile);

      expect(result.warnings.some(warning => warning.includes('should include try/catch error handling'))).toBe(true);
    });

    it('should warn about missing progress reporting', async () => {
      const taskFile = createValidTaskFile();
      taskFile.executeFunction = 'async function execute(context) { const { log } = context; log("test"); return { success: true }; }';

      const result = await validator.validateTaskFile(taskFile);

      expect(result.warnings.some(warning => warning.includes('should report progress'))).toBe(true);
    });

    it('should validate using factory function', async () => {
      const taskFile = createValidTaskFile();
      const result = await validateTaskFile(taskFile);

      expect(result.valid).toBe(true);
    });

    it('should provide quick validation', async () => {
      const taskFile = createValidTaskFile();
      taskFile.metadata.name = ''; // Make it invalid

      const result = await quickValidateTaskFile(taskFile);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should accept task without optional fields', async () => {
      const taskFile = createValidTaskFile();
      taskFile.dependencies = [];

      const result = await validator.validateTaskFile(taskFile);

      expect(result.valid).toBe(true);
    });

    it('should accept task with minimal config', async () => {
      const taskFile = createValidTaskFile();
      taskFile.config = {};

      const result = await validator.validateTaskFile(taskFile);

      expect(result.valid).toBe(true);
    });

    it('should validate a complex task file', async () => {
      const taskFile = createValidTaskFile();
      taskFile.parameters = [
        {
          name: 'url',
          label: 'URL',
          type: 'url',
          required: true,
          description: 'The URL to process'
        },
        {
          name: 'selector',
          label: 'CSS Selector',
          type: 'string',
          required: false,
          default: 'body',
          description: 'The CSS selector to target'
        },
        {
          name: 'format',
          label: 'Output Format',
          type: 'select',
          required: false,
          default: 'text',
          options: [
            { label: 'Text', value: 'text' },
            { label: 'HTML', value: 'html' },
            { label: 'JSON', value: 'json' }
          ]
        }
      ];
      taskFile.dependencies = ['axios@1.0.0', 'cheerio@1.0.0', 'lodash@4.17.21'];
      taskFile.executeFunction = `async function execute(context) {
        const { page, params, log, progress, browser, utils } = context;
        
        try {
          log('Starting extraction task');
          progress(10, 'Navigating to URL');
          
          await browser.goto(params.url);
          await browser.waitForLoad();
          
          progress(30, 'Page loaded');
          
          const selector = params.selector || 'body';
          log(\`Using selector: \${selector}\`);
          
          progress(50, 'Extracting content');
          let content;
          
          switch (params.format) {
            case 'html':
              content = await browser.evaluate(el => el.innerHTML, selector);
              break;
            case 'json':
              content = await browser.evaluate(el => {
                try {
                  return JSON.parse(el.textContent);
                } catch (e) {
                  return { error: 'Invalid JSON', text: el.textContent };
                }
              }, selector);
              break;
            case 'text':
            default:
              content = await browser.getText(selector);
          }
          
          progress(90, 'Processing complete');
          log('Content extracted successfully');
          
          progress(100, 'Task complete');
          return {
            success: true,
            data: content,
            metadata: {
              url: params.url,
              selector,
              format: params.format || 'text',
              timestamp: new Date().toISOString()
            }
          };
        } catch (error) {
          log(\`Error: \${error.message}\`);
          return {
            success: false,
            error: error.message
          };
        }
      }`;

      const result = await validator.validateTaskFile(taskFile);

      if (!result.valid) {
        console.error('Validation errors:', result.errors);
      }

      expect(result.valid).toBe(true);
    });
  });
});