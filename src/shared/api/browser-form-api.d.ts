/**
 * Browser Form Operations API
 *
 * This module implements the browser form operations API for plugin tasks,
 * providing methods for filling forms, submitting forms, and handling form interactions.
 */
import { TaskPage } from '../engines/task-execution-engine';
import { WaitOptions, InteractionResult } from '../types/plugin-task-system';
/**
 * Form field data interface
 */
export interface FormFieldData {
    [fieldName: string]: string | string[] | boolean | number;
}
/**
 * Form fill options
 */
export interface FormFillOptions extends WaitOptions {
    clearFirst?: boolean;
    submitAfter?: boolean;
    validateRequired?: boolean;
}
/**
 * Browser Form Operations API implementation
 */
export declare class BrowserFormAPI {
    private page;
    private logger;
    /**
     * Create a new Browser Form API
     */
    constructor(page: TaskPage, logger?: (message: string, level?: string) => void);
    /**
     * Fill a form with provided data
     */
    fillForm(formSelector: string, formData: FormFieldData, options?: FormFillOptions): Promise<InteractionResult>;
    /**
     * Submit a form
     */
    submitForm(formSelector: string, options?: WaitOptions): Promise<InteractionResult>;
    /**
     * Reset a form to its default values
     */
    resetForm(formSelector: string, options?: WaitOptions): Promise<InteractionResult>;
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
     * Wait for an element to appear (simplified version for internal use)
     */
    private waitForElement;
}
/**
 * Create a browser form API
 */
export declare function createBrowserFormAPI(page: TaskPage, logger?: (message: string, level?: string) => void): BrowserFormAPI;
//# sourceMappingURL=browser-form-api.d.ts.map