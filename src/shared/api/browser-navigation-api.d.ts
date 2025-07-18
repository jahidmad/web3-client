/**
 * Browser Navigation API
 *
 * This module implements the browser navigation API for plugin tasks,
 * providing methods for page navigation, loading, and state management.
 */
import { TaskPage, TaskBrowser } from '../engines/browser-execution-environment';
import { NavigationOptions, NavigationResult } from '../types/plugin-task-system';
/**
 * Browser Navigation API implementation
 */
export declare class BrowserNavigationAPI {
    private page;
    private browser;
    private logger;
    /**
     * Create a new Browser Navigation API
     */
    constructor(page: TaskPage, browser: TaskBrowser, logger?: (message: string, level?: string) => void);
    /**
     * Navigate to a URL
     */
    goto(url: string, options?: NavigationOptions): Promise<NavigationResult>;
    /**
     * Reload the current page
     */
    reload(options?: NavigationOptions): Promise<NavigationResult>;
    /**
     * Navigate back in history
     */
    goBack(options?: NavigationOptions): Promise<NavigationResult>;
    /**
     * Navigate forward in history
     */
    goForward(options?: NavigationOptions): Promise<NavigationResult>;
    /**
     * Wait for navigation to complete
     */
    waitForNavigation(options?: NavigationOptions): Promise<NavigationResult>;
    /**
     * Wait for the page to load
     */
    waitForLoad(timeout?: number): Promise<void>;
    /**
     * Wait for the page to be ready (DOM content loaded)
     */
    waitForReady(timeout?: number): Promise<void>;
    /**
     * Wait for the page to be idle (network is idle)
     */
    waitForIdle(timeout?: number): Promise<void>;
    /**
     * Get the current URL
     */
    getCurrentUrl(): Promise<string>;
    /**
     * Get the page title
     */
    getTitle(): Promise<string>;
    /**
     * Get the page status
     */
    private getPageStatus;
}
/**
 * Create a browser navigation API
 */
export declare function createBrowserNavigationAPI(page: TaskPage, browser: TaskBrowser, logger?: (message: string, level?: string) => void): BrowserNavigationAPI;
//# sourceMappingURL=browser-navigation-api.d.ts.map