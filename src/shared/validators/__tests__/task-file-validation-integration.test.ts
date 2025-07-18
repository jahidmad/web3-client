/**
 * Task File Validation Integration Tests
 * 
 * This file contains integration tests between the task file parser and validator.
 */

import { describe, it, expect } from 'vitest';
import { validateTaskFile } from '../task-file-validator';
import { TaskFileValidationContext } from '../../types/task-file-format';

describe('Task File Validation Integration', () => {
  // Sample valid task file content
  const validTaskFile = `/**
 * @name Test Task
 * @description This is a test task for validation
 * @version 1.0.0
 * @author Test Author
 * @category Testing
 * @tags test,validation
 * @icon 🧪
 */

// Task parameters
const parameters = [
  {
    name: 'url',
    label: 'URL',
    type: 'url',
    required: true,
    description: 'The URL to process'
  }
];

// Task dependencies
const dependencies = ['axios@1.0.0'];

// Task configuration
const config = {
  timeout: 30000,
  retries: 2,
  permissions: ['network']
};

// Main execution function
async function execute(context) {
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
}

// Export task components
module.exports = { parameters, dependencies, config, execute };
`;

  // Sample invalid task file content
  const invalidTaskFile = `/**
 * @name 
 * @description This is a test task with missing metadata
 * @version invalid-version
 */

// Missing parameters

// Invalid dependency format
const dependencies = ['invalid@dependency@format'];

// Invalid configuration
const config = {
  timeout: -1000,
  retries: 10
};

// Non-async execute function
function execute() {
  return true;
}

module.exports = { dependencies, config, execute };
`;

  it('should validate a parsed task file', async () => {
    // Mock parsed task file
    const parsedTask = {
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
      code: validTaskFile,
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

    const result = await validateTaskFile(parsedTask);
    
    expect(result.valid).toBe(true);
    expect(result.errors.length).toBe(0);
  });

  it('should reject an invalid parsed task file', async () => {
    // Mock invalid parsed task file
    const parsedTask = {
      metadata: {
        name: '',
        description: 'This is a test task with missing metadata',
        version: 'invalid-version',
        author: 'Test Author'
      },
      parameters: [],
      dependencies: ['invalid@dependency@format'],
      config: {
        timeout: -1000,
        retries: 10
      },
      code: invalidTaskFile,
      executeFunction: 'function execute() { return true; }'
    };

    const result = await validateTaskFile(parsedTask);
    
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some(error => error.includes('name'))).toBe(true);
    expect(result.errors.some(error => error.includes('version'))).toBe(true);
    expect(result.errors.some(error => error.includes('dependency'))).toBe(true);
    expect(result.errors.some(error => error.includes('timeout'))).toBe(true);
    expect(result.errors.some(error => error.includes('retries'))).toBe(true);
    expect(result.errors.some(error => error.includes('async'))).toBe(true);
  });
});