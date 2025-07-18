/**
 * Comprehensive Browser API Tests
 * 
 * This file contains tests for the comprehensive browser API that combines
 * navigation, element interaction, data extraction, and form operations.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BrowserAPI, createBrowserAPI } from '../browser-api';
import { TaskPage, TaskBrowser } from '../../engines/task-execution-engine';

describe('BrowserAPI', () => {
  let mockPage: TaskPage;
  let mockBrowser: TaskBrowser;
  let browserAPI: BrowserAPI;
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

    // Create mock browser
    mockBrowser = {
      id: 'test-browser',
      name: 'Test Browser',
      isAvailable: vi.fn().mockResolvedValue(true),
      createPage: vi.fn().mockResolvedValue(mockPage)
    };

    // Create mock logger
    mockLogger = vi.fn();

    // Create browser API instance
    browserAPI = createBrowserAPI(mockPage, mockBrowser, mockLogger);
  });

  describe('Navigation Methods', () => {
    beforeEach(() => {
      // Mock navigation API methods to return successful results
      vi.spyOn(browserAPI as any, 'navigationAPI', 'get').mockReturnValue({
        goto: vi.fn().mockResolvedValue({ success: true, url: 'https://example.com' }),
        reload: vi.fn().mockResolvedValue({ success: true }),
        goBack: vi.fn().mockResolvedValue({ success: true }),
        goForward: vi.fn().mockResolvedValue({ success: true }),
        waitForNavigation: vi.fn().mockResolvedValue({ success: true }),
        waitForLoad: vi.fn().mockResolvedValue(undefined),
        waitForReady: vi.fn().mockResolvedValue(undefined),
        waitForIdle: vi.fn().mockResolvedValue(undefined),
        getCurrentUrl: vi.fn().mockResolvedValue('https://example.com'),
        getTitle: vi.fn().mockResolvedValue('Example Page')
      });
    });

    it('should navigate to URL', async () => {
      await browserAPI.goto('https://example.com');
      // Test passes if no error is thrown
    });

    it('should reload page', async () => {
      await browserAPI.reload();
      // Test passes if no error is thrown
    });

    it('should navigate back', async () => {
      await browserAPI.goBack();
      // Test passes if no error is thrown
    });

    it('should navigate forward', async () => {
      await browserAPI.goForward();
      // Test passes if no error is thrown
    });

    it('should wait for navigation', async () => {
      await browserAPI.waitForNavigation();
      // Test passes if no error is thrown
    });

    it('should wait for page load', async () => {
      await browserAPI.waitForLoad(5000);
      // Test passes if no error is thrown
    });

    it('should get current URL', async () => {
      const url = await browserAPI.getUrl();
      expect(url).toBe('https://example.com');
    });

    it('should get page title', async () => {
      const title = await browserAPI.getTitle();
      expect(title).toBe('Example Page');
    });
  });

  describe('Element Interaction Methods', () => {
    beforeEach(() => {
      // Mock element API methods
      vi.spyOn(browserAPI as any, 'elementAPI', 'get').mockReturnValue({
        click: vi.fn().mockResolvedValue({ success: true }),
        type: vi.fn().mockResolvedValue({ success: true }),
        select: vi.fn().mockResolvedValue({ success: true }),
        check: vi.fn().mockResolvedValue({ success: true }),
        focus: vi.fn().mockResolvedValue({ success: true }),
        blur: vi.fn().mockResolvedValue({ success: true }),
        waitForElement: vi.fn().mockResolvedValue({ found: true, visible: true }),
        waitForText: vi.fn().mockResolvedValue({ found: true })
      });
    });

    it('should click element', async () => {
      await browserAPI.click('#button');
      // Test passes if no error is thrown
    });

    it('should type text into element', async () => {
      await browserAPI.type('#input', 'Hello World');
      // Test passes if no error is thrown
    });

    it('should select option from select element', async () => {
      await browserAPI.select('#select', 'option1');
      // Test passes if no error is thrown
    });

    it('should check checkbox', async () => {
      await browserAPI.check('#checkbox', true);
      // Test passes if no error is thrown
    });

    it('should focus element', async () => {
      await browserAPI.focus('#input');
      // Test passes if no error is thrown
    });

    it('should blur element', async () => {
      await browserAPI.blur('#input');
      // Test passes if no error is thrown
    });

    it('should wait for element', async () => {
      await browserAPI.waitFor('#element');
      // Test passes if no error is thrown
    });

    it('should wait for text', async () => {
      await browserAPI.waitForText('Hello World');
      // Test passes if no error is thrown
    });
  });

  describe('Data Extraction Methods', () => {
    beforeEach(() => {
      // Mock data API methods
      vi.spyOn(browserAPI as any, 'dataAPI', 'get').mockReturnValue({
        getText: vi.fn().mockResolvedValue('Sample text'),
        getTextAll: vi.fn().mockResolvedValue(['Text 1', 'Text 2']),
        getHTML: vi.fn().mockResolvedValue('<div>HTML content</div>'),
        getAttribute: vi.fn().mockResolvedValue('attribute value'),
        getAttributes: vi.fn().mockResolvedValue({ href: 'https://example.com', title: 'Link' }),
        getTable: vi.fn().mockResolvedValue([['Header 1', 'Header 2'], ['Row 1', 'Row 2']]),
        getTableAsObjects: vi.fn().mockResolvedValue([{ 'Header 1': 'Row 1', 'Header 2': 'Row 2' }]),
        getListItems: vi.fn().mockResolvedValue(['Item 1', 'Item 2']),
        getLinks: vi.fn().mockResolvedValue([{ text: 'Link', href: 'https://example.com' }]),
        getFormData: vi.fn().mockResolvedValue({ name: 'John', email: 'john@example.com' })
      });
    });

    it('should get text from element', async () => {
      const text = await browserAPI.getText('#element');
      expect(text).toBe('Sample text');
    });

    it('should get text from all matching elements', async () => {
      const texts = await browserAPI.getTextAll('.items');
      expect(texts).toEqual(['Text 1', 'Text 2']);
    });

    it('should get HTML from element', async () => {
      const html = await browserAPI.getHTML('#container');
      expect(html).toBe('<div>HTML content</div>');
    });

    it('should get attribute from element', async () => {
      const value = await browserAPI.getAttribute('#link', 'href');
      expect(value).toBe('attribute value');
    });

    it('should get multiple attributes from element', async () => {
      const attributes = await browserAPI.getAttributes('#link', ['href', 'title']);
      expect(attributes).toEqual({ href: 'https://example.com', title: 'Link' });
    });

    it('should get table data', async () => {
      const table = await browserAPI.getTable('#table');
      expect(table).toEqual([['Header 1', 'Header 2'], ['Row 1', 'Row 2']]);
    });

    it('should get table as objects', async () => {
      const objects = await browserAPI.getTableAsObjects('#table');
      expect(objects).toEqual([{ 'Header 1': 'Row 1', 'Header 2': 'Row 2' }]);
    });

    it('should get list items', async () => {
      const items = await browserAPI.getListItems('#list');
      expect(items).toEqual(['Item 1', 'Item 2']);
    });

    it('should get links', async () => {
      const links = await browserAPI.getLinks('a');
      expect(links).toEqual([{ text: 'Link', href: 'https://example.com' }]);
    });

    it('should get form data', async () => {
      const formData = await browserAPI.getFormData('#form');
      expect(formData).toEqual({ name: 'John', email: 'john@example.com' });
    });
  });

  describe('Form Operations Methods', () => {
    beforeEach(() => {
      // Mock form API methods
      vi.spyOn(browserAPI as any, 'formAPI', 'get').mockReturnValue({
        fillForm: vi.fn().mockResolvedValue({ success: true }),
        submitForm: vi.fn().mockResolvedValue({ success: true }),
        resetForm: vi.fn().mockResolvedValue({ success: true }),
        validateForm: vi.fn().mockResolvedValue({ valid: true, errors: [] }),
        getFormFields: vi.fn().mockResolvedValue({ name: 'John', email: 'john@example.com' })
      });
    });

    it('should fill form', async () => {
      await browserAPI.fillForm('#form', { name: 'John', email: 'john@example.com' });
      // Test passes if no error is thrown
    });

    it('should submit form', async () => {
      await browserAPI.submitForm('#form');
      // Test passes if no error is thrown
    });

    it('should reset form', async () => {
      await browserAPI.resetForm('#form');
      // Test passes if no error is thrown
    });

    it('should validate form', async () => {
      const validation = await browserAPI.validateForm('#form');
      expect(validation.valid).toBe(true);
      expect(validation.errors).toEqual([]);
    });

    it('should get form fields', async () => {
      const fields = await browserAPI.getFormFields('#form');
      expect(fields).toEqual({ name: 'John', email: 'john@example.com' });
    });
  });

  describe('Advanced Operations Methods', () => {
    it('should take screenshot', async () => {
      const mockScreenshot = Buffer.from('screenshot data');
      mockPage.screenshot = vi.fn().mockResolvedValue(mockScreenshot);

      const screenshot = await browserAPI.screenshot({ type: 'png', fullPage: true });

      expect(screenshot).toBe(mockScreenshot);
      expect(mockPage.screenshot).toHaveBeenCalledWith({
        type: 'png',
        quality: 90,
        fullPage: true
      });
    });

    it('should evaluate JavaScript', async () => {
      mockPage.evaluate = vi.fn().mockResolvedValue('evaluation result');

      const result = await browserAPI.evaluate(() => document.title);

      expect(result).toBe('evaluation result');
      expect(mockPage.evaluate).toHaveBeenCalled();
    });

    it('should get page content', async () => {
      mockPage.content = vi.fn().mockResolvedValue('<html><body>Content</body></html>');

      const content = await browserAPI.getContent();

      expect(content).toBe('<html><body>Content</body></html>');
      expect(mockPage.content).toHaveBeenCalled();
    });
  });

  describe('Cookie Operations', () => {
    it('should get cookies', async () => {
      mockPage.evaluate = vi.fn().mockResolvedValue([
        { name: 'session', value: 'abc123' },
        { name: 'theme', value: 'dark' }
      ]);

      const cookies = await browserAPI.getCookies();

      expect(cookies).toEqual([
        { name: 'session', value: 'abc123' },
        { name: 'theme', value: 'dark' }
      ]);
    });

    it('should set cookies', async () => {
      mockPage.evaluate = vi.fn().mockResolvedValue(undefined);

      const cookies = [
        { name: 'session', value: 'abc123' },
        { name: 'theme', value: 'dark' }
      ];

      await browserAPI.setCookies(cookies);

      expect(mockPage.evaluate).toHaveBeenCalledWith(expect.any(Function), cookies);
    });
  });

  describe('Utility Methods', () => {
    it('should sleep for specified time', async () => {
      const startTime = Date.now();
      await browserAPI.sleep(100);
      const endTime = Date.now();

      expect(endTime - startTime).toBeGreaterThanOrEqual(100);
    });

    it('should return underlying page instance', () => {
      const page = browserAPI.getPage();
      expect(page).toBe(mockPage);
    });

    it('should return underlying browser instance', () => {
      const browser = browserAPI.getBrowser();
      expect(browser).toBe(mockBrowser);
    });
  });

  describe('Error Handling', () => {
    it('should handle navigation failures', async () => {
      vi.spyOn(browserAPI as any, 'navigationAPI', 'get').mockReturnValue({
        goto: vi.fn().mockResolvedValue({ success: false, url: 'https://example.com' })
      });

      await expect(browserAPI.goto('https://example.com')).rejects.toThrow('Navigation failed');
    });

    it('should handle screenshot errors', async () => {
      mockPage.screenshot = vi.fn().mockRejectedValue(new Error('Screenshot failed'));

      await expect(browserAPI.screenshot()).rejects.toThrow('Screenshot failed');
      expect(mockLogger).toHaveBeenCalledWith(
        expect.stringContaining('Screenshot failed'),
        'error'
      );
    });

    it('should handle JavaScript evaluation errors', async () => {
      mockPage.evaluate = vi.fn().mockRejectedValue(new Error('Evaluation failed'));

      await expect(browserAPI.evaluate(() => document.title)).rejects.toThrow('Evaluation failed');
      expect(mockLogger).toHaveBeenCalledWith(
        expect.stringContaining('JavaScript evaluation failed'),
        'error'
      );
    });
  });

  describe('Factory Function', () => {
    it('should create browser API instance', () => {
      const api = createBrowserAPI(mockPage, mockBrowser, mockLogger);
      expect(api).toBeInstanceOf(BrowserAPI);
    });

    it('should work without logger', () => {
      const api = createBrowserAPI(mockPage, mockBrowser);
      expect(api).toBeInstanceOf(BrowserAPI);
    });
  });

  describe('Integration', () => {
    it('should combine all APIs into a unified interface', () => {
      // Verify that all expected methods are available
      expect(typeof browserAPI.goto).toBe('function');
      expect(typeof browserAPI.click).toBe('function');
      expect(typeof browserAPI.getText).toBe('function');
      expect(typeof browserAPI.fillForm).toBe('function');
      expect(typeof browserAPI.screenshot).toBe('function');
    });

    it('should maintain consistent error handling across all APIs', async () => {
      // Mock all APIs to throw errors
      vi.spyOn(browserAPI as any, 'navigationAPI', 'get').mockReturnValue({
        goto: vi.fn().mockRejectedValue(new Error('Navigation error'))
      });

      vi.spyOn(browserAPI as any, 'elementAPI', 'get').mockReturnValue({
        click: vi.fn().mockRejectedValue(new Error('Click error'))
      });

      vi.spyOn(browserAPI as any, 'dataAPI', 'get').mockReturnValue({
        getText: vi.fn().mockRejectedValue(new Error('Data extraction error'))
      });

      vi.spyOn(browserAPI as any, 'formAPI', 'get').mockReturnValue({
        fillForm: vi.fn().mockRejectedValue(new Error('Form error'))
      });

      // All should throw appropriate errors
      await expect(browserAPI.goto('https://example.com')).rejects.toThrow();
      await expect(browserAPI.click('#button')).rejects.toThrow();
      await expect(browserAPI.getText('#element')).rejects.toThrow();
      await expect(browserAPI.fillForm('#form', {})).rejects.toThrow();
    });
  });
});