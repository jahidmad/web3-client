/**
 * Comprehensive Browser API
 * 
 * This module provides a unified browser API that combines navigation, element interaction,
 * data extraction, and form operations for plugin tasks.
 */

import { TaskPage, TaskBrowser } from '../engines/task-execution-engine';
import { 
  NavigationOptions, 
  ClickOptions, 
  TypeOptions, 
  WaitOptions, 
  SelectOptions,
  ScreenshotOptions,
  ElementInfo,
  InteractionResult
} from '../types/plugin-task-system';

import { BrowserNavigationAPI, createBrowserNavigationAPI } from './browser-navigation-api';
import { BrowserElementAPI, createBrowserElementAPI } from './browser-element-api';
import { BrowserDataAPI, createBrowserDataAPI } from './browser-data-api';
import { BrowserFormAPI, createBrowserFormAPI, FormFieldData, FormFillOptions } from './browser-form-api';

/**
 * Comprehensive Browser API that combines all browser operations
 */
export class BrowserAPI {
  private page: TaskPage;
  private browser: TaskBrowser;
  private logger: (message: string, level?: string) => void;

  // Individual API instances
  private navigationAPI: BrowserNavigationAPI;
  private elementAPI: BrowserElementAPI;
  private dataAPI: BrowserDataAPI;
  private formAPI: BrowserFormAPI;

  /**
   * Create a new comprehensive Browser API
   */
  constructor(page: TaskPage, browser: TaskBrowser, logger?: (message: string, level?: string) => void) {
    this.page = page;
    this.browser = browser;
    this.logger = logger || ((message: string) => console.log(message));

    // Initialize individual APIs
    this.navigationAPI = createBrowserNavigationAPI(page, browser, logger);
    this.elementAPI = createBrowserElementAPI(page, logger);
    this.dataAPI = createBrowserDataAPI(page, logger);
    this.formAPI = createBrowserFormAPI(page, logger);
  }

  // ============================================================================
  // NAVIGATION METHODS
  // ============================================================================

  /**
   * Navigate to a URL
   */
  async goto(url: string, options?: NavigationOptions): Promise<void> {
    const result = await this.navigationAPI.goto(url, options);
    if (!result.success) {
      throw new Error(`Navigation failed: ${result.url}`);
    }
  }

  /**
   * Reload the current page
   */
  async reload(options?: NavigationOptions): Promise<void> {
    const result = await this.navigationAPI.reload(options);
    if (!result.success) {
      throw new Error('Page reload failed');
    }
  }

  /**
   * Navigate back in history
   */
  async goBack(options?: NavigationOptions): Promise<void> {
    const result = await this.navigationAPI.goBack(options);
    if (!result.success) {
      throw new Error('Navigation back failed');
    }
  }

  /**
   * Navigate forward in history
   */
  async goForward(options?: NavigationOptions): Promise<void> {
    const result = await this.navigationAPI.goForward(options);
    if (!result.success) {
      throw new Error('Navigation forward failed');
    }
  }

  /**
   * Wait for navigation to complete
   */
  async waitForNavigation(options?: NavigationOptions): Promise<void> {
    const result = await this.navigationAPI.waitForNavigation(options);
    if (!result.success) {
      throw new Error('Wait for navigation failed');
    }
  }

  /**
   * Wait for the page to load
   */
  async waitForLoad(timeout?: number): Promise<void> {
    await this.navigationAPI.waitForLoad(timeout);
  }

  /**
   * Wait for the page to be ready
   */
  async waitForReady(timeout?: number): Promise<void> {
    await this.navigationAPI.waitForReady(timeout);
  }

  /**
   * Wait for the page to be idle
   */
  async waitForIdle(timeout?: number): Promise<void> {
    await this.navigationAPI.waitForIdle(timeout);
  }

  // ============================================================================
  // ELEMENT INTERACTION METHODS
  // ============================================================================

  /**
   * Click on an element
   */
  async click(selector: string, options?: ClickOptions): Promise<void> {
    await this.elementAPI.click(selector, options);
  }

  /**
   * Type text into an element
   */
  async type(selector: string, text: string, options?: TypeOptions): Promise<void> {
    await this.elementAPI.type(selector, text, options);
  }

