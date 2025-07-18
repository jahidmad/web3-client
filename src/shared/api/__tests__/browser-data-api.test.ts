/**
 * Browser Data API Tests
 * 
 * This file contains tests for the browser data extraction API.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BrowserDataAPI, createBrowserDataAPI } from '../browser-data-api';
import { TaskPage } from '../../engines/task-execution-engine';

describe('BrowserDataAPI', () => {
  let mockPage: TaskPage;
  let dataAPI: BrowserDataAPI;
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

    // Create data API instance
    dataAPI = createBrowserDataAPI(mockPage, mockLogger);
  });

  describe('getText', () => {
    it('should extract text from an element', async () => {
      mockPage.evaluate = vi.fn().mockResolvedValue('Hello World');

      const text = await dataAPI.getText('#element');

      expect(text).toBe('Hello World');
      expect(mockPage.evaluate).toHaveBeenCalled();
      expect(mockLogger).toHaveBeenCalledWith('Getting text from element: #element', 'info');
    });

    it('should extract value from input element', async () => {
      mockPage.evaluate = vi.fn().mockResolvedValue('input value');

      const text = await dataAPI.getText('#input');

      expect(text).toBe('input value');
    });

    it('should throw error when element not found', async () => {
      mockPage.evaluate = vi.fn().mockRejectedValue(new Error('Element not found: #missing'));

      await expect(dataAPI.getText('#missing')).rejects.toThrow('Failed to get text from element #missing');
      expect(mockLogger).toHaveBeenCalledWith(
        expect.stringContaining('Failed to get text from #missing'),
        'error'
      );
    });
  });

  describe('getTextAll', () => {
    it('should extract text from multiple elements', async () => {
      mockPage.evaluate = vi.fn().mockResolvedValue(['Text 1', 'Text 2', 'Text 3']);

      const texts = await dataAPI.getTextAll('.items');

      expect(texts).toEqual(['Text 1', 'Text 2', 'Text 3']);
      expect(mockPage.evaluate).toHaveBeenCalled();
      expect(mockLogger).toHaveBeenCalledWith('Getting text from all elements: .items', 'info');
    });

    it('should throw error when no elements found', async () => {
      mockPage.evaluate = vi.fn().mockRejectedValue(new Error('No elements found: .missing'));

      await expect(dataAPI.getTextAll('.missing')).rejects.toThrow('Failed to get text from all elements .missing');
    });
  });

  describe('getHTML', () => {
    it('should extract HTML from an element', async () => {
      const mockHTML = '<div><span>Content</span></div>';
      mockPage.evaluate = vi.fn().mockResolvedValue(mockHTML);

      const html = await dataAPI.getHTML('#container');

      expect(html).toBe(mockHTML);
      expect(mockPage.evaluate).toHaveBeenCalled();
      expect(mockLogger).toHaveBeenCalledWith('Getting HTML from element: #container', 'info');
    });
  });

  describe('getAttribute', () => {
    it('should extract attribute value from an element', async () => {
      mockPage.evaluate = vi.fn().mockResolvedValue('https://example.com');

      const href = await dataAPI.getAttribute('#link', 'href');

      expect(href).toBe('https://example.com');
      expect(mockPage.evaluate).toHaveBeenCalledWith(
        expect.any(Function),
        '#link',
        'href'
      );
      expect(mockLogger).toHaveBeenCalledWith('Getting attribute "href" from element: #link', 'info');
    });

    it('should return empty string for missing attribute', async () => {
      mockPage.evaluate = vi.fn().mockResolvedValue('');

      const value = await dataAPI.getAttribute('#element', 'missing');

      expect(value).toBe('');
    });
  });

  describe('getAttributes', () => {
    it('should extract multiple attributes from an element', async () => {
      const mockAttributes = { href: 'https://example.com', title: 'Example Link', class: 'link' };
      mockPage.evaluate = vi.fn().mockResolvedValue(mockAttributes);

      const attributes = await dataAPI.getAttributes('#link', ['href', 'title', 'class']);

      expect(attributes).toEqual(mockAttributes);
      expect(mockPage.evaluate).toHaveBeenCalledWith(
        expect.any(Function),
        '#link',
        ['href', 'title', 'class']
      );
    });
  });

  describe('getTable', () => {
    it('should extract table data as 2D array', async () => {
      const mockTableData = [
        ['Header 1', 'Header 2', 'Header 3'],
        ['Row 1 Col 1', 'Row 1 Col 2', 'Row 1 Col 3'],
        ['Row 2 Col 1', 'Row 2 Col 2', 'Row 2 Col 3']
      ];
      mockPage.evaluate = vi.fn().mockResolvedValue(mockTableData);

      const tableData = await dataAPI.getTable('#table');

      expect(tableData).toEqual(mockTableData);
      expect(mockPage.evaluate).toHaveBeenCalled();
      expect(mockLogger).toHaveBeenCalledWith('Extracting table data from: #table', 'info');
    });

    it('should throw error when element is not a table', async () => {
      mockPage.evaluate = vi.fn().mockRejectedValue(new Error('Element is not a table: #div'));

      await expect(dataAPI.getTable('#div')).rejects.toThrow('Failed to extract table from #div');
    });
  });

  describe('getTableAsObjects', () => {
    it('should extract table data as objects with header mapping', async () => {
      const mockTableData = [
        ['Name', 'Age', 'City'],
        ['John', '25', 'New York'],
        ['Jane', '30', 'Los Angeles']
      ];
      mockPage.evaluate = vi.fn().mockResolvedValue(mockTableData);

      const objects = await dataAPI.getTableAsObjects('#table');

      expect(objects).toEqual([
        { Name: 'John', Age: '25', City: 'New York' },
        { Name: 'Jane', Age: '30', City: 'Los Angeles' }
      ]);
    });

    it('should return empty array for empty table', async () => {
      mockPage.evaluate = vi.fn().mockResolvedValue([]);

      const objects = await dataAPI.getTableAsObjects('#empty-table');

      expect(objects).toEqual([]);
    });
  });

  describe('getFormData', () => {
    it('should extract form data', async () => {
      const mockFormData = {
        name: 'John Doe',
        email: 'john@example.com',
        age: '25'
      };
      mockPage.evaluate = vi.fn().mockResolvedValue(mockFormData);

      const formData = await dataAPI.getFormData('#form');

      expect(formData).toEqual(mockFormData);
      expect(mockPage.evaluate).toHaveBeenCalled();
      expect(mockLogger).toHaveBeenCalledWith('Extracting form data from: #form', 'info');
    });

    it('should throw error when element is not a form', async () => {
      mockPage.evaluate = vi.fn().mockRejectedValue(new Error('Element is not a form: #div'));

      await expect(dataAPI.getFormData('#div')).rejects.toThrow('Failed to extract form data from #div');
    });
  });

  describe('getListItems', () => {
    it('should extract list items', async () => {
      const mockItems = ['Item 1', 'Item 2', 'Item 3'];
      mockPage.evaluate = vi.fn().mockResolvedValue(mockItems);

      const items = await dataAPI.getListItems('#list');

      expect(items).toEqual(mockItems);
      expect(mockPage.evaluate).toHaveBeenCalled();
      expect(mockLogger).toHaveBeenCalledWith('Extracting list items from: #list', 'info');
    });

    it('should throw error when element is not a list', async () => {
      mockPage.evaluate = vi.fn().mockRejectedValue(new Error('Element is not a list: #div'));

      await expect(dataAPI.getListItems('#div')).rejects.toThrow('Failed to extract list items from #div');
    });
  });

  describe('getLinks', () => {
    it('should extract links from the page', async () => {
      const mockLinks = [
        { text: 'Home', href: 'https://example.com/', title: 'Home Page' },
        { text: 'About', href: 'https://example.com/about', title: undefined },
        { text: 'Contact', href: 'https://example.com/contact', title: 'Contact Us' }
      ];
      mockPage.evaluate = vi.fn().mockResolvedValue(mockLinks);

      const links = await dataAPI.getLinks('a');

      expect(links).toEqual(mockLinks);
      expect(mockPage.evaluate).toHaveBeenCalled();
      expect(mockLogger).toHaveBeenCalledWith('Extracting links from: a', 'info');
    });

    it('should use default selector for links', async () => {
      const mockLinks = [{ text: 'Link', href: 'https://example.com/', title: undefined }];
      mockPage.evaluate = vi.fn().mockResolvedValue(mockLinks);

      const links = await dataAPI.getLinks();

      expect(links).toEqual(mockLinks);
      expect(mockPage.evaluate).toHaveBeenCalledWith(expect.any(Function), 'a');
    });

    it('should throw error when no links found', async () => {
      mockPage.evaluate = vi.fn().mockRejectedValue(new Error('No links found: .missing'));

      await expect(dataAPI.getLinks('.missing')).rejects.toThrow('Failed to extract links from .missing');
    });
  });

  describe('error handling', () => {
    it('should handle page evaluation errors gracefully', async () => {
      mockPage.evaluate = vi.fn().mockRejectedValue(new Error('Page evaluation failed'));

      await expect(dataAPI.getText('#element')).rejects.toThrow('Failed to get text from element #element');
      expect(mockLogger).toHaveBeenCalledWith(
        expect.stringContaining('Failed to get text from #element'),
        'error'
      );
    });

    it('should handle timeout in wait operations', async () => {
      // Mock the internal waitForElement to throw timeout error
      mockPage.evaluate = vi.fn().mockResolvedValue(false);

      await expect(dataAPI.getText('#element', { timeout: 50 }))
        .rejects.toThrow('Failed to get text from element #element');
    });
  });

  describe('factory function', () => {
    it('should create browser data API instance', () => {
      const api = createBrowserDataAPI(mockPage, mockLogger);
      expect(api).toBeInstanceOf(BrowserDataAPI);
    });

    it('should work without logger', () => {
      const api = createBrowserDataAPI(mockPage);
      expect(api).toBeInstanceOf(BrowserDataAPI);
    });
  });
});