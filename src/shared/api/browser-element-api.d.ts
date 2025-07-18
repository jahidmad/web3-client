/**
 * Browser Element Interaction API
 *
 * This module implements the browser element interaction API for plugin tasks,
 * providing methods for clicking, typing, selecting, and other element interactions.
 */
import { TaskPage } from '../engines/task-execution-engine';
import { ClickOptions, TypeOptions, WaitOptions, SelectOptions, ElementInfo, InteractionResult } from '../types/plugin-task-system';
/**
 * Browser Element Interaction API implementation
 */
export declare class BrowserElementAPI {
    private page;
    private logger;
    /**
     * Create a new Browser Element API
     */
    constructor(page: TaskPage, logger?: (message: string, level?: string) => void);
    /**
     * Click on an element
     */
    click(selector: string, options?: ClickOptions): Promise<InteractionResult>;
    /**
     * Type text into an element
     */
    type(selector: string, text: string, options?: TypeOptions): Promise<InteractionResult>;
    /**
     * Select option(s) from a select element
     */
    select(selector: string, value: string | string[], options?: SelectOptions): Promise<InteractionResult>;
    /**
     * Check or uncheck a checkbox or radio button
     */
    check(selector: string, checked?: boolean, options?: ClickOptions): Promise<InteractionResult>;
    /**
     * Focus on an element
     */
    focus(selector: string, options?: WaitOptions): Promise<InteractionResult>;
    /**
     * Blur (remove focus from) an element
     */
    blur(selector: string, options?: WaitOptions): Promise<InteractionResult>;
    /**
     * Wait for an element to appear
     */
    waitForElement(selector: string, options?: WaitOptions): Promise<ElementInfo>;
    /**
     * Wait for text to appear on the page
     */
    waitForText(text: string, options?: WaitOptions): Promise<ElementInfo>;
    /**
     * Poll for an element with specific conditions
     */
    private pollForElement;
    /**
     * Poll for a condition to be true
     */
    private pollForCondition;
}
/**
 * Create a browser element API
 */
export declare function createBrowserElementAPI(page: TaskPage, logger?: (message: string, level?: string) => void): BrowserElementAPI;
//# sourceMappingURL=browser-element-api.d.ts.map