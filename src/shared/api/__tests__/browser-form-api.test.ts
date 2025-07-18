/**
 * Browser Form API Tests
 * 
 * This file contains tests for the browser form operations API.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BrowserFormAPI, createBrowserFormAPI } from '../browser-form-api';
import { TaskPage } from '../../engines/task-execution-engine';

describe('BrowserFormAPI', () => {
  let mockPage: TaskPage;
  let formAPI: BrowserFormAPI;
  let mockLogger: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Create mock page
    mockPage = {
      goto: vi.fn(),
      content: vi.fn(),
      screenshot: vi.fn(),
      pdf: vi.fn(),
      evaluate: vi.fn(),
      close: vi.fn()
    };

    // Create mock logger
    mockLogger = vi.fn();

    // Create form API instance
    formAPI = createBrowserFormAPI(mockPage, mockLogger);
  });

  describe('fillForm', () => {
    it('should fill form with provided data', async () => {
      const mockResult = {
        filledFields: ['name', 'email', 'age'],
        errors: []
      };
      mockPage.evaluate = vi.fn().mockResolvedValue(mockResult);

      const formData = {
        name: 'John Doe',
        email: 'john@example.com',
        age: '25'
      };

      const result = await formAPI.fillForm('#form', formData);

      expect(result.success).toBe(true);
      expect(result.selector).toBe('#form');
      expect(result.action).toBe('fillForm');
      expect(result.data?.filledFields).toEqual(['name', 'email', 'age']);
      expect(mockPage.evaluate).toHaveBeenCalled();
      expect(mockLogger).toHaveBeenCalledWith('Filling form: #form', 'info');
    });

    it('should handle form filling with options', async () => {
      const mockResult = { filledFields: ['name'], errors: [] };
      mockPage.evaluate = vi.fn().mockResolvedValue(mockResult);

      const result = await formAPI.fillForm('#form', { name: 'John' }, {
        clearFirst: false,
        validateRequired: true
      });

      expect(result.success).toBe(true);
      expect(mockPage.evaluate).toHaveBeenCalledWith(
        expect.any(Function),
        '#form',
        { name: 'John' },
        expect.objectContaining({
          clearFirst: false,
          validateRequired: true
        })
      );
    });

    it('should throw error when form filling has errors', async () => {
      const mockResult = {
        filledFields: ['name'],
        errors: ['Field not found: email', 'Required field is empty: phone']
      };
      mockPage.evaluate = vi.fn().mockResolvedValue(mockResult);

      await expect(formAPI.fillForm('#form', { name: 'John', email: 'john@example.com' }))
        .rejects.toThrow('Form filling errors: Field not found: email, Required field is empty: phone');
    });

    it('should submit form after filling when submitAfter option is true', async () => {
      const mockResult = { filledFields: ['name'], errors: [] };
      mockPage.evaluate = vi.fn()
        .mockResolvedValueOnce(mockResult) // fillForm call
        .mockResolvedValueOnce(undefined); // submitForm call

      const result = await formAPI.fillForm('#form', { name: 'John' }, { submitAfter: true });

      expect(result.success).toBe(true);
      expect(mockPage.evaluate).toHaveBeenCalledTimes(2); // fillForm + submitForm
    });
  });

  describe('submitForm', () => {
    it('should submit form successfully', async () => {
      mockPage.evaluate = vi.fn().mockResolvedValue(undefined);

      const result = await formAPI.submitForm('#form');

      expect(result.success).toBe(true);
      expect(result.selector).toBe('#form');
      expect(result.action).toBe('submitForm');
      expect(mockPage.evaluate).toHaveBeenCalled();
      expect(mockLogger).toHaveBeenCalledWith('Submitting form: #form', 'info');
    });

    it('should throw error when form not found', async () => {
      mockPage.evaluate = vi.fn().mockRejectedValue(new Error('Form not found: #missing'));

      await expect(formAPI.submitForm('#missing')).rejects.toThrow('Failed to submit form #missing');
      expect(mockLogger).toHaveBeenCalledWith(
        expect.stringContaining('Failed to submit form #missing'),
        'error'
      );
    });
  });

  describe('resetForm', () => {
    it('should reset form successfully', async () => {
      mockPage.evaluate = vi.fn().mockResolvedValue(undefined);

      const result = await formAPI.resetForm('#form');

      expect(result.success).toBe(true);
      expect(result.selector).toBe('#form');
      expect(result.action).toBe('resetForm');
      expect(mockPage.evaluate).toHaveBeenCalled();
      expect(mockLogger).toHaveBeenCalledWith('Resetting form: #form', 'info');
    });

    it('should throw error when element is not a form', async () => {
      mockPage.evaluate = vi.fn().mockRejectedValue(new Error('Element is not a form: #div'));

      await expect(formAPI.resetForm('#div')).rejects.toThrow('Failed to reset form #div');
    });
  });

  describe('validateForm', () => {
    it('should validate form and return valid result', async () => {
      const mockValidation = { valid: true, errors: [] };
      mockPage.evaluate = vi.fn().mockResolvedValue(mockValidation);

      const validation = await formAPI.validateForm('#form');

      expect(validation.valid).toBe(true);
      expect(validation.errors).toEqual([]);
      expect(mockPage.evaluate).toHaveBeenCalled();
      expect(mockLogger).toHaveBeenCalledWith('Validating form: #form', 'info');
    });

    it('should validate form and return invalid result with errors', async () => {
      const mockValidation = {
        valid: false,
        errors: [
          { field: 'email', message: 'Please enter a valid email address' },
          { field: 'age', message: 'Please enter a number' }
        ]
      };
      mockPage.evaluate = vi.fn().mockResolvedValue(mockValidation);

      const validation = await formAPI.validateForm('#form');

      expect(validation.valid).toBe(false);
      expect(validation.errors).toHaveLength(2);
      expect(validation.errors[0]).toEqual({ field: 'email', message: 'Please enter a valid email address' });
      expect(validation.errors[1]).toEqual({ field: 'age', message: 'Please enter a number' });
    });

    it('should throw error when element is not a form', async () => {
      mockPage.evaluate = vi.fn().mockRejectedValue(new Error('Element is not a form: #div'));

      await expect(formAPI.validateForm('#div')).rejects.toThrow('Failed to validate form #div');
    });
  });

  describe('getFormFields', () => {
    it('should get all form fields and their values', async () => {
      const mockFields = {
        name: 'John Doe',
        email: 'john@example.com',
        age: '25',
        newsletter: 'yes',
        interests: ['coding', 'music']
      };
      mockPage.evaluate = vi.fn().mockResolvedValue(mockFields);

      const fields = await formAPI.getFormFields('#form');

      expect(fields).toEqual(mockFields);
      expect(mockPage.evaluate).toHaveBeenCalled();
      expect(mockLogger).toHaveBeenCalledWith('Getting form fields from: #form', 'info');
    });

    it('should return empty object for form with no fields', async () => {
      mockPage.evaluate = vi.fn().mockResolvedValue({});

      const fields = await formAPI.getFormFields('#empty-form');

      expect(fields).toEqual({});
    });

    it('should throw error when element is not a form', async () => {
      mockPage.evaluate = vi.fn().mockRejectedValue(new Error('Element is not a form: #div'));

      await expect(formAPI.getFormFields('#div')).rejects.toThrow('Failed to get form fields from #div');
    });
  });

  describe('form field handling', () => {
    it('should handle different input types in form filling', async () => {
      const mockResult = {
        filledFields: ['text', 'email', 'password', 'number', 'checkbox', 'radio', 'textarea', 'select'],
        errors: []
      };
      mockPage.evaluate = vi.fn().mockResolvedValue(mockResult);

      const formData = {
        text: 'Text value',
        email: 'test@example.com',
        password: 'secret123',
        number: '42',
        checkbox: true,
        radio: 'option1',
        textarea: 'Long text content',
        select: 'option2'
      };

      const result = await formAPI.fillForm('#complex-form', formData);

      expect(result.success).toBe(true);
      expect(result.data?.filledFields).toHaveLength(8);
    });

    it('should handle multiple select values', async () => {
      const mockResult = { filledFields: ['multiselect'], errors: [] };
      mockPage.evaluate = vi.fn().mockResolvedValue(mockResult);

      const result = await formAPI.fillForm('#form', {
        multiselect: ['option1', 'option2', 'option3']
      });

      expect(result.success).toBe(true);
    });

    it('should handle file input error', async () => {
      const mockResult = {
        filledFields: [],
        errors: ['File input cannot be filled programmatically: fileUpload']
      };
      mockPage.evaluate = vi.fn().mockResolvedValue(mockResult);

      await expect(formAPI.fillForm('#form', { fileUpload: 'file.txt' }))
        .rejects.toThrow('File input cannot be filled programmatically: fileUpload');
    });
  });

  describe('error handling', () => {
    it('should handle page evaluation errors gracefully', async () => {
      mockPage.evaluate = vi.fn().mockRejectedValue(new Error('Page evaluation failed'));

      await expect(formAPI.fillForm('#form', { name: 'John' })).rejects.toThrow('Failed to fill form #form');
      expect(mockLogger).toHaveBeenCalledWith(
        expect.stringContaining('Failed to fill form #form'),
        'error'
      );
    });

    it('should handle timeout in wait operations', async () => {
      // Mock the internal waitForElement to throw timeout error
      mockPage.evaluate = vi.fn().mockResolvedValue(false);

      await expect(formAPI.submitForm('#form', { timeout: 50 }))
        .rejects.toThrow('Failed to submit form #form');
    });
  });

  describe('factory function', () => {
    it('should create browser form API instance', () => {
      const api = createBrowserFormAPI(mockPage, mockLogger);
      expect(api).toBeInstanceOf(BrowserFormAPI);
    });

    it('should work without logger', () => {
      const api = createBrowserFormAPI(mockPage);
      expect(api).toBeInstanceOf(BrowserFormAPI);
    });
  });
});