/**
 * Browser Data Extraction API
 *
 * This module implements the browser data extraction API for plugin tasks,
 * providing methods for extracting text, attributes, tables, and other data from web pages.
 */
import { TaskPage } from '../engines/task-execution-engine';
import { WaitOptions } from '../types/plugin-task-system';
/**
 * Browser Data Extraction API implementation
 */
export declare class BrowserDataAPI {
    private page;
    private logger;
    /**
     * Create a new Browser Data API
     */
    constructor(page: TaskPage, logger?: (message: string, level?: string) => void);
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
     * Extract form data
     */
    getFormData(selector: string, options?: WaitOptions): Promise<Record<string, any>>;
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
     * Wait for an element to appear (simplified version for internal use)
     */
    private waitForElement;
}
/**
 * Create a browser data API
 */
export declare function createBrowserDataAPI(page: TaskPage, logger?: (message: string, level?: string) => void): BrowserDataAPI;
//# sourceMappingURL=browser-data-api.d.ts.map