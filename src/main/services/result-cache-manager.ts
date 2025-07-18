/**
 * Result Cache Manager
 * 
 * This service manages the caching of task execution results.
 * It provides functionality for storing, retrieving, and cleaning up execution results
 * to improve performance and reduce redundant task executions.
 */

import * as path from 'path';
import * as fs from 'fs/promises';
import { Logger } from '../utils/logger';

/**
 * Cache statistics
 */
export interface ResultCacheStats {
  totalEntries: number;
  totalSize: number;
  expiredEntries: number;
  hitRate: number;
  missRate: number;
  averageAccessCount: number;
}

/**
 * Result Cache Manager - Service for caching task execution results
 */
export class ResultCacheManager {
  private logger: Logger;
  private cacheDir: string;
  private cache: Map<string, any> = new Map();
  
  /**
   * Create a new Result Cache Manager
   */
  constructor() {
    this.logger = new Logger('ResultCacheManager');
    this.cacheDir = path.join(process.cwd(), 'data', 'result-cache');
  }
  
  /**
   * Initialize the cache manager
   */
  async initialize(): Promise<void> {
    try {
      // Create the cache directory if it doesn't exist
      await fs.mkdir(this.cacheDir, { recursive: true });
      this.logger.info('Result cache manager initialized');
    } catch (error) {
      this.logger.error('Failed to initialize result cache manager:', error);
    }
  }
  
  /**
   * Get a cached execution result
   */
  async getCachedResult(taskId: string, parameters: Record<string, any>): Promise<any | null> {
    const cacheKey = this.getCacheKey(taskId, parameters);
    return this.cache.get(cacheKey) || null;
  }
  
  /**
   * Cache an execution
   */
  async cacheExecution(execution: any): Promise<void> {
    if (!execution || !execution.result || !execution.taskId) {
      return;
    }
    
    try {
      const cacheKey = this.getCacheKey(execution.taskId, execution.parameters || {});
      this.cache.set(cacheKey, execution.result);
      this.logger.info(`Cached result for task ${execution.taskId}`);
    } catch (error) {
      this.logger.error(`Failed to cache execution result:`, error);
    }
  }
  
  /**
   * Clear result cache for a task
   */
  async clearTaskCache(taskId: string): Promise<void> {
    // Find and remove all entries for this task
    for (const [key, _] of this.cache.entries()) {
      if (key.startsWith(`${taskId}:`)) {
        this.cache.delete(key);
      }
    }
    this.logger.info(`Cleared cache for task ${taskId}`);
  }
  
  /**
   * Clean up the result cache
   */
  async cleanupCache(): Promise<void> {
    this.cache.clear();
    this.logger.info('Result cache cleaned up');
  }
  
  /**
   * Get cache statistics
   */
  getCacheStats(): ResultCacheStats {
    return {
      totalEntries: this.cache.size,
      totalSize: 0,
      expiredEntries: 0,
      hitRate: 0,
      missRate: 0,
      averageAccessCount: 0
    };
  }
  
  /**
   * Get the cache key for a task and parameters
   */
  private getCacheKey(taskId: string, parameters: Record<string, any>): string {
    // Create a stable representation of the parameters
    const paramString = JSON.stringify(parameters);
    
    // Create a simple hash
    let hash = 0;
    for (let i = 0; i < paramString.length; i++) {
      const char = paramString.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    
    return `${taskId}:${hash}`;
  }
}