  /**
   * Select option(s) from a select element
   */
  async select(selector: string, value: string | string[], options?: SelectOptions): Promise<void> {
    await this.elementAPI.select(selector, value, options);
  }

  /**
   * Check or uncheck a checkbox or radio button
   */
  async check(selector: string, checked: boolean = true, options?: ClickOptions): Promise<void> {
    await this.elementAPI.check(selector, checked, options);
  }

  /**
   * Focus on an element
   */
  async focus(selector: string, options?: WaitOptions): Promise<void> {
    await this.elementAPI.focus(selector, options);
  }

  /**
   * Blur (remove focus from) an element
   */
  async blur(selector: string, options?: WaitOptions): Promise<void> {
    await this.elementAPI.blur(selector, options);
  }

  /**
   * Wait for an element to appear
   */
  async waitFor(selector: string, options?: WaitOptions): Promise<void> {
    await this.elementAPI.waitForElement(selector, options);
  }

  /**
   * Wait for text to appear on the page
   */
  async waitForText(text: string, options?: WaitOptions): Promise<void> {
    await this.elementAPI.waitForText(text, options);
  }

  // ============================================================================
  // DATA EXTRACTION METHODS
  // ============================================================================

  /**
   * Get text content from an element
   */
  async getText(selector: string, options?: WaitOptions): Promise<string> {
    return await this.dataAPI.getText(selector, options);
  }

  /**
   * Get text content from multiple elements
   */
  async getTextAll(selector: string, options?: WaitOptions): Promise<string[]> {
    return await this.dataAPI.getTextAll(selector, options);
  }

  /**
   * Get inner HTML from an element
   */
  async getHTML(selector: string, options?: WaitOptions): Promise<string> {
    return await this.dataAPI.getHTML(selector, options);
  }

  /**
   * Get attribute value from an element
   */
  async getAttribute(selector: string, attribute: string, options?: WaitOptions): Promise<string> {
    return await this.dataAPI.getAttribute(selector, attribute, options);
  }

  /**
   * Get multiple attributes from an element
   */
  async getAttributes(selector: string, attributes: string[], options?: WaitOptions): Promise<Record<string, string>> {
    return await this.dataAPI.getAttributes(selector, attributes, options);
  }

  /**
   * Extract table data as a 2D array
   */
  async getTable(selector: string, options?: WaitOptions): Promise<string[][]> {
    return await this.dataAPI.getTable(selector, options);
  }

  /**
   * Extract table data as objects with header mapping
   */
  async getTableAsObjects(selector: string, options?: WaitOptions): Promise<Record<string, string>[]> {
    return await this.dataAPI.getTableAsObjects(selector, options);
  }

  /**
   * Extract list items
   */
  async getListItems(selector: string, options?: WaitOptions): Promise<string[]> {
    return await this.dataAPI.getListItems(selector, options);
  }

  /**
   * Extract links from the page
   */
  async getLinks(selector?: string, options?: WaitOptions): Promise<Array<{ text: string; href: string; title?: string }>> {
    return await this.dataAPI.getLinks(selector, options);
  }

  // ============================================================================
  // FORM OPERATIONS METHODS
  // ============================================================================

  /**
   * Fill a form with provided data
   */
  async fillForm(formSelector: string, formData: FormFieldData, options?: FormFillOptions): Promise<void> {
    await this.formAPI.fillForm(formSelector, formData, options);
  }

  /**
   * Submit a form
   */
  async submitForm(formSelector: string, options?: WaitOptions): Promise<void> {
    await this.formAPI.submitForm(formSelector, options);
  }

  /**
   * Reset a form to its default values
   */
  async resetForm(formSelector: string, options?: WaitOptions): Promise<void> {
    await this.formAPI.resetForm(formSelector, options);
  }

  /**
   * Validate a form
   */
  async validateForm(formSelector: string, options?: WaitOptions): Promise<{
    valid: boolean;
    errors: Array<{ field: string; message: string }>;
  }> {
    return await this.formAPI.validateForm(formSelector, options);
  }

  /**
   * Get all form fields and their current values
   */
  async getFormFields(formSelector: string, options?: WaitOptions): Promise<Record<string, any>> {
    return await this.formAPI.getFormFields(formSelector, options);
  }

