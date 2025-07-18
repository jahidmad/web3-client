/**
 * Task File Parser Tests
 * 
 * Comprehensive tests for the JavaScript task file parser functionality
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TaskFileParser, parseTaskFile, validateTaskFile } from '../task-file-parser';
import { TaskFileValidationContext } from '../../types/task-file-format';

describe('TaskFileParser', () => {
  let parser: TaskFileParser;

  beforeEach(() => {
    parser = new TaskFileParser();
  });

  describe('parseTaskFile', () => {
    it('should parse a valid task file', async () => {
      const validTaskContent = `
/**
 * @name Test Task
 * @description A simple test task
 * @version 1.0.0
 * @author Test Author
 * @category Testing
 * @tags test,example
 * @icon 🧪
 */

const parameters = [
  {
    name: 'url',
    label: 'Target URL',
    type: 'url',
    required: true,
    description: 'The URL to test'
  }
];

const dependencies = [
  'lodash@4.17.21'
];

const config = {
  timeout: 30000,
  retries: 2,
  permissions: ['network']
};

async function execute(context) {
  const { page, params, log, progress, browser, utils } = context;
  
  try {
    log('Starting test task');
    progress(50, 'Processing');
    
    await browser.goto(params.url);
    
    progress(100, 'Completed');
    return { success: true, data: 'Test completed' };
  } catch (error) {
    throw new Error('Test failed: ' + error.message);
  }
}

module.exports = {
  parameters,
  dependencies,
  config,
  execute
};
      `;

      const context: TaskFileValidationContext = {
        filename: 'test-task.js',
        content: validTaskContent,
        size: Buffer.byteLength(validTaskContent),
        encoding: 'utf-8'
      };

      const result = await parser.parseTaskFile(context);

      expect(result.metadata.name).toBe('Test Task');
      expect(result.metadata.description).toBe('A simple test task');
      expect(result.metadata.version).toBe('1.0.0');
      expect(result.metadata.author).toBe('Test Author');
      expect(result.metadata.category).toBe('Testing');
      expect(result.metadata.tags).toEqual(['test', 'example']);
      expect(result.metadata.icon).toBe('🧪');

      expect(result.parameters).toHaveLength(1);
      expect(result.parameters[0].name).toBe('url');
      expect(result.parameters[0].type).toBe('url');

      expect(result.dependencies).toEqual(['lodash@4.17.21']);
      expect(result.config.timeout).toBe(30000);
      expect(result.config.permissions).toEqual(['network']);
    });

    it('should throw error for invalid task file', async () => {
      const invalidTaskContent = `
// Missing JSDoc metadata
const parameters = [];
module.exports = { parameters };
      `;

      const context: TaskFileValidationContext = {
        filename: 'invalid-task.js',
        content: invalidTaskContent,
        size: Buffer.byteLength(invalidTaskContent),
        encoding: 'utf-8'
      };

      await expect(parser.parseTaskFile(context)).rejects.toThrow();
    });
  });

  describe('validateTaskFile', () => {
    it('should validate a correct task file', async () => {
      const validTaskContent = `
/**
 * @name Valid Task
 * @description A valid test task
 * @version 1.0.0
 * @author Test Author
 */

async function execute(context) {
  const { params, log } = context;
  log('Task executed');
  return { success: true };
}

module.exports = { execute };
      `;

      const context: TaskFileValidationContext = {
        filename: 'valid-task.js',
        content: validTaskContent,
        size: Buffer.byteLength(validTaskContent),
        encoding: 'utf-8'
      };

      const result = await parser.validateTaskFile(context);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.metadata?.name).toBe('Valid Task');
    });

    it('should detect missing required metadata', async () => {
      const invalidTaskContent = `
/**
 * @name Test Task
 * @description Missing version and author
 */

async function execute(context) {
  return { success: true };
}

module.exports = { execute };
      `;

      const context: TaskFileValidationContext = {
        filename: 'invalid-metadata.js',
        content: invalidTaskContent,
        size: Buffer.byteLength(invalidTaskContent),
        encoding: 'utf-8'
      };

      const result = await parser.validateTaskFile(context);

      expect(result.valid).toBe(false);
      expect(result.errors.some(error => error.includes('version'))).toBe(true);
      expect(result.errors.some(error => error.includes('author'))).toBe(true);
    });

    it('should detect invalid parameter definitions', async () => {
      const invalidParametersContent = `
