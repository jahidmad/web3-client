export * from './logger';
export * from './error-handler';

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15);
}

export function formatDate(date: Date): string {
  return date.toISOString().replace('T', ' ').substring(0, 19);
}

export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

export function sanitizeString(str: string): string {
  return str.replace(/[^\w\s-]/gi, '').trim();
}

export function parseJSON<T>(jsonString: string, fallback: T): T {
  try {
    return JSON.parse(jsonString);
  } catch {
    return fallback;
  }
}

export function debounce<T extends (...args: any[]) => any>(
  func: T,
  waitMs: number
): T {
  let timeout: NodeJS.Timeout;
  
  return ((...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), waitMs);
  }) as T;
}

export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limitMs: number
): T {
  let inThrottle: boolean;
  
  return ((...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limitMs);
    }
  }) as T;
}

export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  
  if (obj instanceof Date) {
    return new Date(obj.getTime()) as T;
  }
  
  if (obj instanceof Array) {
    return obj.map(item => deepClone(item)) as T;
  }
  
  if (typeof obj === 'object') {
    const cloned = {} as T;
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        cloned[key] = deepClone(obj[key]);
      }
    }
    return cloned;
  }
  
  return obj;
}

export function createRetryableOperation<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  backoffMs: number = 1000
) {
  return async (): Promise<T> => {
    let lastError: Error;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt === maxRetries) {
          throw lastError;
        }
        
        await sleep(backoffMs * Math.pow(2, attempt));
      }
    }
    
    throw lastError!;
  };
}