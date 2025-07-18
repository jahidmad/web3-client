/**
 * Browser Element Interaction API
 * 
 * This module implements the browser element interaction API for plugin tasks,
 * providing methods for clicking, typing, selecting, and other element interactions.
 */

import { TaskPage } from '../engines/task-execution-engine';
import { 
  ClickOptions, 
  TypeOptions, 
  WaitOptions, 
  SelectOptions,
  ElementInfo,
  InteractionResult 
} from '../types/plugin-task-system';
import { TaskError, ErrorCode } from '../types/plugin-task-system';

/**
 * Browser Element Interaction API implementation
 */
export class BrowserElementAPI {
  private page: TaskPage;
  private logger: (message: string, level?: string) => void;

  /**
   * Create a new Browser Element API
   */
  constructor(page: TaskPage, logger?: (message: string, level?: string) => void) {
    this.page = page;
    this.logger = logger || ((message: string) => console.log(message));
  }

  // ============================================================================
  // ELEMENT INTERACTION METHODS
  // ============================================================================

  /**
   * Click on an element
   */
  async click(selector: string, options: ClickOptions = {}): Promise<InteractionResult> {
    try {
      this.logger(`Clicking element: ${selector}`, 'info');

      const startTime = Date.now();

      // Set default options
      const clickOptions = {
        button: options.button || 'left',
        clickCount: options.clickCount || 1,
        delay: options.delay || 0,
        force: options.force || false,
        timeout: options.timeout || 30000,
        ...options
      };

      // Wait for element to be available if not forcing
      if (!clickOptions.force) {
        await this.waitForElement(selector, { timeout: clickOptions.timeout, visible: true });
      }

      // Perform the click using page evaluation
      await this.page.evaluate((sel: string, opts: any) => {
        const element = document.querySelector(sel);
        if (!element) {
          throw new Error(`Element not found: ${sel}`);
        }

        // Check if element is visible (unless forcing)
        if (!opts.force) {
          const rect = element.getBoundingClientRect();
          const style = window.getComputedStyle(element);
          
          if (rect.width === 0 || rect.height === 0 || 
              style.visibility === 'hidden' || 
              style.display === 'none') {
            throw new Error(`Element is not visible: ${sel}`);
          }
        }

        // Create and dispatch click events
        for (let i = 0; i < opts.clickCount; i++) {
          const event = new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            button: opts.button === 'left' ? 0 : opts.button === 'right' ? 2 : 1
          });
          
          element.dispatchEvent(event);
          
          // Add delay between clicks if specified
          if (i < opts.clickCount - 1 && opts.delay > 0) {
            return new Promise(resolve => setTimeout(resolve, opts.delay));
          }
        }
      }, selector, clickOptions);

      const duration = Date.now() - startTime;

      this.logger(`Click completed on ${selector} in ${duration}ms`, 'info');

