export class ErrorHandler {
  static handle(error: Error, context?: string): void {
    console.error(`[${context || 'Unknown'}] Error:`, error.message);
    console.error('Stack:', error.stack);
  }

  static async handleAsync<T>(
    operation: () => Promise<T>,
    context?: string
  ): Promise<T | null> {
    try {
      return await operation();
    } catch (error) {
      ErrorHandler.handle(error as Error, context);
      return null;
    }
  }

  static handleSync<T>(
    operation: () => T,
    context?: string
  ): T | null {
    try {
      return operation();
    } catch (error) {
      ErrorHandler.handle(error as Error, context);
      return null;
    }
  }
}

export class ValidationError extends Error {
  constructor(message: string, public field?: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class BrowserError extends Error {
  constructor(message: string, public browserId?: string) {
    super(message);
    this.name = 'BrowserError';
  }
}

export class TaskError extends Error {
  constructor(message: string, public taskId?: string) {
    super(message);
    this.name = 'TaskError';
  }
}

export class DatabaseError extends Error {
  constructor(message: string, public operation?: string) {
    super(message);
    this.name = 'DatabaseError';
  }
}

export function isValidBrowserConfig(config: any): boolean {
  return (
    config &&
    typeof config.name === 'string' &&
    config.name.trim().length > 0 &&
    typeof config.platform === 'string' &&
    ['local', 'adspower', 'bitbrowser'].includes(config.platform)
  );
}

export function validateBrowserConfig(config: any): void {
  if (!isValidBrowserConfig(config)) {
    throw new ValidationError('Invalid browser configuration');
  }
}

export function createSafeProxy<T extends object>(target: T): T {
  return new Proxy(target, {
    get(obj, prop) {
      try {
        return obj[prop as keyof T];
      } catch (error) {
        ErrorHandler.handle(error as Error, `Proxy access to ${String(prop)}`);
        return undefined;
      }
    },
    set(obj, prop, value) {
      try {
        obj[prop as keyof T] = value;
        return true;
      } catch (error) {
        ErrorHandler.handle(error as Error, `Proxy set ${String(prop)}`);
        return false;
      }
    }
  });
}

export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage: string = 'Operation timed out'
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(errorMessage)), timeoutMs);
    })
  ]);
}

export function retry<T>(
  operation: () => Promise<T>,
  maxAttempts: number = 3,
  delayMs: number = 1000
): Promise<T> {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    
    const tryOperation = async () => {
      try {
        attempts++;
        const result = await operation();
        resolve(result);
      } catch (error) {
        if (attempts >= maxAttempts) {
          reject(error);
        } else {
          setTimeout(tryOperation, delayMs * attempts);
        }
      }
    };
    
    tryOperation();
  });
}