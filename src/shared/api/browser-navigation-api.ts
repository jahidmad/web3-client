/**
 * Browser Navigation API
 * 
 * This module implements the browser navigation API for plugin tasks,
 * providing methods for page navigation, loading, and state management.
 */

import { TaskPage, TaskBrowser } from '../engines/browser-execution-environment';
import { NavigationOptions, NavigationResult, BrowserAPI } from '../types/plugin-task-system';
import { TaskError, ErrorCode } from '../types/plugin-task-system';

/**
 * Browser Navigation API implementation
 */
export class BrowserNavigationAPI {
  private page: TaskPage;
  private browser: TaskBrowser;
  private logger: (message: string, level?: string) => void;

  /**
   * Create a new Browser Navigation API
   */
  constructor(page: TaskPage, browser: TaskBrowser, logger?: (message: string, level?: string) => void) {
    this.page = page;
    this.browser = browser;
    this.logger = logger || ((message: string) => console.log(message));
  }

  /**
   * Navigate to a URL
   */
  async goto(url: string, options: NavigationOptions = {}): Promise<NavigationResult> {
    try {
      this.logger(`Navigating to ${url}`, 'info');

      const startTime = Date.now();

      // Set default options
      const navigationOptions = {
        timeout: options.timeout || 30000,
        waitUntil: options.waitUntil || 'load',
        referer: options.referer,
        ...options
      };

      // Navigate to the URL
      await this.page.goto(url, navigationOptions);

      const duration = Date.now() - startTime;

      this.logger(`Navigation to ${url} completed in ${duration}ms`, 'info');

      // Get the final URL (may be different due to redirects)
      const finalUrl = await this.page.url();

      return {
        success: true,
        url: finalUrl,
        duration,
        redirected: finalUrl !== url,
        status: await this.getPageStatus()
      };
    } catch (error) {
      this.logger(`Navigation to ${url} failed: ${error instanceof Error ? error.message : String(error)}`, 'error');

      throw new TaskError(
        ErrorCode.NAVIGATION_FAILED,
        `Failed to navigate to ${url}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Reload the current page
   */
  async reload(options: NavigationOptions = {}): Promise<NavigationResult> {
    try {
      const currentUrl = await this.page.url();
      this.logger(`Reloading page: ${currentUrl}`, 'info');

      const startTime = Date.now();

      // Set default options
      const navigationOptions = {
        timeout: options.timeout || 30000,
        waitUntil: options.waitUntil || 'load',
        ...options
      };

      // Reload the page
      await this.page.reload(navigationOptions);

      const duration = Date.now() - startTime;

      this.logger(`Page reload completed in ${duration}ms`, 'info');

      return {
        success: true,
        url: currentUrl,
        duration,
        redirected: false,
        status: await this.getPageStatus()
      };
    } catch (error) {
      this.logger(`Page reload failed: ${error instanceof Error ? error.message : String(error)}`, 'error');

      throw new TaskError(
        ErrorCode.NAVIGATION_FAILED,
        `Failed to reload page: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Navigate back in history
   */
  async goBack(options: NavigationOptions = {}): Promise<NavigationResult> {
    try {
      this.logger('Navigating back in history', 'info');

      const startTime = Date.now();

      // Set default options
      const navigationOptions = {
        timeout: options.timeout || 30000,
        waitUntil: options.waitUntil || 'load',
        ...options
      };

      // Go back in history
      await this.page.goBack(navigationOptions);

      const duration = Date.now() - startTime;

      // Get the current URL after navigation
      const currentUrl = await this.page.url();

      this.logger(`Navigation back completed in ${duration}ms`, 'info');

      return {
        success: true,
        url: currentUrl,
        duration,
        redirected: false,
        status: await this.getPageStatus()
      };
    } catch (error) {
      this.logger(`Navigation back failed: ${error instanceof Error ? error.message : String(error)}`, 'error');

      throw new TaskError(
        ErrorCode.NAVIGATION_FAILED,
        `Failed to navigate back: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Navigate forward in history
   */
  async goForward(options: NavigationOptions = {}): Promise<NavigationResult> {
    try {
      this.logger('Navigating forward in history', 'info');

      const startTime = Date.now();

      // Set default options
      const navigationOptions = {
        timeout: options.timeout || 30000,
        waitUntil: options.waitUntil || 'load',
        ...options
      };

      // Go forward in history
      await this.page.goForward(navigationOptions);

      const duration = Date.now() - startTime;

      // Get the current URL after navigation
      const currentUrl = await this.page.url();

      this.logger(`Navigation forward completed in ${duration}ms`, 'info');

      return {
        success: true,
        url: currentUrl,
        duration,
        redirected: false,
        status: await this.getPageStatus()
      };
    } catch (error) {
      this.logger(`Navigation forward failed: ${error instanceof Error ? error.message : String(error)}`, 'error');

      throw new TaskError(
        ErrorCode.NAVIGATION_FAILED,
        `Failed to navigate forward: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Wait for navigation to complete
   */
  async waitForNavigation(options: NavigationOptions = {}): Promise<NavigationResult> {
    try {
      this.logger('Waiting for navigation to complete', 'info');

      const startTime = Date.now();

      // Set default options
      const navigationOptions = {
        timeout: options.timeout || 30000,
        waitUntil: options.waitUntil || 'load',
        ...options
      };

      // Wait for navigation to complete
      await this.page.waitForNavigation(navigationOptions);

      const duration = Date.now() - startTime;

      // Get the current URL after navigation
      const currentUrl = await this.page.url();

      this.logger(`Navigation completed in ${duration}ms`, 'info');

      return {
        success: true,
        url: currentUrl,
        duration,
        redirected: false,
        status: await this.getPageStatus()
      };
    } catch (error) {
      this.logger(`Wait for navigation failed: ${error instanceof Error ? error.message : String(error)}`, 'error');

      throw new TaskError(
        ErrorCode.NAVIGATION_FAILED,
        `Failed to wait for navigation: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Wait for the page to load
   */
  async waitForLoad(timeout: number = 30000): Promise<void> {
    try {
      this.logger(`Waiting for page to load (timeout: ${timeout}ms)`, 'info');

      // Wait for the load event
      await this.page.waitForLoadState('load', { timeout });

      this.logger('Page load completed', 'info');
    } catch (error) {
      this.logger(`Wait for load failed: ${error instanceof Error ? error.message : String(error)}`, 'error');

      throw new TaskError(
        ErrorCode.NAVIGATION_FAILED,
        `Failed to wait for page load: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Wait for the page to be ready (DOM content loaded)
   */
  async waitForReady(timeout: number = 30000): Promise<void> {
    try {
      this.logger(`Waiting for page to be ready (timeout: ${timeout}ms)`, 'info');

      // Wait for the DOMContentLoaded event
      await this.page.waitForLoadState('domcontentloaded', { timeout });

      this.logger('Page ready', 'info');
    } catch (error) {
      this.logger(`Wait for ready failed: ${error instanceof Error ? error.message : String(error)}`, 'error');

      throw new TaskError(
        ErrorCode.NAVIGATION_FAILED,
        `Failed to wait for page ready: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Wait for the page to be idle (network is idle)
   */
  async waitForIdle(timeout: number = 30000): Promise<void> {
    try {
      this.logger(`Waiting for page to be idle (timeout: ${timeout}ms)`, 'info');

      // Wait for the networkidle event
      await this.page.waitForLoadState('networkidle', { timeout });

      this.logger('Page idle', 'info');
    } catch (error) {
      this.logger(`Wait for idle failed: ${error instanceof Error ? error.message : String(error)}`, 'error');

      throw new TaskError(
        ErrorCode.NAVIGATION_FAILED,
        `Failed to wait for page idle: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Get the current URL
   */
  async getCurrentUrl(): Promise<string> {
    return await this.page.url();
  }

  /**
   * Get the page title
   */
  async getTitle(): Promise<string> {
    return await this.page.title();
  }

  /**
   * Get the page status
   */
  private async getPageStatus(): Promise<{
    url: string;
    title: string;
    ready: boolean;
    loaded: boolean;
  }> {
    const url = await this.page.url();
    const title = await this.page.title();

    // Check if the page is ready and loaded
    // This is a simplified implementation
    const ready = true;
    const loaded = true;

    return {
      url,
      title,
      ready,
      loaded
    };
  }
}

/**
 * Create a browser navigation API
 */
export function createBrowserNavigationAPI(
  page: TaskPage,
  browser: TaskBrowser,
  logger?: (message: string, level?: string) => void
): BrowserNavigationAPI {
  return new BrowserNavigationAPI(page, browser, logger);
}