/**
 * @name Test Task
 * @description Test task with invalid parameters
 * @version 1.0.0
 * @author Test Author
 */

const parameters = [
  {
    name: 'invalid-name!',
    label: 'Invalid Parameter',
    type: 'invalid-type'
  }
];

async function execute(context) {
  return { success: true };
}

module.exports = { parameters, execute };
      `;

      const context: TaskFileValidationContext = {
        filename: 'invalid-params.js',
        content: invalidParametersContent,
        size: Buffer.byteLength(invalidParametersContent),
        encoding: 'utf-8'
      };

      const result = await parser.validateTaskFile(context);

      expect(result.valid).toBe(false);
      expect(result.errors.some(error => error.includes('name must be a valid identifier'))).toBe(true);
      expect(result.errors.some(error => error.includes('invalid type'))).toBe(true);
    });

    it('should detect security issues', async () => {
      const unsafeTaskContent = `
/**
 * @name Unsafe Task
 * @description Task with security issues
 * @version 1.0.0
 * @author Test Author
 */

async function execute(context) {
  const fs = require('fs');
  eval('dangerous code');
  return { success: true };
}

module.exports = { execute };
      `;

      const context: TaskFileValidationContext = {
        filename: 'unsafe-task.js',
        content: unsafeTaskContent,
        size: Buffer.byteLength(unsafeTaskContent),
        encoding: 'utf-8'
      };

      const result = await parser.validateTaskFile(context);

      expect(result.valid).toBe(false);
      expect(result.securityIssues.length).toBeGreaterThan(0);
    });
  });

  describe('factory functions', () => {
    it('should parse task file using factory function', async () => {
      const taskContent = `
/**
 * @name Factory Test
 * @description Test using factory function
 * @version 1.0.0
 * @author Test Author
 */

async function execute(context) {
  return { success: true };
}

module.exports = { execute };
      `;

      const result = await parseTaskFile('factory-test.js', taskContent);

      expect(result.metadata.name).toBe('Factory Test');
    });

    it('should validate task file using factory function', async () => {
      const taskContent = `
/**
 * @name Validation Test
 * @description Test validation factory function
 * @version 1.0.0
 * @author Test Author
 */

async function execute(context) {
  return { success: true };
}

module.exports = { execute };
      `;

      const result = await validateTaskFile('validation-test.js', taskContent);

      expect(result.valid).toBe(true);
      expect(result.metadata?.name).toBe('Validation Test');
    });
  });

  describe('edge cases', () => {
    it('should handle empty parameters array', async () => {
      const taskContent = `
/**
 * @name Empty Params Task
 * @description Task with empty parameters
 * @version 1.0.0
 * @author Test Author
 */

const parameters = [];

async function execute(context) {
  return { success: true };
}

module.exports = { parameters, execute };
      `;

      const result = await parseTaskFile('empty-params.js', taskContent);

      expect(result.parameters).toEqual([]);
    });

    it('should handle missing optional exports', async () => {
      const taskContent = `
/**
 * @name Minimal Task
 * @description Task with only required exports
 * @version 1.0.0
 * @author Test Author
 */

async function execute(context) {
  return { success: true };
}

module.exports = { execute };
      `;

      const result = await parseTaskFile('minimal-task.js', taskContent);

      expect(result.parameters).toEqual([]);
      expect(result.dependencies).toEqual([]);
      expect(result.config).toEqual({});
    });

    it('should handle complex parameter types', async () => {
      const taskContent = `
/**
 * @name Complex Params Task
 * @description Task with complex parameter types
 * @version 1.0.0
 * @author Test Author
 */

const parameters = [
  {
    name: 'selectParam',
    label: 'Select Parameter',
    type: 'select',
    options: [
      { label: 'Option 1', value: 'opt1' },
      { label: 'Option 2', value: 'opt2' }
    ],
    default: 'opt1'
  },
  {
    name: 'numberParam',
    label: 'Number Parameter',
    type: 'number',
    min: 1,
    max: 100,
    default: 50
  }
];

async function execute(context) {
  return { success: true };
}

module.exports = { parameters, execute };
      `;

      const result = await parseTaskFile('complex-params.js', taskContent);

      expect(result.parameters).toHaveLength(2);
      expect(result.parameters[0].type).toBe('select');
      expect(result.parameters[0].options).toHaveLength(2);
      expect(result.parameters[1].type).toBe('number');
      expect(result.parameters[1].min).toBe(1);
      expect(result.parameters[1].max).toBe(100);
    });
  });
});