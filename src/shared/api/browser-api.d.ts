/**
 * Comprehensive Browser API
 *
 * This module provides a unified browser API that combines navigation, element interaction,
 * data extraction, and form operations for plugin tasks.
 */
import { TaskPage, TaskBrowser } from '../engines/task-execution-engine';
import { NavigationOptions, ClickOptions, TypeOptions, WaitOptions, SelectOptions, ScreenshotOptions } from '../types/plugin-task-system';
import { BrowserNavigationAPI, createBrowserNavigationAPI } from './browser-navigation-api';
import { BrowserElementAPI, createBrowserElementAPI } from './browser-element-api';
import { BrowserDataAPI, createBrowserDataAPI } from './browser-data-api';
import { BrowserFormAPI, createBrowserFormAPI, FormFieldData, FormFillOptions } from './browser-form-api';
/**
 * Comprehensive Browser API that combines all browser operations
 */
export declare class BrowserAPI {
    private page;
    private browser;
    private logger;
    private navigationAPI;
    private elementAPI;
    private dataAPI;
    private formAPI;
    /**
     * Create a new comprehensive Browser API
     */
    constructor(page: TaskPage, browser: TaskBrowser, logger?: (message: string, level?: string) => void);
    /**
     * Navigate to a URL
     */
    goto(url: string, options?: NavigationOptions): Promise<void>;
    /**
     * Reload the current page
     */
    reload(options?: NavigationOptions): Promise<void>;
    /**
     * Navigate back in history
     */
    goBack(options?: NavigationOptions): Promise<void>;
    /**
     * Navigate forward in history
     */
    goForward(options?: NavigationOptions): Promise<void>;
    /**
     * Wait for navigation to complete
     */
    waitForNavigation(options?: NavigationOptions): Promise<void>;
    /**
     * Wait for the page to load
     */
    waitForLoad(timeout?: number): Promise<void>;
    /**
     * Wait for the page to be ready
     */
    waitForReady(timeout?: number): Promise<void>;
    /**
     * Wait for the page to be idle
     */
    waitForIdle(timeout?: number): Promise<void>;
    /**
     * Click on an element
     */
    click(selector: string, options?: ClickOptions): Promise<void>;
    /**
     * Type text into an element
     */
    type(selector: string, text: string, options?: TypeOptions): Promise<void>;
    /**
     * Select option(s) from a select element
     */
    select(selector: string, value: string | string[], options?: SelectOptions): Promise<void>;
    /**
     * Check or uncheck a checkbox or radio button
     */
    check(selector: string, checked?: boolean, options?: ClickOptions): Promise<void>;
    /**
     * Focus on an element
     */
    focus(selector: string, options?: WaitOptions): Promise<void>;
    /**
     * Blur (remove focus from) an element
     */
    blur(selector: string, options?: WaitOptions): Promise<void>;
    /**
     * Wait for an element to appear
     */
    waitFor(selector: string, options?: WaitOptions): Promise<void>;
    /**
     * Wait for text to appear on the page
     */
    waitForText(text: string, options?: WaitOptions): Promise<void>;
    /**
     * Get text content from an element
     */
    getText(selector: string, options?: WaitOptions): Promise<string>;
    /**
     * Get text content from multiple elements
     */
    getTextAll(selector: string, options?: WaitOptions): Promise<string[]>;
    /**
     * Get inner HTML from an element
     */
    getHTML(selector: string, options?: WaitOptions): Promise<string>;
    /**
     * Get attribute value from an element
     */
    getAttribute(selector: string, attribute: string, options?: WaitOptions): Promise<string>;
    /**
     * Get multiple attributes from an element
     */
    getAttributes(selector: string, attributes: string[], options?: WaitOptions): Promise<Record<string, string>>;
    /**
     * Extract table data as a 2D array
     */
    getTable(selector: string, options?: WaitOptions): Promise<string[][]>;
    /**
     * Extract table data as objects with header mapping
     */
    getTableAsObjects(selector: string, options?: WaitOptions): Promise<Record<string, string>[]>;
    /**
     * Extract list items
     */
    getListItems(selector: string, options?: WaitOptions): Promise<string[]>;
    /**
     * Extract links from the page
     */
    getLinks(selector?: string, options?: WaitOptions): Promise<Array<{
        text: string;
        href: string;
        title?: string;
    }>>;
    /**
     * Fill a form with provided data
     */
    fillForm(formSelector: string, formData: FormFieldData, options?: FormFillOptions): Promise<void>;
    /**
     * Submit a form
     */
    submitForm(formSelector: string, options?: WaitOptions): Promise<void>;
    /**
     * Reset a form to its default values
     */
    resetForm(formSelector: string, options?: WaitOptions): Promise<void>;
    /**
     * Validate a form
     */
    validateForm(formSelector: string, options?: WaitOptions): Promise<{
        valid: boolean;
        errors: Array<{
            field: string;
            message: string;
        }>;
    }>;
    /**
     * Get all form fields and their current values
     */
    getFormFields(formSelector: string, options?: WaitOptions): Promise<Record<string, any>>;
    /**
     * Extract form data
     */
    getFormData(selector: string, options?: WaitOptions): Promise<Record<string, any>>;
    /**
     * Take a screenshot
     */
    screenshot(options?: ScreenshotOptions): Promise<Buffer>;
    /**
     * Evaluate JavaScript code in the page context
     */
    evaluate<T>(fn: string | Function, ...args: any[]): Promise<T>;
    /**
     * Get the current URL
     */
    getUrl(): Promise<string>;
    /**
     * Get the page title
     */
    getTitle(): Promise<string>;
    /**
     * Get page content as HTML
     */
    getContent(): Promise<string>;
    /**
     * Get cookies from the page
     */
    getCookies(): Promise<any[]>;
    /**
     * Set cookies on the page
     */
    setCookies(cookies: any[]): Promise<void>;
    /**
     * Wait for a specified amount of time
     */
    sleep(ms: number): Promise<void>;
    /**
     * Get the underlying page instance
     */
    getPage(): TaskPage;
    /**
     * Get the underlying browser instance
     */
    getBrowser(): TaskBrowser;
}
/**
 * Create a comprehensive browser API
 */
export declare function createBrowserAPI(page: TaskPage, browser: TaskBrowser, logger?: (message: string, level?: string) => void): BrowserAPI;
export { BrowserNavigationAPI, BrowserElementAPI, BrowserDataAPI, BrowserFormAPI, createBrowserNavigationAPI, createBrowserElementAPI, createBrowserDataAPI, createBrowserFormAPI };
export type { FormFieldData, FormFillOptions };
//# sourceMappingURL=browser-api.d.ts.map