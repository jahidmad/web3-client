/**
 * Browser Form Operations API
 * 
 * This module implements the browser form operations API for plugin tasks,
 * providing methods for filling forms, submitting forms, and handling form interactions.
 */

import { TaskPage } from '../engines/task-execution-engine';
import { WaitOptions, InteractionResult } from '../types/plugin-task-system';
import { TaskError, ErrorCode } from '../types/plugin-task-system';

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
  clearFirst?: boolean;            // Clear existing values before filling
  submitAfter?: boolean;           // Submit form after filling
  validateRequired?: boolean;      // Validate required fields
}

/**
 * Browser Form Operations API implementation
 */
export class BrowserFormAPI {
  private page: TaskPage;
  private logger: (message: string, level?: string) => void;

  /**
   * Create a new Browser Form API
   */
  constructor(page: TaskPage, logger?: (message: string, level?: string) => void) {
    this.page = page;
    this.logger = logger || ((message: string) => console.log(message));
  }

  // ============================================================================
  // FORM FILLING METHODS
  // ============================================================================

  /**
   * Fill a form with provided data
   */
  async fillForm(formSelector: string, formData: FormFieldData, options: FormFillOptions = {}): Promise<InteractionResult> {
    try {
      this.logger(`Filling form: ${formSelector}`, 'info');

      const startTime = Date.now();

      // Set default options
      const fillOptions = {
        timeout: options.timeout || 30000,
        clearFirst: options.clearFirst !== false, // Default to true
        submitAfter: options.submitAfter || false,
        validateRequired: options.validateRequired || false,
        ...options
      };

      // Wait for form to be available
      await this.waitForElement(formSelector, { timeout: fillOptions.timeout, visible: true });

      // Fill the form using page evaluation
      const result = await this.page.evaluate<{filledFields: string[], errors: string[]}>((formSel: string, data: Record<string, any>, opts: any) => {
        const form = document.querySelector(formSel);
        if (!form) {
          throw new Error(`Form not found: ${formSel}`);
        }

        if (form.tagName !== 'FORM') {
          throw new Error(`Element is not a form: ${formSel}`);
        }

        const filledFields: string[] = [];
        const errors: string[] = [];

        // Process each field in the form data
        Object.entries(data).forEach(([fieldName, fieldValue]) => {
          try {
            // Find the field element
            const field = form.querySelector(`[name="${fieldName}"], #${fieldName}`) as HTMLElement;
            
            if (!field) {
              errors.push(`Field not found: ${fieldName}`);
              return;
            }

            // Handle different field types
            if (field.tagName === 'INPUT') {
              const input = field as HTMLInputElement;
              
              switch (input.type.toLowerCase()) {
                case 'text':
                case 'email':
                case 'password':
                case 'url':
                case 'tel':
                case 'search':
                case 'number':
                case 'date':
                case 'time':
                case 'datetime-local':
                case 'month':
                case 'week':
                  if (opts.clearFirst) input.value = '';
                  input.value = String(fieldValue);
                  input.dispatchEvent(new Event('input', { bubbles: true }));
                  input.dispatchEvent(new Event('change', { bubbles: true }));
                  break;

                case 'checkbox':
                  input.checked = Boolean(fieldValue);
                  input.dispatchEvent(new Event('change', { bubbles: true }));
                  break;

                case 'radio':
                  if (String(fieldValue) === input.value) {
                    input.checked = true;
                    input.dispatchEvent(new Event('change', { bubbles: true }));
                  }
                  break;

                case 'file':
                  // File inputs require special handling and can't be set programmatically
                  errors.push(`File input cannot be filled programmatically: ${fieldName}`);
                  return;

                default:
                  if (opts.clearFirst) input.value = '';
                  input.value = String(fieldValue);
                  input.dispatchEvent(new Event('input', { bubbles: true }));
                  input.dispatchEvent(new Event('change', { bubbles: true }));
              }
            } else if (field.tagName === 'TEXTAREA') {
              const textarea = field as HTMLTextAreaElement;
              if (opts.clearFirst) textarea.value = '';
              textarea.value = String(fieldValue);
              textarea.dispatchEvent(new Event('input', { bubbles: true }));
              textarea.dispatchEvent(new Event('change', { bubbles: true }));
            } else if (field.tagName === 'SELECT') {
              const select = field as HTMLSelectElement;
              const values = Array.isArray(fieldValue) ? fieldValue : [fieldValue];
              
              // Clear existing selections
              Array.from(select.options).forEach(option => {
                option.selected = false;
              });

              // Set new selections
              values.forEach(value => {
                const option = Array.from(select.options).find(opt => 
                  opt.value === String(value) || opt.text === String(value)
                );
                if (option) {
                  option.selected = true;
                }
              });

              select.dispatchEvent(new Event('change', { bubbles: true }));
            } else {
              errors.push(`Unsupported field type: ${field.tagName} for field ${fieldName}`);
              return;
            }

            filledFields.push(fieldName);
          } catch (error) {
            errors.push(`Error filling field ${fieldName}: ${error instanceof Error ? error.message : String(error)}`);
          }
        });

        // Validate required fields if requested
        if (opts.validateRequired) {
          const requiredFields = form.querySelectorAll('[required]');
          requiredFields.forEach(field => {
            const fieldElement = field as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
            if (!fieldElement.value && fieldElement.name) {
              errors.push(`Required field is empty: ${fieldElement.name}`);
            }
          });
        }

        return { filledFields, errors };
      }, formSelector, formData, fillOptions);

      // Check for errors
      if (result.errors.length > 0) {
        throw new Error(`Form filling errors: ${result.errors.join(', ')}`);
      }

      const duration = Date.now() - startTime;

      this.logger(`Form filled successfully: ${result.filledFields.length} fields in ${duration}ms`, 'info');

      // Submit form if requested
      if (fillOptions.submitAfter) {
        await this.submitForm(formSelector);
      }

      return {
        success: true,
        selector: formSelector,
        duration,
        action: 'fillForm',
        data: { filledFields: result.filledFields }
      };
    } catch (error) {
      this.logger(`Failed to fill form ${formSelector}: ${error instanceof Error ? error.message : String(error)}`, 'error');

      throw new TaskError(
        ErrorCode.BROWSER_ERROR,
        `Failed to fill form ${formSelector}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Submit a form
   */
  async submitForm(formSelector: string, options: WaitOptions = {}): Promise<InteractionResult> {
    try {
      this.logger(`Submitting form: ${formSelector}`, 'info');

      const startTime = Date.now();

      // Set default options
      const submitOptions = {
        timeout: options.timeout || 30000,
        ...options
      };

      // Wait for form to be available
      await this.waitForElement(formSelector, { timeout: submitOptions.timeout, visible: true });

      // Submit the form using page evaluation
      await this.page.evaluate((formSel: string) => {
        const form = document.querySelector(formSel);
        if (!form) {
          throw new Error(`Form not found: ${formSel}`);
        }

        if (form.tagName !== 'FORM') {
          throw new Error(`Element is not a form: ${formSel}`);
        }

        const formElement = form as HTMLFormElement;
        
        // Try to find and click submit button first
        const submitButton = formElement.querySelector('input[type="submit"], button[type="submit"], button:not([type])');
        
        if (submitButton) {
          (submitButton as HTMLElement).click();
        } else {
          // Fallback to form.submit()
          formElement.submit();
        }
      }, formSelector);

      const duration = Date.now() - startTime;

      this.logger(`Form submitted successfully in ${duration}ms`, 'info');

      return {
        success: true,
        selector: formSelector,
        duration,
        action: 'submitForm'
      };
    } catch (error) {
      this.logger(`Failed to submit form ${formSelector}: ${error instanceof Error ? error.message : String(error)}`, 'error');

      throw new TaskError(
        ErrorCode.BROWSER_ERROR,
        `Failed to submit form ${formSelector}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Reset a form to its default values
   */
  async resetForm(formSelector: string, options: WaitOptions = {}): Promise<InteractionResult> {
    try {
      this.logger(`Resetting form: ${formSelector}`, 'info');

      const startTime = Date.now();

      // Set default options
      const resetOptions = {
        timeout: options.timeout || 30000,
        ...options
      };

      // Wait for form to be available
      await this.waitForElement(formSelector, { timeout: resetOptions.timeout, visible: true });

      // Reset the form using page evaluation
      await this.page.evaluate((formSel: string) => {
        const form = document.querySelector(formSel);
        if (!form) {
          throw new Error(`Form not found: ${formSel}`);
        }

        if (form.tagName !== 'FORM') {
          throw new Error(`Element is not a form: ${formSel}`);
        }

        const formElement = form as HTMLFormElement;
        formElement.reset();
        
        // Trigger change events on all form elements
        const formElements = formElement.querySelectorAll('input, textarea, select');
        formElements.forEach(element => {
          element.dispatchEvent(new Event('change', { bubbles: true }));
        });
      }, formSelector);

      const duration = Date.now() - startTime;

      this.logger(`Form reset successfully in ${duration}ms`, 'info');

      return {
        success: true,
        selector: formSelector,
        duration,
        action: 'resetForm'
      };
    } catch (error) {
      this.logger(`Failed to reset form ${formSelector}: ${error instanceof Error ? error.message : String(error)}`, 'error');

      throw new TaskError(
        ErrorCode.BROWSER_ERROR,
        `Failed to reset form ${formSelector}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  // ============================================================================
  // FORM VALIDATION METHODS
  // ============================================================================

  /**
   * Validate a form
   */
  async validateForm(formSelector: string, options: WaitOptions = {}): Promise<{
    valid: boolean;
    errors: Array<{ field: string; message: string }>;
  }> {
    try {
      this.logger(`Validating form: ${formSelector}`, 'info');

      // Set default options
      const validateOptions = {
        timeout: options.timeout || 30000,
        ...options
      };

      // Wait for form to be available
      await this.waitForElement(formSelector, { timeout: validateOptions.timeout, visible: true });

      // Validate the form using page evaluation
      const validation = await this.page.evaluate<{valid: boolean; errors: Array<{field: string; message: string}>}>((formSel: string) => {
        const form = document.querySelector(formSel);
        if (!form) {
          throw new Error(`Form not found: ${formSel}`);
        }

        if (form.tagName !== 'FORM') {
          throw new Error(`Element is not a form: ${formSel}`);
        }

        const formElement = form as HTMLFormElement;
        const errors: Array<{ field: string; message: string }> = [];

        // Check HTML5 validation
        const isValid = formElement.checkValidity();
        
        if (!isValid) {
          // Get validation errors for each field
          const formElements = formElement.querySelectorAll('input, textarea, select');
          formElements.forEach(element => {
            const fieldElement = element as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
            
            if (!fieldElement.checkValidity()) {
              errors.push({
                field: fieldElement.name || fieldElement.id || 'unknown',
                message: fieldElement.validationMessage
              });
            }
          });
        }

        return { valid: isValid, errors };
      }, formSelector);

      this.logger(`Form validation completed: ${validation.valid ? 'valid' : 'invalid'}`, 'info');

      return validation;
    } catch (error) {
      this.logger(`Failed to validate form ${formSelector}: ${error instanceof Error ? error.message : String(error)}`, 'error');

      throw new TaskError(
        ErrorCode.BROWSER_ERROR,
        `Failed to validate form ${formSelector}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  // ============================================================================
  // FORM FIELD METHODS
  // ============================================================================

  /**
   * Get all form fields and their current values
   */
  async getFormFields(formSelector: string, options: WaitOptions = {}): Promise<Record<string, any>> {
    try {
      this.logger(`Getting form fields from: ${formSelector}`, 'info');

      // Set default options
      const getOptions = {
        timeout: options.timeout || 30000,
        ...options
      };

      // Wait for form to be available
      await this.waitForElement(formSelector, { timeout: getOptions.timeout, visible: true });

      // Get form fields using page evaluation
      const fields = await this.page.evaluate<Record<string, any>>((formSel: string) => {
        const form = document.querySelector(formSel);
        if (!form) {
          throw new Error(`Form not found: ${formSel}`);
        }

        if (form.tagName !== 'FORM') {
          throw new Error(`Element is not a form: ${formSel}`);
        }

        const formElement = form as HTMLFormElement;
        const fields: Record<string, any> = {};

        // Get all form elements
        const formElements = formElement.querySelectorAll('input, textarea, select');
        
        formElements.forEach(element => {
          const fieldElement = element as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
          const name = fieldElement.name || fieldElement.id;
          
          if (!name) return;

          if (fieldElement.tagName === 'INPUT') {
            const input = fieldElement as HTMLInputElement;
            
            switch (input.type.toLowerCase()) {
              case 'checkbox':
              case 'radio':
                if (input.checked) {
                  if (fields[name]) {
                    // Handle multiple values (like radio groups)
                    if (Array.isArray(fields[name])) {
                      fields[name].push(input.value);
                    } else {
                      fields[name] = [fields[name], input.value];
                    }
                  } else {
                    fields[name] = input.value;
                  }
                }
                break;
              default:
                fields[name] = input.value;
            }
          } else if (fieldElement.tagName === 'TEXTAREA') {
            fields[name] = (fieldElement as HTMLTextAreaElement).value;
          } else if (fieldElement.tagName === 'SELECT') {
            const select = fieldElement as HTMLSelectElement;
            if (select.multiple) {
              fields[name] = Array.from(select.selectedOptions).map(option => option.value);
            } else {
              fields[name] = select.value;
            }
          }
        });

        return fields;
      }, formSelector);

      this.logger(`Form fields retrieved: ${Object.keys(fields).length} fields`, 'info');

      return fields;
    } catch (error) {
      this.logger(`Failed to get form fields from ${formSelector}: ${error instanceof Error ? error.message : String(error)}`, 'error');

      throw new TaskError(
        ErrorCode.BROWSER_ERROR,
        `Failed to get form fields from ${formSelector}: ${error instanceof Error ? error.message : String(error)}`
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
        const exists = await this.page.evaluate((sel: string, opts: any) => {
          const element = document.querySelector(sel);
          if (!element) return false;

          // Check visibility if required
          if (opts.visible) {
            const rect = element.getBoundingClientRect();
            const style = window.getComputedStyle(element);
            
            const visible = rect.width > 0 && rect.height > 0 && 
                           style.visibility !== 'hidden' && 
                           style.display !== 'none';

            return visible;
          }

          return true;
        }, selector, options);

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
 * Create a browser form API
 */
export function createBrowserFormAPI(
  page: TaskPage,
  logger?: (message: string, level?: string) => void
): BrowserFormAPI {
  return new BrowserFormAPI(page, logger);
}