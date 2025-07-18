/**
 * Browser Element API Tests
 * 
 * This file contains tests for the browser element interaction API.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BrowserElementAPI, createBrowserElementAPI } from '../browser-element-api';
import { TaskPage } from '../../engines/task-execution-engine';

describe('BrowserElementAPI', () => {
  let mockPage: TaskPage;
  let elementAPI: BrowserElementAPI;
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

    // Create element API instance
    elementAPI = createBrowserElementAPI(mockPage, mockLogger);
  });

  describe('click', () => {
    it('should click an element successfully', async () => {
      // Mock successful element click
      mockPage.evaluate = vi.fn().mockResolvedValue(undefined);

      const result = await elementAPI.click('#button');

      expect(result.success).toBe(true);
      expect(result.selector).toBe('#button');
      expect(result.action).toBe('click');
      expect(mockPage.evaluate).toHaveBeenCalled();
      expect(mockLogger).toHaveBeenCalledWith('Clicking element: #button', 'info');
    });

    it('should handle click with options', async () => {
      mockPage.evaluate = vi.fn().mockResolvedValue(undefined);

      const result = await elementAPI.click('#button', {
        button: 'right',
        clickCount: 2,
        delay: 100,
        force: true
      });

      expect(result.success).toBe(true);
      expect(mockPage.evaluate).toHaveBeenCalledWith(
        expect.any(Function),
        '#button',
        expect.objectContaining({
          button: 'right',
          clickCount: 2,
          delay: 100,
          force: true
        })
      );
    });

    it('should throw error when element not found', async () => {
      mockPage.evaluate = vi.fn().mockRejectedValue(new Error('Element not found: #missing'));

      await expect(elementAPI.click('#missing')).rejects.toThrow('Failed to click element #missing');
      expect(mockLogger).toHaveBeenCalledWith(
        expect.stringContaining('Click failed on #missing'),
        'error'
      );
    });
  });

  describe('type', () => {
    it('should type text into an element successfully', async () => {
      mockPage.evaluate = vi.fn().mockResolvedValue(undefined);

      const result = await elementAPI.type('#input', 'Hello World');

      expect(result.success).toBe(true);
      expect(result.selector).toBe('#input');
      expect(result.action).toBe('type');
      expect(result.data?.text).toBe('Hello World');
      expect(mockPage.evaluate).toHaveBeenCalled();
      expect(mockLogger).toHaveBeenCalledWith('Typing into element: #input', 'info');
    });

    it('should handle typing with options', async () => {
      mockPage.evaluate = vi.fn().mockResolvedValue(undefined);

      const result = await elementAPI.type('#input', 'Test', {
        delay: 50,
        clear: false
      });

      expect(result.success).toBe(true);
      expect(mockPage.evaluate).toHaveBeenCalledWith(
        expect.any(Function),
        '#input',
        'Test',
        expect.objectContaining({
          delay: 50,
          clear: false
        })
      );
    });

    it('should throw error when element is not typeable', async () => {
      mockPage.evaluate = vi.fn().mockRejectedValue(new Error('Element is not typeable: #div'));

      await expect(elementAPI.type('#div', 'text')).rejects.toThrow('Failed to type into element #div');
    });
  });

  describe('select', () => {
    it('should select option from select element', async () => {
      mockPage.evaluate = vi.fn().mockResolvedValue(['option1']);

      const result = await elementAPI.select('#select', 'option1');

      expect(result.success).toBe(true);
      expect(result.selector).toBe('#select');
      expect(result.action).toBe('select');
      expect(result.data?.selectedValues).toEqual(['option1']);
      expect(mockPage.evaluate).toHaveBeenCalled();
    });

    it('should select multiple options', async () => {
      mockPage.evaluate = vi.fn().mockResolvedValue(['option1', 'option2']);

      const result = await elementAPI.select('#select', ['option1', 'option2']);

      expect(result.success).toBe(true);
      expect(result.data?.selectedValues).toEqual(['option1', 'option2']);
    });

    it('should throw error when option not found', async () => {
      mockPage.evaluate = vi.fn().mockRejectedValue(new Error('Option not found: invalid'));

      await expect(elementAPI.select('#select', 'invalid')).rejects.toThrow('Failed to select option in element #select');
    });
  });

  describe('check', () => {
    it('should check a checkbox', async () => {
      mockPage.evaluate = vi.fn().mockResolvedValue(undefined);

      const result = await elementAPI.check('#checkbox', true);

      expect(result.success).toBe(true);
      expect(result.selector).toBe('#checkbox');
      expect(result.action).toBe('check');
      expect(mockPage.evaluate).toHaveBeenCalledWith(
        expect.any(Function),
        '#checkbox',
        true,
        expect.any(Object)
      );
    });

    it('should uncheck a checkbox', async () => {
      mockPage.evaluate = vi.fn().mockResolvedValue(undefined);

      const result = await elementAPI.check('#checkbox', false);

      expect(result.success).toBe(true);
      expect(result.action).toBe('uncheck');
    });

    it('should throw error when element is not checkbox or radio', async () => {
      mockPage.evaluate = vi.fn().mockRejectedValue(new Error('Element is not a checkbox or radio button'));

      await expect(elementAPI.check('#button', true)).rejects.toThrow('Failed to check element #button');
    });
  });

  describe('focus', () => {
    it('should focus an element', async () => {
      mockPage.evaluate = vi.fn().mockResolvedValue(undefined);

      const result = await elementAPI.focus('#input');

      expect(result.success).toBe(true);
      expect(result.selector).toBe('#input');
      expect(result.action).toBe('focus');
      expect(mockPage.evaluate).toHaveBeenCalled();
    });
  });

  describe('blur', () => {
    it('should blur an element', async () => {
      mockPage.evaluate = vi.fn().mockResolvedValue(undefined);

      const result = await elementAPI.blur('#input');

      expect(result.success).toBe(true);
      expect(result.selector).toBe('#input');
      expect(result.action).toBe('blur');
      expect(mockPage.evaluate).toHaveBeenCalled();
    });
  });

  describe('waitForElement', () => {
    it('should wait for element to appear', async () => {
      // Mock element polling - first call returns false, second returns true
      mockPage.evaluate = vi.fn()
        .mockResolvedValueOnce({ exists: false, visible: false })
        .mockResolvedValueOnce({ exists: true, visible: true });

      const result = await elementAPI.waitForElement('#element');

      expect(result.found).toBe(true);
      expect(result.visible).toBe(true);
      expect(result.selector).toBe('#element');
      expect(mockPage.evaluate).toHaveBeenCalledTimes(2);
    });

    it('should timeout when element does not appear', async () => {
      mockPage.evaluate = vi.fn().mockResolvedValue({ exists: false, visible: false });

      await expect(elementAPI.waitForElement('#missing', { timeout: 100 }))
        .rejects.toThrow('Failed to wait for element #missing');
    });

    it('should wait for element to be hidden', async () => {
      mockPage.evaluate = vi.fn()
        .mockResolvedValueOnce({ exists: true, visible: true })
        .mockResolvedValueOnce({ exists: true, visible: false });

      const result = await elementAPI.waitForElement('#element', { hidden: true });

      expect(result.found).toBe(true);
      expect(result.visible).toBe(false);
    });
  });

  describe('waitForText', () => {
    it('should wait for text to appear', async () => {
      // Mock text polling - first call returns false, second returns true
      mockPage.evaluate = vi.fn()
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true);

      const result = await elementAPI.waitForText('Hello World');

      expect(result.found).toBe(true);
      expect(result.selector).toBe('text:"Hello World"');
      expect(mockPage.evaluate).toHaveBeenCalledTimes(2);
    });

    it('should timeout when text does not appear', async () => {
      mockPage.evaluate = vi.fn().mockResolvedValue(false);

      await expect(elementAPI.waitForText('Missing Text', { timeout: 100 }))
        .rejects.toThrow('Failed to wait for text "Missing Text"');
    });
  });

  describe('error handling', () => {
    it('should handle page evaluation errors gracefully', async () => {
      mockPage.evaluate = vi.fn().mockRejectedValue(new Error('Page evaluation failed'));

      await expect(elementAPI.click('#button')).rejects.toThrow('Failed to click element #button');
      expect(mockLogger).toHaveBeenCalledWith(
        expect.stringContaining('Click failed on #button'),
        'error'
      );
    });

    it('should handle timeout errors in wait operations', async () => {
      mockPage.evaluate = vi.fn().mockResolvedValue({ exists: false, visible: false });

      await expect(elementAPI.waitForElement('#element', { timeout: 50 }))
        .rejects.toThrow('Failed to wait for element #element');
    });
  });

  describe('factory function', () => {
    it('should create browser element API instance', () => {
      const api = createBrowserElementAPI(mockPage, mockLogger);
      expect(api).toBeInstanceOf(BrowserElementAPI);
    });

    it('should work without logger', () => {
      const api = createBrowserElementAPI(mockPage);
      expect(api).toBeInstanceOf(BrowserElementAPI);
    });
  });
});