      return {
        success: true,
        selector,
        duration,
        action: 'click'
      };
    } catch (error) {
      this.logger(`Click failed on ${selector}: ${error instanceof Error ? error.message : String(error)}`, 'error');

      throw new TaskError(
        ErrorCode.BROWSER_ERROR,
        `Failed to click element ${selector}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Type text into an element
   */
  async type(selector: string, text: string, options: TypeOptions = {}): Promise<InteractionResult> {
    try {
      this.logger(`Typing into element: ${selector}`, 'info');

      const startTime = Date.now();

      // Set default options
      const typeOptions = {
        delay: options.delay || 0,
        clear: options.clear !== false, // Default to true
        timeout: options.timeout || 30000,
        ...options
      };

      // Wait for element to be available
      await this.waitForElement(selector, { timeout: typeOptions.timeout, visible: true });

      // Perform the typing using page evaluation
      await this.page.evaluate((sel: string, txt: string, opts: any) => {
        const element = document.querySelector(sel) as HTMLInputElement | HTMLTextAreaElement;
        if (!element) {
          throw new Error(`Element not found: ${sel}`);
        }

        // Check if element is an input or textarea
        if (!['INPUT', 'TEXTAREA'].includes(element.tagName) && !element.isContentEditable) {
          throw new Error(`Element is not typeable: ${sel}`);
        }

        // Clear existing content if requested
        if (opts.clear) {
          if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
            element.value = '';
          } else if (element.isContentEditable) {
            element.textContent = '';
          }
        }

        // Focus the element
        element.focus();

        // Type the text character by character with delay
        return new Promise<void>((resolve) => {
          let index = 0;
          
          const typeChar = () => {
            if (index >= txt.length) {
              // Trigger input and change events
              element.dispatchEvent(new Event('input', { bubbles: true }));
              element.dispatchEvent(new Event('change', { bubbles: true }));
              resolve();
              return;
            }

            const char = txt[index];
            
            if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
              element.value += char;
            } else if (element.isContentEditable) {
              element.textContent += char;
            }

            // Trigger keydown, keypress, keyup events
            ['keydown', 'keypress', 'keyup'].forEach(eventType => {
              const event = new KeyboardEvent(eventType, {
                key: char,
                code: `Key${char.toUpperCase()}`,
                bubbles: true
              });
              element.dispatchEvent(event);
            });

            index++;
            
            if (opts.delay > 0) {
              setTimeout(typeChar, opts.delay);
            } else {
              typeChar();
            }
          };

          typeChar();
        });
      }, selector, text, typeOptions);

      const duration = Date.now() - startTime;

      this.logger(`Typing completed on ${selector} in ${duration}ms`, 'info');

      return {
        success: true,
        selector,
        duration,
        action: 'type',
        data: { text }
      };
    } catch (error) {
      this.logger(`Typing failed on ${selector}: ${error instanceof Error ? error.message : String(error)}`, 'error');

      throw new TaskError(
        ErrorCode.BROWSER_ERROR,
        `Failed to type into element ${selector}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Select option(s) from a select element
   */
  async select(selector: string, value: string | string[], options: SelectOptions = {}): Promise<InteractionResult> {
    try {
      this.logger(`Selecting option in element: ${selector}`, 'info');

      const startTime = Date.now();

      // Set default options
      const selectOptions = {
        timeout: options.timeout || 30000,
        ...options
      };

      // Wait for element to be available
      await this.waitForElement(selector, { timeout: selectOptions.timeout, visible: true });

      // Perform the selection using page evaluation
      const selectedValues = await this.page.evaluate((sel: string, val: string | string[], opts: any) => {
        const element = document.querySelector(sel) as HTMLSelectElement;
        if (!element) {
          throw new Error(`Element not found: ${sel}`);
        }

        if (element.tagName !== 'SELECT') {
          throw new Error(`Element is not a select: ${sel}`);
        }

        const values = Array.isArray(val) ? val : [val];
        const selectedValues: string[] = [];

        // Clear existing selections if not multiple
        if (!element.multiple) {
          element.selectedIndex = -1;
        } else {
          // Clear all selections for multiple select
          Array.from(element.options).forEach(option => {
            option.selected = false;
          });
        }

        // Select the specified values
        values.forEach(value => {
          let found = false;
          
          Array.from(element.options).forEach(option => {
            if (option.value === value || option.text === value) {
              option.selected = true;
              selectedValues.push(option.value);
              found = true;
              
              // For single select, break after first match
              if (!element.multiple) {
                return;
              }
            }
          });

          if (!found) {
            throw new Error(`Option not found: ${value}`);
          }
        });

        // Trigger change event
        element.dispatchEvent(new Event('change', { bubbles: true }));

        return selectedValues;
      }, selector, value, selectOptions);

      const duration = Date.now() - startTime;

      this.logger(`Selection completed on ${selector} in ${duration}ms`, 'info');

      return {
        success: true,
        selector,
        duration,
        action: 'select',
        data: { selectedValues }
      };
    } catch (error) {
      this.logger(`Selection failed on ${selector}: ${error instanceof Error ? error.message : String(error)}`, 'error');

      throw new TaskError(
        ErrorCode.BROWSER_ERROR,
        `Failed to select option in element ${selector}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Check or uncheck a checkbox or radio button
   */
  async check(selector: string, checked: boolean = true, options: ClickOptions = {}): Promise<InteractionResult> {
    try {
      this.logger(`${checked ? 'Checking' : 'Unchecking'} element: ${selector}`, 'info');

      const startTime = Date.now();

      // Set default options
      const checkOptions = {
        timeout: options.timeout || 30000,
        ...options
      };

      // Wait for element to be available
      await this.waitForElement(selector, { timeout: checkOptions.timeout, visible: true });

      // Perform the check/uncheck using page evaluation
      await this.page.evaluate((sel: string, isChecked: boolean, opts: any) => {
        const element = document.querySelector(sel) as HTMLInputElement;
        if (!element) {
          throw new Error(`Element not found: ${sel}`);
        }

        if (element.tagName !== 'INPUT' || !['checkbox', 'radio'].includes(element.type)) {
          throw new Error(`Element is not a checkbox or radio button: ${sel}`);
        }

        // Only change if current state is different
        if (element.checked !== isChecked) {
          element.checked = isChecked;
          
          // Trigger change event
          element.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }, selector, checked, checkOptions);

      const duration = Date.now() - startTime;

      this.logger(`${checked ? 'Check' : 'Uncheck'} completed on ${selector} in ${duration}ms`, 'info');

      return {
        success: true,
        selector,
        duration,
        action: checked ? 'check' : 'uncheck'
      };
    } catch (error) {
      this.logger(`${checked ? 'Check' : 'Uncheck'} failed on ${selector}: ${error instanceof Error ? error.message : String(error)}`, 'error');

      throw new TaskError(
        ErrorCode.BROWSER_ERROR,
        `Failed to ${checked ? 'check' : 'uncheck'} element ${selector}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Focus on an element
   */
  async focus(selector: string, options: WaitOptions = {}): Promise<InteractionResult> {
    try {
      this.logger(`Focusing element: ${selector}`, 'info');

      const startTime = Date.now();

      // Set default options
      const focusOptions = {
        timeout: options.timeout || 30000,
        ...options
      };

      // Wait for element to be available
      await this.waitForElement(selector, { timeout: focusOptions.timeout, visible: true });

      // Focus the element using page evaluation
      await this.page.evaluate((sel: string) => {
        const element = document.querySelector(sel) as HTMLElement;
        if (!element) {
          throw new Error(`Element not found: ${sel}`);
        }

        element.focus();
        
        // Trigger focus event
        element.dispatchEvent(new Event('focus', { bubbles: true }));
      }, selector);

      const duration = Date.now() - startTime;

      this.logger(`Focus completed on ${selector} in ${duration}ms`, 'info');

      return {
        success: true,
        selector,
        duration,
        action: 'focus'
      };
    } catch (error) {
      this.logger(`Focus failed on ${selector}: ${error instanceof Error ? error.message : String(error)}`, 'error');

      throw new TaskError(
        ErrorCode.BROWSER_ERROR,
        `Failed to focus element ${selector}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Blur (remove focus from) an element
   */
  async blur(selector: string, options: WaitOptions = {}): Promise<InteractionResult> {
    try {
      this.logger(`Blurring element: ${selector}`, 'info');

      const startTime = Date.now();

      // Set default options
      const blurOptions = {
        timeout: options.timeout || 30000,
        ...options
      };

      // Wait for element to be available
      await this.waitForElement(selector, { timeout: blurOptions.timeout });

      // Blur the element using page evaluation
      await this.page.evaluate((sel: string) => {
        const element = document.querySelector(sel) as HTMLElement;
        if (!element) {
          throw new Error(`Element not found: ${sel}`);
        }

        element.blur();
        
        // Trigger blur event
        element.dispatchEvent(new Event('blur', { bubbles: true }));
      }, selector);

      const duration = Date.now() - startTime;

      this.logger(`Blur completed on ${selector} in ${duration}ms`, 'info');

      return {
        success: true,
        selector,
        duration,
        action: 'blur'
      };
    } catch (error) {
      this.logger(`Blur failed on ${selector}: ${error instanceof Error ? error.message : String(error)}`, 'error');

      throw new TaskError(
        ErrorCode.BROWSER_ERROR,
        `Failed to blur element ${selector}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  // ============================================================================
  // ELEMENT WAITING METHODS
  // ============================================================================

  /**
   * Wait for an element to appear
   */
  async waitForElement(selector: string, options: WaitOptions = {}): Promise<ElementInfo> {
    try {
      this.logger(`Waiting for element: ${selector}`, 'info');

      const startTime = Date.now();

      // Set default options
      const waitOptions = {
        timeout: options.timeout || 30000,
        visible: options.visible !== false, // Default to true
        hidden: options.hidden || false,
        ...options
      };

      // Wait for the element using polling
      const element = await this.pollForElement(selector, waitOptions);

      const duration = Date.now() - startTime;

      this.logger(`Element found: ${selector} in ${duration}ms`, 'info');

      return {
        selector,
        found: true,
        visible: element.visible,
        duration
      };
    } catch (error) {
      this.logger(`Wait for element failed: ${selector}: ${error instanceof Error ? error.message : String(error)}`, 'error');

      throw new TaskError(
        ErrorCode.BROWSER_ERROR,
        `Failed to wait for element ${selector}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Wait for text to appear on the page
   */
  async waitForText(text: string, options: WaitOptions = {}): Promise<ElementInfo> {
    try {
      this.logger(`Waiting for text: "${text}"`, 'info');

      const startTime = Date.now();

      // Set default options
      const waitOptions = {
        timeout: options.timeout || 30000,
        ...options
      };

      // Wait for the text using polling
      await this.pollForCondition(
        () => this.page.evaluate((txt: string) => {
          return document.body.textContent?.includes(txt) || false;
        }, text),
        waitOptions.timeout,
        100 // Poll every 100ms
      );

      const duration = Date.now() - startTime;

      this.logger(`Text found: "${text}" in ${duration}ms`, 'info');

      return {
        selector: `text:"${text}"`,
        found: true,
        visible: true,
        duration
      };
    } catch (error) {
      this.logger(`Wait for text failed: "${text}": ${error instanceof Error ? error.message : String(error)}`, 'error');

      throw new TaskError(
        ErrorCode.BROWSER_ERROR,
        `Failed to wait for text "${text}": ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  /**
   * Poll for an element with specific conditions
   */
  private async pollForElement(selector: string, options: WaitOptions): Promise<{ visible: boolean }> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      const timeout = options.timeout || 30000;

      const poll = async () => {
        try {
          const elementInfo = await this.page.evaluate((sel: string) => {
            const element = document.querySelector(sel);
            if (!element) {
              return { exists: false, visible: false };
            }

            const rect = element.getBoundingClientRect();
            const style = window.getComputedStyle(element);
            
            const visible = rect.width > 0 && rect.height > 0 && 
                           style.visibility !== 'hidden' && 
                           style.display !== 'none';

            return { exists: true, visible };
          }, selector) as { exists: boolean; visible: boolean };

          // Check if conditions are met
          if (elementInfo.exists) {
            if (options.hidden && !elementInfo.visible) {
              resolve({ visible: false });
              return;
            }
            
            if (!options.hidden && (!options.visible || elementInfo.visible)) {
              resolve({ visible: elementInfo.visible });
              return;
            }
          }

          // Check timeout
          if (Date.now() - startTime >= timeout) {
            reject(new Error(`Timeout waiting for element: ${selector}`));
            return;
          }

          // Continue polling
          setTimeout(poll, 100);
        } catch (error) {
          reject(error);
        }
      };

      poll();
    });
  }

  /**
   * Poll for a condition to be true
   */
  private async pollForCondition(
    condition: () => Promise<boolean>,
    timeout: number,
    interval: number = 100
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();

      const poll = async () => {
        try {
          const result = await condition();
          
          if (result) {
            resolve();
            return;
          }

          // Check timeout
          if (Date.now() - startTime >= timeout) {
            reject(new Error('Timeout waiting for condition'));
            return;
          }

          // Continue polling
          setTimeout(poll, interval);
        } catch (error) {
          reject(error);
        }
      };

      poll();
    });
  }
}

/**
 * Create a browser element API
 */
export function createBrowserElementAPI(
  page: TaskPage,
  logger?: (message: string, level?: string) => void
): BrowserElementAPI {
  return new BrowserElementAPI(page, logger);
}