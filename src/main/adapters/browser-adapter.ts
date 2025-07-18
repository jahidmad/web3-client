/**
 * Browser Adapter
 * 
 * This module adapts the existing browser manager to the task execution engine's
 * browser provider interface.
 */

import { BrowserManager } from '../services/browser-manager';
import { BrowserProvider, TaskBrowser, TaskPage } from '../../shared/engines/browser-execution-environment';

/**
 * Adapter for the browser manager to implement the BrowserProvider interface
 */
export class BrowserManagerAdapter implements BrowserProvider {
  private browserManager: BrowserManager;

  constructor(browserManager: BrowserManager) {
    this.browserManager = browserManager;
  }

  /**
   * Get a browser by ID
   */
  async getBrowser(browserId: string): Promise<TaskBrowser | null> {
    const browser = this.browserManager.getBrowser(browserId);
    if (!browser) return null;
    
    return this.adaptBrowser(browser);
  }

  /**
   * Get any available browser
   */
  async getAvailableBrowser(): Promise<TaskBrowser | null> {
    const browsers = await this.browserManager.getBrowsers();
    const availableBrowser = browsers.find(b => b.status === 'running');
    
    if (!availableBrowser) return null;
    
    return this.adaptBrowser(availableBrowser);
  }

  /**
   * Get all browsers
   */
  async getAllBrowsers(): Promise<TaskBrowser[]> {
    const browsers = await this.browserManager.getBrowsers();
    return browsers.map(browser => this.adaptBrowser(browser));
  }

  /**
   * Adapt a browser to the TaskBrowser interface
   */
  private adaptBrowser(browser: any): TaskBrowser {
    return {
      id: browser.id,
      name: browser.name,
      
      isAvailable: async () => {
        return browser.status === 'running';
      },
      
      createPage: async () => {
        // For now, return a mock page since the current browser system
        // doesn't support page creation directly
        return this.createMockPage(browser.id);
      }
    };
  }

