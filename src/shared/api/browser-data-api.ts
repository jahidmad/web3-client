/**
 * Browser Data Extraction API
 * 
 * This module implements the browser data extraction API for plugin tasks,
 * providing methods for extracting text, attributes, tables, and other data from web pages.
 */

import { TaskPage } from '../engines/task-execution-engine';
import { WaitOptions } from '../types/plugin-task-system';
import { TaskError, ErrorCode } from '../types/plugin-task-system';

/**
 * Browser Data Extraction API implementation
 */
export class BrowserDataAPI {
  private page: TaskPage;
  private logger: (message: string, level?: string) => void;

  /**
   * Create a new Browser Data API
   */
  constructor(page: TaskPage, logger?: (message: string, level?: string) => void) {
    this.page = page;
    this.logger = logger || ((message: string) => console.log(message));
  }

  // ============================================================================
  // TEXT EXTRACTION METHODS
  // ============================================================================

  /**
   * Get text content from an element
   */
  async getText(selector: string, options: WaitOptions = {}): Promise<string> {
    try {
      this.logger(`Getting text from element: ${selector}`, 'info');

      // Set default options
      const waitOptions = {
        timeout: options.timeout || 30000,
        visible: options.visible !== false,
        ...options
      };

      // Wait for element if needed
      if (waitOptions.timeout > 0) {
        await this.waitForElement(selector, waitOptions);
      }

      // Extract text using page evaluation
      const text = await this.page.evaluate((sel: string) => {
        const element = document.querySelector(sel);
        if (!element) {
          throw new Error(`Element not found: ${sel}`);
        }

        // Get text content, handling different element types
        if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
          return (element as HTMLInputElement).value;
        } else if (element.tagName === 'SELECT') {
          const selectElement = element as HTMLSelectElement;
          return selectElement.options[selectElement.selectedIndex]?.text || '';
        } else {
          return element.textContent?.trim() || '';
        }
      }, selector) as string;

      this.logger(`Text extracted from ${selector}: "${text}"`, 'info');

      return text;
    } catch (error) {
      this.logger(`Failed to get text from ${selector}: ${error instanceof Error ? error.message : String(error)}`, 'error');

      throw new TaskError(
        ErrorCode.BROWSER_ERROR,
        `Failed to get text from element ${selector}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Get text content from multiple elements
   */
  async getTextAll(selector: string, options: WaitOptions = {}): Promise<string[]> {
    try {
      this.logger(`Getting text from all elements: ${selector}`, 'info');

      // Set default options
      const waitOptions = {
        timeout: options.timeout || 30000,
        ...options
      };

      // Wait for at least one element if needed
      if (waitOptions.timeout > 0) {
        await this.waitForElement(selector, waitOptions);
      }

      // Extract text from all matching elements
      const texts = await this.page.evaluate((sel: string) => {
        const elements = document.querySelectorAll(sel);
        if (elements.length === 0) {
          throw new Error(`No elements found: ${sel}`);
        }

        return Array.from(elements).map(element => {
          if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
            return (element as HTMLInputElement).value;
          } else if (element.tagName === 'SELECT') {
            const selectElement = element as HTMLSelectElement;
            return selectElement.options[selectElement.selectedIndex]?.text || '';
          } else {
            return element.textContent?.trim() || '';
          }
        });
      }, selector) as string[];

      this.logger(`Text extracted from ${texts.length} elements matching ${selector}`, 'info');

      return texts;
    } catch (error) {
      this.logger(`Failed to get text from all ${selector}: ${error instanceof Error ? error.message : String(error)}`, 'error');

      throw new TaskError(
        ErrorCode.BROWSER_ERROR,
        `Failed to get text from all elements ${selector}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Get inner HTML from an element
   */
  async getHTML(selector: string, options: WaitOptions = {}): Promise<string> {
    try {
      this.logger(`Getting HTML from element: ${selector}`, 'info');

      // Set default options
      const waitOptions = {
        timeout: options.timeout || 30000,
        visible: options.visible !== false,
        ...options
      };

      // Wait for element if needed
      if (waitOptions.timeout > 0) {
        await this.waitForElement(selector, waitOptions);
      }

      // Extract HTML using page evaluation
      const html = await this.page.evaluate((sel: string) => {
        const element = document.querySelector(sel);
        if (!element) {
          throw new Error(`Element not found: ${sel}`);
        }

        return element.innerHTML;
      }, selector) as string;

      this.logger(`HTML extracted from ${selector}`, 'info');

      return html;
    } catch (error) {
      this.logger(`Failed to get HTML from ${selector}: ${error instanceof Error ? error.message : String(error)}`, 'error');

      throw new TaskError(
        ErrorCode.BROWSER_ERROR,
        `Failed to get HTML from element ${selector}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  // ============================================================================
  // ATTRIBUTE EXTRACTION METHODS
  // ============================================================================

  /**
   * Get attribute value from an element
   */
  async getAttribute(selector: string, attribute: string, options: WaitOptions = {}): Promise<string> {
    try {
      this.logger(`Getting attribute "${attribute}" from element: ${selector}`, 'info');

      // Set default options
      const waitOptions = {
        timeout: options.timeout || 30000,
        visible: options.visible !== false,
        ...options
      };

      // Wait for element if needed
      if (waitOptions.timeout > 0) {
        await this.waitForElement(selector, waitOptions);
      }

      // Extract attribute using page evaluation
      const value = await this.page.evaluate((sel: string, attr: string) => {
        const element = document.querySelector(sel);
        if (!element) {
          throw new Error(`Element not found: ${sel}`);
        }

        return element.getAttribute(attr) || '';
      }, selector, attribute) as string;

      this.logger(`Attribute "${attribute}" extracted from ${selector}: "${value}"`, 'info');

      return value;
    } catch (error) {
      this.logger(`Failed to get attribute "${attribute}" from ${selector}: ${error instanceof Error ? error.message : String(error)}`, 'error');

      throw new TaskError(
        ErrorCode.BROWSER_ERROR,
        `Failed to get attribute "${attribute}" from element ${selector}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Get multiple attributes from an element
   */
  async getAttributes(selector: string, attributes: string[], options: WaitOptions = {}): Promise<Record<string, string>> {
    try {
      this.logger(`Getting attributes [${attributes.join(', ')}] from element: ${selector}`, 'info');

      // Set default options
      const waitOptions = {
        timeout: options.timeout || 30000,
        visible: options.visible !== false,
        ...options
      };

      // Wait for element if needed
      if (waitOptions.timeout > 0) {
        await this.waitForElement(selector, waitOptions);
      }

      // Extract attributes using page evaluation
      const values = await this.page.evaluate((sel: string, attrs: string[]) => {
        const element = document.querySelector(sel);
        if (!element) {
          throw new Error(`Element not found: ${sel}`);
        }

        const result: Record<string, string> = {};
        attrs.forEach((attr: string) => {
          result[attr] = element.getAttribute(attr) || '';
        });

        return result;
      }, selector, attributes) as Record<string, string>;

      this.logger(`Attributes extracted from ${selector}:`, 'info');

      return values;
    } catch (error) {
      this.logger(`Failed to get attributes from ${selector}: ${error instanceof Error ? error.message : String(error)}`, 'error');

      throw new TaskError(
        ErrorCode.BROWSER_ERROR,
        `Failed to get attributes from element ${selector}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  // ============================================================================
  // TABLE EXTRACTION METHODS
  // ============================================================================

  /**
   * Extract table data as a 2D array
   */
  async getTable(selector: string, options: WaitOptions = {}): Promise<string[][]> {
    try {
      this.logger(`Extracting table data from: ${selector}`, 'info');

      // Set default options
      const waitOptions = {
        timeout: options.timeout || 30000,
        visible: options.visible !== false,
        ...options
      };

      // Wait for element if needed
      if (waitOptions.timeout > 0) {
        await this.waitForElement(selector, waitOptions);
      }

      // Extract table data using page evaluation
      const tableData = await this.page.evaluate((sel: string) => {
        const table = document.querySelector(sel);
        if (!table) {
          throw new Error(`Table not found: ${sel}`);
        }

        if (table.tagName !== 'TABLE') {
          throw new Error(`Element is not a table: ${sel}`);
        }

        const rows: string[][] = [];
        const tableRows = table.querySelectorAll('tr');

        tableRows.forEach((row: Element) => {
          const cells: string[] = [];
          const tableCells = row.querySelectorAll('td, th');
          
          tableCells.forEach((cell: Element) => {
            cells.push(cell.textContent?.trim() || '');
          });
          
          if (cells.length > 0) {
            rows.push(cells);
          }
        });

        return rows;
      }, selector) as string[][];

      this.logger(`Table data extracted from ${selector}: ${tableData.length} rows`, 'info');

      return tableData;
    } catch (error) {
      this.logger(`Failed to extract table from ${selector}: ${error instanceof Error ? error.message : String(error)}`, 'error');

      throw new TaskError(
        ErrorCode.BROWSER_ERROR,
        `Failed to extract table from ${selector}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Extract table data as objects with header mapping
   */
  async getTableAsObjects(selector: string, options: WaitOptions = {}): Promise<Record<string, string>[]> {
    try {
      this.logger(`Extracting table as objects from: ${selector}`, 'info');

      // Get table data as 2D array
      const tableData = await this.getTable(selector, options);

      if (tableData.length === 0) {
        return [];
      }

      // Use first row as headers
      const headers = tableData[0];
      const dataRows = tableData.slice(1);

      // Convert to objects
      const objects = dataRows.map(row => {
        const obj: Record<string, string> = {};
        headers.forEach((header, index) => {
          obj[header] = row[index] || '';
        });
        return obj;
      });

      this.logger(`Table converted to ${objects.length} objects`, 'info');

      return objects;
    } catch (error) {
      this.logger(`Failed to extract table as objects from ${selector}: ${error instanceof Error ? error.message : String(error)}`, 'error');

      throw new TaskError(
        ErrorCode.BROWSER_ERROR,
        `Failed to extract table as objects from ${selector}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  // ============================================================================
  // FORM DATA EXTRACTION METHODS
  // ============================================================================

  /**
   * Extract form data
   */
  async getFormData(selector: string, options: WaitOptions = {}): Promise<Record<string, any>> {
    try {
      this.logger(`Extracting form data from: ${selector}`, 'info');

      // Set default options
      const waitOptions = {
        timeout: options.timeout || 30000,
        visible: options.visible !== false,
        ...options
      };

      // Wait for element if needed
      if (waitOptions.timeout > 0) {
        await this.waitForElement(selector, waitOptions);
      }

      // Extract form data using page evaluation
      const formData = await this.page.evaluate((sel: string) => {
        const form = document.querySelector(sel);
        if (!form) {
          throw new Error(`Form not found: ${sel}`);
        }

        if (form.tagName !== 'FORM') {
          throw new Error(`Element is not a form: ${sel}`);
        }

        const data: Record<string, any> = {};
        const formElement = form as HTMLFormElement;
        
        // Get form elements directly instead of using FormData
        const formElements = formElement.querySelectorAll('input, textarea, select');
        formElements.forEach((element: Element) => {
          const field = element as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
          const name = field.name;
          if (!name) return;
          
          if (field.tagName === 'INPUT') {
            const input = field as HTMLInputElement;
            if (input.type === 'checkbox' || input.type === 'radio') {
              if (input.checked) {
                data[name] = input.value;
              }
            } else {
              data[name] = input.value;
            }
          } else if (field.tagName === 'TEXTAREA') {
            data[name] = (field as HTMLTextAreaElement).value;
          } else if (field.tagName === 'SELECT') {
            data[name] = (field as HTMLSelectElement).value;
          }
        });

        return data;
      }, selector) as Record<string, any>;

      this.logger(`Form data extracted from ${selector}`, 'info');

      return formData;
    } catch (error) {
      this.logger(`Failed to extract form data from ${selector}: ${error instanceof Error ? error.message : String(error)}`, 'error');

      throw new TaskError(
        ErrorCode.BROWSER_ERROR,
        `Failed to extract form data from ${selector}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  // ============================================================================
  // LIST EXTRACTION METHODS
  // ============================================================================

  /**
   * Extract list items
   */
  async getListItems(selector: string, options: WaitOptions = {}): Promise<string[]> {
    try {
      this.logger(`Extracting list items from: ${selector}`, 'info');

      // Set default options
      const waitOptions = {
        timeout: options.timeout || 30000,
        visible: options.visible !== false,
        ...options
      };

      // Wait for element if needed
      if (waitOptions.timeout > 0) {
        await this.waitForElement(selector, waitOptions);
      }

      // Extract list items using page evaluation
      const items = await this.page.evaluate((sel: string) => {
        const list = document.querySelector(sel);
        if (!list) {
          throw new Error(`List not found: ${sel}`);
        }

        if (!['UL', 'OL', 'DL'].includes(list.tagName)) {
          throw new Error(`Element is not a list: ${sel}`);
        }

        const listItems = list.querySelectorAll('li, dt, dd');
        return Array.from(listItems).map((item: Element) => item.textContent?.trim() || '');
      }, selector) as string[];

      this.logger(`List items extracted from ${selector}: ${items.length} items`, 'info');

      return items;
    } catch (error) {
      this.logger(`Failed to extract list items from ${selector}: ${error instanceof Error ? error.message : String(error)}`, 'error');

      throw new TaskError(
        ErrorCode.BROWSER_ERROR,
        `Failed to extract list items from ${selector}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  // ============================================================================
  // LINK EXTRACTION METHODS
  // ============================================================================

  /**
   * Extract links from the page
   */
  async getLinks(selector: string = 'a', options: WaitOptions = {}): Promise<Array<{ text: string; href: string; title?: string }>> {
    try {
      this.logger(`Extracting links from: ${selector}`, 'info');

      // Set default options
      const waitOptions = {
        timeout: options.timeout || 30000,
        ...options
      };

      // Wait for at least one element if needed
      if (waitOptions.timeout > 0) {
        await this.waitForElement(selector, waitOptions);
      }

      // Extract links using page evaluation
      const links = await this.page.evaluate((sel: string) => {
        const linkElements = document.querySelectorAll(sel);
        if (linkElements.length === 0) {
          throw new Error(`No links found: ${sel}`);
        }

        return Array.from(linkElements).map((link: Element) => {
          const anchor = link as HTMLAnchorElement;
          return {
            text: anchor.textContent?.trim() || '',
            href: anchor.href || '',
            title: anchor.title || undefined
          };
        }).filter((link: any) => link.href); // Filter out links without href
      }, selector) as Array<{ text: string; href: string; title?: string }>;

      this.logger(`Links extracted: ${links.length} links`, 'info');

      return links;
    } catch (error) {
      this.logger(`Failed to extract links from ${selector}: ${error instanceof Error ? error.message : String(error)}`, 'error');

      throw new TaskError(
        ErrorCode.BROWSER_ERROR,
        `Failed to extract links from ${selector}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  /**
   * Wait for an element to appear (simplified version for internal use)
   */
  private async waitForElement(selector: string, options: WaitOptions): Promise<void> {
    const timeout = options.timeout || 30000;
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      try {
        const exists = await this.page.evaluate((sel: string) => {
          const element = document.querySelector(sel);
          if (!element) return false;

          // Check visibility if required
          const rect = element.getBoundingClientRect();
          const style = window.getComputedStyle(element);
          
          const visible = rect.width > 0 && rect.height > 0 && 
                         style.visibility !== 'hidden' && 
                         style.display !== 'none';

          return true; // Simplified for now
        }, selector) as boolean;

        if (exists) {
          return;
        }
      } catch (error) {
        // Continue polling
      }

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    throw new Error(`Timeout waiting for element: ${selector}`);
  }
}

/**
 * Create a browser data API
 */
export function createBrowserDataAPI(
  page: TaskPage,
  logger?: (message: string, level?: string) => void
): BrowserDataAPI {
  return new BrowserDataAPI(page, logger);
}