  /**
   * Extract form data
   */
  async getFormData(selector: string, options?: WaitOptions): Promise<Record<string, any>> {
    return await this.dataAPI.getFormData(selector, options);
  }

  // ============================================================================
  // ADVANCED OPERATIONS METHODS
  // ============================================================================

  /**
   * Take a screenshot
   */
  async screenshot(options?: ScreenshotOptions): Promise<Buffer> {
    try {
      this.logger('Taking screenshot', 'info');

      // Set default options
      const screenshotOptions = {
        type: options?.type || 'png',
        quality: options?.quality || 90,
        fullPage: options?.fullPage || false,
        ...options
      };

      // Take screenshot using page method
      const screenshot = await this.page.screenshot(screenshotOptions);

      this.logger('Screenshot taken successfully', 'info');

      return screenshot;
    } catch (error) {
      this.logger(`Screenshot failed: ${error instanceof Error ? error.message : String(error)}`, 'error');
      throw error;
    }
  }

  /**
   * Evaluate JavaScript code in the page context
   */
  async evaluate<T>(fn: string | Function, ...args: any[]): Promise<T> {
    try {
      this.logger('Evaluating JavaScript in page context', 'info');

      const result = await this.page.evaluate(fn, ...args);

      this.logger('JavaScript evaluation completed', 'info');

      return result as T;
    } catch (error) {
      this.logger(`JavaScript evaluation failed: ${error instanceof Error ? error.message : String(error)}`, 'error');
      throw error;
    }
  }

  // ============================================================================
  // PAGE INFORMATION METHODS
  // ============================================================================

  /**
   * Get the current URL
   */
  async getUrl(): Promise<string> {
    return await this.navigationAPI.getCurrentUrl();
  }

  /**
   * Get the page title
   */
  async getTitle(): Promise<string> {
    return await this.navigationAPI.getTitle();
  }

  /**
   * Get page content as HTML
   */
  async getContent(): Promise<string> {
    return await this.page.content();
  }

  /**
   * Get cookies from the page
   */
  async getCookies(): Promise<any[]> {
    try {
      this.logger('Getting cookies', 'info');

      // This would need to be implemented based on the actual browser implementation
      const cookies = await this.page.evaluate(() => {
        return document.cookie.split(';').map(cookie => {
          const [name, value] = cookie.trim().split('=');
          return { name, value };
        });
      });

      this.logger(`Retrieved ${(cookies as any[]).length} cookies`, 'info');

      return cookies as any[];
    } catch (error) {
      this.logger(`Failed to get cookies: ${error instanceof Error ? error.message : String(error)}`, 'error');
      throw error;
    }
  }

  /**
   * Set cookies on the page
   */
  async setCookies(cookies: any[]): Promise<void> {
    try {
      this.logger(`Setting ${cookies.length} cookies`, 'info');

      // This would need to be implemented based on the actual browser implementation
      await this.page.evaluate((cookieList: any[]) => {
        cookieList.forEach((cookie: any) => {
          document.cookie = `${cookie.name}=${cookie.value}`;
        });
      }, cookies);

      this.logger('Cookies set successfully', 'info');
    } catch (error) {
      this.logger(`Failed to set cookies: ${error instanceof Error ? error.message : String(error)}`, 'error');
      throw error;
    }
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Wait for a specified amount of time
   */
  async sleep(ms: number): Promise<void> {
    this.logger(`Sleeping for ${ms}ms`, 'info');
    await new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get the underlying page instance
   */
  getPage(): TaskPage {
    return this.page;
  }

  /**
   * Get the underlying browser instance
   */
  getBrowser(): TaskBrowser {
    return this.browser;
  }
}

/**
 * Create a comprehensive browser API
 */
export function createBrowserAPI(
  page: TaskPage,
  browser: TaskBrowser,
  logger?: (message: string, level?: string) => void
): BrowserAPI {
  return new BrowserAPI(page, browser, logger);
}

// Export individual APIs for advanced use cases
export {
  BrowserNavigationAPI,
  BrowserElementAPI,
  BrowserDataAPI,
  BrowserFormAPI,
  createBrowserNavigationAPI,
  createBrowserElementAPI,
  createBrowserDataAPI,
  createBrowserFormAPI
};

// Export types
export type { FormFieldData, FormFillOptions };