  /**
   * Create a mock page implementation
   * TODO: Replace with actual page creation when browser system supports it
   */
  private createMockPage(browserId: string): TaskPage {
    return {
      // 页面导航API
      goto: async (url: string, options?: { timeout?: number; waitUntil?: string }) => {
        console.log(`Mock page goto: ${url} for browser ${browserId}`);
        // TODO: Implement actual navigation
      },
      
      url: async () => {
        console.log(`Mock page url for browser ${browserId}`);
        return 'https://example.com';
      },
      
      title: async () => {
        console.log(`Mock page title for browser ${browserId}`);
        return 'Mock Page Title';
      },
      
      content: async () => {
        console.log(`Mock page content for browser ${browserId}`);
        return '<html><body>Mock content</body></html>';
      },
      
      reload: async (options?: { timeout?: number; waitUntil?: string }) => {
        console.log(`Mock page reload for browser ${browserId}`);
        // TODO: Implement actual reload
      },
      
      goBack: async (options?: { timeout?: number; waitUntil?: string }) => {
        console.log(`Mock page goBack for browser ${browserId}`);
        // TODO: Implement actual navigation
      },
      
      goForward: async (options?: { timeout?: number; waitUntil?: string }) => {
        console.log(`Mock page goForward for browser ${browserId}`);
        // TODO: Implement actual navigation
      },
      
      waitForNavigation: async (options?: { timeout?: number; waitUntil?: string }) => {
        console.log(`Mock page waitForNavigation for browser ${browserId}`);
        // TODO: Implement actual navigation waiting
      },
      
      waitForLoadState: async (state: string, options?: { timeout?: number }) => {
        console.log(`Mock page waitForLoadState for browser ${browserId}, state: ${state}`);
        // TODO: Implement actual load state waiting
      },
      
      // 数据提取API
      getText: async (selector: string): Promise<string> => {
        console.log(`Mock page getText: ${selector} for browser ${browserId}`);
        return `Mock text content for ${selector}`;
      },
      
      getAttribute: async (selector: string, attribute: string): Promise<string> => {
        console.log(`Mock page getAttribute: ${selector}.${attribute} for browser ${browserId}`);
        return `Mock attribute value for ${selector}.${attribute}`;
      },
      
      getTable: async (selector: string): Promise<string[][]> => {
        console.log(`Mock page getTable: ${selector} for browser ${browserId}`);
        return [
          ['Header 1', 'Header 2', 'Header 3'],
          ['Row 1 Cell 1', 'Row 1 Cell 2', 'Row 1 Cell 3'],
          ['Row 2 Cell 1', 'Row 2 Cell 2', 'Row 2 Cell 3']
        ];
      },
      
      getCount: async (selector: string): Promise<number> => {
        console.log(`Mock page getCount: ${selector} for browser ${browserId}`);
        return 5; // Mock count of elements
      },
      
      getInnerHTML: async (selector: string): Promise<string> => {
        console.log(`Mock page getInnerHTML: ${selector} for browser ${browserId}`);
        return '<div>Mock inner HTML content</div>';
      },
      
      getOuterHTML: async (selector: string): Promise<string> => {
        console.log(`Mock page getOuterHTML: ${selector} for browser ${browserId}`);
        return '<div class="container"><div>Mock inner HTML content</div></div>';
      },
      
      getLinks: async (selector?: string): Promise<Array<{href: string, text: string}>> => {
        console.log(`Mock page getLinks${selector ? ': ' + selector : ''} for browser ${browserId}`);
        return [
          { href: 'https://example.com/page1', text: 'Page 1' },
          { href: 'https://example.com/page2', text: 'Page 2' },
          { href: 'https://example.com/page3', text: 'Page 3' }
        ];
      },
      
      getImages: async (selector?: string): Promise<Array<{src: string, alt: string}>> => {
        console.log(`Mock page getImages${selector ? ': ' + selector : ''} for browser ${browserId}`);
        return [
          { src: 'https://example.com/image1.jpg', alt: 'Image 1' },
          { src: 'https://example.com/image2.jpg', alt: 'Image 2' },
          { src: 'https://example.com/image3.jpg', alt: 'Image 3' }
        ];
      },
      
      // 等待操作
      waitFor: async (selector: string, options?: { timeout?: number; visible?: boolean; hidden?: boolean }): Promise<void> => {
        console.log(`Mock page waitFor: ${selector} for browser ${browserId}`);
        // Mock implementation - just wait a bit
        await new Promise(resolve => setTimeout(resolve, 100));
      },
      
      waitForText: async (text: string, options?: { timeout?: number }): Promise<void> => {
        console.log(`Mock page waitForText: ${text} for browser ${browserId}`);
        // Mock implementation - just wait a bit
        await new Promise(resolve => setTimeout(resolve, 100));
      },
      
      // 高级操作
      screenshot: async (options?: { type?: string; quality?: number; fullPage?: boolean }): Promise<Buffer> => {
        console.log(`Mock page screenshot for browser ${browserId}`);
        return Buffer.from('mock screenshot data');
      },
      
      pdf: async (options?: { format?: string; landscape?: boolean; printBackground?: boolean }): Promise<Buffer> => {
        console.log(`Mock page pdf for browser ${browserId}`);
        return Buffer.from('mock pdf data');
      },
      
      evaluate: async <T>(fn: string | Function, ...args: any[]): Promise<T> => {
        console.log(`Mock page evaluate for browser ${browserId}`);
        // Return a mock result
        return {} as T;
      },
      
      close: async () => {
        console.log(`Mock page close for browser ${browserId}`);
        // TODO: Implement actual page closing
      }
    };
  }
}

/**
 * Create a browser manager adapter
 */
export function createBrowserManagerAdapter(browserManager: BrowserManager): BrowserManagerAdapter {
  return new BrowserManagerAdapter(browserManager);
}